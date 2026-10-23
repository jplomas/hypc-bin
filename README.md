# hypc-bin

Emscripten builds of the [Hyperion](https://github.com/theQRL/hyperion) compiler, served at
`https://binaries.theqrl.org/bin/`. [`@theqrl/hypc`](https://www.npmjs.com/package/@theqrl/hypc)
downloads its compiler from here and checks it against `bin/list.json`.

## Rules

- `bin/list.json` is generated from the files in `bin/`. Never edit it by hand.
- A binary, once added, is never modified, renamed or deleted. A bad release burns its version
  number; publish a new one.
- Every binary must be the `hypjson.js` asset of the matching `theQRL/hyperion` GitHub release:
  identical sha256 to that release's `SHA256SUMS`, and a build provenance attestation that verifies.
  Versions that predate those release artefacts are listed in `scripts/release-policy.json`;
  nothing new may be added there.

CI (`.github/workflows/verify.yml`) enforces all three on every pull request and push to `main`.

## Adding a release

Requires Node.js 22+ and the GitHub CLI (`gh`), signed in.

```bash
npm ci --ignore-scripts --prefix scripts
node scripts/add-release.mjs 0.2.1          # download, verify sha256 + attestation, copy, regenerate list.json
node scripts/verify-list.mjs                # same checks CI runs
node scripts/check-releases.mjs
```

Then open a pull request with the new `bin/hypjson-v<version>+commit.<hash>.js` and the
regenerated `bin/list.json`.

## Verifying a download yourself

```bash
gh attestation verify hypjson-v0.2.1+commit.<hash>.js --repo theQRL/hyperion   # releases after 0.2.0
```

or compare its sha256 with the `hypjson.js` line of the release's `SHA256SUMS` on
<https://github.com/theQRL/hyperion/releases>.
