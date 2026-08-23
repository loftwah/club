// Visual generation pipeline.
//
// Reusable tooling for generating visual assets (mood, hero,
// supporting imagery, social cards) with explicit provenance
// tracking. The registry records: prompt, provider, model,
// source output, selected output, destination, dimensions, status.
//
// Per the project invariants (docs/03 §4.10), MiniMax-generated
// imagery is acceptable for mood, physical objects, composition,
// and atmosphere — but NOT for readable typography. Anything
// that must be read uses HTML/CSS/SVG (see `src/lib/og.ts`).

import type { MiniMaxAdapter } from "../adapters/minimax.js";

export type VisualStatus = "candidate" | "selected" | "rejected" | "production";

export interface VisualAsset {
  readonly id: string;
  readonly prompt: string;
  readonly provider: string;
  readonly model: string;
  readonly sourceOutput: string;
  readonly selectedOutput: string;
  readonly destination: string;
  readonly width: number;
  readonly height: number;
  readonly status: VisualStatus;
  readonly notes: string;
  readonly createdAt: string;
}

export interface GenerateVisualInput {
  readonly id: string;
  readonly prompt: string;
  readonly destination: string;
  readonly width: number;
  readonly height: number;
  readonly notes?: string;
  readonly model?: string;
}

export interface VisualRegistry {
  record(asset: VisualAsset): Promise<void>;
  list(): Promise<VisualAsset[]>;
  byId(id: string): Promise<VisualAsset | null>;
  byDestination(dest: string): Promise<VisualAsset | null>;
}

interface InMemoryRow {
  id: string;
  prompt: string;
  provider: string;
  model: string;
  source_output: string;
  selected_output: string;
  destination: string;
  width: number;
  height: number;
  status: string;
  notes: string;
  created_at: string;
}

/**
 * In-memory visual asset registry. Persists to a JSON file in
 * `explorations/brand/assets/_registry.json` for traceability.
 */
export class FileVisualRegistry implements VisualRegistry {
  private rows: InMemoryRow[] = [];

  constructor(private readonly filePath: string) {}

  async record(asset: VisualAsset): Promise<void> {
    const row: InMemoryRow = {
      id: asset.id,
      prompt: asset.prompt,
      provider: asset.provider,
      model: asset.model,
      source_output: asset.sourceOutput,
      selected_output: asset.selectedOutput,
      destination: asset.destination,
      width: asset.width,
      height: asset.height,
      status: asset.status,
      notes: asset.notes,
      created_at: asset.createdAt,
    };
    const existing = this.rows.findIndex((r) => r.id === row.id);
    if (existing >= 0) this.rows[existing] = row;
    else this.rows.push(row);
    await this.persist();
  }

  async list(): Promise<VisualAsset[]> {
    return this.rows.map(rowToAsset);
  }

  async byId(id: string): Promise<VisualAsset | null> {
    const row = this.rows.find((r) => r.id === id);
    return row ? rowToAsset(row) : null;
  }

  async byDestination(dest: string): Promise<VisualAsset | null> {
    const row = this.rows.find((r) => r.destination === dest);
    return row ? rowToAsset(row) : null;
  }

  private async persist(): Promise<void> {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(this.filePath, JSON.stringify(this.rows, null, 2), "utf8");
  }
}

function rowToAsset(r: InMemoryRow): VisualAsset {
  return {
    id: r.id,
    prompt: r.prompt,
    provider: r.provider,
    model: r.model,
    sourceOutput: r.source_output,
    selectedOutput: r.selected_output,
    destination: r.destination,
    width: r.width,
    height: r.height,
    status: r.status as VisualStatus,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

/**
 * Generate a visual asset, then evaluate-and-re-roll if the
 * first attempt is poor. The pipeline:
 *   1. generateText() to evaluate if the prompt would produce
 *      a useful image (and to capture a self-critique for the
 *      registry).
 *   2. generateImage() to produce the asset.
 *   3. if the self-critique returns "REJECT", re-roll with a
 *      refined prompt (up to 3 attempts).
 *   4. record the result in the registry.
 */
export async function generateVisual(
  ai: MiniMaxAdapter,
  registry: VisualRegistry,
  input: GenerateVisualInput,
  options: { maxAttempts?: number; refine?: (prev: string, critique: string) => string } = {},
): Promise<VisualAsset> {
  const maxAttempts = options.maxAttempts ?? 3;
  let prompt = input.prompt;
  let critique = "";
  let lastResult: { imageUrl: string; providerGenerationId: string | null } | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Self-critique via the AI (text generation).
    const critiqueResult = await ai.generateText({
      system:
        "You are a strict image-prompt critic. Reply with exactly PASS or REJECT and one short reason on the same line.",
      userMessage: `Prompt: ${prompt}\nIntended use: ${input.notes ?? "mood/atmosphere"}\nWill this produce a useful image for a restrained, editorial, premium brand? Check for: visible AI-typography (rejection-level), generic stock feel, wrong aspect ratio mood, anything that would need post-processing typography.`,
      maxTokens: 100,
      temperature: 0.2,
      schemaKey: "visual-critique",
    });
    critique = critiqueResult.text;
    if (!/REJECT/i.test(critique)) break;
    if (attempt < maxAttempts && options.refine) {
      prompt = options.refine(prompt, critique);
    }
  }
  const result = await ai.generateImage({
    prompt,
    width: input.width,
    height: input.height,
    model: input.model,
  });
  lastResult = result;
  const asset: VisualAsset = {
    id: input.id,
    prompt,
    provider: "minimax",
    model: input.model ?? "image-01",
    sourceOutput: lastResult?.imageUrl ?? "",
    selectedOutput: lastResult?.imageUrl ?? "",
    destination: input.destination,
    width: input.width,
    height: input.height,
    status: "candidate",
    notes: input.notes ?? "",
    createdAt: new Date().toISOString(),
  };
  await registry.record(asset);
  return asset;
}
