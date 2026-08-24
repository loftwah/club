import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required for generation-time audio.");

const force = process.argv.includes("--force");
const outputDir = resolve("public/video/audio");
const provenancePath = resolve("video/assets/audio-provenance.json");

const sounds = [
  {
    id: "paper-arrival",
    duration: 2.2,
    loop: false,
    prompt:
      "Close-miked thick uncoated invitation card sliding across a clean wooden desk and settling with a soft confident paper tap. Dry studio recording, tactile, restrained, no room noise, no music, no voice.",
  },
  {
    id: "calendar-settle",
    duration: 1.6,
    loop: false,
    prompt:
      "A precise mechanical calendar index advancing one position, followed by a solid card placement on paper. Refined administrative object, quiet metal and paper, satisfying but subtle, no bell, no voice, no music.",
  },
  {
    id: "cancellation",
    duration: 2.4,
    loop: false,
    prompt:
      "A large rubber cancellation stamp hits thick paper with a fast tactile thump, short inked scrape, and controlled low-frequency release. Deeply satisfying successful action, premium sound design, no explosion, no trailer boom, no voice, no music.",
  },
  {
    id: "correspondence",
    duration: 3.2,
    loop: false,
    prompt:
      "A quality paper envelope slides forward, opens, and a folded cotton letter unfolds in three clean movements. Close and detailed studio foley, warm physical paper, elegant and restrained, no wax seal, no voice, no music.",
  },
  {
    id: "milestone",
    duration: 2.0,
    loop: false,
    prompt:
      "A small weighty membership artefact is placed gently onto thick paper, followed by one muted resonant ceramic tone. Restrained earned ceremony, warm and modern, no confetti, no fanfare, no voice.",
  },
  {
    id: "sonic-bed",
    duration: 24,
    loop: true,
    prompt:
      "Seamless minimal sound-design bed made from quiet paper texture, soft mechanical calendar ticks, a warm low pulse and sparse muted wooden percussion. Contemporary editorial, patient and human, no melody, no corporate music, no cinematic trailer, no voice. Loop perfectly.",
  },
];

await mkdir(outputDir, { recursive: true });
await mkdir(dirname(provenancePath), { recursive: true });

let existing = { assets: [] };
try {
  existing = JSON.parse(await readFile(provenancePath, "utf8"));
} catch {
  // First generation.
}

const generated = [];
for (const sound of sounds) {
  const destination = resolve(outputDir, `${sound.id}.mp3`);
  if (!force) {
    try {
      await readFile(destination);
      const previous = existing.assets?.find((asset) => asset.id === sound.id);
      if (previous) generated.push(previous);
      continue;
    } catch {
      // Generate missing asset.
    }
  }

  const response = await fetch(
    "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        accept: "audio/mpeg",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: sound.prompt,
        duration_seconds: sound.duration,
        prompt_influence: 0.55,
        loop: sound.loop,
        model_id: "eleven_text_to_sound_v2",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs sound generation failed for ${sound.id}: HTTP ${response.status}`);
  }

  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  generated.push({
    id: sound.id,
    file: `public/video/audio/${sound.id}.mp3`,
    provider: "ElevenLabs",
    model: "eleven_text_to_sound_v2",
    prompt: sound.prompt,
    requestedDurationSeconds: sound.duration,
    loop: sound.loop,
    generatedAt: new Date().toISOString(),
    rightsBasis:
      "Generated through the operator-authorised paid ElevenLabs account; commercial use governed by the account plan and ElevenLabs terms at generation time.",
    terms: "https://elevenlabs.io/terms-of-use",
    campaignUsage: ["The Plan", "The Relationship"],
  });
  console.info(`Generated ${sound.id}.mp3`);
}

await writeFile(
  provenancePath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generationTimeCapabilityOnly: true,
      publicWorkerDependency: false,
      assets: generated,
    },
    null,
    2,
  )}\n`,
);

console.info(`Audio inventory ready: ${generated.length}/${sounds.length}`);
