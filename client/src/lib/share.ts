// Share links for the static (GitHub Pages) build: there is no server to look a
// report up, so the link carries the report itself, compressed, after "#/s/".

import { STATIC } from "./config";
import type { SavedReport } from "./types";

const base = () => `${window.location.origin}${window.location.pathname}`;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export interface SharePayload {
  ownerName: string;
  report: SavedReport;
}

export async function makeShareUrl(report: SavedReport, ownerName: string): Promise<string> {
  if (!STATIC) return `${base()}#/share/${report.id}`;
  const { shared: _shared, ...plain } = report as SavedReport & { shared?: boolean };
  return `${base()}#/s/${await encodeShare({ ownerName, report: plain })}`;
}

export async function encodeShare(payload: SharePayload): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(payload)), new CompressionStream("deflate-raw"));
  return toBase64Url(packed);
}

export async function readShareData(encoded: string): Promise<SharePayload> {
  const bytes = await pipe(fromBase64Url(encoded), new DecompressionStream("deflate-raw"));
  return JSON.parse(new TextDecoder().decode(bytes)) as SharePayload;
}
