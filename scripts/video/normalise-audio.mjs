import { execFileSync } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ids = [
  "paper-arrival",
  "calendar-settle",
  "cancellation",
  "correspondence",
  "milestone",
  "sonic-bed",
];
const targets = Object.fromEntries(ids.map((id) => [id, id === "sonic-bed" ? -20 : -14]));

for (const id of ids) {
  const input = resolve(`public/video/audio/${id}.mp3`);
  const output = resolve(`public/video/audio/${id}.normalised.mp3`);
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      input,
      "-af",
      `loudnorm=I=${targets[id]}:TP=-2:LRA=7`,
      "-ar",
      "48000",
      "-b:a",
      "192k",
      output,
    ],
    { stdio: "inherit" },
  );
  await rename(output, input);
  console.info(`Normalised ${id}.mp3`);
}

const provenancePath = resolve("video/assets/audio-provenance.json");
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
provenance.postProcessing = {
  tool: "FFmpeg loudnorm",
  integratedLufsTargets: targets,
  truePeakDbTarget: -2,
  loudnessRangeTarget: 7,
  sampleRateHz: 48000,
  bitrateKbps: 192,
  processedAt: new Date().toISOString(),
};
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
