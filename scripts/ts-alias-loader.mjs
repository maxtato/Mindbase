import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const basePath = path.join(root, specifier.slice(2));
    const resolvedPath = resolveFile(basePath);
    if (resolvedPath) {
      return { url: pathToFileURL(resolvedPath).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}

function resolveFile(basePath) {
  if (existsSync(basePath)) return basePath;
  for (const extension of [".ts", ".tsx", ".js", ".mjs"]) {
    const candidate = `${basePath}${extension}`;
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}
