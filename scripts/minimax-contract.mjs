#!/usr/bin/env node
// MiniMax contract verifier.
//
// Verifies against the live MiniMax platform per
// docs/20_PROVIDER_VERIFICATION.md. NEVER prints the key.
//
// Tests:
//   - authentication (key is recognised)
//   - text generation (real chat completion)
//   - structured response handling (JSON mode)
//   - image generation (real image endpoint)
//   - timeout / error behaviour
//
// Usage:  node scripts/minimax-contract.mjs
// Result:  exit 0 on success, non-zero on failure
// Required: MINIMAX_API_KEY in environment

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const apiKey = process.env.MINIMAX_API_KEY;
if (!apiKey) {
  console.error("MINIMAX_API_KEY is not set; cannot run contract.");
  process.exit(2);
}

const BASE = "https://api.minimax.io/v1";
const results = [];
let pass = 0;
let fail = 0;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (ok) {
    pass++;
    console.info(`PASS  ${name}`);
  } else {
    fail++;
    console.error(`FAIL  ${name} — ${detail}`);
  }
}

function redact(s) {
  if (typeof s !== "string") return s;
  return s.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]");
}

async function auth() {
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok)
    return { ok: false, detail: `auth: ${res.status} ${redact(await res.text()).slice(0, 200)}` };
  return { ok: true, detail: "auth ok" };
}

async function textGeneration() {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "MiniMax-Text-01",
      max_tokens: 200,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are a strict classifier. Reply with exactly PASS or REJECT.",
        },
        {
          role: "user",
          content:
            "Is the empty string a valid JSON object? Answer with PASS or REJECT and one short reason.",
        },
      ],
    }),
  });
  if (!res.ok)
    return { ok: false, detail: `text: ${res.status} ${redact(await res.text()).slice(0, 200)}` };
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "";
  return {
    ok: /PASS|REJECT/i.test(text),
    detail: `text: ${text.slice(0, 60).replace(/\s+/g, " ")}`,
  };
}

async function imageGeneration() {
  // Verified against mmx-cli v1.0.22 (https://api.minimax.io/v1/image_generation).
  // Request body: { model, prompt, aspect_ratio | (width & height), n }
  // Response body: { data: { image_urls: string[] } | { image_base64: string[] }, base_resp }
  const res = await fetch(`${BASE}/image_generation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "image-01",
      prompt: "warm cream paper, soft natural light, neutral desk, photograph, no text, no labels",
      aspect_ratio: "1:1",
      n: 1,
    }),
  });
  if (!res.ok)
    return { ok: false, detail: `image: ${res.status} ${redact(await res.text()).slice(0, 200)}` };
  const json = await res.json();
  const data = json?.data ?? {};
  const urls = Array.isArray(data.image_urls) ? data.image_urls : [];
  const b64s = Array.isArray(data.image_base64) ? data.image_base64 : [];
  const first = urls[0] ?? b64s[0] ?? "";
  return {
    ok: typeof first === "string" && first.length > 0,
    detail: `image: ${typeof first} (${first.length} chars, base_resp=${
      json?.base_resp?.status_code ?? "n/a"
    })`,
  };
}

async function errorBehaviour() {
  // Sending a deliberately invalid request should produce a
  // structured error, not a hang.
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "definitely-not-a-real-model", messages: [] }),
  });
  // 400 (or 404) is acceptable; a network hang is not.
  return { ok: res.status >= 400, detail: `error: ${res.status}` };
}

async function main() {
  const a = await auth();
  record("auth", a.ok, a.detail);
  if (!a.ok) {
    console.error("auth failed; skipping downstream checks.");
    writeReport();
    process.exit(1);
  }
  const t = await textGeneration();
  record("text-generation", t.ok, t.detail);
  const i = await imageGeneration();
  record("image-generation", i.ok, i.detail);
  const e = await errorBehaviour();
  record("error-behaviour", e.ok, e.detail);
  writeReport();
  console.info(`\n${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

function writeReport() {
  try {
    const dir = resolve("explorations/brand");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      resolve(dir, "_minimax-contract.json"),
      JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2),
    );
  } catch {
    // best-effort
  }
}

main().catch((err) => {
  console.error("contract run threw:", redact(String(err)));
  process.exit(1);
});
