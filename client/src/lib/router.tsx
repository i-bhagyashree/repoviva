// Minimal hash router (#/dashboard, #/report/123?x=1). No extra library and
// works with any static host because the server never sees the path.

import { useSyncExternalStore, type AnchorHTMLAttributes } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

const getHash = () => window.location.hash.slice(1) || "/";

export interface Route {
  path: string; // "/report/123"
  parts: string[]; // ["report", "123"]
  query: URLSearchParams;
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => "/");
  const [path, search = ""] = hash.split("?");
  return { path, parts: path.split("/").filter(Boolean), query: new URLSearchParams(search) };
}

export function navigate(to: string, replace = false) {
  if (replace) window.location.replace(`#${to}`);
  else window.location.hash = to;
  window.scrollTo(0, 0);
}

export function Link({ to, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={`#${to}`} {...rest} />;
}
