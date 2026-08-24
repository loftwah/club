// Real MiniMax adapter.
//
// Talks directly to the MiniMax platform HTTP API. Cloudflare Workers
// cannot depend on a local CLI, so this adapter is the runtime path
// for both text and image generation. The CLI (mmx) and the contract
// test (scripts/minimax-contract.mjs) use the same endpoint contract
// (verified against mmx-cli v1.0.22):
//
//   POST /v1/chat/completions            (text)
//   POST /v1/image_generation            (image)
//
// Text body:   { model, messages, max_tokens, temperature }
// Text shape:  { choices: [{ message: { content } }] }
//
// Image body:  { model, prompt, aspect_ratio | (width & height), n }
// Image shape: { data: { image_urls: string[] } | { image_base64: string[] }, base_resp }
//
// Errors are normalised into MiniMaxError with TRANSIENT / PERMANENT /
// RATE_LIMITED / INVALID_OUTPUT codes, matching the fake adapter.

import {
  MiniMaxError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type MiniMaxAdapter,
  type TextGenerationRequest,
  type TextGenerationResult,
} from "./minimax.js";

export interface RealMiniMaxOptions {
  readonly apiKey: string;
  readonly fetchImpl?: typeof fetch;
  /** Override the API base URL. Defaults to https://api.minimax.io/v1. */
  readonly baseUrl?: string;
}

interface ApiErrorBody {
  base_resp?: { status_code?: number; status_msg?: string };
  error?: { code?: number | string; message?: string; type?: string };
  message?: string;
}

const DEFAULT_BASE = "https://api.minimax.io/v1";

const SUPPORTED_ASPECT_RATIOS = [
  "1:1",
  "3:2",
  "2:3",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "21:9",
] as const;

export class RealMiniMaxAdapter implements MiniMaxAdapter {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: RealMiniMaxOptions) {
    if (!opts.apiKey) {
      throw new MiniMaxError("PERMANENT", "MINIMAX_API_KEY is required for the real adapter");
    }
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
  }

  async generateText(req: TextGenerationRequest): Promise<TextGenerationResult> {
    const body = {
      model: req.model ?? "MiniMax-Text-01",
      messages: [
        { role: "system" as const, content: req.system },
        { role: "user" as const, content: req.userMessage },
      ],
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    };
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw await toAdapterError(res, "chat");
    }
    const json = (await res.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      id?: string;
    } | null;
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new MiniMaxError(
        "INVALID_OUTPUT",
        "MiniMax text response missing choices[0].message.content",
      );
    }
    return {
      text,
      model: json?.model ?? String(body.model),
      providerGenerationId: json?.id ?? null,
    };
  }

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!req.prompt) {
      throw new MiniMaxError("PERMANENT", "image prompt is required");
    }
    const body: Record<string, unknown> = {
      model: req.model ?? "image-01",
      prompt: req.prompt,
      n: 1,
    };
    if (req.width && req.height) {
      // The mmx-cli SDK accepts both width+height and aspect_ratio.
      // The HTTP API supports aspect_ratio as the stable form; we map
      // width/height to the closest preset so we don't depend on
      // per-model width/height handling. The contract test does the
      // same mapping.
      body.aspect_ratio = closestAspectRatio(req.width, req.height);
    } else {
      body.aspect_ratio = "1:1";
    }
    const res = await this.fetchImpl(`${this.baseUrl}/image_generation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw await toAdapterError(res, "image");
    }
    const json = (await res.json().catch(() => null)) as {
      data?: { image_urls?: string[]; image_base64?: string[] };
      base_resp?: { status_code?: number; status_msg?: string };
      model?: string;
      id?: string;
    } | null;
    const data = json?.data ?? {};
    const imageUrl = data.image_urls?.[0] ?? data.image_base64?.[0];
    if (!imageUrl) {
      const code = json?.base_resp?.status_code;
      const msg = json?.base_resp?.status_msg;
      throw new MiniMaxError(
        "INVALID_OUTPUT",
        `MiniMax image response has no image_urls/image_base64 (base_resp=${code ?? "n/a"} ${
          msg ?? ""
        })`,
      );
    }
    return {
      imageUrl,
      model: json?.model ?? String(body.model),
      providerGenerationId: json?.id ?? null,
    };
  }
}

function closestAspectRatio(w: number, h: number): string {
  const target = w / h;
  let best = "1:1";
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const p of SUPPORTED_ASPECT_RATIOS) {
    const parts = p.split(":");
    const pw = Number(parts[0]);
    const ph = Number(parts[1]);
    if (!Number.isFinite(pw) || !Number.isFinite(ph) || ph === 0) continue;
    const r = pw / ph;
    const delta = Math.abs(Math.log(r / target));
    if (delta < bestDelta) {
      best = p;
      bestDelta = delta;
    }
  }
  return best;
}

async function toAdapterError(res: Response, kind: "chat" | "image"): Promise<MiniMaxError> {
  const status = res.status;
  const text = await res.text().catch(() => "");
  let body: ApiErrorBody | null = null;
  try {
    body = text ? (JSON.parse(text) as ApiErrorBody) : null;
  } catch {
    body = null;
  }
  const code = body?.base_resp?.status_code;
  const apiCode = body?.error?.code;
  const msg =
    body?.base_resp?.status_msg ?? body?.error?.message ?? body?.message ?? text.slice(0, 200);
  if (
    status === 429 ||
    apiCode === 1002 ||
    apiCode === 1028 ||
    apiCode === 1030 ||
    apiCode === 2061
  ) {
    return new MiniMaxError("RATE_LIMITED", `MiniMax ${kind} rate-limited (${status}): ${msg}`);
  }
  if (status >= 500) {
    return new MiniMaxError("TRANSIENT", `MiniMax ${kind} server error (${status}): ${msg}`);
  }
  if (status === 408 || status === 504) {
    return new MiniMaxError("TRANSIENT", `MiniMax ${kind} timed out (${status}): ${msg}`);
  }
  if (status >= 400) {
    return new MiniMaxError(
      "PERMANENT",
      `MiniMax ${kind} rejected request (${status} code=${code ?? "n/a"}): ${msg}`,
    );
  }
  return new MiniMaxError("TRANSIENT", `MiniMax ${kind} unexpected status (${status}): ${msg}`);
}
