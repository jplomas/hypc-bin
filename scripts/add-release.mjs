// Add a released compiler to bin/ from its theQRL/hyperion GitHub release and regenerate list.json.
//   node scripts/add-release.mjs 0.2.1
// Downloads hypjson.js and SHA256SUMS with the GitHub CLI, requires the sha256 to match and the build
// provenance attestation to verify, names the file from the version the binary reports, refuses to
// overwrite an existing binary, then rewrites list.json. Review the diff and open a pull request.
import { mkdtempSync, readFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { binDir, buildList, serialize, listPath } from './lib.mjs';
import { writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) { console.error('usage: node scripts/add-release.mjs <x.y.z>'); process.exit(2); }
const HYPERION = 'theQRL/hyperion';
const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${(r.stderr || r.stdout).trim()}`); return r.stdout; };

const work = mkdtempSync(join(tmpdir(), 'hypc-bin-add-'));
try {
  run('gh', ['release', 'download', `v${version}`, '--repo', HYPERION, '--pattern', 'hypjson.js', '--pattern', 'SHA256SUMS', '--dir', work]);
  const file = join(work, 'hypjson.js');
  const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
  const line = readFileSync(join(work, 'SHA256SUMS'), 'utf8').split('\n').find((l) => /\shypjson\.js$/.test(l));
  if (!line || line.split(/\s+/)[0] !== actual) throw new Error('hypjson.js does not match the release SHA256SUMS');
  run('gh', ['attestation', 'verify', file, '--repo', HYPERION]);
  const reported = run(process.execPath, ['--input-type=commonjs', '-e', `process.stdout.write(require(${JSON.stringify(file)}).cwrap('hyperion_version','string',[])())`]).trim();
  const m = /^(\d+\.\d+\.\d+)\+(commit\.[0-9a-f]{8})\./.exec(reported);
  if (!m || m[1] !== version) throw new Error(`binary reports version ${reported}, expected ${version}+commit.*`);
  const name = `hypjson-v${m[1]}+${m[2]}.js`;
  if (existsSync(join(binDir, name))) throw new Error(`bin/${name} already exists; binaries are immutable`);
  copyFileSync(file, join(binDir, name));
  writeFileSync(listPath, serialize(buildList()));
  console.log(`added bin/${name} (${reported}) and regenerated bin/list.json`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
