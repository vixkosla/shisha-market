const listingPath = /^\/listings\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/edit)?$/i;

export function safeLoginReturn(value: unknown): string {
  if (typeof value !== "string" || value.length > 300 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/account";
  const url = new URL(value, "https://shisha.invalid");
  if (url.origin !== "https://shisha.invalid") return "/account";
  if (url.pathname === "/account/mcp") {
    const request = url.searchParams.get("request");
    return request && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request) ? `/account/mcp?request=${request}` : "/account/mcp";
  }
  if (["/account", "/listings/new", "/favorites", "/support"].includes(url.pathname) || listingPath.test(url.pathname)) return url.pathname;
  return "/account";
}

export function loginHref(returnTo = "/account", renew = false) {
  const path = safeLoginReturn(returnTo);
  const params = new URLSearchParams();
  if (renew) params.set("renew", "1");
  if (path !== "/account") params.set("next", path);
  return `/login${params.size ? `?${params}` : ""}`;
}
