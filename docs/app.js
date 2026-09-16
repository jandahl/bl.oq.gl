import { buildWord, analyzeWordAsync, glossSummaryItems, headlineGloss, resolveMoodLabel, resolvePersonLabel } from "./oq-api.js";
import { loadCatalog } from "./catalog.js";
import {
	defineMorphemeBlocks, buildToolbox, topLevelSentences, renderSentence, relabelBlocks, labelContainers,
	buildVerbEndingIndex, buildNounEndingIndex, defineVerbEndingPickerBlock, defineNounEndingPickerBlock, defineVerbObjectBlock, registerVerbPickerReactivity,
	presetMatchesQuery,
} from "./blocks.js";
import { renderBreakdown, renderAlternativeBreakdowns, renderTonedPhrases, wordTone } from "./breakdown.js";
import { buildBlocklyThemes } from "./theme.js";
import { composedTranslation } from "./gloss.js";
import { readState, writeState, routeForState } from "./router.js";
import { loadWorkedExamples } from "./worked-examples.js";
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

let mode = "build";
let presets = [];
let presetsById = new Map();
let workspace = null;
let deconstructAbort = null;
let deconstructRun = 0;
let paletteVisible = true;
let lastDeconstructIds = null;
let blocklyThemes = null;
let lastDeconstructWord = "";
let lastDeconstructSeq = null;
let lastDeconstructBuilt = null;
let lastDeconstructAlternatives = null;
let lastDeconstructParts = null;
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
	exampleWordButtons = document.querySelectorAll("[data-example-word]");
	workedExamplesBtn = document.getElementById("worked-examples-btn");
	workedExamplesModal = document.getElementById("worked-examples-modal");
	workedExamplesClose = document.getElementById("worked-examples-close");
	workedExamplesFilter = document.getElementById("worked-examples-filter");
	workedExamplesStatus = document.getElementById("worked-examples-status");
	workedExamplesList = document.getElementById("worked-examples-list");
	showIdsCheckbox = document.getElementById("opt-show-ids");
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
// labelFor()-consuming call (blocks.js's buildToolbox/renderChain/
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


function stored(key, legacyKey) {
	return localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null);
}

function storePreference(key, renamedKey, value) {
	localStorage.setItem(key, value);
	localStorage.setItem(renamedKey, value);
}

const APP_TITLE = "BLOQ";

/** Tab title is `$word - BLOQ` only after a submitted deconstruct, never while typing. */
function syncDocumentTitle() {
	const word = (lastDeconstructWord || "").trim();
	document.title = word ? `${word} - ${APP_TITLE}` : APP_TITLE;
}

function displayOptions() {
	return { showIds: showIdsCheckbox.checked, lang: langSelect.value, spellingMode: spellingSelect.value };
}

function glossOptions() { const lang = displayOptions().lang; return { lang: lang === "both" ? "en" : lang, showOther: lang === "both" }; }

function selectExample(word) {
	preservePageScroll(() => {
		setFieldValue(wordInput, word);
		return runDeconstruct();
	});
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
	uiLangSelect.value = stored("bl-oq-ly:ui-lang", "bloq:ui-lang") === "da" ? "da" : "en";
	showIdsCheckbox.checked = stored(SHOW_IDS_KEY, SHOW_IDS_KEY_RENAMED) === "true";
	readingOrderCheckbox.checked = stored(READING_ORDER_KEY, READING_ORDER_KEY_RENAMED) !== "false"; // default on
	langSelect.value = ["en", "da", "both"].includes(stored(LANG_KEY, LANG_KEY_RENAMED)) ? stored(LANG_KEY, LANG_KEY_RENAMED) : "en";
	spellingSelect.value = ["both", "spelling-only", "gloss-only"].includes(stored(SPELLING_KEY, SPELLING_KEY_RENAMED))
		? stored(SPELLING_KEY, SPELLING_KEY_RENAMED) : "both";

	function onDisplayOptionChange() {
		if (workspace) relabelBlocks(workspace, presetsById, displayOptions());
		applyToolbox();
		refreshBuild();
		if (lastDeconstructIds) rerenderBreakdown();
	}
	uiLangSelect.addEventListener("change", () => {
		storePreference("bl-oq-ly:ui-lang", "bloq:ui-lang", uiLangSelect.value);
		setLocale(uiLangSelect.value);
		applyLocale();
		syncDocumentTitle();
		applyTheme(document.documentElement.dataset.theme || "auto");
	});
	showIdsCheckbox.addEventListener("change", () => {
		storePreference(SHOW_IDS_KEY, SHOW_IDS_KEY_RENAMED, String(showIdsCheckbox.checked));
		onDisplayOptionChange();
	});
	langSelect.addEventListener("change", () => {
		storePreference(LANG_KEY, LANG_KEY_RENAMED, langSelect.value);
		onDisplayOptionChange();
	});
	spellingSelect.addEventListener("change", () => {
		storePreference(SPELLING_KEY, SPELLING_KEY_RENAMED, spellingSelect.value);
		onDisplayOptionChange();
	});
	readingOrderCheckbox.addEventListener("change", () => {
		storePreference(READING_ORDER_KEY, READING_ORDER_KEY_RENAMED, String(readingOrderCheckbox.checked));
		// Only Deconstruct's per-morpheme rows are reversible -- Build's
		// reading line is a composed sentence, unaffected (see gloss.js).
		if (lastDeconstructIds) rerenderBreakdown();
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

function nounPresentationPreferences() {
	const noun = workspace?.getAllBlocks(false).find((block) => block.type === "morpheme_block__stem_n");
	const [numberPreference, determinationPreference] = (noun?.getFieldValue("PRESENTATION") ?? "singular|indefinite").split("|");
	return { numberPreference, determinationPreference };
}

// --- Theme (bl-oq-ly#7): a real toggle, not just following the OS. Cycles
// auto -> light -> dark -> auto. "auto" clears the override so style.css's
// prefers-color-scheme media query decides, matching the OS as before.
// Blockly's own toolbox/flyout/workspace chrome is themed separately via
// theme.js + workspace.setTheme(), since it doesn't read CSS custom
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
	if (workspace && blocklyThemes) {
		const themeSet = blocklyThemes[selectedBlocklyTheme] || blocklyThemes.classic;
		workspace.setTheme(isEffectivelyDark() ? themeSet.dark : themeSet.light);
	}
}

function initBlocklyTheme() {
	const saved = stored("bl-oq-ly:blockly-theme", "bloq:blockly-theme");
	selectedBlocklyTheme = ["classic", "zelos"].includes(saved) ? saved : "classic";
	blocklyThemeSelect.value = selectedBlocklyTheme;
	blocklyThemeSelect.addEventListener("change", () => {
		selectedBlocklyTheme = blocklyThemeSelect.value;
		storePreference("bl-oq-ly:blockly-theme", "bloq:blockly-theme", selectedBlocklyTheme);
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
		toolbox: buildToolbox(presets, displayOptions()),
		theme: isEffectivelyDark() ? themeSet.dark : themeSet.light,
		// Classic uses Blockly's default renderer (Geras); Zelos is a renderer,
		// not just a Theme. Changing it requires rebuilding the workspace.
		renderer: selectedBlocklyTheme === "zelos" ? "zelos" : "geras",
		trashcan: true,
		zoom: { controls: true, wheel: true, pinch: true },
		sounds: false,
		move: { scrollbars: true, drag: true, wheel: true },
	};
}

function injectWorkspace(serializedState = null) {
	workspace = Blockly.inject(blocklyDiv, workspaceOptions());
	workspace.addChangeListener((event) => {
		if (event?.isUiEvent) return;
		refreshBuild();
	});
	if (serializedState) Blockly.serialization.workspaces.load(serializedState, workspace);
	registerVerbPickerReactivity(workspace);
}

function rebuildWorkspace() {
	if (!workspace) return;
	const serializedState = Blockly.serialization.workspaces.save(workspace);
	workspace.dispose();
	injectWorkspace(serializedState);
	applyToolbox();
	requestAnimationFrame(() => Blockly.svgResize(workspace));
	refreshBuild();
}

function applyTheme(theme) {
	if (theme === "auto") delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = theme;
	themeToggleBtn.textContent = t(`theme.${theme}`);
	syncBlocklyTheme();
}

function initTheme() {
	const saved = stored(THEME_KEY, THEME_KEY_RENAMED);
	applyTheme(THEME_CYCLE.includes(saved) ? saved : "auto");
	themeToggleBtn.addEventListener("click", () => {
		const current = document.documentElement.dataset.theme || "auto";
		const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
		storePreference(THEME_KEY, THEME_KEY_RENAMED, next);
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
	const sentences = workspace ? topLevelSentences(workspace) : [];
	const words = sentences.length === 1 ? sentences[0] : [];
	const word = lastDeconstructWord || wordInput.value.trim();
	return {
		mode,
		word,
		chain: words.length === 1 ? words[0] : [],
		words,
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
	if (!workspace) return;
	workspace.clear();
	// Clearing the canvas must also invalidate share state: otherwise
	// lastDeconstructWord / the word input keep w= in the URL, and a reload
	// or copied link re-runs Deconstruct and repopulates the canvas.
	lastDeconstructWord = "";
	lastDeconstructSeq = null;
	lastDeconstructBuilt = null;
	lastDeconstructAlternatives = null;
	lastDeconstructIds = null;
	lastDeconstructParts = null;
	mode = "build";
	setFieldValue(wordInput, "");
	breakdownDiv.innerHTML = "";
	breakdownSummaryMeta.textContent = "";
	breakdownDetails.hidden = true;
	updateReadingLine(null);
	syncDocumentTitle();
	refreshBuild();
	requestAnimationFrame(() => Blockly.svgResize(workspace));
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
		if (!lastDeconstructWord) lastDeconstructWord = state.word;
	}
	const words = (state.words && state.words.length) ? state.words : (state.chain.length ? [state.chain] : []);
	if (words.length > 0 && workspace) {
		const current = topLevelSentences(workspace);
		const same = current.length === 1 && current[0].length === words.length
			&& current[0].every((ids, i) => ids.length === words[i].length && ids.every((id, j) => id === words[i][j]));
		if (!same) {
			renderSentence(workspace, words, presetsById, displayOptions());
			workspace.scrollCenter();
		}
		refreshBuild();
	}
	if (state.word) {
		if (lastDeconstructWord !== state.word || !lastDeconstructSeq) {
			runDeconstruct({ skipCanvas: words.length > 0 });
		} else {
			rerenderBreakdown();
		}
	}
	syncDocumentTitle();
}

function seqForChain(ids) {
	const seq = [];
	for (const id of ids) {
		const preset = presetsById.get(id);
		if (!preset) return null;
		seq.push(preset.seq[0]);
	}
	return seq;
}

function refreshBuild() {
	if (!workspace) return;
	const sentences = topLevelSentences(workspace);
	if (sentences.length === 0) {
		setStatus(t("emptyCanvasHint"), "");
		updateReadingLine(null);
		labelContainers(workspace, []);
		syncURL({ push: false });
		return;
	}
	if (sentences.length > 1) {
		setStatus("More than one sentence on the canvas — combine into a single sentence.", "error");
		updateReadingLine(null);
		return;
	}
	const words = sentences[0];
	const built = [];
	const seqs = [];
	for (let i = 0; i < words.length; i++) {
		const seq = seqForChain(words[i]);
		if (!seq) {
			setStatus("Unknown morpheme in stack.", "error");
			updateReadingLine(null);
			return;
		}
		const result = buildWord(seq);
		if (!result.ok) {
			const where = words.length > 1 ? `word ${i + 1}, ` : "";
			setStatus(`✗ ${result.reason || "invalid sequence"}`, "error", `${where}at position ${result.errorAt >= 0 ? result.errorAt + 1 : "?"}`);
			updateReadingLine(null);
			return;
		}
		built.push(result);
		seqs.push(seq);
	}
	const translations = seqs.map((seq) => composedTranslation(glossSummaryItems(seq, glossOptions()), headlineGloss, glossOptions()));
	labelContainers(workspace, built, translations);
	const kind = built.some((r) => r.approximate) ? "approx" : "ok";
	const allClosed = built.every((r) => r.closed);
	const meta = words.length > 1
		? (allClosed ? `${words.length} words` : "mid-derivation — keep building")
		: (allClosed ? "complete word" : "mid-derivation — keep building");
	setStatusWords(built.map((r) => `${r.approximate ? "≈ " : ""}${r.word}`), kind, meta);
	updateReadingLine(seqs);
	// A valid edit to the Build canvas is now the shareable state. Do not let
	// the previous Deconstruct query survive after the parser turns green.
	mode = "build";
	lastDeconstructWord = "";
	syncURL({ push: false });
}

function rerenderBreakdown() {
	const parts = lastDeconstructParts?.length
		? lastDeconstructParts
		: (lastDeconstructSeq
			? [{ word: lastDeconstructWord, seq: lastDeconstructSeq, built: lastDeconstructBuilt, alternatives: lastDeconstructAlternatives }]
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

async function runDeconstruct({ skipCanvas = false } = {}) {
	const surface = wordInput.value.trim();
	if (deconstructAbort) deconstructAbort.abort();
	const run = ++deconstructRun;
	if (!surface) return;
	const tokens = surface.split(/\s+/).filter(Boolean);
	deconstructAbort = new AbortController();
	breakdownDiv.innerHTML = "";
	setStatus(tokens.length === 1 ? `Analyzing "${tokens[0]}"…` : `Analyzing ${tokens.length} words…`, "");
	lastDeconstructIds = null;
	lastDeconstructSeq = null;
	lastDeconstructAlternatives = null;
	lastDeconstructParts = null;
	try {
		const parts = [];
		for (const token of tokens) {
			const result = await analyzeWordAsync(token, presets, {}, { signal: deconstructAbort.signal });
			if (run !== deconstructRun) return;
			if (!result.matches || result.matches.length === 0) {
				lastDeconstructWord = surface;
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
		lastDeconstructWord = surface;
		lastDeconstructParts = parts;
		lastDeconstructSeq = parts[0].seq;
		lastDeconstructBuilt = parts[0].built;
		lastDeconstructAlternatives = parts[0].alternatives;
		lastDeconstructIds = parts.length === 1 ? parts[0].ids : parts.map((p) => p.ids);
		mode = "deconstruct";
		syncDocumentTitle();
		rerenderBreakdown();
		if (!skipCanvas && workspace) {
			const chains = parts.map((p) => p.ids).filter((ids) => ids.length);
			if (chains.length) {
				renderSentence(workspace, chains, presetsById, displayOptions());
				workspace.scrollCenter();
				requestAnimationFrame(() => Blockly.svgResize(workspace));
				refreshBuild();
			}
		}
		syncURL({ push: true });
	} catch (err) {
		if (err?.name === "AbortError" || run !== deconstructRun) return;
		setStatus(`Analysis failed: ${err.message}`, "error");
	}
}

// --- Palette hide/show (bl-oq-ly#8) and filter (bl-oq-ly#9). The toolbox
// content is rebuilt from the filtered preset list rather than hidden/shown
// per-block, so a category with no matches disappears entirely (see
// blocks.js's buildToolbox) instead of leaving an empty, confusing category
// behind. Hiding the palette uses Toolbox.setVisible(), Blockly's own public
// API for this -- NOT workspace.updateToolbox(null), which throws ("Can't
// nullify an existing toolbox"): updateToolbox only supports swapping a
// toolbox's *content*, never removing one already injected with a toolbox.
function closeOpenFlyout() {
	workspace?.getToolbox()?.getFlyout()?.hide();
}

function applyToolbox() {
	if (!workspace) return;
	workspace.getToolbox()?.setVisible(paletteVisible);
	closeOpenFlyout();
	if (!paletteVisible) return;

	const q = filterInput.value.trim().toLowerCase();
	const filtered = q
		? presets.filter((preset) => presetMatchesQuery(preset, q))
		: presets;
	// Rebuilt every time from scratch (no cached "full" toolbox), since
	// display options can change independently of the filter and both need
	// to be reflected together. The verb ending picker has no id/gloss text
	// to match a query, so it's excluded from a filtered view entirely
	// (bl-oq-ly#18) rather than left showing as an always-present,
	// unrelated "Inflectional endings (1)" category.
	workspace.updateToolbox(buildToolbox(filtered, displayOptions(), { includeVerbPicker: !q }));
	closeOpenFlyout();
}

function bindWindowEvents() {
	if (windowBound) return;
	windowBound = true;
	window.addEventListener("resize", () => { if (workspace) Blockly.svgResize(workspace); });
	window.addEventListener("orientationchange", () => { if (workspace) Blockly.svgResize(workspace); });
	window.addEventListener("popstate", () => applyShareState(readState(location.search)));
}

function bindUiEvents() {
	const resultsDetails = document.getElementById("results-details");
	resultsDetails?.addEventListener("toggle", () => {
		requestAnimationFrame(() => { if (workspace) Blockly.svgResize(workspace); });
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
		requestAnimationFrame(() => Blockly.svgResize(workspace));
	});
	filterInput.addEventListener("input", applyToolbox);
}

async function loadEngine() {
	blocklyThemes = buildBlocklyThemes();
	setStatus("Loading morpheme catalog…", "");
	const catalog = await loadCatalog({
		onProgress: setLoadingProgress,
		onUpdated: (next) => {
			presets = next.presets;
			presetsById = new Map(presets.map((p) => [p.id, p]));
			if (workspace?.getToolbox()?.getFlyout()?.isVisible()) return;
			applyToolbox();
		},
	});
	presets = catalog.presets;
	presetsById = new Map(presets.map((p) => [p.id, p]));

	defineMorphemeBlocks();
	const verbEndingIndex = buildVerbEndingIndex(presets);
	const nounEndingIndex = buildNounEndingIndex(presets);
	defineVerbEndingPickerBlock(verbEndingIndex, presetsById, displayOptions, resolveMoodLabel, resolvePersonLabel);
	defineNounEndingPickerBlock(nounEndingIndex, presetsById, displayOptions);
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
	setStatus(`Loaded ${presets.length} morphemes.`, "");
	if (!paletteVisible) {
		paletteToggleBtn.textContent = t("paletteShow");
		filterWrap.hidden = true;
		applyToolbox();
	}
	const initialState = readState(location.search);
	if (initialState.word || initialState.chain.length > 0 || initialState.words?.length) applyShareState(initialState);
	requestAnimationFrame(() => { if (workspace) Blockly.svgResize(workspace); });
}

async function startInner() {
	bindDom();
	if (!blocklyDiv) {
		hideLoadingModal();
		return;
	}
	if (workspace && blocklyDiv.querySelector(".injectionDiv")) {
		hideLoadingModal();
		requestAnimationFrame(() => Blockly.svgResize(workspace));
		return;
	}
	if (workspace) {
		try { workspace.dispose(); } catch { /* DOM was replaced (React remount / HMR) */ }
		workspace = null;
	}
	setLocale(stored("bl-oq-ly:ui-lang", "bloq:ui-lang") || "en");
	applyLocale();
	syncDocumentTitle();
	try {
		if (!presets.length) {
			showLoadingModal();
			setLoadingProgress({});
			await loadEngine();
		}
		mountWorkspace();
	} finally {
		hideLoadingModal();
		requestAnimationFrame(() => { if (workspace) Blockly.svgResize(workspace); });
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
