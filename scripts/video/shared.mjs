import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

export const root = resolve(".");
export const inventoryPath = resolve("creative/video-inventory.json");
export const artifactsRoot = resolve("artifacts/video");

export const canonical = [
  {
    id: "the-plan-landscape",
    campaign: "The Plan",
    composition: "ThePlan-Landscape",
    aspect: "16:9",
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 600,
    safeZoneProfile: "landscape-editorial-v1",
    posterFrame: 420,
    storyboardFrames: [0, 70, 160, 280, 420, 520, 599],
  },
  {
    id: "the-plan-vertical",
    campaign: "The Plan",
    composition: "ThePlan-Vertical",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 480,
    safeZoneProfile: "social-ui-variable-v1",
    posterFrame: 360,
    storyboardFrames: [0, 55, 125, 220, 325, 415, 479],
  },
  {
    id: "the-relationship-landscape",
    campaign: "The Relationship",
    composition: "TheRelationship-Landscape",
    aspect: "16:9",
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 630,
    safeZoneProfile: "landscape-editorial-v1",
    posterFrame: 560,
    storyboardFrames: [0, 80, 180, 320, 460, 570, 629],
  },
  {
    id: "the-relationship-vertical",
    campaign: "The Relationship",
    composition: "TheRelationship-Vertical",
    aspect: "9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 480,
    safeZoneProfile: "social-ui-variable-v1",
    posterFrame: 420,
    storyboardFrames: [0, 65, 150, 250, 340, 425, 479],
  },
];

for (const item of canonical) {
  const frames = [item.posterFrame, ...item.storyboardFrames];
  if (
    frames.some((frame) => !Number.isInteger(frame) || frame < 0 || frame >= item.durationInFrames)
  )
    throw new Error(`${item.id} contains a render frame outside 0-${item.durationInFrames - 1}.`);
}

const sourceRoots = [
  "video",
  "public/video",
  "scripts/video/render.mjs",
  "scripts/video/shared.mjs",
  "scripts/video/storyboard.mjs",
  "src/brand/config.ts",
  "DESIGN.md",
  "package.json",
  "pnpm-lock.yaml",
];

async function filesUnder(path) {
  const full = resolve(path);
  const info = await stat(full);
  if (info.isFile()) return [full];
  const entries = await readdir(full, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => filesUnder(resolve(full, entry.name))),
  );
  return nested.flat();
}

export async function sourceFingerprint() {
  const files = (await Promise.all(sourceRoots.map(filesUnder))).flat().sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(root, file));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

export function sourceCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

export function assertSourceCommitted() {
  const dirty = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", ...sourceRoots],
    { encoding: "utf8" },
  ).trim();
  if (dirty) {
    throw new Error(
      "Canonical source is not committed. Commit the motion source and dependencies before rendering provenance-bearing assets.",
    );
  }
}

export async function fileSha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

export async function loadInventory() {
  return JSON.parse(await readFile(inventoryPath, "utf8"));
}

export async function saveInventory(inventory) {
  inventory.updatedAt = new Date().toISOString();
  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
}

export function selectedCanonical(args) {
  const requested = args.filter((arg) => !arg.startsWith("--"));
  if (args.includes("--all") || requested.length === 0) return canonical;
  return requested.map((id) => {
    const item = canonical.find((entry) => entry.id === id || entry.composition === id);
    if (!item) throw new Error(`Unknown canonical composition: ${id}`);
    return item;
  });
}

export function artifactPaths(item, fingerprint) {
  const directory = resolve(artifactsRoot, item.id, fingerprint);
  return {
    directory,
    delivery: resolve(directory, `${item.id}.mp4`),
    master: resolve(directory, `${item.id}-master.mov`),
    poster: resolve(directory, `${item.id}-poster.jpg`),
    thumbnail: resolve(directory, `${item.id}-thumbnail.jpg`),
    contactSheet: resolve(directory, `${item.id}-contact-sheet.jpg`),
    renderManifest: resolve(directory, "render-manifest.json"),
  };
}

export function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options });
}
