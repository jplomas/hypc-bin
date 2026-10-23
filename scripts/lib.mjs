// Shared helpers for the hypc-bin list tooling. list.json is a pure function of the files in bin/:
// nothing in it is typed by hand, so generate-list.mjs and verify-list.mjs agree by construction.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const binDir = join(root, 'bin');
export const listPath = join(binDir, 'list.json');

// hypjson-v<version>+<build>.js, e.g. hypjson-v0.2.0+commit.e36a0aea.js
const NAME = /^hypjson-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\+(commit\.[0-9a-f]{8})\.js$/;

export function parseName(file) {
  const m = NAME.exec(file);
  if (!m) return null;
  return { version: m[1], build: m[2], longVersion: `${m[1]}+${m[2]}` };
}

export function semverCompare(a, b) {
  const [ma, pa] = a.split('-', 2);
  const [mb, pb] = b.split('-', 2);
  const na = ma.split('.').map(Number), nb = mb.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (na[i] !== nb[i]) return na[i] - nb[i];
  if (pa === pb) return 0;
  if (pa === undefined) return 1;   // a release sorts after its pre-releases
  if (pb === undefined) return -1;
  return pa < pb ? -1 : 1;
}

export function hashes(file) {
  const buf = readFileSync(join(binDir, file));
  return {
    keccak256: '0x' + bytesToHex(keccak_256(buf)),
    sha256: '0x' + createHash('sha256').update(buf).digest('hex'),
  };
}

export function binaries() {
  const files = readdirSync(binDir).filter((f) => f.endsWith('.js'));
  const bad = files.filter((f) => !parseName(f));
  if (bad.length) throw new Error(`unexpected file name(s) in bin/: ${bad.join(', ')}`);
  return files.map((f) => ({ file: f, ...parseName(f) })).sort((x, y) => semverCompare(x.version, y.version));
}

// Build list.json exactly as it has been published: builds ascending, releases descending.
export function buildList() {
  const bins = binaries();
  const versions = new Set();
  const builds = bins.map((b) => {
    if (versions.has(b.version)) throw new Error(`two binaries for version ${b.version}`);
    versions.add(b.version);
    return { path: b.file, version: b.version, build: b.build, longVersion: b.longVersion, ...hashes(b.file), urls: [] };
  });
  const released = builds.filter((b) => !b.version.includes('-'));
  const releases = {};
  for (const b of [...released].reverse()) releases[b.version] = b.path;
  const list = { builds, releases };
  if (released.length) list.latestRelease = released[released.length - 1].version;
  return list;
}

export const serialize = (list) => JSON.stringify(list, null, 2) + '\n';

// Load a binary in a child process and return the version string the compiler reports.
export function embeddedVersion(file) {
  const code = `const m = require(${JSON.stringify(join(binDir, file))});
    const v = m.cwrap('hyperion_version', 'string', [])();
    process.stdout.write(v);`;
  const r = spawnSync(process.execPath, ['--input-type=commonjs', '-e', code], { encoding: 'utf8', maxBuffer: 1 << 20 });
  if (r.status !== 0) throw new Error(`could not load ${file}: ${r.stderr.trim().split('\n').pop()}`);
  return r.stdout.trim();
}

export function policy() {
  return JSON.parse(readFileSync(join(root, 'scripts', 'release-policy.json'), 'utf8'));
}
