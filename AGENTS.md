# AGENTS.md

## Project

`bl.oq.gl` (BLOQ) is a static Blockly learning aid for building and deconstructing
Kalaallisut words and short sentences. The app lives in `docs/` and has no bundling step.

## Important boundaries

- `docs/oq-api.js` pins the oq-api release used by the app (`loadEngine` / `OQ_API_URL`).
- `docs/catalog.js` must load the compatible catalog URL exported by oq-api.
- Do not combine a rolling API URL with an independently rolling grammarian
  catalog.
- Approximate or incomplete analyses must never be presented as verified Build
  chains. Missing morpheme IDs must fail visibly; never silently skip them.

## Validation

```sh
npm run test:unit
npm run lint
npm run test:e2e
```

Default `test:e2e` is the **fixture** Playwright project: it boots against
`docs/fixtures/engine-stub.js` and `docs/fixtures/catalog-mini.json`, so a PR
does not go red when `jandahl.github.io/api.oq.gl` or the grammarian mirror is
down.

Live upstream check (pinned public-api + grammarian catalog):

```sh
npm run test:live-smoke
# or the full live suite:
npm run test:e2e:live
```

## Files

- `docs/app.js` — app wiring and analysis flow
- `docs/session.js` — workshop session + pure Build computation
- `docs/sentence-plan.js` — sentence lattice → Blockly sentences
- `docs/blocks.js` — Blockly blocks and chain rendering
- `docs/catalog.js` — runtime catalog loading with Cache Storage
- `docs/catalog-cache.js` — catalog cache helpers
- `docs/oq-api.js` — oq-api pin + `loadEngine` port
- `docs/fixtures/` — offline engine stub + mini catalog for fixture e2e
- `test/unit/` — fast unit tests (no network)
- `test/e2e/` — browser tests (fixture by default; live via `BLOQ_LIVE=1`)

## Changes

- Keep changes focused and preserve existing user work.
- Add or update tests for behavior changes.
- Run `git diff --check` before committing.
- Use a concise conventional commit and open a PR; do not push directly to
  `master`.
