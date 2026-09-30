const messages = {
	en: {
		"app.title": "BLOQ", "theme.auto": "Theme: Auto", "theme.light": "Theme: Light", "theme.dark": "Theme: Dark", "display": "Settings", "settingsHeading": "Display and language",
		"subtitle": "A block-based learning aid for building and taking apart Kalaallisut words and short sentences. Prototype — nothing here is authoritative.", "analyzeHeading": "Analyze", "buildHeading": "Build a word", "buildInstruction": "Choose a category, then drag a block onto the canvas — or try an example below.",
		"attested": "Word or sentence", "deconstruct": "Deconstruct", "glossLanguage": "Gloss language", "wordPlaceholder": "e.g. qimmeqarpunga or Piitap inaaniippoq.", "clearWord": "Clear word", "clearFilter": "Clear filter",
		"english": "English", "danish": "Dansk", "both": "Both", "uiLanguage": "UI language", "morphemeLabels": "Morpheme labels",
		"formGloss": "Form + gloss", "formOnly": "Form only", "glossOnly": "Gloss only", "blockStyle": "Block style",
		"classic": "Classic", "zelos": "Zelos", "showIds": "Add internal API ids", "showMood": "Show mood labels", "readLast": "Read last morpheme first",
		"viewStyle": "Layout", "layoutStack": "Stack", "layoutHorizontal": "Horizontal", "layoutWrap": "Wrap",
		"viewStyleNote": "Horizontal and wrap are still the Blockly blocks. A word runs left to right instead of as a tall stack.",
		"buildInstructionLinear": "Same Blockly blocks, stem first, left to right. Drag from the palette. Horizontal stays on one line; Wrap breaks a long word onto more lines.",
		"paletteHide": "Hide palette", "paletteShow": "Show palette", "paletteFilter": "Filter by Kalaallisut form, id, or gloss…",
		"copyLink": "Copy link", "linkCopied": "Copied", "copyFailed": "Could not copy link", "clearCanvas": "Clear canvas", "emptyCanvasHint": "Drag a morpheme in, or try an example above.",
		"tryExample": "Try an example", "exampleDescription": "Deconstructs a word or sentence and drops the closed chains onto the canvas.",
		"exampleWordsLabel": "Words", "exampleSentencesLabel": "Sentences",
		"exampleBatchesLabel": "Example batches", "examplesOpen": "Browse…", "examplesClose": "Close",
		"examplesHeading": "Examples",
		"examplesWordsHint": "Organic single-word deconstructs from the shared oq-api standard-examples catalog. Selecting one deconstructs it onto the canvas.",
		"examplesSentencesHint": "Curated multi-word examples when the shared catalog provides them. Empty for now — nothing invented here.",
		"extendedExamples": "Browse…", "loading": "Loading morpheme catalog…", "loadingTitle": "Loading", "loadingCached": "Opening saved catalog…", "loadingParse": "Preparing morphemes…", "morphemeChain": "Morpheme chain", "results": "Results", "footerText": "An experimental learning tool for exploring Kalaallisut word structure.",
		"unknownMorpheme": "Unknown morpheme in stack.", "invalidSequence": "invalid sequence", "analysisFailed": "Analysis failed: {message}",
		"noVerifiedBreakdown": "No verified breakdown found for \"{token}\".", "noClosedReading": "No closed reading to place on the canvas.",
		"analyzingWord": "Analyzing \"{token}\"…", "analyzingWords": "Analyzing {count} words…", "analyzingSentence": "Analyzing {count} words as a sentence…",
		"loadedMorphemes": "Loaded {count} morphemes.", "failedToStart": "Failed to start: {message}",
		"completeWord": "complete word", "midDerivation": "mid-derivation — keep building", "nWords": "{count} words", "nSentences": "{count} sentences",
		"closedChainUnused": "Closed chain not used: {text}", "notOnCanvas": "Not placed on the canvas.",
		"noGloss": "(no gloss)", "noSuchEnding": "(no such ending in the catalog)",
		"workedExamplesHeading": "Examples", "workedExamplesDescription": "Shared standard-examples catalog from oq-api (also used by Misiliineq).",
		"workedExamplesFilter": "Filter examples", "workedExamplesFilterPh": "Filter by word or gloss…", "workedExamplesLoading": "Loading examples…",
		"workedExamplesEmpty": "No examples in this list yet.",
		"workedExamplesCount": "{shown} of {total} examples", "workedExamplesFailed": "Could not load the CI example set: {message}",
		"canvasLabel": "Morpheme workshop canvas", "canvasDescription": "Build words by stacking morpheme blocks. Current chains are listed in the results region.",
		"canvasChains": "Current canvas chains", "filterLabel": "Filter morphemes",
	},
	da: {
		"app.title": "BLOQ", "theme.auto": "Tema: Automatisk", "theme.light": "Tema: Lys", "theme.dark": "Tema: Mørk", "display": "Indstillinger", "settingsHeading": "Visning og sprog",
		"subtitle": "Et blokbaseret læringsværktøj til at bygge og analysere kalaallisut-ord og korte sætninger. Prototype — intet her er autoritativt.", "analyzeHeading": "Analysér", "buildHeading": "Byg et ord", "buildInstruction": "Vælg en kategori, og træk en blok over på lærredet — eller prøv et eksempel nedenfor.",
		"attested": "Ord eller sætning", "deconstruct": "Dekonstruér", "glossLanguage": "Glossprog", "wordPlaceholder": "f.eks. qimmeqarpunga eller Piitap inaaniippoq.", "clearWord": "Ryd ord", "clearFilter": "Ryd filter",
		"english": "English", "danish": "Dansk", "both": "Begge", "uiLanguage": "Brugerfladesprog", "morphemeLabels": "Morfemlabels",
		"formGloss": "Form + gloss", "formOnly": "Kun form", "glossOnly": "Kun gloss", "blockStyle": "Blokstil",
		"classic": "Klassisk", "zelos": "Zelos", "showIds": "Tilføj interne API-id'er", "showMood": "Vis modusmarkeringer", "readLast": "Læs sidste morfem først",
		"viewStyle": "Layout", "layoutStack": "Stak", "layoutHorizontal": "Vandret", "layoutWrap": "Ombryd",
		"viewStyleNote": "Vandret og ombryd er stadig Blockly-brikker. Et ord løber fra venstre mod højre i stedet for som en høj stak.",
		"buildInstructionLinear": "Samme Blockly-brikker, stamme først, fra venstre mod højre. Træk fra paletten. Vandret bliver på én linje; Ombryd deler et langt ord over flere linjer.",
		"paletteHide": "Skjul palette", "paletteShow": "Vis palette", "paletteFilter": "Filtrér efter kalaallisut-form, id eller gloss…",
		"copyLink": "Kopiér link", "linkCopied": "Kopieret", "copyFailed": "Kunne ikke kopiere link", "clearCanvas": "Ryd lærred", "emptyCanvasHint": "Træk et morfem ind, eller prøv et eksempel ovenfor.",
		"tryExample": "Prøv et eksempel", "exampleDescription": "Analyserer et ord eller en sætning og lægger de lukkede kæder på lærredet.",
		"exampleWordsLabel": "Ord", "exampleSentencesLabel": "Sætninger",
		"exampleBatchesLabel": "Eksempelgrupper", "examplesOpen": "Gennemse…", "examplesClose": "Luk",
		"examplesHeading": "Eksempler",
		"examplesWordsHint": "Organiske enkeltords-dekonstruktioner fra det delte oq-api standard-examples-katalog. Vælg et for at dekonstruere det på lærredet.",
		"examplesSentencesHint": "Kuraterede flerdords-eksempler, når det delte katalog har dem. Tomt for nu — intet opdigtet her.",
		"extendedExamples": "Gennemse…", "loading": "Indlæser morfemkatalog…", "loadingTitle": "Indlæser", "loadingCached": "Åbner gemt katalog…", "loadingParse": "Forbereder morfemer…", "morphemeChain": "Morfemkæde", "results": "Resultater", "footerText": "Et eksperimentelt læringsværktøj til at udforske kalaallisut-ords struktur.",
		"unknownMorpheme": "Ukendt morfem i stakken.", "invalidSequence": "ugyldig sekvens", "analysisFailed": "Analyse mislykkedes: {message}",
		"noVerifiedBreakdown": "Ingen verificeret opdeling fundet for \"{token}\".", "noClosedReading": "Ingen lukket læsning at placere på lærredet.",
		"analyzingWord": "Analyserer \"{token}\"…", "analyzingWords": "Analyserer {count} ord…", "analyzingSentence": "Analyserer {count} ord som en sætning…",
		"loadedMorphemes": "Indlæste {count} morfemer.", "failedToStart": "Kunne ikke starte: {message}",
		"completeWord": "fuldstændigt ord", "midDerivation": "midterivelse — byg videre", "nWords": "{count} ord", "nSentences": "{count} sætninger",
		"closedChainUnused": "Lukket kæde ikke brugt: {text}", "notOnCanvas": "Ikke placeret på lærredet.",
		"noGloss": "(ingen gloss)", "noSuchEnding": "(ingen sådan endelse i kataloget)",
		"workedExamplesHeading": "Eksempler", "workedExamplesDescription": "Delt standard-examples-katalog fra oq-api (bruges også af Misiliineq).",
		"workedExamplesFilter": "Filtrér eksempler", "workedExamplesFilterPh": "Filtrér efter ord eller gloss…", "workedExamplesLoading": "Indlæser eksempler…",
		"workedExamplesEmpty": "Ingen eksempler i denne liste endnu.",
		"workedExamplesCount": "{shown} af {total} eksempler", "workedExamplesFailed": "Kunne ikke indlæse CI-eksempelsættet: {message}",
		"canvasLabel": "Morfemværkstedets lærred", "canvasDescription": "Byg ord ved at stable morfemblokke. Aktuelle kæder står i resultatområdet.",
		"canvasChains": "Aktuelle lærredskæder", "filterLabel": "Filtrér morfemer",
	},
};

let locale = "en";

/** @param {string} key @param {Record<string, string|number>} [vars] */
export function t(key, vars = {}) {
	let text = messages[locale]?.[key] ?? messages.en[key] ?? key;
	for (const [name, value] of Object.entries(vars)) {
		text = text.replaceAll(`{${name}}`, String(value));
	}
	return text;
}
export function setLocale(value) { locale = value === "da" ? "da" : "en"; if (typeof document !== "undefined") document.documentElement.lang = locale; applyLocale(); return locale; }
export function getLocale() { return locale; }
export function applyLocale(root = typeof document === "undefined" ? null : document) {
	if (!root) return;
	root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
	root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
	root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)); });
}
