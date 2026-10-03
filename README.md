# BLOQ

A small Blockly learning aid for building and deconstructing Kalaallisut
words and short sentences. It is a static site in `docs/`, powered by the
published [`oq-api`](https://jandahl.github.io/oq-api/) morphology engine.
The public name is BLOQ; the repository remains `jandahl/bl.oq.gl`.

## What it does

- **Build**: drag morphemes into a stem-first stack. Each change runs oq's
  word builder and shows either the resulting word or the grammar error.
- **Deconstruct**: enter a word or running text. A single word still uses the
  full word analysis (including other verified breakdowns). Two or more words
  use oq-api's sentence lattice (`analyzeSentence` + `assembleClause`): each
  source sentence becomes a Blockly sentence, closed morpheme chains become
  editable word blocks, and the clause gloss is the sentence's reading.
  A closed chain is drawn only when it is the reading the clause uses.
  Names the catalog does not contain, attested phrases whose chain means
  something else, and open or approximate analyses stay visible and are not
  drawn as verified blocks.
- **Explore**: filter morphemes, choose English or Danish glosses, adjust
  display/theme settings, and share Build or Deconstruct state through the
  URL.

The app is an MVP and is not linked from oq's main application.

## Data and architecture

The visualization picker keeps Blockly available and offers:

- Slot cards with an independent searchable palette and ordered editing.
- Interlinear tiers for citation forms, realized spans, glosses and sound changes.
- A connected derivation tree with aligned leaves and separate semantic evidence.
- An editable node/port path with explicit class metadata and ending features.
- A derivation stepper that builds each original prefix through the engine.

Edits update the same sentence plans and share links. Invalid proposals remain
visible in the alternative editor instead of losing morphemes through Blockly
connections. Presentation data comes from oq-api 0.4.6 `presentSequence`; the
original compatible catalog payload is retained alongside its engine presets.
Zero forms, approximate/open states and unresolved semantic obligations remain
explicit. Ordered derivation is never presented as verified semantic scope.

Form/gloss settings apply to card, port, tree-morpheme and step-button labels.
Engine-built surfaces, step results, interlinear tiers and semantic evidence
remain available as result displays. Editing a word invalidates the assembled
gloss for that sentence; other sentences and held words are preserved.

`npm run typecheck` checks the new pure visualization model incrementally.
For Python 3.14 browser checks, create `.venv-python3.14` with
`/opt/homebrew/bin/python3.14 -m venv .venv-python3.14`, then run tests with
`PATH="$PWD/.venv-python3.14/bin:$PATH" npm run test:e2e` (or `test:e2e:live`).

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

Same pin also exposes the have-N transform (oq-api 0.3.33+): host noun + optional count / howMany (qassit) / many (qassiit) / truth (ilumut?) / intensifier +
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

Default `test:e2e` is the **fixture** project (`docs/fixtures/` engine stub +
mini catalog). It does not need the live oq-api or grammarian hosts.

Live upstream checks (pinned `jandahl.github.io/api.oq.gl` public-api +
grammarian GitHub Pages mirror):

```bash
npm run test:live-smoke
npm run test:e2e:live
```

## Scope

This project is a learning aid, not a complete Kalaallisut grammar or a
dictionary. Morphological legality belongs to oq; this client presents the
engine's results and provides the interactive workshop around them.
