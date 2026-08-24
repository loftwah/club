import { lstat, readFile, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { loadInventory, saveInventory, selectedCanonical, sourceFingerprint } from "./shared.mjs";

const reviewArg = process.argv.find((arg) => arg.startsWith("--review="));
if (!reviewArg) throw new Error("Pass --review=<path> to the completed independent review.");
const review = resolve(reviewArg.slice("--review=".length));
const docsRoot = resolve("docs");
if (!review.startsWith(`${docsRoot}${sep}`) || !review.endsWith(".md"))
  throw new Error("The approval review must be a Markdown record inside docs/.");
const reviewInfo = await lstat(review);
if (!reviewInfo.isFile() || reviewInfo.isSymbolicLink() || (await realpath(review)) !== review)
  throw new Error("The approval review must be a regular file, not a symlink.");
const reviewText = await readFile(review, "utf8");
if (!/^Decision: APPROVED$/m.test(reviewText))
  throw new Error("The independent review must contain an exact 'Decision: APPROVED' line.");

const selected = selectedCanonical(process.argv.slice(2));
const fingerprint = await sourceFingerprint();
if (!reviewText.includes(`Source fingerprint: \`${fingerprint}\``))
  throw new Error("The independent review is not bound to the current source fingerprint.");
if (!/^Review pass: 2$/m.test(reviewText))
  throw new Error("Canonical approval requires a completed second review pass.");
for (const item of selected) {
  if (!reviewText.includes(`- \`${item.id}\``))
    throw new Error(`The independent review does not cover ${item.id}.`);
}
const inventory = await loadInventory();

for (const item of selected) {
  const asset = inventory.assets.find((entry) => entry.id === item.id);
  if (asset.sourceFingerprint !== fingerprint) throw new Error(`${item.id} is stale.`);
  if (asset.qc?.status !== "PASS") throw new Error(`${item.id} has not passed technical QC.`);
  if (
    !asset.local?.master ||
    !asset.local?.delivery ||
    !asset.local?.poster ||
    !asset.local?.thumbnail ||
    !asset.local?.contactSheet
  )
    throw new Error(`${item.id} is missing canonical files.`);
  asset.approvalState = "approved";
  asset.approvedAt = new Date().toISOString();
  asset.review = relative(resolve("."), review);
  console.info(`Approved ${item.id}`);
}
await saveInventory(inventory);
