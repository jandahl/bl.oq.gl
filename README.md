# BLOQ

A small Blockly learning aid for building and deconstructing Kalaallisut
words and short sentences. It is a static site in `docs/`, powered by the
published [`oq-api`](https://jandahl.github.io/oq-api/) morphology engine.
The public name is BLOQ; the repository remains `jandahl/bl.oq.gl`.

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


## Conjugation (oq-api one-call)

BLOQ's Build path still composes via `buildWord(seq)` and the verb-ending
picker (morpheme IDs). The pinned oq-api also exposes the same one-call
conjugation transform oq.gl uses:

```js
import {
  buildEndingCatalog, conjugateForm, API_VERSION,
} from "./oq-api.js";

const catalog = buildEndingCatalog(flat); // from grammarian morphemes
const formed = conjugateForm("nerivoq", {
  catalog,
  mood: "IND",
  subject: { person: 1, number: "SG" },
  // object: { person: 3, number: "SG" }, // implies transitive
  // transitive: true,
  stemHint: null, // trusted override for intr + tr (0.3.23+)
  gloss: "eat",
});
// formed → { ok, word, approximate, stem, ending, schwa, errorKey, translation }
```

Public options on `conjugateForm`'s `spec`: `catalog`, `mood`, `subject` (or
top-level `person`/`number`), optional `object` / `transitive`, `stemHint`,
`gloss`. Never invents a stem — ambiguous citations decline without a verified
`stemHint`.


## Have-N (oq-api one-call)

Same pin also exposes the have-N transform (oq-api 0.3.30+): host noun + optional count / howMany (qassit) / many (qassiit) / truth (ilumut?) / intensifier +
optional count + `-qaq` + conjugation ending → surface via `buildWord`
(never invented stems).

```js
import {
  buildEndingCatalog, haveNForm, HAVE_N_CARDINALS, API_VERSION,
} from "./oq-api.js";

const endingCatalog = buildEndingCatalog(flat);
const formed = haveNForm({
  host: "qimmeq",
  catalog: byId,           // grammarian by-id map / list
  endingCatalog,
  mood: "IND",
  subject: { person: 1, number: "SG" },
  // count: 3,             // optional 1–10 → instrumental companion
});
// formed → { ok, word, phrase, numeral, seq, errorKey, missingIds, … }
```

`HAVE_N_CARDINALS` maps 1–10 → cardinal ids (`arfineq` for six). Missing host
(e.g. `nuliaq`) returns `errorKey: "missing_host"` — do not invent; ping
Grammarian if the UI inventory needs the host.

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
