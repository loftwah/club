import { mkdir, writeFile } from "node:fs/promises";
import {
  artifactPaths,
  assertSourceCommitted,
  fileSha256,
  loadInventory,
  run,
  saveInventory,
  selectedCanonical,
  sourceCommit,
  sourceFingerprint,
} from "./shared.mjs";

const selected = selectedCanonical(process.argv.slice(2));
assertSourceCommitted();
const fingerprint = await sourceFingerprint();
const commit = sourceCommit();
const inventory = await loadInventory();
const deliveryOnly = process.argv.includes("--delivery-only");

for (const item of selected) {
  const paths = artifactPaths(item, fingerprint);
  await mkdir(paths.directory, { recursive: true });

  run("pnpm", [
    "exec",
    "remotion",
    "render",
    "video/index.ts",
    item.composition,
    paths.delivery,
    "--codec=h264",
    "--crf=14",
    "--audio-codec=aac",
    "--audio-bitrate=192k",
    "--concurrency=50%",
    "--overwrite",
  ]);
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    paths.poster,
    "-vf",
    `scale=${item.width / 2}:${item.height / 2}:flags=lanczos`,
    "-q:v",
    "3",
    paths.thumbnail,
  ]);

  if (!deliveryOnly) {
    run("pnpm", [
      "exec",
      "remotion",
      "render",
      "video/index.ts",
      item.composition,
      paths.master,
      "--codec=prores",
      "--prores-profile=hq",
      "--audio-codec=pcm-16",
      "--concurrency=50%",
      "--overwrite",
    ]);
  }

  run("pnpm", [
    "exec",
    "remotion",
    "still",
    "video/index.ts",
    item.composition,
    paths.poster,
    `--frame=${item.posterFrame}`,
    "--image-format=jpeg",
    "--jpeg-quality=92",
    "--overwrite",
  ]);

  const renderedAt = new Date().toISOString();
  const manifest = {
    schemaVersion: 1,
    ...item,
    remotionVersion: "4.0.516",
    sourceCommit: commit,
    sourceFingerprint: fingerprint,
    renderedAt,
    brandRevision: "plans-with-you-dispatch-wall-2026-08-24",
    audioProfile: "designed-elevenlabs-foley-v1",
    renderer: { gl: null, concurrency: "50%", deterministicFrameMotion: true },
    files: {
      delivery: {
        path: paths.delivery,
        codec: "h264",
        audio: "aac-48khz-192k",
        sha256: await fileSha256(paths.delivery),
      },
      master: deliveryOnly
        ? null
        : {
            path: paths.master,
            codec: "prores-hq",
            audio: "pcm-16",
            sha256: await fileSha256(paths.master),
          },
      poster: { path: paths.poster, sha256: await fileSha256(paths.poster) },
      thumbnail: { path: paths.thumbnail, sha256: await fileSha256(paths.thumbnail) },
    },
  };
  await writeFile(paths.renderManifest, `${JSON.stringify(manifest, null, 2)}\n`);

  const index = inventory.assets.findIndex((entry) => entry.id === item.id);
  inventory.assets[index] = {
    ...inventory.assets[index],
    durationSeconds: null,
    sourceCommit: commit,
    sourceFingerprint: fingerprint,
    renderedAt,
    renderManifest: paths.renderManifest,
    local: {
      delivery: paths.delivery,
      master: deliveryOnly ? null : paths.master,
      poster: paths.poster,
      thumbnail: paths.thumbnail,
      contactSheet: null,
    },
    approvalState: "review_required",
    qc: null,
    locations: null,
  };
  await saveInventory(inventory);
}
