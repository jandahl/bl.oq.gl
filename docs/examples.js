/**
 * Examples catalog loader + Misiliineq-style browse modal.
 *
 * Prefer a remote/shared JSON when available (`globalThis.__BLOQ_EXAMPLES_URL__`);
 * otherwise fall back to the pinned oq-api `getStandardExamples()`. See
 * `examples-schema.js` and AGENTS.md for the shared schema. Do not invent a
 * permanent local examples API here — keep the fallback thin.
 */

import { getStandardExamples } from "./oq-api.js";
import { bindModal } from "./modal.js";
import { t, getLocale } from "./i18n.js";
import {
	normalizeExamplesCatalog,
	glossForExample,
} from "./examples-schema.js";

export { normalizeExamplesCatalog, glossForExample } from "./examples-schema.js";

/** @type {string | null} Override via globalThis.__BLOQ_EXAMPLES_URL__ for tests / future CDN. */
export function examplesRemoteUrl() {
	return (typeof globalThis !== "undefined" && globalThis.__BLOQ_EXAMPLES_URL__) || null;
}

/** @deprecated use examplesRemoteUrl() — kept for call sites that want a constant-like name. */
export const EXAMPLES_REMOTE_URL = null;

/**
 * Prefer a remote shared catalog when configured; otherwise the pinned
 * oq-api STANDARD_EXAMPLES (local fallback only — not a permanent BLOQ API).
 * @returns {Promise<{ catalog: import('./examples-schema.js').ExamplesCatalog, source: 'remote' | 'oq-api' }>}
 */
export async function loadExamplesCatalog() {
	const remoteUrl = examplesRemoteUrl();
	if (remoteUrl) {
		try {
			const res = await fetch(remoteUrl, { credentials: "omit" });
			if (res.ok) {
				const raw = await res.json();
				return { catalog: normalizeExamplesCatalog(raw), source: "remote" };
			}
		} catch {
			/* fall through to oq-api pin */
		}
	}
	const local = await getStandardExamples();
	return { catalog: normalizeExamplesCatalog(local), source: "oq-api" };
}

/** @deprecated Prefer loadExamplesCatalog(); kept for existing call sites. */
export async function loadStandardExamples() {
	const { catalog } = await loadExamplesCatalog();
	return {
		worked: catalog.worked.map((item) => ({ ...item })),
		sentences: catalog.sentences.map((item) => ({
			...item,
			words: [...(item.words || item.surface.split(/\s+/).filter(Boolean))],
		})),
	};
}

/** @deprecated Prefer loadExamplesCatalog().catalog.worked */
export async function loadWorkedExamples() {
	const examples = await loadStandardExamples();
	return examples.worked;
}

/**
 * Mount the Misiliineq-style examples frame + browse dialog.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.frameRoot
 * @param {HTMLDialogElement} opts.dialog
 * @param {(key: string, vars?: Record<string, string | number>) => string} [opts.tFn]
 * @param {(surface: string, item: import('./examples-schema.js').ExampleItem) => void} opts.onPick
 * @param {import('./examples-schema.js').ExamplesCatalog} [opts.initialCatalog]
 */
export function mountExamplesPanel({ frameRoot, dialog, tFn = t, onPick, initialCatalog }) {
	const openBtn = frameRoot.querySelector("[data-examples-open]");
	const closeBtn = dialog.querySelector("[data-examples-close]");
	const dialogTitle = dialog.querySelector("[data-examples-dialog-title]");
	const hintEl = dialog.querySelector("[data-examples-hint]");
	const listEl = dialog.querySelector("[data-examples-list]");
	const statusEl = dialog.querySelector("[data-examples-status]");
	const filterInput = dialog.querySelector("[data-examples-filter]");
	const tabWords = frameRoot.querySelector('[data-examples-tab="words"]');
	const tabSentences = frameRoot.querySelector('[data-examples-tab="sentences"]');

	/** @type {'words' | 'sentences'} */
	let activeBatch = "words";
	/** @type {import('./examples-schema.js').ExamplesCatalog} */
	let catalog = initialCatalog || { worked: [], sentences: [] };
	let loadError = "";

	const modal = bindModal(dialog, {
		openButton: openBtn instanceof HTMLElement ? openBtn : null,
		closeButton: closeBtn instanceof HTMLElement ? closeBtn : null,
		onOpen() {
			renderList();
		},
	});

	function batchItems() {
		return activeBatch === "sentences" ? catalog.sentences : catalog.worked;
	}

	function applyChrome() {
		const batchLabel = activeBatch === "sentences"
			? tFn("exampleSentencesLabel")
			: tFn("exampleWordsLabel");
		if (dialogTitle) {
			dialogTitle.textContent = `${tFn("examplesHeading")} — ${batchLabel}`;
		}
		if (hintEl) {
			hintEl.textContent = activeBatch === "sentences"
				? tFn("examplesSentencesHint")
				: tFn("examplesWordsHint");
		}
		if (openBtn instanceof HTMLElement) {
			openBtn.textContent = tFn("examplesOpen");
			openBtn.setAttribute("aria-label", tFn("examplesOpen"));
		}
		if (closeBtn instanceof HTMLElement && closeBtn.dataset.i18n) {
			closeBtn.textContent = tFn(closeBtn.dataset.i18n);
		}
		for (const tab of [tabWords, tabSentences]) {
			if (!(tab instanceof HTMLElement)) continue;
			const isActive = tab.getAttribute("data-examples-tab") === activeBatch;
			tab.setAttribute("aria-pressed", isActive ? "true" : "false");
		}
		frameRoot.setAttribute("data-active-batch", activeBatch);
	}

	function renderList() {
		if (!(listEl instanceof HTMLElement)) return;
		applyChrome();
		const query = filterInput instanceof HTMLInputElement
			? filterInput.value.trim().toLowerCase()
			: "";
		const items = batchItems();
		const matches = items.filter((item) => {
			if (!query) return true;
			const gloss = glossForExample(item, getLocale());
			return `${item.surface} ${gloss}`.toLowerCase().includes(query);
		});
		if (statusEl) {
			if (loadError) {
				statusEl.textContent = tFn("workedExamplesFailed", { message: loadError });
			} else if (!items.length) {
				statusEl.textContent = tFn("workedExamplesLoading");
			} else {
				statusEl.textContent = tFn("workedExamplesCount", {
					shown: matches.length,
					total: items.length,
				});
			}
		}
		listEl.replaceChildren();
		for (const item of matches) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "examples-item";
			btn.dataset.exampleWord = item.surface;
			btn.dataset.exampleId = item.id;
			const surface = document.createElement("span");
			surface.className = "examples-item-surface";
			surface.textContent = item.surface;
			const gloss = document.createElement("span");
			gloss.className = "examples-item-gloss";
			const glossText = glossForExample(item, getLocale());
			gloss.textContent = glossText;
			btn.append(surface, gloss);
			if (glossText) btn.title = glossText;
			btn.addEventListener("click", () => {
				onPick(item.surface, item);
				modal.close();
			});
			listEl.append(btn);
		}
	}

	/** @param {'words' | 'sentences'} batch */
	function setBatch(batch) {
		activeBatch = batch === "sentences" ? "sentences" : "words";
		applyChrome();
		if (modal.isOpen()) renderList();
		else modal.open();
	}

	tabWords?.addEventListener("click", () => setBatch("words"));
	tabSentences?.addEventListener("click", () => setBatch("sentences"));
	if (filterInput instanceof HTMLInputElement) {
		filterInput.addEventListener("input", () => {
			if (modal.isOpen()) renderList();
		});
	}

	applyChrome();

	return {
		refreshChrome() {
			applyChrome();
			if (modal.isOpen()) renderList();
		},
		/** @param {import('./examples-schema.js').ExamplesCatalog} next */
		setCatalog(next) {
			catalog = next;
			loadError = "";
			if (modal.isOpen()) renderList();
		},
		/** @param {string} message */
		setLoadError(message) {
			loadError = message || "";
			if (modal.isOpen()) renderList();
		},
		/** @param {'words' | 'sentences'} [batch] */
		open(batch) {
			if (batch) activeBatch = batch === "sentences" ? "sentences" : "words";
			modal.open();
			renderList();
		},
		close: () => modal.close(),
		getActiveBatch: () => activeBatch,
		getCatalog: () => catalog,
		renderList,
	};
}
