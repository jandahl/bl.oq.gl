const messages = {
	en: {
		"app.title": "BLOQ", "theme.auto": "Theme: Auto", "theme.light": "Theme: Light", "theme.dark": "Theme: Dark", "display": "Settings", "settingsHeading": "Display and language",
		"subtitle": "A block-based learning aid for building and taking apart Kalaallisut words. Prototype — nothing here is authoritative.", "analyzeHeading": "Analyze a word", "buildHeading": "Build a word", "buildInstruction": "Choose a category, then drag a block onto the canvas — or try an example below.",
		"attested": "Attested word", "deconstruct": "Deconstruct", "glossLanguage": "Gloss language", "wordPlaceholder": "e.g. qimmeqarpunga", "clearWord": "Clear word", "clearFilter": "Clear filter",
		"english": "English", "danish": "Dansk", "both": "Both", "uiLanguage": "UI language", "morphemeLabels": "Morpheme labels",
		"formGloss": "Form + gloss", "formOnly": "Form only", "glossOnly": "Gloss only", "blockStyle": "Block style",
		"classic": "Classic", "zelos": "Zelos", "showIds": "Add internal API ids", "readLast": "Read last morpheme first",
		"paletteHide": "Hide palette", "paletteShow": "Show palette", "paletteFilter": "Filter by Kalaallisut form, id, or gloss…",
		"copyLink": "Copy link", "linkCopied": "Copied", "clearCanvas": "Clear canvas", "emptyCanvasHint": "Drag a morpheme in, or try an example above.",
		"tryExample": "Try an example", "exampleDescription": "Deconstructs a word and drops the verified chain onto the canvas.",
		"exampleWordsLabel": "Words", "exampleSentencesLabel": "Sentences",
		"extendedExamples": "Extended examples", "loading": "Loading morpheme catalog…", "loadingTitle": "Loading", "loadingCached": "Opening saved catalog…", "loadingParse": "Preparing morphemes…", "morphemeChain": "Morpheme chain", "footerText": "An experimental learning tool for exploring Kalaallisut word structure.",
	},
	da: {
		"app.title": "BLOQ", "theme.auto": "Tema: Automatisk", "theme.light": "Tema: Lys", "theme.dark": "Tema: Mørk", "display": "Indstillinger", "settingsHeading": "Visning og sprog",
		"subtitle": "Et blokbaseret læringsværktøj til at bygge og analysere kalaallisut-ord. Prototype — intet her er autoritativt.", "analyzeHeading": "Analysér et ord", "buildHeading": "Byg et ord", "buildInstruction": "Vælg en kategori, og træk en blok over på lærredet — eller prøv et eksempel nedenfor.",
		"attested": "Attesteret ord", "deconstruct": "Dekonstruér", "glossLanguage": "Glossprog", "wordPlaceholder": "f.eks. qimmeqarpunga", "clearWord": "Ryd ord", "clearFilter": "Ryd filter",
		"english": "English", "danish": "Dansk", "both": "Begge", "uiLanguage": "Brugerfladesprog", "morphemeLabels": "Morfemlabels",
		"formGloss": "Form + gloss", "formOnly": "Kun form", "glossOnly": "Kun gloss", "blockStyle": "Blokstil",
		"classic": "Klassisk", "zelos": "Zelos", "showIds": "Tilføj interne API-id'er", "readLast": "Læs sidste morfem først",
		"paletteHide": "Skjul palette", "paletteShow": "Vis palette", "paletteFilter": "Filtrér efter kalaallisut-form, id eller gloss…",
		"copyLink": "Kopiér link", "linkCopied": "Kopieret", "clearCanvas": "Ryd lærred", "emptyCanvasHint": "Træk et morfem ind, eller prøv et eksempel ovenfor.",
		"tryExample": "Prøv et eksempel", "exampleDescription": "Analyserer et ord og lægger den verificerede kæde på lærredet.",
		"exampleWordsLabel": "Ord", "exampleSentencesLabel": "Sætninger",
		"extendedExamples": "Udvidede eksempler", "loading": "Indlæser morfemkatalog…", "loadingTitle": "Indlæser", "loadingCached": "Åbner gemt katalog…", "loadingParse": "Forbereder morfemer…", "morphemeChain": "Morfemkæde", "footerText": "Et eksperimentelt læringsværktøj til at udforske kalaallisut-ords struktur.",
	},
};

let locale = "en";
export function t(key) { return messages[locale]?.[key] ?? messages.en[key] ?? key; }
export function setLocale(value) { locale = value === "da" ? "da" : "en"; if (typeof document !== "undefined") document.documentElement.lang = locale; applyLocale(); return locale; }
export function getLocale() { return locale; }
export function applyLocale(root = typeof document === "undefined" ? null : document) {
	if (!root) return;
	root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
	root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
	root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)); });
}
