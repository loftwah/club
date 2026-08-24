import { loadInventory, canonical, sourceFingerprint } from "./shared.mjs";

const inventory = await loadInventory();
const fingerprint = await sourceFingerprint();
let ready = true;

for (const expected of canonical) {
  const asset = inventory.assets.find((entry) => entry.id === expected.id);
  let status = "MISSING";
  if (asset?.sourceFingerprint) {
    status =
      asset.sourceFingerprint === fingerprint &&
      asset.approvalState === "approved" &&
      asset.locations?.master &&
      asset.locations?.delivery
        ? "CURRENT"
        : "STALE";
  }
  if (status !== "CURRENT") ready = false;
  console.info(
    `${status.padEnd(7)} ${expected.campaign.padEnd(16)} ${expected.aspect.padEnd(5)} ${expected.composition}`,
  );
}

console.info(`\nSource fingerprint: ${fingerprint}`);
console.info(`Canonical commercial inventory: ${ready ? "READY" : "NOT READY"}`);
process.exitCode = ready ? 0 : 1;
