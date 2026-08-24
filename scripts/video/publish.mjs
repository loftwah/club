import { lstat, readFile, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, resolve, sep } from "node:path";
import {
  artifactPaths,
  fileSha256,
  loadInventory,
  run,
  saveInventory,
  selectedCanonical,
  sourceFingerprint,
} from "./shared.mjs";

const contentType = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".json": "application/json",
};
for (const key of [
  "CF_ACCOUNT_ID",
  "CF_ACCESS_KEY_ID",
  "CF_SECRET_ACCESS_KEY",
  "CF_S3_API_ENDPOINT",
]) {
  if (!process.env[key]) throw new Error(`${key} is required for R2 publishing.`);
}
const endpoint = new URL(process.env.CF_S3_API_ENDPOINT);
const expectedHost = `${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
if (
  endpoint.protocol !== "https:" ||
  endpoint.hostname !== expectedHost ||
  endpoint.username ||
  endpoint.password
) {
  throw new Error(`CF_S3_API_ENDPOINT must be the HTTPS S3 endpoint for ${expectedHost}.`);
}
const awsEnv = {
  PATH: process.env.PATH ?? "",
  TMPDIR: process.env.TMPDIR ?? "/tmp",
  LANG: process.env.LANG ?? "C.UTF-8",
  AWS_ACCESS_KEY_ID: process.env.CF_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.CF_SECRET_ACCESS_KEY,
  AWS_DEFAULT_REGION: "auto",
  AWS_EC2_METADATA_DISABLED: "true",
  AWS_PAGER: "",
};
const selected = selectedCanonical(process.argv.slice(2));
const fingerprint = await sourceFingerprint();
const inventory = await loadInventory();
const docsRoot = resolve("docs");

for (const item of selected) {
  const asset = inventory.assets.find((entry) => entry.id === item.id);
  if (asset.approvalState !== "approved" || asset.sourceFingerprint !== fingerprint)
    throw new Error(`${item.id} must be current and approved before publishing.`);
  if (asset.qc?.status !== "PASS") throw new Error(`${item.id} must pass QC before publishing.`);

  const review = typeof asset.review === "string" ? resolve(asset.review) : "";
  if (!review.startsWith(`${docsRoot}${sep}`) || !review.endsWith(".md"))
    throw new Error(`${item.id} has no canonical approval review.`);
  const reviewInfo = await lstat(review);
  if (!reviewInfo.isFile() || reviewInfo.isSymbolicLink() || (await realpath(review)) !== review)
    throw new Error(`${item.id} approval review must be a regular canonical file.`);
  const reviewText = await readFile(review, "utf8");
  if (
    !/^Decision: APPROVED$/m.test(reviewText) ||
    !/^Review pass: 2$/m.test(reviewText) ||
    !reviewText.includes(`Source fingerprint: \`${fingerprint}\``) ||
    !reviewText.includes(`- \`${item.id}\``)
  ) {
    throw new Error(`${item.id} approval review does not match the current render.`);
  }

  const expected = artifactPaths(item, fingerprint);
  const manifest = JSON.parse(await readFile(expected.renderManifest, "utf8"));
  if (manifest.sourceFingerprint !== fingerprint)
    throw new Error(`${item.id} render manifest is stale.`);

  const prefix = `creative/approved/${item.id}/${fingerprint}`;
  const files = {
    master: asset.local.master,
    delivery: asset.local.delivery,
    poster: asset.local.poster,
    thumbnail: asset.local.thumbnail,
    contactSheet: asset.local.contactSheet,
    renderManifest: asset.renderManifest,
  };
  const locations = {};
  for (const [kind, file] of Object.entries(files)) {
    const expectedFile = expected[kind];
    if (typeof file !== "string" || resolve(file) !== expectedFile)
      throw new Error(`${item.id} ${kind} path is outside its canonical artifact directory.`);
    const fileInfo = await lstat(file);
    if (!fileInfo.isFile() || fileInfo.isSymbolicLink() || (await realpath(file)) !== expectedFile)
      throw new Error(`${item.id} ${kind} must be a regular canonical artifact file.`);
    const expectedHash = manifest.files?.[kind]?.sha256;
    if (kind !== "renderManifest" && expectedHash !== (await fileSha256(file)))
      throw new Error(`${item.id} ${kind} does not match its recorded render hash.`);

    const key = `${prefix}/${file.split("/").at(-1)}`;
    run(
      "aws",
      [
        "s3",
        "cp",
        file,
        `s3://social-club-artifacts/${key}`,
        "--endpoint-url",
        process.env.CF_S3_API_ENDPOINT,
        "--content-type",
        contentType[extname(file)] ?? "application/octet-stream",
        "--no-progress",
      ],
      { env: awsEnv },
    );
    locations[kind] = `r2://social-club-artifacts/${key}`;
  }
  asset.locations = locations;
  asset.publishedAt = new Date().toISOString();
  console.info(`Published ${item.id}`);
  await saveInventory(inventory);
}

run(
  "aws",
  [
    "s3",
    "cp",
    fileURLToPath(new URL("../../creative/video-inventory.json", import.meta.url)),
    "s3://social-club-artifacts/creative/approved/inventory.json",
    "--endpoint-url",
    process.env.CF_S3_API_ENDPOINT,
    "--content-type",
    "application/json",
    "--no-progress",
  ],
  { env: awsEnv },
);
