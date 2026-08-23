// R2 storage adapter interface.
//
// Two flavours of objects are stored:
//   1. Public brand assets (logo, seal, social imagery). World-readable.
//   2. Private member artefacts (letters, cards, certificates). Authorised
//      access only; no permanent world-readable URLs.
//
// Private artefacts must be served through a Worker route that authorises
// the requester (member self, operator) and streams from R2. The interface
// here is the storage primitive; the access-control layer is in the service.

export interface StorageAdapter {
  put(input: {
    key: string;
    body: Uint8Array | string;
    contentType: string;
    visibility: "PUBLIC" | "PRIVATE";
  }): Promise<{ key: string }>;
  get(input: { key: string }): Promise<{ body: Uint8Array; contentType: string } | null>;
  delete(input: { key: string }): Promise<void>;
  /** Generate a short-lived signed URL for a private object. */
  signedUrl(input: { key: string; ttlSeconds: number }): Promise<string>;
}
