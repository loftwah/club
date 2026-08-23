// Fake MiniMax adapter for tests and ordinary local acceptance.
//
// Default behaviour: returns a deterministic, content-shaped response.
// Supports:
//   - a response script per schemaKey (configured by the test)
//   - forcing the next call to fail
//   - tracking every call for assertion

import {
  MiniMaxError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type MiniMaxAdapter,
  type TextGenerationRequest,
  type TextGenerationResult,
} from "./minimax.js";

export interface FakeMiniMaxOptions {
  /** Per-schemaKey response text. If unset, returns a placeholder. */
  responses?: Record<string, string>;
  /** Force the next call to fail with this code. */
  failNext?: "TRANSIENT" | "PERMANENT" | "RATE_LIMITED" | "INVALID_OUTPUT";
}

export class FakeMiniMax implements MiniMaxAdapter {
  readonly textCalls: TextGenerationRequest[] = [];
  readonly imageCalls: ImageGenerationRequest[] = [];
  private responses: Record<string, string>;
  private failureQueue: FakeMiniMaxOptions["failNext"] | null = null;

  constructor(opts: FakeMiniMaxOptions = {}) {
    this.responses = opts.responses ?? {};
    this.failureQueue = opts.failNext ?? null;
  }

  setResponse(schemaKey: string, text: string): void {
    this.responses[schemaKey] = text;
  }

  failNext(code: FakeMiniMaxOptions["failNext"]): void {
    this.failureQueue = code;
  }

  private checkFailure(): void {
    if (this.failureQueue) {
      const code = this.failureQueue;
      this.failureQueue = null;
      throw new MiniMaxError(code, `Forced failure: ${code}`);
    }
  }

  async generateText(req: TextGenerationRequest): Promise<TextGenerationResult> {
    this.textCalls.push(req);
    this.checkFailure();
    const text = req.schemaKey
      ? (this.responses[req.schemaKey] ?? defaultTextResponse(req))
      : defaultTextResponse(req);
    return {
      text,
      model: req.model ?? "fake-minimax",
      providerGenerationId: `fake_${Math.random().toString(36).slice(2, 10)}`,
    };
  }

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    this.imageCalls.push(req);
    this.checkFailure();
    return {
      imageUrl: "data:image/svg+xml;utf8,<svg/>",
      model: req.model ?? "fake-minimax",
      providerGenerationId: `fake_${Math.random().toString(36).slice(2, 10)}`,
    };
  }
}

function defaultTextResponse(req: TextGenerationRequest): string {
  return `[fake-minimax] system=${req.system.length}chars user=${req.userMessage.slice(0, 80)}`;
}
