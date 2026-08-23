// MiniMax adapter interface.
//
// All AI-mediated text/image generation goes through this interface. The
// real adapter is wired to the MiniMax platform (OpenAI-compatible or
// Anthropic-compatible endpoints; see docs/20_PROVIDER_VERIFICATION.md).
// The fake adapter is deterministic and supports failure injection.
//
// AI may not invent member facts, override policy, or write confirmed
// member truth. The interface is intentionally narrow.

export interface TextGenerationRequest {
  readonly system: string;
  readonly userMessage: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  /** Provider-side model name. Kept generic here; resolved by the adapter. */
  readonly model?: string;
  /** A schema key the adapter uses to constrain the response shape. */
  readonly schemaKey?: string;
}

export interface TextGenerationResult {
  readonly text: string;
  readonly model: string;
  readonly providerGenerationId: string | null;
}

export interface ImageGenerationRequest {
  readonly prompt: string;
  /** A reference image (URL or base64). For brand explorations. */
  readonly referenceImage?: string;
  readonly width?: number;
  readonly height?: number;
  readonly model?: string;
}

export interface ImageGenerationResult {
  readonly imageUrl: string;
  readonly model: string;
  readonly providerGenerationId: string | null;
}

export interface MiniMaxAdapter {
  generateText(req: TextGenerationRequest): Promise<TextGenerationResult>;
  generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export class MiniMaxError extends Error {
  constructor(
    public readonly code: "TRANSIENT" | "PERMANENT" | "RATE_LIMITED" | "INVALID_OUTPUT",
    message: string,
  ) {
    super(message);
    this.name = "MiniMaxError";
  }
}
