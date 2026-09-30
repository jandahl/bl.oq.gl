import { buildWord, analyzeWordAsync, tokenizeSentence, analyzeSentence, assembleClause, glossSummaryItems, headlineGloss, resolveMoodLabel, resolvePersonLabel } from "./oq-api.js";
import { loadCatalog } from "./catalog.js";
import {
	defineMorphemeBlocks, buildToolbox, topLevelSentences, renderSentencePlan, relabelBlocks, labelContainers,
	buildVerbEndingIndex, buildNounEndingIndex, defineVerbEndingPickerBlock, defineNounEndingPickerBlock, defineVerbObjectBlock, registerVerbPickerReactivity,
	presetMatchesQuery,
} from "./blocks.js";
import {
	createSession, clearAnalysisCaches, seqForChain as resolveSeqForChain, planMatchesCanvas,
	deconstructIdsMatchSentences, computeBuild,
} from "./session.js";
import { renderBreakdown, renderAlternativeBreakdowns, renderTonedPhrases, wordTone } from "./breakdown.js";
import { buildBlocklyThemes } from "./theme.js";
import { composedTranslation } from "./gloss.js";
import { readState, writeState, routeForState } from "./router.js";
import { isSentenceInput, planFromLattice, canvasSentences, withInitialCapital, assemblyReading } from "./sentence-plan.js";
import { loadWorkedExamples, loadStandardExamples } from "./worked-examples.js";
import { setLocale, applyLocale, t } from "./i18n.js";

/** Radiogroup of [role=radio][data-value] buttons that behaves like a <select>
 *  (.value getter/setter + change events) so displayOptions() stays unchanged. */
function enhanceSegmented(root) {
	const buttons = () => [...root.querySelectorAll('[role="radio"]')];
	const apply = (value) => {
		for (const btn of buttons()) {
			const selected = btn.dataset.value === value;
			btn.setAttribute("aria-checked", selected ? "true" : "false");
			btn.tabIndex = selected ? 0 : -1;
		}
		root.dataset.value = value;
	};
	Object.defineProperty(root, "value", {
		configurable: true,
		get() {
			return root.dataset.value
				|| buttons().find((b) => b.getAttribute("aria-checked") === "true")?.dataset.value
				|| "";
		},
		set(value) { apply(value); },
	});
	root.addEventListener("click", (event) => {
		const btn = event.target.closest('[role="radio"]');
		if (!btn || !root.contains(btn)) return;
		if (root.value === btn.dataset.value) return;
		root.value = btn.dataset.value;
		root.dispatchEvent(new Event("change", { bubbles: true }));
	});
	root.addEventListener("keydown", (event) => {
		const current = event.target.closest('[role="radio"]');
		if (!current || !root.contains(current)) return;
		const options = buttons();
		const index = options.indexOf(current);
		const nextIndex = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % options.length
			: event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index - 1 + options.length) % options.length
			: event.key === "Home" ? 0
			: event.key === "End" ? options.length - 1
			: -1;
		if (nextIndex < 0) return;
		event.preventDefault();
		const next = options[nextIndex];
		next.focus();
		if (root.value !== next.dataset.value) {
			root.value = next.dataset.value;
			root.dispatchEvent(new Event("change", { bubbles: true }));
		}
	});
	apply(root.value);
	return root;
}

function bindClearable(input, button) {
	const sync = () => { button.hidden = !input.value; };
	button.addEventListener("click", () => {
		input.value = "";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.focus();
	});
	input.addEventListener("input", sync);
	sync();
	return input;
}

function setFieldValue(input, value) {
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

let statusEl;
let statusLine;
let wordInput;
let deconstructForm;
let blocklyDiv;
let breakdownDiv;
let breakdownDetails;
let breakdownSummaryMeta;
let themeToggleBtn;
let displayToggleBtn;
let displayPanel;
let paletteToggleBtn;
let copyLinkBtn;
let clearCanvasBtn;
let filterWrap;
let filterInput;
let blocklyThemeSelect;
let exampleWordButtons;
let workedExamplesBtn;
let workedExamplesModal;
let workedExamplesClose;
let workedExamplesFilter;
let workedExamplesStatus;
let workedExamplesList;
let showIdsCheckbox;
let showMoodCheckbox;
let readingOrderCheckbox;
let langSelect;
let uiLangSelect;
let spellingSelect;
let readingLine;
let loadingModal;
let loadingStatus;
let loadingProgress;
let loadingProgressFill;
let prefersDarkQuery;
let DISPLAY_MQ;

const session = createSession();
let paletteVisible = true;
let blocklyThemes = null;
let selectedBlocklyTheme = "classic";
let workedExamples = [];
let windowBound = false;
let startInflight = null;

function bindDom() {
	statusEl = document.getElementById("status");
	statusLine = document.getElementById("status-line");
	wordInput = bindClearable(
		document.getElementById("word-input"),
		document.getElementById("word-input-clear"),
	);
	deconstructForm = document.getElementById("deconstruct-form");
	blocklyDiv = document.getElementById("blockly-div");
	breakdownDiv = document.getElementById("breakdown");
	breakdownDetails = document.getElementById("breakdown-details");
	breakdownSummaryMeta = document.getElementById("breakdown-summary-meta");
	themeToggleBtn = document.getElementById("theme-toggle");
	displayToggleBtn = document.getElementById("display-toggle");
	displayPanel = document.getElementById("display-panel");
	paletteToggleBtn = document.getElementById("palette-toggle");
	copyLinkBtn = document.getElementById("copy-link-btn");
	clearCanvasBtn = document.getElementById("clear-canvas-btn");
	filterWrap = document.getElementById("morpheme-filter-wrap");
	filterInput = bindClearable(
		document.getElementById("morpheme-filter"),
		document.getElementById("morpheme-filter-clear"),
	);
	blocklyThemeSelect = enhanceSegmented(document.getElementById("blockly-theme-select"));
	workedExamplesBtn = document.getElementById("worked-examples-btn");
	workedExamplesModal = document.getElementById("worked-examples-modal");
	workedExamplesClose = document.getElementById("worked-examples-close");
	workedExamplesFilter = document.getElementById("worked-examples-filter");
	workedExamplesStatus = document.getElementById("worked-examples-status");
	workedExamplesList = document.getElementById("worked-examples-list");
	showIdsCheckbox = document.getElementById("opt-show-ids");
	showMoodCheckbox = document.getElementById("opt-show-mood");
	readingOrderCheckbox = document.getElementById("opt-reading-order");
	langSelect = enhanceSegmented(document.getElementById("opt-lang"));
	uiLangSelect = enhanceSegmented(document.getElementById("opt-ui-lang"));
	spellingSelect = enhanceSegmented(document.getElementById("opt-spelling"));
	readingLine = document.getElementById("reading-line");
	loadingModal = document.getElementById("loading-modal");
	loadingStatus = document.getElementById("loading-status");
	loadingProgress = document.getElementById("loading-progress");
	loadingProgressFill = document.getElementById("loading-progress-fill");
	prefersDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
	DISPLAY_MQ = window.matchMedia("(min-width: 720px)");
	paletteVisible = window.innerWidth >= 640;
}

// --- Display options (bl-oq-ly#10, #11, #17), persisted like the theme.
// `displayOptions()` is the single source of truth passed into every
// labelFor()-consuming call (blocks.js's buildToolbox/renderSentencePlan/
// relabelBlocks, breakdown.js/gloss.js's glossSummaryItems lang) so all of
// them stay in sync with each other -- the earlier "hiding ids also hid the
// spelling" bug (bl-oq-ly#14) came from exactly this kind of state living in
// two places instead of one.
const SHOW_IDS_KEY = "bl-oq-ly:show-ids";
const SHOW_IDS_KEY_RENAMED = "bloq:show-ids";
const READING_ORDER_KEY = "bl-oq-ly:reading-order";
const READING_ORDER_KEY_RENAMED = "bloq:reading-order";
const LANG_KEY = "bl-oq-ly:lang";
const LANG_KEY_RENAMED = "bloq:lang";
const SPELLING_KEY = "bl-oq-ly:spelling-mode";
const SPELLING_KEY_RENAMED = "bloq:spelling-mode";
const SHOW_MOOD_KEY = "bl-oq-ly:show-mood";
const SHOW_MOOD_KEY_RENAMED = "bloq:show-mood";


function stored(primaryKey, legacyKey) {
	// Prefer bloq:*; fall back to bl-oq-ly:* for one release.
	return localStorage.getItem(primaryKey) ?? (legacyKey ? localStorage.getItem(legacyKey) : null);
}

function storePreference(primaryKey, _legacyKey, value) {
	localStorage.setItem(primaryKey, value);
}

const APP_TITLE = "BLOQ";

/** Tab title is `$word - BLOQ` only after a submitted deconstruct, never while typing. */
function syncDocumentTitle() {
	const word = (session.lastDeconstructWord || "").trim();
	document.title = word ? `${word} - ${APP_TITLE}` : APP_TITLE;
}

function displayOptions() {
	return { showIds: showIdsCheckbox.checked, lang: langSelect.value, spellingMode: spellingSelect.value };
}

function showMoodLabels() {
	return showMoodCheckbox.checked;
}

function visibleAssembly(assembly) {
	return assemblyReading(assembly, showMoodLabels());
}

function syncMoodLabels() {
	if (!session.lastSentencePlan || !session.workspace) return;
	const blocks = session.workspace.getTopBlocks(true).filter((block) => block.type === "morpheme_block__sentence_container");
	session.lastSentencePlan.sentences.forEach((sentence, index) => {
		const block = blocks[index];
		if (!block || !sentence.assembly?.text) return;
		const text = visibleAssembly(sentence.assembly);
		block.bloqAssembly = text;
		block.setFieldValue(text, "TRANSLATION");
	});
	updateSentenceReading(session.lastSentencePlan);
	renderSentenceBreakdown(session.lastSentencePlan);
}

function glossOptions() { const lang = displayOptions().lang; return { lang: lang === "both" ? "en" : lang, showOther: lang === "both" }; }

function selectExample(word) {
	preservePageScroll(() => {
		setFieldValue(wordInput, word);
		return runDeconstruct();
	});
}

let standardExamples = { worked: [], sentences: [] };

function renderStandardExamples() {
	const words = document.querySelector(".example-word-list");
	const sentences = document.querySelector(".example-sentence-list");
	words.replaceChildren(...standardExamples.worked.map((example) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "example-pill";
		button.dataset.exampleWord = example.surface;
		button.textContent = example.surface;
		button.title = example.gloss;
		return button;
	}));
	sentences.replaceChildren(...standardExamples.sentences.map((example) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "example-pill";
		button.dataset.exampleWord = example.words.join(" ");
		button.textContent = example.words.join(" ");
		button.title = example.gloss;
		return button;
	}));
}

function renderWorkedExamples() {
	const query = workedExamplesFilter.value.trim().toLowerCase();
	const matches = workedExamples.filter((example) =>
		!query || `${example.surface} ${example.gloss ?? ""}`.toLowerCase().includes(query));
	workedExamplesStatus.textContent = `${matches.length} of ${workedExamples.length} examples`;
	workedExamplesList.replaceChildren(...matches.map((example) => {
		const button = document.createElement("button");
		button.type = "button";
		button.dataset.exampleWord = example.surface;
		button.textContent = example.gloss ? `${example.surface} — ${example.gloss}` : example.surface;
		if (example.gloss) button.title = example.gloss;
		return button;
	}));
}

async function openWorkedExamples() {
	workedExamplesModal.showModal();
	if (workedExamples.length) return;
	workedExamplesStatus.textContent = "Loading examples…";
	try {
		workedExamples = await loadWorkedExamples();
		renderWorkedExamples();
	} catch (err) {
		workedExamplesStatus.textContent = `Could not load the CI example set: ${err.message}`;
	}
}

function readLastFirst() {
	return readingOrderCheckbox.checked;
}

function initDisplayOptions() {
	uiLangSelect.value = stored("bloq:ui-lang", "bl-oq-ly:ui-lang") === "da" ? "da" : "en";
	showIdsCheckbox.checked = stored(SHOW_IDS_KEY_RENAMED, SHOW_IDS_KEY) === "true";
	showMoodCheckbox.checked = stored(SHOW_MOOD_KEY_RENAMED, SHOW_MOOD_KEY) === "true"; // default off
	readingOrderCheckbox.checked = stored(READING_ORDER_KEY_RENAMED, READING_ORDER_KEY) !== "false"; // default on
	langSelect.value = ["en", "da", "both"].includes(stored(LANG_KEY_RENAMED, LANG_KEY)) ? stored(LANG_KEY_RENAMED, LANG_KEY) : "en";
	spellingSelect.value = ["both", "spelling-only", "gloss-only"].includes(stored(SPELLING_KEY_RENAMED, SPELLING_KEY))
		? stored(SPELLING_KEY_RENAMED, SPELLING_KEY) : "both";

	function onDisplayOptionChange() {
		if (session.workspace) relabelBlocks(session.workspace, session.presetsById, displayOptions());
		applyToolbox();
		refreshBuild();
		if (session.lastDeconstructIds) rerenderBreakdown();
	}
	uiLangSelect.addEventListener("change", () => {
		storePreference("bloq:ui-lang", "bl-oq-ly:ui-lang", uiLangSelect.value);
		setLocale(uiLangSelect.value);
		applyLocale();
		syncDocumentTitle();
		applyTheme(document.documentElement.dataset.theme || "auto");
	});
	showIdsCheckbox.addEventListener("change", () => {
		storePreference(SHOW_IDS_KEY_RENAMED, SHOW_IDS_KEY, String(showIdsCheckbox.checked));
		onDisplayOptionChange();
	});
	showMoodCheckbox.addEventListener("change", () => {
		storePreference(SHOW_MOOD_KEY_RENAMED, SHOW_MOOD_KEY, String(showMoodCheckbox.checked));
		syncMoodLabels();
	});
	langSelect.addEventListener("change", () => {
		storePreference(LANG_KEY_RENAMED, LANG_KEY, langSelect.value);
		if (session.lastSentencePlan && wordInput.value.trim()) {
			runDeconstruct();
			return;
		}
		onDisplayOptionChange();
	});
	spellingSelect.addEventListener("change", () => {
		storePreference(SPELLING_KEY_RENAMED, SPELLING_KEY, spellingSelect.value);
		onDisplayOptionChange();
	});
	readingOrderCheckbox.addEventListener("change", () => {
		storePreference(READING_ORDER_KEY_RENAMED, READING_ORDER_KEY, String(readingOrderCheckbox.checked));
		// Only Deconstruct's per-morpheme rows are reversible -- Build's
		// reading line is a composed sentence, unaffected (see gloss.js).
		if (session.lastDeconstructIds) rerenderBreakdown();
	});
}


/**
 * Shows the same composed, full-sentence translation Deconstruct does (e.g.
 * "qimmeqarpunga" -> "I have a dog"), not a " · "-joined list of each
 * morpheme's own fragment -- an earlier version of this line did the latter
 * and never picked up the composedTranslation() fix once that shipped for
 * Deconstruct, the same bug in a second place. A single composed sentence
 * isn't a reversible list, so the European-reading-order toggle
 * (bl-oq-ly#11) doesn't apply here -- see gloss.js's own comment. It's kept
 * as a distinct display element from Build's status line for a different
 * reason: physically flipping the Blockly block stack to visually read
 * ending-first would conflict with two things that must stay stem-first --
 * buildWord()'s own required sequence order, and the one-directional
 * connection constraints in blocks.js -- so this exists to give a
 * European-friendly translation without touching the block stack itself.
 */
function updateReadingLine(seqOrSeqs) {
	if (!seqOrSeqs) {
		readingLine.hidden = true;
		return;
	}
	const list = Array.isArray(seqOrSeqs) && seqOrSeqs.length && Array.isArray(seqOrSeqs[0])
		? seqOrSeqs
		: [seqOrSeqs];
	const presentationPreferences = nounPresentationPreferences();
	const parts = list.map((seq) => composedTranslation(glossSummaryItems(seq, {
		...glossOptions(),
		...presentationPreferences,
	}), headlineGloss, glossOptions())).filter(Boolean);
	if (!parts.length) {
		readingLine.hidden = true;
		return;
	}
	readingLine.replaceChildren();
	parts.forEach((text, i) => {
		if (i > 0) readingLine.append(" ");
		const span = document.createElement("span");
		span.className = "reading-word";
		span.dataset.wordTone = wordTone(i);
		span.textContent = text;
		readingLine.appendChild(span);
	});
	readingLine.hidden = false;
}

function updateSentenceReading(plan) {
	const lines = (plan?.sentences ?? [])
		.map((sentence) => visibleAssembly(sentence.assembly))
		.filter(Boolean);
	if (!lines.length && plan?.assembly) lines.push(visibleAssembly(plan.assembly));
	if (!lines.length) {
		readingLine.hidden = true;
		return;
	}
	readingLine.replaceChildren();
	lines.forEach((text, i) => {
		const span = document.createElement("span");
		span.className = "reading-word reading-sentence";
		span.dataset.wordTone = wordTone(i);
		span.textContent = text;
		readingLine.appendChild(span);
	});
	const da = visibleAssembly(plan?.assemblyDa);
	if (da && displayOptions().lang === "both") {
		const extra = document.createElement("span");
		extra.className = "reading-word reading-alt";
		extra.textContent = da;
		readingLine.append(" ");
		readingLine.appendChild(extra);
	}
	readingLine.hidden = false;
}

function nounPresentationPreferences() {
	const noun = session.workspace?.getAllBlocks(false).find((block) => block.type === "morpheme_block__stem_n");
	const [numberPreference, determinationPreference] = (noun?.getFieldValue("PRESENTATION") ?? "singular|indefinite").split("|");
	return { numberPreference, determinationPreference };
}

// --- Theme (bl-oq-ly#7): a real toggle, not just following the OS. Cycles
// auto -> light -> dark -> auto. "auto" clears the override so style.css's
// prefers-color-scheme media query decides, matching the OS as before.
// Blockly's own toolbox/flyout/session.workspace chrome is themed separately via
// theme.js + session.workspace.setTheme(), since it doesn't read CSS custom
// properties at all — see that file's comment.
const THEME_KEY = "bl-oq-ly:theme";
const THEME_KEY_RENAMED = "bloq:theme";
const THEME_CYCLE = ["auto", "light", "dark"];
function isEffectivelyDark() {
	const explicit = document.documentElement.dataset.theme;
	if (explicit === "dark") return true;
	if (explicit === "light") return false;
	return prefersDarkQuery.matches;
}

function syncBlocklyTheme() {
	if (session.workspace && blocklyThemes) {
		const themeSet = blocklyThemes[selectedBlocklyTheme] || blocklyThemes.classic;
		session.workspace.setTheme(isEffectivelyDark() ? themeSet.dark : themeSet.light);
	}
}

function initBlocklyTheme() {
	const saved = stored("bloq:blockly-theme", "bl-oq-ly:blockly-theme");
	selectedBlocklyTheme = ["classic", "zelos"].includes(saved) ? saved : "classic";
	blocklyThemeSelect.value = selectedBlocklyTheme;
	blocklyThemeSelect.addEventListener("change", () => {
		selectedBlocklyTheme = blocklyThemeSelect.value;
		storePreference("bloq:blockly-theme", "bl-oq-ly:blockly-theme", selectedBlocklyTheme);
		rebuildWorkspace();
	});
}

function initDisplayChrome() {
	function sync() {
		if (displayToggleBtn.dataset.userToggled === "true") return;
		displayPanel.classList.remove("is-open");
		displayToggleBtn.setAttribute("aria-expanded", "false");
	}
	displayToggleBtn.addEventListener("click", () => {
		const open = !displayPanel.classList.contains("is-open");
		displayPanel.classList.toggle("is-open", open);
		displayToggleBtn.dataset.userToggled = "true";
		displayToggleBtn.setAttribute("aria-expanded", String(open));
	});
	DISPLAY_MQ.addEventListener("change", sync);
	sync();
}

function workspaceOptions() {
	const themeSet = blocklyThemes[selectedBlocklyTheme] || blocklyThemes.classic;
	return {
		toolbox: buildToolbox(session.presets, displayOptions()),
		theme: isEffectivelyDark() ? themeSet.dark : themeSet.light,
		// Classic uses Blockly's default renderer (Geras); Zelos is a renderer,
		// not just a Theme. Changing it requires rebuilding the session.workspace.
		renderer: selectedBlocklyTheme === "zelos" ? "zelos" : "geras",
		trashcan: true,
		zoom: { controls: true, wheel: true, pinch: true },
		sounds: false,
		move: { scrollbars: true, drag: true, wheel: true },
	};
}

function injectWorkspace(serializedState = null) {
	session.workspace = Blockly.inject(blocklyDiv, workspaceOptions());
	session.workspace.addChangeListener((event) => {
		if (event?.isUiEvent) return;
		applyBuildShare(refreshBuild());
	});
	if (serializedState) Blockly.serialization.workspaces.load(serializedState, session.workspace);
	registerVerbPickerReactivity(session.workspace);
}

function rebuildWorkspace() {
	if (!session.workspace) return;
	const serializedState = Blockly.serialization.workspaces.save(session.workspace);
	session.workspace.dispose();
	injectWorkspace(serializedState);
	applyToolbox();
	requestAnimationFrame(() => Blockly.svgResize(session.workspace));
	applyBuildShare(refreshBuild());
}

function applyTheme(theme) {
	if (theme === "auto") delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = theme;
	themeToggleBtn.textContent = t(`theme.${theme}`);
	syncBlocklyTheme();
}

function initTheme() {
	const saved = stored(THEME_KEY_RENAMED, THEME_KEY);
	applyTheme(THEME_CYCLE.includes(saved) ? saved : "auto");
	themeToggleBtn.addEventListener("click", () => {
		const current = document.documentElement.dataset.theme || "auto";
		const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
		storePreference(THEME_KEY_RENAMED, THEME_KEY, next);
		applyTheme(next);
	});
	// Keep "auto" reactive to a live OS theme change, not just at load time.
	prefersDarkQuery.addEventListener("change", () => {
		if (!document.documentElement.dataset.theme) syncBlocklyTheme();
	});
}

function setStatus(text, kind, meta) {
	statusEl.hidden = false;
	statusEl.className = kind ?? "";
	statusLine.textContent = text;
	const oldMeta = statusEl.querySelector(".meta");
	if (oldMeta) oldMeta.remove();
	if (meta) {
		const m = document.createElement("span");
		m.className = "meta";
		m.textContent = meta;
		statusEl.appendChild(m);
	}
}

function setStatusWords(words, kind, meta) {
	setStatus("", kind, meta);
	renderTonedPhrases(statusLine, words, "status-word");
}

function formatBytes(n) {
	if (!n) return "";
	return `${(n / 1048576).toFixed(1)} MB`;
}

function showLoadingModal() {
	if (document.documentElement.dataset.bloqReady === "1") return;
	if (!loadingModal) return;
	loadingModal.hidden = false;
}

function hideLoadingModal() {
	document.documentElement.dataset.bloqReady = "1";
	if (loadingModal) loadingModal.hidden = true;
}

function preservePageScroll(fn) {
	const x = window.scrollX;
	const y = window.scrollY;
	const restore = () => {
		if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
	};
	const result = fn();
	restore();
	requestAnimationFrame(() => {
		restore();
		requestAnimationFrame(restore);
	});
	if (result && typeof result.then === "function") {
		return result.finally(() => {
			restore();
			requestAnimationFrame(restore);
		});
	}
	return result;
}

function setLoadingProgress(event = {}) {
	showLoadingModal();
	if (!loadingProgress || !loadingProgressFill || !loadingStatus) return;
	const { phase, loaded = 0, total = 0 } = event;
	if (phase === "cached") {
		loadingStatus.textContent = t("loadingCached");
		loadingProgress.classList.add("is-indeterminate");
		loadingProgress.removeAttribute("aria-valuenow");
		loadingProgressFill.style.width = "";
		return;
	}
	if (phase === "parse") {
		loadingStatus.textContent = t("loadingParse");
		loadingProgress.classList.add("is-indeterminate");
		loadingProgress.removeAttribute("aria-valuenow");
		loadingProgressFill.style.width = "";
		return;
	}
	if (total > 0) {
		const pct = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
		loadingProgress.classList.remove("is-indeterminate");
		loadingProgress.setAttribute("aria-valuenow", String(pct));
		loadingProgressFill.style.width = `${pct}%`;
		const size = formatBytes(loaded);
		const max = formatBytes(total);
		loadingStatus.textContent = size && max ? `${t("loading")} ${size} / ${max}` : t("loading");
		return;
	}
	loadingStatus.textContent = t("loading");
	loadingProgress.classList.add("is-indeterminate");
	loadingProgress.removeAttribute("aria-valuenow");
	loadingProgressFill.style.width = "";
}

// --- Shareable-link state (router.js). The single-page URL uses `chain` for
// the Build canvas and `w` for a Deconstruct word. Build still
// replaceState-syncs on every canvas change; a successful Deconstruct pushes
// a real history entry. Legacy mode/word links remain readable.
function currentShareState() {
	const sentences = session.workspace ? topLevelSentences(session.workspace) : [];
	const words = sentences.length === 1 ? sentences[0] : [];
	const word = session.lastDeconstructWord || wordInput.value.trim();
	return {
		mode: session.mode,
		word,
		chain: words.length === 1 ? words[0] : [],
		words,
		sentences,
	};
}


async function copyShareLink() {
	const url = location.href;
	let ok = false;
	try {
		await window.navigator.clipboard.writeText(url);
		ok = true;
	} catch {
		// Fallback for older / insecure contexts: select via prompt-less textarea.
		const ta = document.createElement("textarea");
		ta.value = url;
		ta.setAttribute("readonly", "");
		ta.style.position = "fixed";
		ta.style.left = "-9999px";
		document.body.appendChild(ta);
		ta.select();
		ok = document.execCommand("copy");
		ta.remove();
	}
	if (!ok) return;
	copyLinkBtn.textContent = t("linkCopied");
	window.setTimeout(() => {
		copyLinkBtn.textContent = t("copyLink");
	}, 1200);
}

function clearCanvas() {
	if (!session.workspace) return;
	session.workspace.clear();
	// Clearing the canvas must also invalidate share state: otherwise
	// session.lastDeconstructWord / the word input keep w= in the URL, and a reload
	// or copied link re-runs Deconstruct and repopulates the canvas.
	clearAnalysisCaches(session);
	session.mode = "build";
	setFieldValue(wordInput, "");
	breakdownDiv.innerHTML = "";
	breakdownSummaryMeta.textContent = "";
	breakdownDetails.hidden = true;
	updateReadingLine(null);
	syncDocumentTitle();
	applyBuildShare(refreshBuild());
	requestAnimationFrame(() => Blockly.svgResize(session.workspace));
}

function syncURL({ push = false } = {}) {
	const state = currentShareState();
	const url = routeForState(location.pathname) + writeState(state) + location.hash;
	const current = location.pathname + location.search + location.hash;
	if (!push && url === current) return;
	preservePageScroll(() => {
		if (push) history.pushState(null, "", url);
		else history.replaceState(null, "", url);
	});
}

/** Applies a {mode, word, chain} state (from router.js's readState(),
 * whether from the initial load or a popstate) to the live app -- the
 * inverse of currentShareState(). Restores the canvas chain and the
 * analyzed word together; `mode` is accepted for older links but no
 * longer switches a hidden panel. Never itself touches the URL (the
 * caller already has it, or is about to set it). */
function applyShareState(state) {
	if (state.word) {
		setFieldValue(wordInput, state.word);
		if (!session.lastDeconstructWord) session.lastDeconstructWord = state.word;
	}
	const sentences = state.sentences?.length
		? state.sentences
		: ((state.words && state.words.length) ? [state.words] : (state.chain.length ? [state.chain] : []));
	if (sentences.length > 0 && session.workspace) {
		const current = topLevelSentences(session.workspace);
		const same = current.length === sentences.length
			&& current.every((words, s) => words.length === sentences[s].length
				&& words.every((ids, i) => ids.length === sentences[s][i].length && ids.every((id, j) => id === sentences[s][i][j])));
		if (!same) {
			renderSentencePlan(session.workspace, sentences.map((words) => ({
				words: words.map((ids) => ({ canvasIds: ids })),
			})), session.presetsById, displayOptions());
			session.workspace.scrollCenter();
		}
		applyBuildShare(refreshBuild());
	}
	if (state.word) {
		if (session.lastDeconstructWord !== state.word || !session.lastDeconstructSeq) {
			runDeconstruct({ skipCanvas: sentences.length > 0 });
		} else {
			rerenderBreakdown();
		}
	}
	syncDocumentTitle();
}

function canvasMatchesPlan(plan) {
	if (!plan || !session.workspace) return false;
	const containers = session.workspace.getTopBlocks(false).filter((block) => block.type === "morpheme_block__sentence_container");
	return planMatchesCanvas(topLevelSentences(session.workspace), plan, {
		sentenceContainerCount: containers.length,
	});
}

function showPlanStatus(plan) {
	const words = plan.sentences.flatMap((sentence) => sentence.words);
	const missing = words.filter((word) => word.status === "missing" || word.status === "invalid");
	if (missing.length) {
		setStatus(missing.map((word) => `${word.raw}: ${word.note}`).join(" · "), "error", planStatusMeta(plan));
		return;
	}
	const chains = canvasSentences(plan);
	const surfaces = sentenceInitialWords(plan);
	if (!surfaces.length) {
		setStatus(plan.assembly?.text || "No closed reading to place on the canvas.", plan.assembly?.text ? "approx" : "error", planStatusMeta(plan));
		return;
	}
	const cautious = words.some((word) => word.status !== "verified") || chains.length === 0;
	setStatusWords(surfaces, cautious ? "approx" : "ok", planStatusMeta(plan));
}

function sentenceInitialWords(plan) {
	return (plan?.sentences ?? []).flatMap((sentence) => sentence.words.map((word, index) => {
		const text = word.built?.word || word.raw;
		return index === 0 ? withInitialCapital(text) : text;
	}));
}

function seqForChain(ids) {
	return resolveSeqForChain(session.presetsById, ids);
}

/**
 * Run the pure Build pass and paint status / labels / reading.
 * Does not write history or session.mode — callers own share sync via
 * applyBuildShare(result).
 * @returns {ReturnType<typeof computeBuild>|null}
 */
function refreshBuild() {
	if (!session.workspace) return null;
	const sentences = topLevelSentences(session.workspace);
	const planMatches = Boolean(session.lastSentencePlan && canvasMatchesPlan(session.lastSentencePlan));
	const result = computeBuild({
		sentences,
		presetsById: session.presetsById,
		buildWord,
		lastSentencePlan: session.lastSentencePlan,
		planMatches,
	});

	if (result.error) {
		setStatus(result.error.message, result.error.kind, result.error.meta);
		updateReadingLine(null);
		return result;
	}

	if (result.usePlan) {
		labelContainers(session.workspace, result.built, result.seqs.map((seq) =>
			composedTranslation(glossSummaryItems(seq, glossOptions()), headlineGloss, glossOptions())));
		showPlanStatus(session.lastSentencePlan);
		updateSentenceReading(session.lastSentencePlan);
		return result;
	}

	if (result.empty) {
		setStatus(t("emptyCanvasHint"), "");
		updateReadingLine(null);
		labelContainers(session.workspace, []);
		return result;
	}

	const translations = result.seqs.map((seq) =>
		composedTranslation(glossSummaryItems(seq, glossOptions()), headlineGloss, glossOptions()));
	labelContainers(session.workspace, result.built, translations);
	setStatusWords(result.surfaces, result.kind, result.meta);
	updateReadingLine(result.seqs);
	return result;
}

/** Apply share-mode / URL updates decided by a computeBuild result. */
function applyBuildShare(result) {
	if (!result) return;
	if (result.share.mode === "deconstruct") {
		session.mode = "deconstruct";
		syncURL({ push: false });
		return;
	}
	if (result.empty) {
		syncURL({ push: false });
		return;
	}
	if (result.share.clearDeconstruct) {
		// Label paints after a Deconstruct render fire Blockly change events.
		// Those must not demote an intact Deconstruct canvas to a Build ?chain=
		// share; only a real chain edit should. Caller owns any history push.
		if (
			session.mode === "deconstruct"
			&& session.workspace
			&& deconstructIdsMatchSentences(topLevelSentences(session.workspace), session.lastDeconstructIds)
		) {
			return;
		}
		session.mode = "build";
		session.lastDeconstructWord = "";
		session.lastSentencePlan = null;
		syncURL({ push: false });
	}
}

function rerenderBreakdown() {
	if (session.lastSentencePlan) {
		renderSentenceBreakdown(session.lastSentencePlan);
		return;
	}
	const parts = session.lastDeconstructParts?.length
		? session.lastDeconstructParts
		: (session.lastDeconstructSeq
			? [{ word: session.lastDeconstructWord, seq: session.lastDeconstructSeq, built: session.lastDeconstructBuilt, alternatives: session.lastDeconstructAlternatives }]
			: []);
	if (!parts.length) return;
	breakdownDiv.innerHTML = "";
	const metas = [];
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		const article = document.createElement("article");
		if (i === 0) article.id = "primary-breakdown";
		article.classList.add("word-toned");
		article.dataset.wordTone = wordTone(i);
		if (parts.length > 1) article.classList.add("sentence-word-breakdown");
		renderBreakdown(article, part.word, part.seq, part.built, glossSummaryItems, {
			reverseOrder: readLastFirst(),
			...glossOptions(),
			headlineGloss,
		});
		breakdownDiv.appendChild(article);
		if (part.alternatives?.length) {
			renderAlternativeBreakdowns(breakdownDiv, part.alternatives, glossSummaryItems, {
				word: part.word,
				reverseOrder: readLastFirst(),
				...glossOptions(),
				headlineGloss,
				builderHref: (seq) => `${location.pathname}${writeState({ chain: seq.map((item) => item.id).filter(Boolean) })}`,
			});
		}
		const n = article.querySelectorAll(".breakdown-row").length;
		const translation = article.querySelector(".breakdown-translation")?.textContent;
		metas.push(translation ? `${n} · ${translation}` : String(n));
	}
	breakdownSummaryMeta.textContent = metas.join("  ·  ");
	// Only auto-open the first time the breakdown panel appears. A later
	// re-render — display-option toggle, etc. — must leave its fold state alone.
	const firstShow = breakdownDetails.hidden;
	breakdownDetails.hidden = false;
	if (firstShow) breakdownDetails.open = false;
}

const READING_BAND_LABEL = {
	gold: "gold",
	hard_exact: "exact",
	soft_exact: "soft",
	none: "unparsed",
};

function sentenceLang() {
	return displayOptions().lang === "da" ? "da" : "en";
}

function materializePlan(plan) {
	for (const sentence of plan.sentences) {
		for (const word of sentence.words) {
			if (!word.canvasIds.length) continue;
			const seq = seqForChain(word.canvasIds);
			if (!seq) {
				word.status = "missing";
				word.canvasIds = [];
				word.note = "Catalog entry has no builder sequence.";
				continue;
			}
			const built = buildWord(seq);
			word.seq = seq;
			word.built = built;
			if (!built.ok) {
				word.status = "invalid";
				word.canvasIds = [];
				word.note = built.reason || "This closed reading does not build.";
			}
		}
	}
	return plan;
}

function planStatusMeta(plan) {
	const count = plan.sentences.length;
	const modes = [...new Set(plan.sentences.map((sentence) => sentence.assembly?.mode).filter(Boolean))];
	const modeLabel = modes.join(" + ") || "sentence";
	return count > 1 ? `${count} sentences · ${modeLabel}` : modeLabel;
}

function renderSentenceBreakdown(plan) {
	breakdownDiv.innerHTML = "";
	if (plan.sentences.length > 1 && plan.assembly?.text) {
		const lead = document.createElement("p");
		lead.className = "sentence-assembly sentence-assembly-all";
		lead.textContent = visibleAssembly(plan.assembly);
		breakdownDiv.appendChild(lead);
	}
	const metas = [];
	plan.sentences.forEach((sentence, s) => {
		const section = document.createElement("section");
		section.className = "sentence-breakdown";
		section.dataset.wordTone = wordTone(s);
		const head = document.createElement("header");
		head.className = "sentence-breakdown-head";
		const source = document.createElement("p");
		source.className = "sentence-source";
		source.textContent = sentence.source;
		head.appendChild(source);
		if (sentence.assembly?.text) {
			const line = document.createElement("p");
			line.className = "sentence-assembly";
			const badge = document.createElement("span");
			badge.className = `sentence-mode mode-${sentence.assembly.mode || "serial"}`;
			badge.textContent = sentence.assembly.mode || "serial";
			const reading = visibleAssembly(sentence.assembly);
			line.append(badge, " ", reading);
			head.appendChild(line);
			metas.push(reading);
		}
		if (sentence.assemblyDa?.text && displayOptions().lang === "both") {
			const da = document.createElement("p");
			da.className = "sentence-assembly sentence-assembly-da";
			da.textContent = visibleAssembly(sentence.assemblyDa);
			head.appendChild(da);
		}
		section.appendChild(head);
		sentence.words.forEach((word, i) => {
			const article = document.createElement("article");
			article.classList.add("word-toned", "sentence-word-breakdown");
			article.dataset.wordTone = wordTone(i);
			if (s === 0 && i === 0) article.id = "primary-breakdown";
			const band = document.createElement("p");
			band.className = `reading-band band-${word.band || "none"}`;
			band.textContent = `${READING_BAND_LABEL[word.band] || word.band} · ${word.surface}`;
			article.appendChild(band);
			if (word.seq && word.built?.ok) {
				renderBreakdown(article, word.surface, word.seq, word.built, glossSummaryItems, {
					reverseOrder: readLastFirst(),
					...glossOptions(),
					headlineGloss,
				});
			} else {
				const heading = document.createElement("div");
				heading.className = "breakdown-word";
				heading.textContent = word.raw;
				article.appendChild(heading);
				if (word.headline && word.headline !== word.raw) {
					const gloss = document.createElement("p");
					gloss.className = "breakdown-translation";
					gloss.textContent = word.headline;
					article.appendChild(gloss);
				}
				if (word.compositional && word.compositional !== word.headline) {
					const unused = document.createElement("p");
					unused.className = "breakdown-note";
					unused.textContent = `Closed chain not used: ${word.compositional}`;
					article.appendChild(unused);
				}
				const note = document.createElement("p");
				note.className = "breakdown-note";
				note.textContent = word.note || "Not placed on the canvas.";
				article.appendChild(note);
			}
			if (word.alternatives?.length) {
				const list = document.createElement("ul");
				list.className = "sentence-also";
				for (const alt of word.alternatives) {
					const item = document.createElement("li");
					item.textContent = `${READING_BAND_LABEL[alt.band] || alt.band}: ${alt.headline || alt.ids.join(" + ")}`;
					list.appendChild(item);
				}
				article.appendChild(list);
			}
			section.appendChild(article);
		});
		breakdownDiv.appendChild(section);
	});
	breakdownSummaryMeta.textContent = metas.join("  ·  ");
	const firstShow = breakdownDetails.hidden;
	breakdownDetails.hidden = false;
	if (firstShow) breakdownDetails.open = false;
}

async function runSentenceDeconstruct(surface, { skipCanvas = false, run }) {
	const tokens = tokenizeSentence(surface);
	breakdownDiv.innerHTML = "";
	setStatus(`Analyzing ${tokens.length} words as a sentence…`, "");
	session.lastDeconstructIds = null;
	session.lastDeconstructSeq = null;
	session.lastDeconstructAlternatives = null;
	session.lastDeconstructParts = null;
	try {
		const analyses = new Map();
		for (const token of tokens) {
			const key = token.surface.trim().toLowerCase();
			if (analyses.has(key)) continue;
			const result = await analyzeWordAsync(token.surface, session.presets, {}, { signal: session.deconstructAbort.signal });
			if (run !== session.deconstructRun) return;
			analyses.set(key, result);
		}
		const lang = sentenceLang();
		const lattice = analyzeSentence(surface, session.presets, {
			lang,
			maxReadings: 3,
			analysisResultsByWord: analyses,
		});
		if (run !== session.deconstructRun) return;
		const daLattice = displayOptions().lang === "both"
			? analyzeSentence(surface, session.presets, { lang: "da", maxReadings: 3, analysisResultsByWord: analyses })
			: null;
		const plan = materializePlan(planFromLattice(lattice, {
			presetsById: session.presetsById,
			assembleClause,
			lang,
			analysesByWord: analyses,
			daLattice,
		}));
		session.lastDeconstructWord = surface;
		session.lastSentencePlan = plan;
		const placed = plan.sentences.flatMap((sentence) => sentence.words.filter((word) => word.seq && word.built?.ok));
		session.lastDeconstructSeq = placed[0]?.seq ?? null;
		session.lastDeconstructBuilt = placed[0]?.built ?? null;
		session.lastDeconstructIds = placed.map((word) => word.canvasIds);
		session.mode = "deconstruct";
		syncDocumentTitle();
		rerenderBreakdown();
		if (!skipCanvas && session.workspace && plan.sentences.length) {
			renderSentencePlan(session.workspace, plan.sentences.map((sentence) => ({
				source: sentence.source,
				assembly: visibleAssembly(sentence.assembly),
				words: sentence.words.map((word) => ({
					surface: word.surface || word.raw,
					raw: word.raw,
					canvasIds: word.canvasIds,
					heldLabel: word.heldLabel,
				})),
			})), session.presetsById, displayOptions(), { forceSentence: true });
			session.workspace.scrollCenter();
			requestAnimationFrame(() => Blockly.svgResize(session.workspace));
			refreshBuild();
		}
		const words = plan.sentences.flatMap((sentence) => sentence.words);
		const missing = words.filter((word) => word.status === "missing" || word.status === "invalid");
		if (missing.length) {
			setStatus(missing.map((word) => `${word.raw}: ${word.note}`).join(" · "), "error", planStatusMeta(plan));
		} else if (!plan.sentences.some((sentence) => sentence.assembly?.text) && canvasSentences(plan).length === 0) {
			setStatus("No closed reading to place on the canvas.", "error", planStatusMeta(plan));
		} else {
			const cautious = words.some((word) => word.status !== "verified");
			setStatusWords(sentenceInitialWords(plan), cautious ? "approx" : "ok", planStatusMeta(plan));
			updateSentenceReading(plan);
		}
		// Caller owns share URL: push a Deconstruct history entry after canvas paint.
		syncURL({ push: true });
	} catch (err) {
		if (err?.name === "AbortError" || run !== session.deconstructRun) return;
		setStatus(`Analysis failed: ${err.message}`, "error");
	}
}

async function runDeconstruct({ skipCanvas = false } = {}) {
	const surface = wordInput.value.trim();
	if (session.deconstructAbort) session.deconstructAbort.abort();
	const run = ++session.deconstructRun;
	if (!surface) return;
	session.deconstructAbort = new AbortController();
	session.lastSentencePlan = null;
	if (isSentenceInput(surface)) {
		await runSentenceDeconstruct(surface, { skipCanvas, run });
		return;
	}
	const tokens = surface.split(/\s+/).filter(Boolean);
	breakdownDiv.innerHTML = "";
	setStatus(tokens.length === 1 ? `Analyzing "${tokens[0]}"…` : `Analyzing ${tokens.length} words…`, "");
	session.lastDeconstructIds = null;
	session.lastDeconstructSeq = null;
	session.lastDeconstructAlternatives = null;
	session.lastDeconstructParts = null;
	try {
		const parts = [];
		for (const token of tokens) {
			const result = await analyzeWordAsync(token, session.presets, {}, { signal: session.deconstructAbort.signal });
			if (run !== session.deconstructRun) return;
			if (!result.matches || result.matches.length === 0) {
				session.lastDeconstructWord = surface;
				syncDocumentTitle();
				breakdownSummaryMeta.textContent = "No verified breakdown";
				breakdownDetails.hidden = false;
				setStatus(`No verified breakdown found for "${token}".`, "error", `${result.evalCount} candidates checked`);
				return;
			}
			const analyzed = result.matches.map((match) => ({ seq: match.seq, built: buildWord(match.seq) }));
			const best = analyzed[0];
			parts.push({
				word: token,
				seq: best.seq,
				built: best.built,
				alternatives: analyzed.slice(1),
				ids: best.seq.map((item) => item.id).filter(Boolean),
			});
		}
		session.lastDeconstructWord = surface;
		session.lastDeconstructParts = parts;
		session.lastDeconstructSeq = parts[0].seq;
		session.lastDeconstructBuilt = parts[0].built;
		session.lastDeconstructAlternatives = parts[0].alternatives;
		session.lastDeconstructIds = parts.length === 1 ? parts[0].ids : parts.map((p) => p.ids);
		session.mode = "deconstruct";
		syncDocumentTitle();
		rerenderBreakdown();
		if (!skipCanvas && session.workspace) {
			const chains = parts.map((p) => p.ids).filter((ids) => ids.length);
			if (chains.length) {
				renderSentencePlan(session.workspace, [{
					words: chains.map((ids) => ({ canvasIds: ids })),
				}], session.presetsById, displayOptions());
				session.workspace.scrollCenter();
				requestAnimationFrame(() => Blockly.svgResize(session.workspace));
				refreshBuild();
			}
		}
		// Caller owns share URL after programmatic render (events disabled in renderer).
		syncURL({ push: true });
	} catch (err) {
		if (err?.name === "AbortError" || run !== session.deconstructRun) return;
		setStatus(`Analysis failed: ${err.message}`, "error");
	}
}

// --- Palette hide/show (bl-oq-ly#8) and filter (bl-oq-ly#9). The toolbox
// content is rebuilt from the filtered preset list rather than hidden/shown
// per-block, so a category with no matches disappears entirely (see
// blocks.js's buildToolbox) instead of leaving an empty, confusing category
// behind. Hiding the palette uses Toolbox.setVisible(), Blockly's own public
// API for this -- NOT session.workspace.updateToolbox(null), which throws ("Can't
// nullify an existing toolbox"): updateToolbox only supports swapping a
// toolbox's *content*, never removing one already injected with a toolbox.
function closeOpenFlyout() {
	session.workspace?.getToolbox()?.getFlyout()?.hide();
}

function applyToolbox() {
	if (!session.workspace) return;
	session.workspace.getToolbox()?.setVisible(paletteVisible);
	closeOpenFlyout();
	if (!paletteVisible) return;

	const q = filterInput.value.trim().toLowerCase();
	const filtered = q
		? session.presets.filter((preset) => presetMatchesQuery(preset, q))
		: session.presets;
	// Rebuilt every time from scratch (no cached "full" toolbox), since
	// display options can change independently of the filter and both need
	// to be reflected together. The verb ending picker has no id/gloss text
	// to match a query, so it's excluded from a filtered view entirely
	// (bl-oq-ly#18) rather than left showing as an always-present,
	// unrelated "Inflectional endings (1)" category.
	session.workspace.updateToolbox(buildToolbox(filtered, displayOptions(), { includeVerbPicker: !q }));
	closeOpenFlyout();
}

function bindWindowEvents() {
	if (windowBound) return;
	windowBound = true;
	window.addEventListener("resize", () => { if (session.workspace) Blockly.svgResize(session.workspace); });
	window.addEventListener("orientationchange", () => { if (session.workspace) Blockly.svgResize(session.workspace); });
	window.addEventListener("popstate", () => applyShareState(readState(location.search)));
}

function bindUiEvents() {
	const resultsDetails = document.getElementById("results-details");
	resultsDetails?.addEventListener("toggle", () => {
		requestAnimationFrame(() => { if (session.workspace) Blockly.svgResize(session.workspace); });
	});
	deconstructForm.addEventListener("submit", (e) => {
		e.preventDefault();
		runDeconstruct();
	});
	for (const button of exampleWordButtons) {
		button.addEventListener("click", () => selectExample(button.dataset.exampleWord));
	}
	workedExamplesBtn.addEventListener("click", openWorkedExamples);
	workedExamplesClose.addEventListener("click", () => workedExamplesModal.close());
	workedExamplesFilter.addEventListener("input", renderWorkedExamples);
	workedExamplesList.addEventListener("click", (event) => {
		const button = event.target.closest("button[data-example-word]");
		if (!button) return;
		workedExamplesModal.close();
		selectExample(button.dataset.exampleWord);
	});
	copyLinkBtn.addEventListener("click", () => { copyShareLink(); });
	clearCanvasBtn.addEventListener("click", () => { clearCanvas(); });
	paletteToggleBtn.addEventListener("click", () => {
		paletteVisible = !paletteVisible;
		paletteToggleBtn.textContent = t(paletteVisible ? "paletteHide" : "paletteShow");
		filterWrap.hidden = !paletteVisible;
		applyToolbox();
		requestAnimationFrame(() => Blockly.svgResize(session.workspace));
	});
	filterInput.addEventListener("input", applyToolbox);
}

async function loadEngine() {
	blocklyThemes = buildBlocklyThemes();
	setStatus("Loading morpheme catalog…", "");
	const catalog = await loadCatalog({
		onProgress: setLoadingProgress,
		onUpdated: (next) => {
			session.presets = next.presets;
			session.presetsById = new Map(session.presets.map((p) => [p.id, p]));
			if (session.workspace?.getToolbox()?.getFlyout()?.isVisible()) return;
			applyToolbox();
		},
	});
	session.presets = catalog.presets;
	session.presetsById = new Map(session.presets.map((p) => [p.id, p]));

	defineMorphemeBlocks();
	const verbEndingIndex = buildVerbEndingIndex(session.presets);
	const nounEndingIndex = buildNounEndingIndex(session.presets);
	defineVerbEndingPickerBlock(verbEndingIndex, session.presetsById, displayOptions, resolveMoodLabel, resolvePersonLabel);
	defineNounEndingPickerBlock(nounEndingIndex, session.presetsById, displayOptions);
	defineVerbObjectBlock(verbEndingIndex, resolvePersonLabel);
}

function mountWorkspace() {
	initTheme();
	initBlocklyTheme();
	initDisplayOptions();
	initDisplayChrome();
	injectWorkspace();
	bindWindowEvents();
	bindUiEvents();
	setStatus(`Loaded ${session.presets.length} morphemes.`, "");
	if (!paletteVisible) {
		paletteToggleBtn.textContent = t("paletteShow");
		filterWrap.hidden = true;
		applyToolbox();
	}
	const initialState = readState(location.search);
	if (initialState.word || initialState.chain.length > 0 || initialState.words?.length) applyShareState(initialState);
	requestAnimationFrame(() => { if (session.workspace) Blockly.svgResize(session.workspace); });
}

async function startInner() {
	bindDom();
	if (!blocklyDiv) {
		hideLoadingModal();
		return;
	}
	if (session.workspace && blocklyDiv.querySelector(".injectionDiv")) {
		hideLoadingModal();
		requestAnimationFrame(() => Blockly.svgResize(session.workspace));
		return;
	}
	if (session.workspace) {
		try { session.workspace.dispose(); } catch { /* DOM was replaced (React remount / HMR) */ }
		session.workspace = null;
	}
	setLocale(stored("bloq:ui-lang", "bl-oq-ly:ui-lang") || "en");
	applyLocale();
	syncDocumentTitle();
	try {
		if (!session.presets.length) {
			showLoadingModal();
			setLoadingProgress({});
			await loadEngine();
		}
		if (!standardExamples.worked.length) {
			standardExamples = await loadStandardExamples();
			renderStandardExamples();
			exampleWordButtons = document.querySelectorAll("[data-example-word]");
		}
		mountWorkspace();
	} finally {
		hideLoadingModal();
		requestAnimationFrame(() => { if (session.workspace) Blockly.svgResize(session.workspace); });
	}
}

export async function start() {
	if (startInflight) return startInflight;
	startInflight = (async () => {
		try {
			await startInner();
		} catch (err) {
			console.error(err);
			hideLoadingModal();
			setStatus(`Failed to start: ${err.message}`, "error");
		} finally {
			startInflight = null;
		}
	})();
	return startInflight;
}

if (typeof window !== "undefined") {
	window.__bloqStart = start;
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => { start(); });
	} else {
		start();
	}
}
