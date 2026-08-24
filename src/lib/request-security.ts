/** Shared request-boundary helpers for private state-changing endpoints. */

export const PRIVATE_RESPONSE_HEADERS = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;

/**
 * Browser mutation requests must be same-origin. Headerless clients (for
 * example the MCP/cron integrations) remain supported; when a browser sends
 * either signal, reject an explicitly cross-site request.
 */
export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return false;
    } catch {
      return false;
    }
  }
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  return true;
}

export function privateJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...PRIVATE_RESPONSE_HEADERS,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function privateTextResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      ...PRIVATE_RESPONSE_HEADERS,
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
