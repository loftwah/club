import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import {
  artifactPaths,
  artifactsRoot,
  loadInventory,
  saveInventory,
  selectedCanonical,
  sourceFingerprint,
} from "./shared.mjs";

const selected = selectedCanonical(process.argv.slice(2));
const fingerprint = await sourceFingerprint();
const inventory = await loadInventory();
const reports = [];

for (const item of selected) {
  const paths = artifactPaths(item, fingerprint);
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration,size,format_name:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
        "-of",
        "json",
        paths.delivery,
      ],
      { encoding: "utf8" },
    ),
  );
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  const durationSeconds = Number(probe.format.duration);
  const failures = [];
  if (!probe.format.format_name?.split(",").includes("mp4"))
    failures.push(`container ${probe.format.format_name}`);
  if (video?.codec_name !== "h264") failures.push(`video codec ${video?.codec_name}`);
  if (video?.width !== item.width || video?.height !== item.height)
    failures.push(`dimensions ${video?.width}x${video?.height}`);
  if (video?.r_frame_rate !== `${item.fps}/1`) failures.push(`fps ${video?.r_frame_rate}`);
  if (audio?.codec_name !== "aac") failures.push(`audio codec ${audio?.codec_name}`);
  if (audio?.sample_rate !== "48000") failures.push(`audio rate ${audio?.sample_rate}`);
  if (audio?.channels !== 2) failures.push(`audio channels ${audio?.channels}`);
  const expectedDurationSeconds = item.durationInFrames / item.fps;
  if (Math.abs(durationSeconds - expectedDurationSeconds) > 0.2)
    failures.push(
      `duration ${durationSeconds.toFixed(2)}s (expected ${expectedDurationSeconds.toFixed(2)}s)`,
    );

  const blackRun = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      paths.delivery,
      "-vf",
      "blackdetect=d=0.08:pix_th=0.02",
      "-an",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8" },
  );
  if (blackRun.status !== 0) failures.push("black-frame analysis failed");
  const blackDetect = `${blackRun.stdout ?? ""}\n${blackRun.stderr ?? ""}`;
  if (blackDetect.includes("black_start")) failures.push("black-frame segment detected");

  const volumeRun = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      paths.delivery,
      "-af",
      "volumedetect",
      "-vn",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8" },
  );
  const volumeOutput = `${volumeRun.stdout ?? ""}\n${volumeRun.stderr ?? ""}`;
  const maxVolume = Number(volumeOutput.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]);
  if (volumeRun.status !== 0 || !Number.isFinite(maxVolume)) failures.push("audio analysis failed");
  else if (maxVolume > -0.1) failures.push(`audio peak ${maxVolume} dB`);

  const loudnessRun = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      paths.delivery,
      "-filter:a",
      "ebur128=peak=true",
      "-map",
      "0:a:0",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8" },
  );
  const loudnessOutput = `${loudnessRun.stdout ?? ""}\n${loudnessRun.stderr ?? ""}`;
  const integratedMatches = [...loudnessOutput.matchAll(/\bI:\s*(-?[\d.]+) LUFS/g)];
  const truePeakMatches = [...loudnessOutput.matchAll(/\bPeak:\s*(-?[\d.]+) dBFS/g)];
  const integratedLufs = Number(integratedMatches.at(-1)?.[1]);
  const truePeakDbfs = Number(truePeakMatches.at(-1)?.[1]);
  if (!Number.isFinite(integratedLufs) || !Number.isFinite(truePeakDbfs))
    failures.push("EBU R128 loudness analysis failed");
  else {
    if (integratedLufs < -24 || integratedLufs > -12)
      failures.push(`integrated loudness ${integratedLufs} LUFS`);
    if (truePeakDbfs > -1) failures.push(`true peak ${truePeakDbfs} dBFS`);
  }

  const report = {
    id: item.id,
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    durationSeconds,
    fileSizeBytes: Number(probe.format.size),
    video,
    audio,
    maxVolumeDb: Number.isFinite(maxVolume) ? maxVolume : null,
    integratedLufs: Number.isFinite(integratedLufs) ? integratedLufs : null,
    truePeakDbfs: Number.isFinite(truePeakDbfs) ? truePeakDbfs : null,
    checkedAt: new Date().toISOString(),
    manualChecksRequired: [
      "font and copy correctness",
      "safe zones and platform preview",
      "text clipping and hierarchy",
      "first/last frame composition",
      "motion determinism and flicker",
      "audio mix, clipping and abrupt cut",
      "debug overlays absent",
    ],
  };
  reports.push(report);
  const asset = inventory.assets.find((entry) => entry.id === item.id);
  asset.durationSeconds = durationSeconds;
  asset.fileSizeBytes = Number(probe.format.size);
  asset.qc = report;
  console.info(`${report.status} ${item.id}${failures.length ? ` — ${failures.join(", ")}` : ""}`);
}

await mkdir(artifactsRoot, { recursive: true });
await writeFile(
  `${artifactsRoot}/qc-report.json`,
  `${JSON.stringify({ fingerprint, reports }, null, 2)}\n`,
);
await saveInventory(inventory);
if (reports.some((report) => report.status !== "PASS")) process.exitCode = 1;
