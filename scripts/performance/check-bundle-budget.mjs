#!/usr/bin/env node

/**
 * Measure the client-facing part of a fresh Astro output.
 *
 * This deliberately uses only Node's standard library so the check can run
 * after a production build, before Wrangler, and in a clean checkout. The
 * Cloudflare worker bundle under `_worker.js` is server code and is not part
 * of a browser route's transfer budget.
 */

import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const KIB = 1024;

/**
 * `KB` in this report means KiB (1024 bytes). The client budgets are binary
 * so they remain stable across tools and operating systems.
 */
export const BUDGETS = Object.freeze({
  publicRouteJsAimGzipBytes: 100 * KIB,
  publicRouteJsHardGzipBytes: 150 * KIB,
  singleJsHardGzipBytes: 500 * KIB,
  mobileInitialTransferAimBytes: 1_000 * KIB,
  viewportImageAimBytes: 350 * KIB,
});

const JS_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".mjs", ".cjs"]);
const BROTLI_OPTIONS = {
  // Quality 4 is quick enough for a local/CI gate and is representative of
  // a CDN's compressed transfer. The raw and gzip columns remain the hard
  // decision inputs for portability.
  params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
};

function walkFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files;
}

function toPosix(path) {
  return path.split(sep).join("/");
}

function relativeAssetPath(root, path) {
  return toPosix(relative(root, path));
}

function isWithinRoot(root, path) {
  const rootPath = resolve(root);
  const candidate = resolve(path);
  return candidate === rootPath || candidate.startsWith(`${rootPath}${sep}`);
}

function assetReferenceToPath(root, sourceFile, reference) {
  const cleanReference = reference.split(/[?#]/, 1)[0];
  if (!cleanReference || cleanReference.startsWith("data:")) return null;
  const path = cleanReference.startsWith("/")
    ? join(root, cleanReference.slice(1))
    : join(dirname(sourceFile), cleanReference);
  const resolvedPath = resolve(path);
  if (!isWithinRoot(root, resolvedPath) || !existsSync(resolvedPath)) return null;
  return statSync(resolvedPath).isFile() ? resolvedPath : null;
}

function assetReferences(markup, tagName, attributeName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*\\b${attributeName}=["']([^"']+)["'][^>]*>`, "gi");
  return [...markup.matchAll(pattern)].map((match) => match[1]);
}

function scriptImports(source) {
  const references = new Set();
  // Static imports are initial-route bytes. Dynamic imports are intentionally
  // excluded: they are optional interaction chunks and have their own
  // single-file 500 KiB hard ceiling.
  const pattern =
    /(?:\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?)["']([^"']+\.(?:m?js|cjs))(?:\?[^"']*)?["']/g;
  for (const match of source.matchAll(pattern)) references.add(match[1]);
  return references;
}

function isClientJavaScript(root, path, explicitClientPaths) {
  const relativePath = relativeAssetPath(root, path);
  const isKnownClientDirectory =
    relativePath.startsWith("_astro/") || relativePath.startsWith("assets/");
  return isKnownClientDirectory || explicitClientPaths.has(resolve(path));
}

function readStaticEntries(root, files) {
  const entries = new Map();
  const explicitClientPaths = new Set();
  const routeTransferPaths = new Map();
  for (const file of files) {
    if (extname(file).toLowerCase() !== ".html") continue;
    const markup = readFileSync(file, "utf8");
    const javascript = assetReferences(markup, "script", "src")
      .map((reference) => assetReferenceToPath(root, file, reference))
      .filter((path) => path && JS_EXTENSIONS.has(extname(path).toLowerCase()));
    const transferPaths = ["link", "img", "source"]
      .flatMap((tagName) => assetReferences(markup, tagName, tagName === "link" ? "href" : "src"))
      .map((reference) => assetReferenceToPath(root, file, reference))
      .filter(Boolean);
    const route =
      `/${relativeAssetPath(root, file)
        .replace(/(?:^|\/)index\.html$/, "")
        .replace(/index\.html$/, "")}`
        .replace(/\/+/g, "/")
        .replace(/\/$/, "") || "/";
    if (javascript.length > 0) {
      entries.set(route, javascript);
      routeTransferPaths.set(route, transferPaths);
      for (const path of javascript) explicitClientPaths.add(resolve(path));
    }
  }
  return { entries, explicitClientPaths, routeTransferPaths };
}

function collectJavaScriptFromValue(value, output) {
  if (typeof value === "string") {
    if (/\.(?:m?js|cjs)(?:[?#].*)?$/i.test(value)) output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJavaScriptFromValue(item, output);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectJavaScriptFromValue(item, output);
  }
}

function readJsonManifestEntries(root, files) {
  const entries = new Map();
  for (const file of files) {
    if (file.endsWith("/manifest.json") || file.endsWith(`${sep}manifest.json`)) {
      let parsed;
      try {
        parsed = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        continue;
      }
      const routeMap = parsed?.routes ?? parsed?.entries ?? parsed?.entrypoints;
      if (!routeMap || typeof routeMap !== "object") continue;
      for (const [route, value] of Object.entries(routeMap)) {
        const references = [];
        collectJavaScriptFromValue(value, references);
        const paths = references
          .map((reference) => assetReferenceToPath(root, file, reference))
          .filter((path) => path && JS_EXTENSIONS.has(extname(path).toLowerCase()));
        if (paths.length > 0) entries.set(route.startsWith("/") ? route : `/${route}`, paths);
      }
    }
  }
  return entries;
}

function resolveImport(root, sourceFile, reference) {
  const cleanReference = reference.split(/[?#]/, 1)[0];
  if (!cleanReference || cleanReference.startsWith("http")) return null;
  const path = cleanReference.startsWith("/")
    ? join(root, cleanReference.slice(1))
    : join(dirname(sourceFile), cleanReference);
  const resolvedPath = resolve(path);
  if (!isWithinRoot(root, resolvedPath) || !existsSync(resolvedPath)) return null;
  return statSync(resolvedPath).isFile() ? resolvedPath : null;
}

function collectStaticImportClosure(root, entryPaths) {
  const visited = new Set();
  const visit = (path) => {
    const resolvedPath = resolve(path);
    if (visited.has(resolvedPath) || !existsSync(resolvedPath)) return;
    visited.add(resolvedPath);
    const source = readFileSync(resolvedPath, "utf8");
    for (const reference of scriptImports(source)) {
      const imported = resolveImport(root, resolvedPath, reference);
      if (imported) visit(imported);
    }
  };
  for (const path of entryPaths) visit(path);
  return [...visited];
}

function measureBuffer(buffer) {
  return {
    rawBytes: buffer.byteLength,
    gzipBytes: gzipSync(buffer).byteLength,
    brotliBytes: brotliCompressSync(buffer, BROTLI_OPTIONS).byteLength,
  };
}

export function measureFile(path) {
  return { path, ...measureBuffer(readFileSync(path)) };
}

function sumMeasures(measures) {
  return measures.reduce(
    (sum, measure) => ({
      rawBytes: sum.rawBytes + measure.rawBytes,
      gzipBytes: sum.gzipBytes + measure.gzipBytes,
      brotliBytes: sum.brotliBytes + measure.brotliBytes,
    }),
    { rawBytes: 0, gzipBytes: 0, brotliBytes: 0 },
  );
}

function transferMeasure(path) {
  const extension = extname(path).toLowerCase();
  const buffer = readFileSync(path);
  // Images/fonts are already compressed formats and must be counted at their
  // raw transfer size. Text assets are counted at gzip size for a conservative
  // browser-transfer estimate.
  if (!TEXT_EXTENSIONS.has(extension)) {
    return {
      rawBytes: buffer.byteLength,
      gzipBytes: buffer.byteLength,
      brotliBytes: buffer.byteLength,
    };
  }
  return measureBuffer(buffer);
}

function initialRouteReports(root, entries, routeTransferPaths = new Map()) {
  return [...entries.entries()].map(([route, entryPaths]) => {
    const closure = collectStaticImportClosure(root, entryPaths);
    const measures = closure.map((path) => measureFile(path));
    const transferPaths = new Set(closure);
    for (const path of routeTransferPaths.get(route) ?? []) transferPaths.add(path);
    return {
      route,
      entryPaths,
      paths: closure,
      ...sumMeasures(measures),
      transferBytes: [...transferPaths].reduce(
        (total, path) => total + transferMeasure(path).gzipBytes,
        0,
      ),
    };
  });
}

function clientJavaScriptFiles(root, files, explicitClientPaths) {
  return files.filter(
    (path) =>
      JS_EXTENSIONS.has(extname(path).toLowerCase()) &&
      !relativeAssetPath(root, path).startsWith("_worker.js/") &&
      isClientJavaScript(root, path, explicitClientPaths),
  );
}

export function checkBundleBudget(directory, options = {}) {
  const root = resolve(directory);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Build output directory does not exist: ${root}`);
  }
  const files = walkFiles(root);
  const staticEntries = readStaticEntries(root, files);
  const manifestEntries = readJsonManifestEntries(root, files);
  const entries = new Map([...staticEntries.entries.entries(), ...manifestEntries.entries()]);
  const explicitClientPaths = new Set(staticEntries.explicitClientPaths);
  for (const paths of manifestEntries.values()) {
    for (const path of paths) explicitClientPaths.add(resolve(path));
  }
  const javascript = clientJavaScriptFiles(root, files, explicitClientPaths)
    .map((path) => ({ ...measureFile(path), path: relativeAssetPath(root, path) }))
    .sort((a, b) => b.gzipBytes - a.gzipBytes);
  const oversizedJavaScript = javascript.filter(
    (asset) => asset.gzipBytes > BUDGETS.singleJsHardGzipBytes,
  );
  const routeReports = initialRouteReports(root, entries, staticEntries.routeTransferPaths);
  const routeWarnings = routeReports.filter(
    (route) => route.gzipBytes > BUDGETS.publicRouteJsAimGzipBytes,
  );
  const routeFailures = routeReports.filter(
    (route) => route.gzipBytes > BUDGETS.publicRouteJsHardGzipBytes,
  );
  const images = files
    .filter((path) => IMAGE_EXTENSIONS.has(extname(path).toLowerCase()))
    .map((path) => ({ path: relativeAssetPath(root, path), bytes: statSync(path).size }))
    .sort((a, b) => b.bytes - a.bytes);
  const oversizedImages = images.filter((image) => image.bytes > BUDGETS.viewportImageAimBytes);
  const warnings = [
    ...routeWarnings.map(
      (route) =>
        `Initial route ${route.route} is above the ${formatBytes(BUDGETS.publicRouteJsAimGzipBytes)} gzip aim.`,
    ),
    ...oversizedImages.map(
      (image) =>
        `Image ${image.path} is above the ${formatBytes(BUDGETS.viewportImageAimBytes)} viewport aim.`,
    ),
  ];
  const failures = [
    ...oversizedJavaScript.map(
      (asset) =>
        `JavaScript ${asset.path} is ${formatBytes(asset.gzipBytes)} gzip; hard maximum is ${formatBytes(BUDGETS.singleJsHardGzipBytes)}.`,
    ),
    ...routeFailures.map(
      (route) =>
        `Initial route ${route.route} is ${formatBytes(route.gzipBytes)} gzip; hard maximum is ${formatBytes(BUDGETS.publicRouteJsHardGzipBytes)}.`,
    ),
  ];
  if (options.failImages) {
    failures.push(
      ...oversizedImages.map(
        (image) =>
          `Image ${image.path} is ${formatBytes(image.bytes)} raw; hard image maximum is ${formatBytes(BUDGETS.viewportImageAimBytes)}.`,
      ),
    );
  }
  return {
    root,
    budgets: BUDGETS,
    javascript,
    oversizedJavaScript,
    images,
    oversizedImages,
    routes: routeReports,
    warnings,
    failures,
    hasManifestEntries: entries.size > 0,
  };
}

export function formatBytes(bytes) {
  if (bytes < KIB) return `${bytes} B`;
  return `${(bytes / KIB).toFixed(bytes >= 10 * KIB ? 0 : 1)} KiB`;
}

function printReport(report) {
  console.info(`Performance budget report: ${report.root}`);
  console.info(
    `Budgets: route JS aim ${formatBytes(BUDGETS.publicRouteJsAimGzipBytes)} gzip / hard ${formatBytes(BUDGETS.publicRouteJsHardGzipBytes)}; single JS hard ${formatBytes(BUDGETS.singleJsHardGzipBytes)} gzip; viewport image aim ${formatBytes(BUDGETS.viewportImageAimBytes)} raw.`,
  );
  if (report.javascript.length === 0) {
    console.info(
      "No client JavaScript assets found under _astro/, assets/, or referenced by a static entry.",
    );
  } else {
    console.info("\nClient JavaScript (largest gzip first):");
    for (const asset of report.javascript.slice(0, 20)) {
      console.info(
        `  ${asset.path} — raw ${formatBytes(asset.rawBytes)}, gzip ${formatBytes(asset.gzipBytes)}, brotli ${formatBytes(asset.brotliBytes)}`,
      );
    }
    if (report.javascript.length > 20)
      console.info(`  … ${report.javascript.length - 20} more assets`);
  }
  if (report.routes.length > 0) {
    console.info("\nInitial client entries:");
    for (const route of report.routes) {
      console.info(
        `  ${route.route} — raw ${formatBytes(route.rawBytes)}, gzip ${formatBytes(route.gzipBytes)}, brotli ${formatBytes(route.brotliBytes)}, estimated transfer ${formatBytes(route.transferBytes)}`,
      );
    }
  } else {
    console.info(
      "\nInitial client entries: unavailable (no static HTML or supported JSON route manifest in this output).",
    );
  }
  if (report.oversizedImages.length > 0) {
    console.info(`\nImages above the ${formatBytes(BUDGETS.viewportImageAimBytes)} viewport aim:`);
    for (const image of report.oversizedImages.slice(0, 20)) {
      console.info(`  ${image.path} — raw ${formatBytes(image.bytes)}`);
    }
  }
  for (const warning of report.warnings) console.warn(`⚠ ${warning}`);
  for (const failure of report.failures) console.error(`✗ ${failure}`);
  if (report.failures.length > 0) {
    console.error(
      `\nPerformance budgets: FAIL (${report.failures.length} hard limit${report.failures.length === 1 ? "" : "s"}).`,
    );
  } else {
    console.info("\nPerformance budgets: PASS (no hard limit exceeded).");
  }
}

function parseArgs(args) {
  const options = { directory: "dist/client", json: false, failImages: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dir" || arg === "--directory") {
      options.directory = args[index + 1];
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--strict-images") {
      options.failImages = true;
    } else if (arg === "--help" || arg === "-h") {
      console.info(
        "Usage: node scripts/performance/check-bundle-budget.mjs [--dir dist/client] [--json] [--strict-images]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = checkBundleBudget(options.directory, options);
    if (options.json) {
      console.info(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }
    process.exitCode = report.failures.length > 0 ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
