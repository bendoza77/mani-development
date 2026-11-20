// Verifies that every language has exactly the same translation keys, array lengths and
// {{placeholders}}/<tags> as English. Run with `npm run i18n:check`. Exits 1 on any problem.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../i18n/locales/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SOURCE = "en";
const languages = readdirSync(root).filter((d) => d !== SOURCE);
const problems = [];

const tokens = (s) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}|<\/?(\w+)>/g)].map((m) => m[0].replace(/\s/g, "")).sort().join(" ");

function compare(a, b, path, lang) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return problems.push(`${lang}: ${path} should be an array`);
    if (a.length !== b.length) problems.push(`${lang}: ${path} has ${b.length} items, English has ${a.length}`);
    a.forEach((v, i) => i < b.length && compare(v, b[i], `${path}[${i}]`, lang));
    return;
  }
  if (a && typeof a === "object") {
    if (!b || typeof b !== "object" || Array.isArray(b)) return problems.push(`${lang}: ${path} should be an object`);
    for (const k of Object.keys(a)) {
      if (!(k in b)) problems.push(`${lang}: missing ${path}.${k}`);
      else compare(a[k], b[k], `${path}.${k}`, lang);
    }
    for (const k of Object.keys(b)) if (!(k in a)) problems.push(`${lang}: extra key ${path}.${k} (not in English)`);
    return;
  }
  if (typeof b !== "string") return problems.push(`${lang}: ${path} should be a string`);
  if (!b.trim()) problems.push(`${lang}: ${path} is empty`);
  if (tokens(a) !== tokens(b)) problems.push(`${lang}: ${path} placeholders/tags differ: "${tokens(a)}" vs "${tokens(b)}"`);
}

const files = readdirSync(join(root, SOURCE)).filter((f) => f.endsWith(".json"));
for (const lang of languages) {
  for (const file of files) {
    let other;
    try {
      other = JSON.parse(readFileSync(join(root, lang, file), "utf8"));
    } catch {
      problems.push(`${lang}: ${file} is missing or not valid JSON`);
      continue;
    }
    compare(JSON.parse(readFileSync(join(root, SOURCE, file), "utf8")), other, file.replace(/\.json$/, ""), lang);
  }
  for (const f of readdirSync(join(root, lang))) if (!files.includes(f)) problems.push(`${lang}: extra file ${f}`);
}

if (problems.length) {
  console.error(`i18n check failed (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`i18n check passed: ${languages.join(", ")} match ${SOURCE} (${files.length} namespaces).`);
