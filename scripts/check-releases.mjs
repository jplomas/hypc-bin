// Cross-check every released binary against the theQRL/hyperion GitHub release that produced it:
// sha256 must equal the hypjson.js line of the release's SHA256SUMS, and the build provenance
// attestation must verify. Versions older than the release pipeline are listed in release-policy.json.
// Needs the GitHub CLI (`gh`) with a token (GH_TOKEN in CI).
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildList, binDir, policy } from './lib.mjs';

const HYPERION = 'theQRL/hyperion';
const { noGithubRelease, noAttestation } = policy();
const gh = (args) => spawnSync('gh', args, { encoding: 'utf8' });
let failed = false;
const fail = (msg) => { console.error(`::error::${msg}`); failed = true; };

const work = mkdtempSync(join(tmpdir(), 'hypc-bin-'));
try {
  const list = buildList();
  for (const [version, path] of Object.entries(list.releases)) {
    const entry = list.builds.find((b) => b.path === path);
    if (noGithubRelease.includes(version)) { console.log(`skip ${version}: predates GitHub releases (release-policy.json)`); continue; }
    const dir = join(work, version);
    const dl = gh(['release', 'download', `v${version}`, '--repo', HYPERION, '--pattern', 'SHA256SUMS', '--dir', dir]);
    if (dl.status !== 0) { fail(`${version}: cannot download SHA256SUMS from ${HYPERION} v${version}: ${dl.stderr.trim()}`); continue; }
    const line = readFileSync(join(dir, 'SHA256SUMS'), 'utf8').split('\n').find((l) => /\shypjson\.js$/.test(l));
    if (!line) { fail(`${version}: SHA256SUMS of v${version} has no hypjson.js line`); continue; }
    const expected = '0x' + line.split(/\s+/)[0];
    if (expected !== entry.sha256) fail(`${version}: bin/${path} sha256 ${entry.sha256} != release SHA256SUMS ${expected}`);
    else console.log(`ok   ${version}: sha256 matches ${HYPERION} v${version} SHA256SUMS`);
    if (noAttestation.includes(version)) { console.log(`skip ${version}: released before build provenance (release-policy.json)`); continue; }
    const att = gh(['attestation', 'verify', join(binDir, path), '--repo', HYPERION]);
    if (att.status !== 0) fail(`${version}: build provenance attestation does not verify: ${(att.stderr || att.stdout).trim()}`);
    else console.log(`ok   ${version}: build provenance attestation verifies`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
if (failed) process.exit(1);
