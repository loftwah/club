import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  artifactPaths,
  fileSha256,
  loadInventory,
  run,
  saveInventory,
  selectedCanonical,
  sourceFingerprint,
} from "./shared.mjs";

const selected = selectedCanonical(process.argv.slice(2));
const fingerprint = await sourceFingerprint();
const inventory = await loadInventory();

for (const item of selected) {
  const paths = artifactPaths(item, fingerprint);
  await mkdir(paths.directory, { recursive: true });
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    paths.delivery,
    "-vf",
    `select=${item.storyboardFrames.map((frame) => `eq(n\\,${frame})`).join("+")},scale=480:-1:flags=lanczos,tile=4x2:padding=12:margin=18:color=0xf5f1e7`,
    "-frames:v",
    "1",
    paths.contactSheet,
  ]);
  const asset = inventory.assets.find((entry) => entry.id === item.id);
  asset.local.contactSheet = paths.contactSheet;
  const manifest = JSON.parse(await readFile(paths.renderManifest, "utf8"));
  manifest.files.contactSheet = {
    path: paths.contactSheet,
    sha256: await fileSha256(paths.contactSheet),
  };
  await writeFile(paths.renderManifest, `${JSON.stringify(manifest, null, 2)}\n`);
  await saveInventory(inventory);
  console.info(`Storyboard: ${paths.contactSheet}`);
}
