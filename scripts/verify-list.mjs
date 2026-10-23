// Verify bin/list.json: it must be byte-identical to what generate-list.mjs produces from the files,
// and every binary must report the version its file name and list entry claim.
//   node verify-list.mjs [--skip-embedded-version]
import { readFileSync } from 'node:fs';
import { buildList, serialize, listPath, embeddedVersion } from './lib.mjs';

let failed = false;
const fail = (msg) => { console.error(`::error::${msg}`); failed = true; };

const expected = buildList();
const committed = readFileSync(listPath, 'utf8');
if (committed !== serialize(expected)) {
  let parsed;
  try { parsed = JSON.parse(committed); } catch (e) { fail(`list.json is not valid JSON: ${e.message}`); }
  if (parsed) {
    for (const b of expected.builds) {
      const c = (parsed.builds || []).find((x) => x.path === b.path);
      if (!c) { fail(`list.json has no entry for bin/${b.path}`); continue; }
      for (const k of Object.keys(b)) {
        if (JSON.stringify(c[k]) !== JSON.stringify(b[k])) fail(`bin/${b.path}: ${k} is ${JSON.stringify(c[k])}, file gives ${JSON.stringify(b[k])}`);
      }
    }
    for (const c of parsed.builds || []) if (!expected.builds.some((b) => b.path === c.path)) fail(`list.json lists ${c.path}, which is not in bin/`);
    if (JSON.stringify(parsed.releases) !== JSON.stringify(expected.releases)) fail('releases map differs from the one generated from bin/');
    if (parsed.latestRelease !== expected.latestRelease) fail(`latestRelease is ${parsed.latestRelease}, expected ${expected.latestRelease}`);
  }
  fail('list.json differs from `node scripts/generate-list.mjs` output; regenerate it instead of editing by hand');
}

if (!process.argv.includes('--skip-embedded-version')) {
  for (const b of expected.builds) {
    const v = embeddedVersion(b.path);
    if (!v.startsWith(b.longVersion + '.')) fail(`bin/${b.path} reports version ${v}, expected ${b.longVersion}.*`);
    else console.log(`ok  ${b.path}  ${v}`);
  }
}
if (failed) process.exit(1);
console.log(`list.json verified: ${expected.builds.length} builds, latest ${expected.latestRelease}`);
