/**
 * One-shot migration: add the Logfare privacy disclosure to every locale.
 *
 * The disclosure is a legal/privacy notice, so it must exist in every locale or
 * the settings screen shows a raw key path. Real translations are wanted; until
 * a translator supplies them, the English text is inserted and recorded in
 * `untranslated-baseline.json` so `check:translations` stays green and the gap
 * is explicit rather than silent.
 *
 * Run once: `bun scripts/add-logfare-disclosure.ts`
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LOCALES_DIR = join(import.meta.dir, "..", "src", "i18n", "locales");
const BASELINE = join(import.meta.dir, "..", "src", "i18n", "untranslated-baseline.json");

const KEY_PATH = ["settings", "dictation", "cloud", "logfare", "disclosure"];
const KEY_NAME = KEY_PATH.join(".");

const ENGLISH =
  "Logfare is free and needs no card, but its terms say all API traffic is logged for research and data purposes, and the model is marked as requiring training opt-in. Anything you dictate here — including passwords, medical details or private messages — may be retained and used for training. Choose a local model, or a provider with a paid no-training tier, if that is not acceptable.";

/** Walk to the parent object, creating intermediate objects as needed. */
function ensureParent(root: Record<string, unknown>): Record<string, unknown> {
  let node = root;
  for (const part of KEY_PATH.slice(0, -1)) {
    if (typeof node[part] !== "object" || node[part] === null) {
      node[part] = {};
    }
    node = node[part] as Record<string, unknown>;
  }
  return node;
}

const locales = readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

let added = 0;
let already = 0;

for (const locale of locales) {
  const file = join(LOCALES_DIR, locale, "translation.json");
  const json = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const parent = ensureParent(json);
  const leaf = KEY_PATH[KEY_PATH.length - 1];

  if (typeof parent[leaf] === "string") {
    already += 1;
    continue;
  }

  parent[leaf] = ENGLISH;
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  added += 1;
}

// Record the English-in-a-locale case for every non-English locale.
const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<
  string,
  { sameAsEnglish?: string[]; englishFromOtherKey?: string[] }
>;

let baselined = 0;
for (const locale of locales) {
  if (locale === "en") continue;
  const entry = (baseline[locale] ??= {});
  const list = (entry.sameAsEnglish ??= []);
  if (!list.includes(KEY_NAME)) {
    list.push(KEY_NAME);
    list.sort();
    baselined += 1;
  }
}
writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");

console.log(
  `locales: ${locales.length} | added: ${added} | already present: ${already} | baselined: ${baselined}`,
);
