// In-memory storage adapter for tests.

import type { StorageAdapter } from "./storage.js";

export class InMemoryStorage implements StorageAdapter {
  private readonly objects = new Map<
    string,
    { body: Uint8Array; contentType: string; visibility: "PUBLIC" | "PRIVATE" }
  >();

  async put(input: {
    key: string;
    body: Uint8Array | string;
    contentType: string;
    visibility: "PUBLIC" | "PRIVATE";
  }): Promise<{ key: string }> {
    const body = typeof input.body === "string" ? new TextEncoder().encode(input.body) : input.body;
    this.objects.set(input.key, {
      body,
      contentType: input.contentType,
      visibility: input.visibility,
    });
    return { key: input.key };
  }

  async get(input: { key: string }): Promise<{ body: Uint8Array; contentType: string } | null> {
    const o = this.objects.get(input.key);
    if (!o) return null;
    return { body: o.body, contentType: o.contentType };
  }

  async delete(input: { key: string }): Promise<void> {
    this.objects.delete(input.key);
  }

  async signedUrl(input: { key: string; ttlSeconds: number }): Promise<string> {
    return `fake://signed/${encodeURIComponent(input.key)}?ttl=${input.ttlSeconds}`;
  }
}
