// Shim for node:path
export function join(...parts) {
  let segments = [];
  for (let part of parts) {
    segments.push(...part.split(/[/\\]/));
  }
  for (let i = 0; i < segments.length; i++) {
    if (segments[i] === "..") {
      segments.splice(i - 1, 2);
      i -= 2;
    } else if (segments[i] === ".") {
      segments.splice(i, 1);
      i--;
    }
  }
  return segments.join("/");
}

export function resolve(...parts) {
  return join(...parts);
}

export function dirname(p) {
  const parts = p.split(/[/\\]/);
  parts.pop();
  return parts.join("/") || "/";
}

export function basename(p, ext) {
  const parts = p.split(/[/\\]/);
  let base = parts.pop() || "";
  if (ext && base.endsWith(ext)) {
    base = base.slice(0, -ext.length);
  }
  return base;
}

export function extname(p) {
  const base = basename(p);
  const idx = base.lastIndexOf(".");
  return idx > 0 ? base.slice(idx) : "";
}

export function relative(from, to) {
  return to; // Simplified for browser
}

export function isAbsolute(p) {
  return p.startsWith("/");
}

export const sep = "/";
export const delimiter = ":";

export default {
  join,
  resolve,
  dirname,
  basename,
  extname,
  relative,
  isAbsolute,
  sep,
  delimiter,
};
