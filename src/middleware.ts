import { defineMiddleware } from "astro:middleware";
import { requireOnboardingSession, requireOperator } from "./lib/portal-auth";
import { withBrowserSecurityHeaders } from "./lib/request-security";
import { runtimeEnv } from "./lib/runtime-env";

const PRIVATE_ROBOTS = "noindex, nofollow, noarchive";
/**
 * Central route boundary for operator and onboarding surfaces. Individual
 * routes still re-check ownership before state changes, but no admin page or
 * onboarding page is allowed to render from a public request.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const requestUrl = new URL(context.request.url);
  const pathname = normalizePathname(requestUrl.pathname);
  if (!pathname) {
    return withBrowserSecurityHeaders(new Response("Invalid request path.", { status: 400 }));
  }
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const isOnboardingApi = pathname === "/api/onboarding" || pathname.startsWith("/api/onboarding/");
  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/");
  const isPortalApi = pathname === "/api/portal" || pathname.startsWith("/api/portal/");
  const isInternal =
    pathname === "/internal" ||
    pathname.startsWith("/internal/") ||
    pathname === "/brand-explorer" ||
    pathname.startsWith("/brand-explorer/") ||
    pathname === "/brand-r2" ||
    pathname.startsWith("/brand-r2/");
  const isLocalHost = requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1";

  if (isAdmin) {
    const operator = await requireOperator(context.request, runtimeEnv);
    if (!operator) return redirectToLogin(context.request, pathname);
  }

  // Visual laboratories are convenient on a local loopback address. On any
  // deployed hostname they use the same fail-closed operator boundary as the
  // admin surface.
  if (isInternal && !isLocalHost) {
    const operator = await requireOperator(context.request, runtimeEnv);
    if (!operator) return redirectToLogin(context.request, pathname);
  }

  if (isOnboarding || isOnboardingApi) {
    const onboarding = await requireOnboardingSession(context.request, runtimeEnv);
    if (!onboarding) {
      if (isOnboardingApi) {
        return withBrowserSecurityHeaders(
          new Response("Sign in to continue onboarding.", {
            status: 401,
            headers: { "cache-control": "no-store", "x-robots-tag": PRIVATE_ROBOTS },
          }),
        );
      }
      return redirectToLogin(context.request, pathname);
    }
  }

  const response = await next();
  if (!isAdmin && !isOnboarding && !isOnboardingApi && !isPortal && !isPortalApi && !isInternal)
    return withBrowserSecurityHeaders(response);
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  headers.set("x-robots-tag", PRIVATE_ROBOTS);
  return withBrowserSecurityHeaders(
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
});

/**
 * Astro routes decoded path segments. Apply equivalent conservative
 * normalisation before testing security boundaries so encoded or doubled
 * separators cannot turn a public-looking path into a private route later.
 */
function normalizePathname(rawPathname: string): string | null {
  let decoded = rawPathname;
  try {
    for (let pass = 0; pass < 4; pass += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return null;
  }
  if (/%[\da-f]{2}/i.test(decoded) || /[\u0000-\u001f\u007f]/.test(decoded)) return null;

  const segments: string[] = [];
  for (const segment of decoded.replaceAll("\\", "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  const trailingSlash = decoded.endsWith("/") && segments.length > 0 ? "/" : "";
  return `/${segments.join("/")}${trailingSlash}`;
}

function redirectToLogin(request: Request, pathname: string): Response {
  const source = new URL(request.url);
  const login = new URL("/portal/login/", source.origin);
  const next = `${pathname}${source.search}`;
  login.searchParams.set("next", next);
  return withBrowserSecurityHeaders(
    new Response(null, {
      status: 302,
      headers: {
        Location: login.toString(),
        "cache-control": "no-store",
        "x-robots-tag": PRIVATE_ROBOTS,
      },
    }),
  );
}
