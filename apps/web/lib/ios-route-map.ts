import { iosDynamicRoutes, iosEmbeddedRoutes } from "@/lib/ios-embedded-routes";

export function resolveIosHref(href: string) {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://vtaerp.com");
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  if (iosEmbeddedRoutes.includes(pathname)) return href;
  for (const { pattern, target } of iosDynamicRoutes) {
    const expected = pattern.split("/");
    const actual = pathname.split("/");
    if (expected.length !== actual.length) continue;
    const values: Array<[string, string]> = [];
    if (!expected.every((part, index) => {
      if (!part.startsWith("[")) return part === actual[index];
      if (!actual[index]) return false;
      try { values.push([part.slice(1, -1), decodeURIComponent(actual[index])]); }
      catch { return false; }
      return true;
    })) continue;
    for (const [key, value] of values) url.searchParams.set(key, value);
    return `${target}${url.search}${url.hash}`;
  }
  return href;
}

export function iosRouteNeedsId(pathname: string) {
  return iosDynamicRoutes.some(route => route.target === pathname.replace(/\/$/, ""));
}

export function iosBackHref(pathname: string, query = "") {
  const path = pathname.replace(/\/$/, "");
  const parent = path.split("/").slice(0, -1).join("/");
  const fallback = path.startsWith("/admin") ? "/admin/dashboard" : "/dashboard/more";
  const target = parent && iosEmbeddedRoutes.includes(parent) ? parent : fallback;
  const id = new URLSearchParams(query).get("id");
  return iosRouteNeedsId(target) && id ? `${target}?id=${encodeURIComponent(id)}` : target;
}
