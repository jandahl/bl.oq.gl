import { buildWord, presentSequence, analyzeWordAsync, tokenizeSentence, analyzeSentence, assembleClause, glossSummaryItems, headlineGloss, resolveMoodLabel, resolvePersonLabel, setActiveLocale } from "./oq-api.js";
import { mountVisualizations } from "./visualizations.js";
import { loadCatalog } from "./catalog.js";
import {
	defineMorphemeBlocks, buildToolbox, topLevelSentences, renderSentencePlan, relabelBlocks, labelContainers,
	buildVerbEndingIndex, buildNounEndingIndex, defineVerbEndingPickerBlock, defineNounEndingPickerBlock, defineVerbObjectBlock, registerVerbPickerReactivity,
	bindVerbPickerCatalog, bindNounPickerCatalog, reresolveBoundVerbPickers, reresolveBoundNounPickers,
	presetMatchesQuery, labelFor, canvasTree, setViewLayout, getViewLayout, nounStemBlock, planFromCanvas,
} from "./blocks.js";
import { sameIdTree } from "./id-tree.js";
import {
	createSession, clearAnalysisCaches, cancelDeconstruct, seqForChain as resolveSeqForChain, planMatchesCanvas,
	deconstructIdsMatchSentences, computeBuild, formatStatus, labelsForCanvasWords,
} from "./session.js";
import { renderSentenceBreakdown, renderWordBreakdowns, renderTonedPhrases, wordTone } from "./breakdown.js";
import { buildBlocklyThemes } from "./theme.js";
import { composedTranslation } from "./gloss.js";
import { readState, writeState, routeForState } from "./router.js";
import { isSentenceInput, planFromLattice, withInitialCapital, assemblyReading } from "./sentence-plan.js";
import { loadExamplesCatalog, mountExamplesPanel } from "./examples.js";
import { setLocale, applyLocale, t } from "./i18n.js";

import { enhanceSegmented } from "./segmented.js";

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
let examplesFrame;
let workedExamplesModal;
/** @type {ReturnType<typeof mountExamplesPanel> | null} */
let examplesPanel = null;
let showIdsCheckbox;
let fillBlanksCheckbox;
let showMoodCheckbox;
let readingOrderCheckbox;
let langSelect;
let uiLangSelect;
let spellingSelect;
let layoutSelect;
let readingLine;
let loadingModal;
let loadingStatus;
let loadingProgress;
let loadingProgressFill;
let prefersDarkQuery;
let DISPLAY_MQ;

const session = createSession();
let rawCatalog = null;
let visualizations = null;
let paletteVisible = true;
let blocklyThemes = null;
let selectedBlocklyTheme = "classic";
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
	examplesFrame = document.getElementById("example-words");
	workedExamplesModal = document.getElementById("worked-examples-modal");
	fillBlanksCheckbox = document.getElementById("opt-fill-blanks");
	showIdsCheckbox = document.getElementById("opt-show-ids");
	showMoodCheckbox = document.getElementById("opt-show-mood");
	readingOrderCheckbox = document.getElementById("opt-reading-order");
	langSelect = enhanceSegmented(document.getElementById("opt-lang"));
	uiLangSelect = enhanceSegmented(document.getElementById("opt-ui-lang"));
	spellingSelect = enhanceSegmented(document.getElementById("opt-spelling"));
	layoutSelect = enhanceSegmented(document.getElementById("opt-layout"));
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
const LAYOUT_KEY = "bloq:view-layout";
const LAYOUTS = ["stack", "horizontal", "wrap"];


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

/** Single display-options value consumed by labelFor, breakdown, and analysis. */
function displayOptions() {
	const lang = langSelect.value;
	return {
		showIds: showIdsCheckbox.checked,
		fillBlanks: fillBlanksCheckbox.checked,
		lang,
		showOther: lang === "both",
		spellingMode: spellingSelect.value,
		showMood: showMoodCheckbox.checked,
		readLastFirst: readingOrderCheckbox.checked,
	};
}

function glossOptions(opts = displayOptions()) {
	return {
		lang: opts.lang === "both" ? "en" : opts.lang,
		showOther: opts.lang === "both" || opts.showOther,
	};
}

function canvasGlossOptions() {
	return { ...glossOptions(), ...nounPresentationPreferences() };
}

function nounPresentationValue() {
	const { numberPreference, determinationPreference } = nounPresentationPreferences();
	return `${numberPreference}|${determinationPreference}`;
}

function sentenceLang(opts = displayOptions()) {
	// "both" analyzes the lattice in English (primary) and may request DA
	// alongside — same meaning as glossOptions().lang for the primary pass.
	return opts.lang === "da" ? "da" : "en";
}

function showMoodLabels() {
	return displayOptions().showMood;
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
	revealBreakdown(renderSentenceBreakdown(breakdownDiv, session.lastSentencePlan, glossSummaryItems, breakdownView()));
}

function selectExample(word) {
	preservePageScroll(() => {
		setFieldValue(wordInput, word);
		return runDeconstruct();
	});
}

function ensureExamplesPanel() {
	if (examplesPanel || !examplesFrame || !workedExamplesModal) return examplesPanel;
	examplesPanel = mountExamplesPanel({
		frameRoot: examplesFrame,
		dialog: workedExamplesModal,
		tFn: t,
		onPick: (surface) => selectExample(surface),
	});
	return examplesPanel;
}

async function loadAndMountExamples() {
	const panel = ensureExamplesPanel();
	if (!panel) return;
	try {
		const { catalog } = await loadExamplesCatalog();
		panel.setCatalog(catalog);
	} catch (err) {
		panel.setLoadError(err?.message || String(err));
	}
	panel.refreshChrome();
}

function initDisplayOptions() {
	fillBlanksCheckbox.checked = stored("bloq:fill-blanks") === "true";
	fillBlanksCheckbox.addEventListener("change", () => {
		storePreference("bloq:fill-blanks", null, String(fillBlanksCheckbox.checked));
		onDisplayOptionChange();
	});
	uiLangSelect.value = stored("bloq:ui-lang", "bl-oq-ly:ui-lang") === "da" ? "da" : "en";
	showIdsCheckbox.checked = stored(SHOW_IDS_KEY_RENAMED, SHOW_IDS_KEY) === "true";
	showMoodCheckbox.checked = stored(SHOW_MOOD_KEY_RENAMED, SHOW_MOOD_KEY) === "true"; // default off
	readingOrderCheckbox.checked = stored(READING_ORDER_KEY_RENAMED, READING_ORDER_KEY) !== "false"; // default on
	langSelect.value = ["en", "da", "both"].includes(stored(LANG_KEY_RENAMED, LANG_KEY)) ? stored(LANG_KEY_RENAMED, LANG_KEY) : "en";
	spellingSelect.value = ["both", "spelling-only", "gloss-only"].includes(stored(SPELLING_KEY_RENAMED, SPELLING_KEY))
		? stored(SPELLING_KEY_RENAMED, SPELLING_KEY) : "both";
	layoutSelect.value = LAYOUTS.includes(stored(LAYOUT_KEY, null)) ? stored(LAYOUT_KEY, null) : "stack";

	function onDisplayOptionChange() {
		if (session.workspace) relabelBlocks(session.workspace, session.presetsById, displayOptions());
		applyToolbox();
		refreshBuild();
		if (session.lastDeconstructIds) rerenderBreakdown();
	}
	uiLangSelect.addEventListener("change", () => {
		storePreference("bloq:ui-lang", "bl-oq-ly:ui-lang", uiLangSelect.value);
		setLocale(uiLangSelect.value);
		setActiveLocale(uiLangSelect.value);
		applyLocale();
		syncPaletteToggle();
		examplesPanel?.refreshChrome();
		syncDocumentTitle();
		applyTheme(document.documentElement.dataset.theme || "auto");
		if (session.lastDeconstructIds) rerenderBreakdown();
		applyBuildShare(refreshBuild());
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
	layoutSelect.addEventListener("change", () => {
		storePreference(LAYOUT_KEY, LAYOUT_KEY, layoutSelect.value);
		applyLayout({ reveal: true });
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
	const options = canvasGlossOptions();
	const parts = list.map((seq) => composedTranslation(glossSummaryItems(seq, options), headlineGloss, glossOptions())).filter(Boolean);
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
	// Prefer the stem that owns the first drawable word on the canvas tree,
	// not an arbitrary first stem from getAllBlocks (order is not semantic).
	// Wrap layout stores that stem under ROWS → CHAIN, not MORPHEMES.
	let noun = null;
	if (session.workspace) {
		const tree = canvasTree(session.workspace);
		outer: for (const sentence of tree.sentences) {
			for (const word of sentence.words) {
				if (word.held || !word.ids.length) continue;
				noun = nounStemBlock(word.block);
				if (noun) break outer;
			}
		}
	}
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
	setViewLayout(layoutSelect?.value || "stack");
	session.workspace = Blockly.inject(blocklyDiv, workspaceOptions());
	session.workspace.addChangeListener((event) => {
		if (event?.isUiEvent) return;
		applyBuildShare(refreshBuild());
		// The breakdown is not a build product. A noun presentation change
		// still has to repaint it, or it stays on the value from when it opened.
		if (event?.type === Blockly.Events.BLOCK_CHANGE && event.name === "PRESENTATION") rerenderBreakdown();
	});
	if (serializedState) Blockly.serialization.workspaces.load(serializedState, session.workspace);
	registerVerbPickerReactivity(session.workspace);
}

function rebuildWorkspace() {
	if (!session.workspace) return;
	// Blockly serialization drops bloqSource / bloqAssembly / bloqHeld and the
	// noun PRESENTATION field's meaning across a renderer change. Use the same
	// snapshot the layout switch uses.
	const plan = snapshotCanvas(session.workspace);
	session.workspace.dispose();
	injectWorkspace();
	applyToolbox();
	// An empty Sentence has a source and no words. Rendering only when some
	// sentence has words dropped that container on Classic ↔ Zelos.
	if (plan.length) {
		renderSentencePlan(session.workspace, plan, session.presetsById, displayOptions());
	}
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
	statusEl.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
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

/** Render a formatStatus contract onto the status live region. */
function applyStatus(status) {
	if (status.words?.length) {
		setStatusWords(status.words, status.kind, status.meta);
		return;
	}
	setStatus(status.detail, status.kind, status.meta);
}

function formatBytes(n) {
	if (!n) return "";
	return `${(n / 1048576).toFixed(1)} MB`;
}

function showLoadingModal() {
	if (document.documentElement.dataset.bloqReady === "1") return;
	if (!loadingModal) return;
	if (typeof loadingModal.showModal === "function") {
		if (!loadingModal.open) loadingModal.showModal();
	} else {
		loadingModal.hidden = false;
	}
}

function hideLoadingModal() {
	document.documentElement.dataset.bloqReady = "1";
	if (!loadingModal) return;
	if (typeof loadingModal.close === "function" && loadingModal.open) loadingModal.close();
	loadingModal.hidden = true;
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
		view: visualizations?.getView() || "blockly",
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
	if (!ok) {
		applyStatus({ kind: "error", words: null, detail: t("copyFailed"), meta: "", assertive: true });
		return;
	}
	copyLinkBtn.textContent = t("linkCopied");
	window.setTimeout(() => {
		copyLinkBtn.textContent = t("copyLink");
	}, 1200);
}

function clearCanvas() {
	if (!session.workspace) return;
	visualizations?.discardDraft();
	// Bump the run id before dropping share state. A Deconstruct that is
	// awaiting analyzeWordAsync must see the new id and return before it
	// calls renderSentencePlan or syncURL.
	cancelDeconstruct(session);
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
	if (url === current) return;
	preservePageScroll(() => {
		if (push) history.pushState(null, "", url);
		else history.replaceState(null, "", url);
	});
}

/** Applies a {mode, word, chain, view} state (from router.js's readState(),
 * whether from the initial load or a popstate) to the live app -- the
 * inverse of currentShareState(). Restores the canvas chain and the
 * analyzed word together; `mode` is accepted for older links but no
 * longer switches a hidden panel. Never itself touches the URL (the
 * caller already has it, or is about to set it). */
function applyShareState(state) {
	visualizations?.discardDraft();
	visualizations?.setView(state.view);
	const sentences = state.sentences?.length
		? state.sentences
		: ((state.words && state.words.length) ? [state.words] : (state.chain.length ? [state.chain] : []));
	// Back to a bare URL must undo the workshop. Build uses replaceState, so
	// the history entry under a Deconstruct push is often `/` with no word
	// and no chain. clearCanvas already cancels an in-flight analysis and
	// does not push another history entry.
	if (!state.word && sentences.length === 0) {
		clearCanvas();
		return;
	}
	if (state.word) {
		setFieldValue(wordInput, state.word);
		if (!session.lastDeconstructWord) session.lastDeconstructWord = state.word;
	}
	if (sentences.length > 0 && session.workspace) {
		const current = topLevelSentences(session.workspace);
		const same = sameIdTree(current, sentences);
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
	applyStatus(formatStatus({
		plan,
		surfaces: sentenceInitialWords(plan),
		meta: planStatusMeta(plan),
		empty: false,
	}, { t }));
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

function announceCanvasChains() {
	const live = document.getElementById("canvas-chains");
	if (!live || !session.workspace) return;
	const tree = canvasTree(session.workspace);
	const lines = [];
	tree.sentences.forEach((sentence, s) => {
		const words = sentence.words.map((word) => {
			if (word.held) return word.block?.getFieldValue?.("TITLE") || word.held;
			return word.ids.join(" + ") || "…";
		});
		lines.push(words.join(" · ") || t("sentenceN", { n: s + 1 }));
	});
	live.textContent = lines.length ? lines.join(" | ") : "";
}

function paintCanvasLabels(result) {
	// Failures stay in their own slot. Indexing result.built would slide the
	// next successful surface onto the broken word.
	const { built, seqs } = labelsForCanvasWords(result);
	const options = canvasGlossOptions();
	const translations = seqs.map((seq) => (seq
		? composedTranslation(glossSummaryItems(seq, options), headlineGloss, glossOptions())
		: ""));
	labelContainers(session.workspace, built, translations);
}

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
	announceCanvasChains();
	visualizations?.refresh();
	const draftError = visualizations?.getDraftError();
	if (draftError) {
		applyStatus({ kind: "error", words: null, detail: draftError, meta: "", assertive: true });
		updateReadingLine(null);
		return result;
	}

	if (result.usePlan) {
		paintCanvasLabels(result);
		showPlanStatus(session.lastSentencePlan);
		updateSentenceReading(session.lastSentencePlan);
		return result;
	}

	if (result.empty) {
		applyStatus(formatStatus(result, { t }));
		updateReadingLine(null);
		labelContainers(session.workspace, []);
		return result;
	}

	paintCanvasLabels(result);
	applyStatus(formatStatus(result, { t }));
	updateReadingLine(result.error ? null : result.seqs);
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
		syncDocumentTitle();
		syncURL({ push: false });
	}
}

function breakdownView() {
	const opts = displayOptions();
	const gloss = canvasGlossOptions();
	return {
		t,
		reverseOrder: opts.readLastFirst,
		fillBlanks: opts.fillBlanks,
		...gloss,
		presentationPreferences: {
			numberPreference: gloss.numberPreference,
			determinationPreference: gloss.determinationPreference,
		},
		headlineGloss,
		showDanish: opts.lang === "both",
		visibleAssembly,
		builderHref: (seq) => `${routeForState(location.pathname)}${writeState({ view: visualizations?.getView(), chain: seq.map((item) => item.id).filter(Boolean) })}`,
	};
}

function revealBreakdown(meta) {
	breakdownSummaryMeta.textContent = meta;
	// Only auto-open the first time the breakdown panel appears. A later
	// re-render — display-option toggle, etc. — must leave its fold state alone.
	const firstShow = breakdownDetails.hidden;
	breakdownDetails.hidden = false;
	if (firstShow) breakdownDetails.open = false;
}

function rerenderBreakdown() {
	if (session.lastSentencePlan) {
		revealBreakdown(renderSentenceBreakdown(breakdownDiv, session.lastSentencePlan, glossSummaryItems, breakdownView()));
		return;
	}
	const parts = session.lastDeconstructParts?.length
		? session.lastDeconstructParts
		: (session.lastDeconstructSeq
			? [{ word: session.lastDeconstructWord, seq: session.lastDeconstructSeq, built: session.lastDeconstructBuilt, alternatives: session.lastDeconstructAlternatives }]
			: []);
	if (!parts.length) return;
	revealBreakdown(renderWordBreakdowns(breakdownDiv, parts, glossSummaryItems, breakdownView()));
}

function materializePlan(plan) {
	return {
		...plan,
		sentences: plan.sentences.map((sentence) => ({
			...sentence,
			words: sentence.words.map((word) => {
				if (!word.canvasIds?.length) return { ...word };
				const seq = seqForChain(word.canvasIds);
				if (!seq) {
					return {
						...word,
						status: "missing",
						canvasIds: [],
						note: t("noBuilderSequence"),
					};
				}
				const built = buildWord(seq);
				if (!built.ok) {
					return {
						...word,
						seq,
						built,
						status: "invalid",
						canvasIds: [],
						note: built.reason || t("closedReadingDoesNotBuild"),
					};
				}
				return { ...word, seq, built };
			}),
		})),
	};
}

function planStatusMeta(plan) {
	const count = plan.sentences.length;
	const modes = [...new Set(plan.sentences.map((sentence) => sentence.assembly?.mode).filter(Boolean))];
	const modeLabel = modes.join(" + ") || t("oneSentence");
	return count > 1 ? `${t("nSentences", { count })} · ${modeLabel}` : modeLabel;
}

async function runSentenceDeconstruct(surface, { skipCanvas = false, run }) {
	const tokens = tokenizeSentence(surface);
	breakdownDiv.innerHTML = "";
	setStatus(t("analyzingSentence", { count: tokens.length }), "");
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
		if (run !== session.deconstructRun) return;
		session.lastDeconstructWord = surface;
		session.lastSentencePlan = plan;
		const placed = plan.sentences.flatMap((sentence) => sentence.words.filter((word) => word.seq && word.built?.ok));
		session.lastDeconstructSeq = placed[0]?.seq ?? null;
		session.lastDeconstructBuilt = placed[0]?.built ?? null;
		// Keep one id list per source sentence. A flat map makes two sentences
		// look like one, so deconstructIdsMatchSentences fails and the share
		// URL is demoted to ?chain= (#130).
		session.lastDeconstructIds = plan.sentences.map((sentence) =>
			sentence.words.filter((word) => word.canvasIds?.length).map((word) => word.canvasIds));
		session.mode = "deconstruct";
		syncDocumentTitle();
		if (!skipCanvas && session.workspace && plan.sentences.length) {
			const presentation = nounPresentationValue();
			renderSentencePlan(session.workspace, plan.sentences.map((sentence) => ({
				source: sentence.source,
				assembly: visibleAssembly(sentence.assembly),
				words: sentence.words.map((word) => ({
					surface: word.surface || word.raw,
					raw: word.raw,
					canvasIds: word.canvasIds,
					heldLabel: word.heldLabel,
					presentation,
				})),
			})), session.presetsById, displayOptions(), { forceSentence: true });
			session.workspace.scrollCenter();
			requestAnimationFrame(() => Blockly.svgResize(session.workspace));
			// refreshBuild paints labels; plan status must win over any build flash.
			refreshBuild();
		}
		// After the canvas, so the breakdown reads the stems just drawn.
		rerenderBreakdown();
		showPlanStatus(plan);
		updateSentenceReading(plan);
		// This function writes the Deconstruct share URL after the canvas is painted.
		syncURL({ push: true });
	} catch (err) {
		if (err?.name === "AbortError" || run !== session.deconstructRun) return;
		setStatus(t("analysisFailed", { message: err.message }), "error");
	}
}

async function runDeconstruct({ skipCanvas = false } = {}) {
	visualizations?.discardDraft();
	visualizations?.refresh();
	const surface = wordInput.value.trim();
	cancelDeconstruct(session);
	if (!surface) {
		// The run counter just advanced. Without a status paint the live
		// region stays on "Analyzing…" from the request this cancelled.
		applyBuildShare(refreshBuild());
		return;
	}
	const run = session.deconstructRun;
	session.deconstructAbort = new AbortController();
	session.lastSentencePlan = null;
	if (isSentenceInput(surface)) {
		await runSentenceDeconstruct(surface, { skipCanvas, run });
		return;
	}
	const tokens = surface.split(/\s+/).filter(Boolean);
	breakdownDiv.innerHTML = "";
	setStatus(tokens.length === 1 ? t("analyzingWord", { token: tokens[0] }) : t("analyzingWords", { count: tokens.length }), "");
	session.lastDeconstructIds = null;
	session.lastDeconstructSeq = null;
	session.lastDeconstructAlternatives = null;
	session.lastDeconstructParts = null;
	try {
		const parts = [];
		const failures = [];
		for (const token of tokens) {
			const result = await analyzeWordAsync(token, session.presets, {}, { signal: session.deconstructAbort.signal });
			if (run !== session.deconstructRun) return;
			if (!result.matches || result.matches.length === 0) {
				failures.push({ token, evalCount: result.evalCount });
				parts.push({
					word: token,
					seq: null,
					built: null,
					alternatives: [],
					ids: [],
					missing: true,
				});
				continue;
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
		if (run !== session.deconstructRun) return;
		session.lastDeconstructWord = surface;
		const okParts = parts.filter((p) => !p.missing && p.seq);
		session.lastDeconstructParts = okParts.length ? okParts : parts;
		session.lastDeconstructSeq = okParts[0]?.seq ?? null;
		session.lastDeconstructBuilt = okParts[0]?.built ?? null;
		session.lastDeconstructAlternatives = okParts[0]?.alternatives ?? null;
		session.lastDeconstructIds = okParts.length === 1 ? okParts[0].ids : okParts.map((p) => p.ids);
		session.mode = "deconstruct";
		syncDocumentTitle();
		if (!skipCanvas && session.workspace) {
			const chains = okParts.map((p) => p.ids).filter((ids) => ids.length);
			if (chains.length) {
				const presentation = nounPresentationValue();
				renderSentencePlan(session.workspace, [{
					words: chains.map((ids) => ({ canvasIds: ids, presentation })),
				}], session.presetsById, displayOptions());
				session.workspace.scrollCenter();
				requestAnimationFrame(() => Blockly.svgResize(session.workspace));
				refreshBuild();
			} else {
				// An unknown word used to leave the previous blocks and reading
				// line up while the URL became ?w= for a word that was not drawn.
				// Do not refreshBuild here: its empty-canvas hint would replace
				// the error status painted just below.
				renderSentencePlan(session.workspace, [], session.presetsById, displayOptions());
				visualizations?.refresh();
				updateReadingLine(null);
			}
		}
		if (okParts.length) rerenderBreakdown();
		else {
			breakdownSummaryMeta.textContent = t("noVerifiedBreakdown", { token: failures[0]?.token || surface });
			breakdownDetails.hidden = false;
		}
		if (failures.length) {
			const detail = failures.map((f) => t("noVerifiedBreakdown", { token: f.token })).join(" · ");
			const meta = failures.map((f) => t("evalCandidates", { count: f.evalCount })).join(" · ");
			const okSurfaces = okParts.map((p) => p.built?.word || p.word);
			applyStatus({
				kind: "error",
				words: null,
				detail: okSurfaces.length ? `${okSurfaces.join(" · ")} · ${detail}` : detail,
				meta,
				assertive: true,
			});
		}
		// This function writes the Deconstruct share URL after the canvas is painted.
		syncURL({ push: true });
	} catch (err) {
		if (err?.name === "AbortError" || run !== session.deconstructRun) return;
		setStatus(t("analysisFailed", { message: err.message }), "error");
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
function syncPaletteToggle() {
	if (!paletteToggleBtn) return;
	paletteToggleBtn.textContent = t(paletteVisible ? "paletteHide" : "paletteShow");
	paletteToggleBtn.setAttribute("aria-expanded", paletteVisible ? "true" : "false");
}

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
	// to match a query, so the pickers are excluded from a filtered view
	// (bl-oq-ly#18). Matching verb and noun endings are ordinary blocks
	// again for that view; buildToolbox owns that switch.
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
	ensureExamplesPanel();
	copyLinkBtn.addEventListener("click", () => { copyShareLink(); });
	clearCanvasBtn.addEventListener("click", () => { clearCanvas(); });
	paletteToggleBtn.addEventListener("click", () => {
		paletteVisible = !paletteVisible;
		filterWrap.hidden = !paletteVisible;
		syncPaletteToggle();
		applyToolbox();
		requestAnimationFrame(() => Blockly.svgResize(session.workspace));
	});
	filterInput.addEventListener("input", applyToolbox);
}

async function loadCatalogAndBlocks() {
	blocklyThemes = buildBlocklyThemes();
	setStatus(t("loading"), "");
	const catalog = await loadCatalog({
		onProgress: setLoadingProgress,
		onUpdated: (next) => {
			rawCatalog = next.raw;
			session.presets = next.presets;
			session.presetsById = new Map(session.presets.map((p) => [p.id, p]));
			// The picker block types stay registered. Point them at the new
			// index before the toolbox is rebuilt, or a newly published ending
			// is hidden by the picker and still not selectable inside it.
			bindVerbPickerCatalog({
				verbEndingIndex: buildVerbEndingIndex(session.presets),
				presetsById: session.presetsById,
				getDisplayOptions: displayOptions,
				resolveMoodLabel,
				resolvePersonLabel,
			});
			bindNounPickerCatalog({
				nounEndingIndex: buildNounEndingIndex(session.presets),
				presetsById: session.presetsById,
				getDisplayOptions: displayOptions,
			});
			reresolveBoundVerbPickers(session.workspace);
			reresolveBoundNounPickers(session.workspace);
			if (session.workspace?.getToolbox()?.getFlyout()?.isVisible()) return;
			applyToolbox();
		},
	});
	session.presets = catalog.presets;
	rawCatalog = catalog.raw;
	session.presetsById = new Map(session.presets.map((p) => [p.id, p]));

	defineMorphemeBlocks();
	const verbEndingIndex = buildVerbEndingIndex(session.presets);
	const nounEndingIndex = buildNounEndingIndex(session.presets);
	defineVerbEndingPickerBlock(verbEndingIndex, session.presetsById, displayOptions, resolveMoodLabel, resolvePersonLabel);
	defineNounEndingPickerBlock(nounEndingIndex, session.presetsById, displayOptions);
	defineVerbObjectBlock(verbEndingIndex, resolvePersonLabel);
}

function snapshotCanvas(workspace) {
	return planFromCanvas(workspace);
}

function applyLayout(options = {}) {
	const layout = LAYOUTS.includes(layoutSelect?.value) ? layoutSelect.value : "stack";
	document.body.dataset.layout = layout;
	const instruction = document.querySelector(".build-section .section-instruction");
	if (instruction) instruction.dataset.i18n = layout === "stack" ? "buildInstruction" : "buildInstructionLinear";
	applyLocale();
	syncPaletteToggle();
	const changed = getViewLayout() !== layout;
	if (session.workspace && changed) {
		const plan = snapshotCanvas(session.workspace);
		setViewLayout(layout);
		applyToolbox();
		renderSentencePlan(session.workspace, plan, session.presetsById, displayOptions());
		requestAnimationFrame(() => { if (session.workspace) Blockly.svgResize(session.workspace); });
		applyBuildShare(refreshBuild());
	} else {
		setViewLayout(layout);
	}
	if (options.reveal) blocklyDiv?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function mountWorkspace() {
	initTheme();
	initBlocklyTheme();
	initDisplayOptions();
	initDisplayChrome();
	injectWorkspace();
	applyLayout();
	bindWindowEvents();
	bindUiEvents();
	visualizations = mountVisualizations(document.getElementById("visualizations"), {
		getPlan: () => snapshotCanvas(session.workspace),
		getPresets: () => session.presets,
		getPresetsById: () => session.presetsById,
		getCatalog: () => rawCatalog,
		getOptions: displayOptions,
		onViewChange: () => syncURL({ push: true }),
		engine: { buildWord, presentSequence, glossSummaryItems }, matches: presetMatchesQuery, label: labelFor,
		setBlocklyVisible: (visible) => {
			blocklyDiv.hidden = !visible;
			document.querySelector(".palette-controls").hidden = !visible;
			if (visible) requestAnimationFrame(() => Blockly.svgResize(session.workspace));
		},
		onChange: (plan) => {
			cancelDeconstruct(session);
			// Keep an invalid proposal in the card editor. Blockly connection
			// shapes cannot represent every invalid chain without dropping items.
			for (const sentence of plan) for (const word of sentence.words) {
				if (word.heldLabel || !word.canvasIds?.length) continue;
				const seq = seqForChain(word.canvasIds);
				const built = seq ? buildWord(seq) : { ok: false, reason: "Missing morpheme" };
				if (!built.ok) {
					applyStatus({ kind: "error", words: null, detail: built.reason || "Invalid sequence", meta: "", assertive: true });
					updateReadingLine(null);
					return { error: built.reason || "Invalid sequence" };
				}
			}
			clearAnalysisCaches(session);
			renderSentencePlan(session.workspace, plan, session.presetsById, displayOptions());
			applyBuildShare(refreshBuild());
			return true;
		},
	});
	visualizations.refresh();
	setStatus(t("loadedMorphemes", { count: session.presets.length }), "");
	paletteToggleBtn.setAttribute("aria-controls", "blockly-div");
	syncPaletteToggle();
	if (!paletteVisible) {
		filterWrap.hidden = true;
		applyToolbox();
	}
	const initialState = readState(location.search);
	visualizations.setView(initialState.view);
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
	syncPaletteToggle();
	syncDocumentTitle();
	try {
		if (!session.presets.length) {
			showLoadingModal();
			setLoadingProgress({});
			await loadCatalogAndBlocks();
		}
		if (!examplesPanel) {
			await loadAndMountExamples();
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
			setStatus(t("failedToStart", { message: err.message }), "error");
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
