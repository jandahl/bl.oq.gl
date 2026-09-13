# AGENTS.md

## Project

`bl.oq.gl` is a static Blockly learning aid for building and deconstructing
Kalaallisut words. The app lives in `docs/` and has no bundling step.

## Important boundaries

- `docs/oq-api.js` pins the oq-api release used by the app.
- `docs/catalog.js` must load the compatible catalog URL exported by oq-api.
- Do not combine a rolling API URL with an independently rolling grammarian
  catalog.
- Approximate or incomplete analyses must never be presented as verified Build
  chains. Missing morpheme IDs must fail visibly; never silently skip them.

## Validation

```sh
npm run test:unit
npm run lint
npm run typecheck
npm run test:e2e
```

The E2E suite serves `docs/` with the configured Playwright web server and
uses the live oq-api and grammarian catalog.

## Files

- `docs/app.js` — app wiring and analysis flow
- `docs/blocks.js` — Blockly blocks and chain rendering
- `docs/catalog.js` — runtime catalog loading
- `docs/oq-api.js` — oq-api integration
- `test/unit/` — fast unit tests
- `test/e2e/` — browser tests

## Changes

- Keep changes focused and preserve existing user work.
- Add or update tests for behavior changes.
- Run `git diff --check` before committing.
- Use a concise conventional commit and open a PR; do not push directly to
  `master`.
