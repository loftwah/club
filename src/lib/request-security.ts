/** Shared request-boundary helpers for private state-changing endpoints. */

export const PRIVATE_RESPONSE_HEADERS = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;

export const BROWSER_SECURITY_HEADERS = {
  "content-security-policy":
    "base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'",
  "permissions-policy": "camera=(), geolocation=(), microphone=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
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
      ...BROWSER_SECURITY_HEADERS,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function privateTextResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      ...PRIVATE_RESPONSE_HEADERS,
      ...BROWSER_SECURITY_HEADERS,
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

export function withBrowserSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BROWSER_SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
