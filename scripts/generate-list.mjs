// Regenerate bin/list.json from the binaries in bin/. Never edit list.json by hand.
import { writeFileSync } from 'node:fs';
import { buildList, serialize, listPath } from './lib.mjs';

const list = buildList();
writeFileSync(listPath, serialize(list));
console.log(`wrote ${listPath}: ${list.builds.length} builds, latest ${list.latestRelease}`);
