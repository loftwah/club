import { describe, expect, it } from "vitest";
import { RealMiniMaxAdapter } from "../../src/adapters/minimax-real";
import { MiniMaxError } from "../../src/adapters/minimax";

/**
 * Build a fake `fetch` that records every call and returns the
 * next queued response.
 */
function makeFetch(responses: Array<{ status: number; body: unknown } | { throw: Error }>): {
  fetch: typeof fetch;
  calls: Array<{ url: string; init: RequestInit }>;
} {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const r = responses[i++] ?? { status: 500, body: { error: { message: "no more responses" } } };
    if ("throw" in r) throw r.throw;
    const text = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return new Response(text, {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetch: f, calls };
}

describe("RealMiniMaxAdapter", () => {
  it("uses POST /v1/chat/completions for text with system+user messages", async () => {
    const { fetch: f, calls } = makeFetch([
      {
        status: 200,
        body: { choices: [{ message: { content: "hello" } }], model: "MiniMax-Text-01" },
      },
    ]);
    const ai = new RealMiniMaxAdapter({
      apiKey: "k",
      fetchImpl: f,
      baseUrl: "https://api.example/v1",
    });
    const r = await ai.generateText({
      system: "you are concise",
      userMessage: "say hello",
      maxTokens: 50,
    });
    expect(r.text).toBe("hello");
    expect(r.model).toBe("MiniMax-Text-01");
    expect(calls).toHaveLength(1);
    const firstCall = calls[0];
    if (!firstCall) throw new Error("expected first call");
    expect(firstCall.url).toBe("https://api.example/v1/chat/completions");
    const body = JSON.parse(String(firstCall.init.body)) as {
      messages: Array<{ role: string; content: string }>;
      max_tokens: number;
    };
    expect(body.messages).toEqual([
      { role: "system", content: "you are concise" },
      { role: "user", content: "say hello" },
    ]);
    expect(body.max_tokens).toBe(50);
    const headers = firstCall.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer k");
  });

  it("uses POST /v1/image_generation with aspect_ratio for images", async () => {
    const { fetch: f, calls } = makeFetch([
      {
        status: 200,
        body: {
          data: { image_urls: ["https://cdn.example/img.jpg"] },
          base_resp: { status_code: 0, status_msg: "success" },
          model: "image-01",
        },
      },
    ]);
    const ai = new RealMiniMaxAdapter({
      apiKey: "k",
      fetchImpl: f,
      baseUrl: "https://api.example/v1",
    });
    const r = await ai.generateImage({
      prompt: "warm paper",
      width: 1200,
      height: 630,
    });
    expect(r.imageUrl).toBe("https://cdn.example/img.jpg");
    expect(r.model).toBe("image-01");
    expect(calls).toHaveLength(1);
    const firstCall = calls[0];
    if (!firstCall) throw new Error("expected first call");
    expect(firstCall.url).toBe("https://api.example/v1/image_generation");
    const body = JSON.parse(String(firstCall.init.body)) as {
      model: string;
      prompt: string;
      aspect_ratio: string;
      n: number;
    };
    expect(body.model).toBe("image-01");
    expect(body.prompt).toBe("warm paper");
    // 1200/630 ≈ 1.905. Log-space: |log(16/9 / 1.905)| ≈ 0.069 vs
    // |log(21/9 / 1.905)| ≈ 0.203. So 16:9 is the closest preset.
    expect(body.aspect_ratio).toBe("16:9");
    expect(body.n).toBe(1);
  });

  it("image generation accepts base64 responses when image_urls is empty", async () => {
    const { fetch: f } = makeFetch([
      {
        status: 200,
        body: { data: { image_base64: ["aGVsbG8="] }, model: "image-01" },
      },
    ]);
    const ai = new RealMiniMaxAdapter({ apiKey: "k", fetchImpl: f });
    const r = await ai.generateImage({ prompt: "warm paper", width: 1024, height: 1024 });
    expect(r.imageUrl).toBe("aGVsbG8=");
  });

  it("normalises 429 to RATE_LIMITED MiniMaxError", async () => {
    const { fetch: f } = makeFetch([
      { status: 429, body: { base_resp: { status_code: 1030, status_msg: "rate limit" } } },
    ]);
    const ai = new RealMiniMaxAdapter({ apiKey: "k", fetchImpl: f });
    await expect(ai.generateText({ system: "x", userMessage: "y" })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("normalises 5xx to TRANSIENT MiniMaxError", async () => {
    const { fetch: f } = makeFetch([{ status: 503, body: { message: "down" } }]);
    const ai = new RealMiniMaxAdapter({ apiKey: "k", fetchImpl: f });
    await expect(ai.generateText({ system: "x", userMessage: "y" })).rejects.toMatchObject({
      code: "TRANSIENT",
    });
  });

  it("normalises 4xx to PERMANENT MiniMaxError", async () => {
    const { fetch: f } = makeFetch([{ status: 400, body: { message: "bad request" } }]);
    const ai = new RealMiniMaxAdapter({ apiKey: "k", fetchImpl: f });
    await expect(ai.generateText({ system: "x", userMessage: "y" })).rejects.toMatchObject({
      code: "PERMANENT",
    });
  });

  it("rejects when image response has neither url nor base64", async () => {
    const { fetch: f } = makeFetch([
      { status: 200, body: { data: {}, base_resp: { status_code: 1027, status_msg: "no image" } } },
    ]);
    const ai = new RealMiniMaxAdapter({ apiKey: "k", fetchImpl: f });
    await expect(ai.generateImage({ prompt: "x", width: 512, height: 512 })).rejects.toBeInstanceOf(
      MiniMaxError,
    );
  });

  it("rejects text responses missing choices[0].message.content", async () => {
    const { fetch: f } = makeFetch([{ status: 200, body: { choices: [] } }]);
    const ai = new RealMiniMaxAdapter({ apiKey: "k", fetchImpl: f });
    await expect(ai.generateText({ system: "x", userMessage: "y" })).rejects.toMatchObject({
      code: "INVALID_OUTPUT",
    });
  });

  it("refuses to construct without an api key", () => {
    expect(() => new RealMiniMaxAdapter({ apiKey: "" })).toThrow(MiniMaxError);
  });
});
