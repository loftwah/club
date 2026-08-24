import type { APIRoute } from "astro";
import { getRuntimeEnv } from "@lib/runtime-env";
import inventoryData from "../../../../../../creative/video-inventory.json";

type Kind = "delivery" | "master" | "poster" | "thumbnail" | "contactSheet" | "renderManifest";
type Asset = {
  id: string;
  approvalState: string;
  sourceFingerprint?: string;
  locations?: Partial<Record<Kind, string>> | null;
};

const MIME: Record<Kind, string> = {
  delivery: "video/mp4",
  master: "video/quicktime",
  poster: "image/jpeg",
  thumbnail: "image/jpeg",
  contactSheet: "image/jpeg",
  renderManifest: "application/json",
};

type ByteRange = { offset: number; length?: number } | { suffix: number };

export const parseByteRange = (value: string | null): ByteRange | null | "invalid" => {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return "invalid";

  if (!match[1]) {
    const suffix = Number(match[2]);
    return Number.isSafeInteger(suffix) && suffix > 0 ? { suffix } : "invalid";
  }

  const offset = Number(match[1]);
  if (!Number.isSafeInteger(offset) || offset < 0) return "invalid";
  if (!match[2]) return { offset };

  const end = Number(match[2]);
  if (!Number.isSafeInteger(end) || end < offset) return "invalid";
  return { offset, length: end - offset + 1 };
};

export const prerender = false;

export const GET: APIRoute = async ({ params, request, locals }) => {
  const kind = params.kind as Kind;
  if (!(kind in MIME)) return new Response("Not found", { status: 404 });

  const asset = (inventoryData.assets as Asset[]).find((entry) => entry.id === params.id);
  if (
    asset?.approvalState !== "approved" ||
    asset.sourceFingerprint !== __CREATIVE_SOURCE_FINGERPRINT__
  )
    return new Response("Not found", { status: 404 });
  const location = asset?.locations?.[kind];
  const prefix = "r2://social-club-artifacts/";
  if (!location?.startsWith(prefix)) return new Response("Not found", { status: 404 });

  const range = parseByteRange(request.headers.get("range"));
  if (range === "invalid") return new Response("Invalid range", { status: 416 });
  const object = await getRuntimeEnv(locals).ARTIFACTS.get(
    location.slice(prefix.length),
    range ? { range } : undefined,
  );
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
    "content-type": MIME[kind],
    etag: object.httpEtag,
  });

  if (object.range) {
    if ("suffix" in object.range) {
      const start = Math.max(0, object.size - object.range.suffix);
      headers.set("content-range", `bytes ${start}-${object.size - 1}/${object.size}`);
      headers.set("content-length", String(object.size - start));
    } else {
      const start = object.range.offset ?? 0;
      const length = object.range.length ?? object.size - start;
      headers.set("content-range", `bytes ${start}-${start + length - 1}/${object.size}`);
      headers.set("content-length", String(length));
    }
    return new Response(object.body as unknown as BodyInit, { status: 206, headers });
  }

  headers.set("content-length", String(object.size));
  return new Response(object.body as unknown as BodyInit, { status: 200, headers });
};
