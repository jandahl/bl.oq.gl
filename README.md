# bl-oq-ly

A small Blockly learning aid for building and deconstructing Kalaallisut
words. It is a static site in `docs/`, powered by the published
[`oq-api`](https://jandahl.github.io/oq-api/) morphology engine.

## What it does

- **Build**: drag morphemes into a stem-first stack. Each change runs oq's
  word builder and shows either the resulting word or the grammar error.
- **Deconstruct**: enter a word to find a verified morpheme chain. The app
  shows oq's composed translation, a per-morpheme breakdown, and the chain as
  editable Blockly blocks.
- **Explore**: filter morphemes, choose English or Danish glosses, adjust
  display/theme settings, and share Build or Deconstruct state through the
  URL.

The app is an MVP and is not linked from oq's main application.

## Data and architecture

`docs/oq-api.js` pins the oq-api release. The app uses that module's exported
`GRAMMAR_MORPHEMES_URL`, so the engine and catalog stay on a compatible
release pair. The current catalog is grammarian's ID-first
`morphemes-by-id.json`; the app does not ship a local grammar-data copy.

`docs/catalog.js` loads and merges the catalog. `docs/app.js` owns the live
API integration; `docs/blocks.js`, `docs/breakdown.js`, and `docs/gloss.js`
handle the Blockly UI and presentation. Approximate analyses are never
turned into verified Build chains, and missing morphemes fail visibly.

The catalog is hand-authored and currently marked non-authoritative by its
upstream. The app surfaces that status.

## Run locally

```bash
npm install
npm run build:vendor
npm run serve
```

Open <http://localhost:8000/>. The site must be served over HTTP because its
ES modules do not work from `file://` URLs.

## Test

```bash
npm run lint
npm run test:unit
npm run test:e2e
npm test
```

The E2E suite serves `docs/` and uses the live oq-api and grammarian catalog,
so failures may reflect an upstream API/catalog change as well as a local
regression.

## Scope

This project is a learning aid, not a complete Kalaallisut grammar or a
dictionary. Morphological legality belongs to oq; this client presents the
engine's results and provides the interactive workshop around them.
