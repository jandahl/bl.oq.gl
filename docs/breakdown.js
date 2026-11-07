// Renders a Deconstruct result as oq's own Deconstruct view does: a
// composed, full-sentence translation, then a per-morpheme row breakdown
// below it (declared/citation spelling + a short gloss with optional blank filling) —
// rather than raw morpheme ids in a block stack (bl-oq-ly#4: ids like
// "N_qaq_Vb" mean nothing to a learner). Deliberately plain HTML, not
// Blockly: the read-only case has no drag/snap interaction to justify
// Blockly's overhead, and a flex-wrapping row list is far more usable on a
// small screen than a read-only block stack would be.

import { splitMoodLabel, composedTranslation } from "./gloss.js";
import { t as translate } from "./i18n.js";
import { createMarthaLink } from "./martha.js";

export const WORD_TONE_COUNT = 6;

function cleanSurfaceWord(word) {
	return String(word ?? "").replace(/^\s*≈\s*/u, "").trim();
}

export function oqDictionaryUrl(word) {
	const clean = cleanSurfaceWord(word);
	if (!clean) return "https://oq.gl/";
	return `https://oq.gl/?${new URLSearchParams({ q: clean }).toString()}`;
}

export function oqDeconstructUrl(word, detailId) {
	const clean = cleanSurfaceWord(word);
	if (!clean) return "https://oq.gl/deconstruct/";
	const params = new URLSearchParams({ w: clean });
	if (detailId) params.set("detail", String(detailId));
	return `https://oq.gl/deconstruct/?${params.toString()}`;
}

export function oqBuilderUrl(seq) {
	const list = Array.isArray(seq) ? seq : [];
	const trimmed = list.length > 1 && list[list.length - 1]?.id === "N_ABS_SG"
		? list.slice(0, -1)
		: list;
	const ids = trimmed.map((item) => item?.id).filter(Boolean);
	if (ids.length === 0) return "https://oq.gl/builder/";
	return `https://oq.gl/builder/?${new URLSearchParams({ seq: JSON.stringify(ids) }).toString()}`;
}

export function createOqLinks(word, seq, buildResult, opts = {}) {
	const tFn = opts.t ?? translate;
	const clean = cleanSurfaceWord(word || buildResult?.word);
	if (!clean || typeof document === "undefined") return null;

	const wrap = document.createElement("div");
	wrap.className = "oq-links";

	const deconstructLink = document.createElement("a");
	deconstructLink.className = "oq-link oq-deconstruct-link";
	deconstructLink.href = oqDeconstructUrl(clean);
	deconstructLink.target = "_blank";
	deconstructLink.rel = "noopener noreferrer";
	deconstructLink.textContent = tFn("oqDeconstruct");
	wrap.appendChild(deconstructLink);

	const canOpenInBuilder = Array.isArray(seq)
		&& seq.length > 0
		&& Boolean(buildResult?.closed)
		&& !buildResult?.approximate
		&& seq.every((item) => Boolean(item?.id));

	if (canOpenInBuilder) {
		const builderLink = document.createElement("a");
		builderLink.className = "oq-link oq-builder-link";
		builderLink.href = oqBuilderUrl(seq);
		builderLink.target = "_blank";
		builderLink.rel = "noopener noreferrer";
		builderLink.textContent = tFn("oqOpenBuilder");
		wrap.appendChild(builderLink);
	}

	const dictLink = document.createElement("a");
	dictLink.className = "oq-link oq-dict-link";
	dictLink.href = oqDictionaryUrl(clean);
	dictLink.target = "_blank";
	dictLink.rel = "noopener noreferrer";
	dictLink.textContent = tFn("oqLookup");
	dictLink.dataset.oqDictWord = clean.toLocaleLowerCase("kl");
	dictLink.hidden = !opts.dictHit;
	wrap.appendChild(dictLink);

	return wrap;
}

export function wordTone(index) {
	const n = Number(index);
	if (!Number.isFinite(n)) return "0";
	return String(((n % WORD_TONE_COUNT) + WORD_TONE_COUNT) % WORD_TONE_COUNT);
}

export function renderTonedPhrases(container, phrases, className) {
	container.replaceChildren();
	const list = (phrases ?? []).filter((phrase) => phrase != null && String(phrase).length > 0);
	list.forEach((phrase, i) => {
		if (i > 0) container.append(" ");
		const span = document.createElement("span");
		span.className = className;
		span.dataset.wordTone = wordTone(i);
		span.textContent = String(phrase);
		container.appendChild(span);
	});
}

/**
 * @param {HTMLElement} container
 * @param {string} word - the surface form that was analyzed
 * @param {any[]} seq - the winning candidate's seq[] (buildWord-shaped items)
 * @param {{ word: string, approximate: boolean, closed: boolean }} buildResult
 * @param {(seq: any[], opts?: any) => any[]} glossSummaryItems
 * @param {{ reverseOrder?: boolean, lang?: "en"|"da", headlineGloss?: Function }} [opts] - bl-oq-ly#11:
 *   `reverseOrder` reads last-morpheme-first in the per-morpheme ROW list
 *   below the translation (e.g. "statement — I" / "to have a" / "dog" for a
 *   word literally ordered dog-have-statement). Never affects the composed
 *   translation line itself, which is a single sentence, not a reversible
 *   list. `lang` (bl-oq-ly#17) selects which of grammarian's published
 *   languages glossSummaryItems resolves each gloss in.
 */
export function renderBreakdown(container, word, seq, buildResult, glossSummaryItems, opts = {}) {
	// Own a child, not the container. Sentence breakdown puts a reading band
	// on the same article; wiping the article would delete that band, and a
	// variant click re-enters this function on the same node.
	let host = [...container.children].find((child) => child.classList?.contains("breakdown-body") || child.className === "breakdown-body");
	if (!host) {
		host = document.createElement("div");
		host.className = "breakdown-body";
		container.appendChild(host);
	}
	host.innerHTML = "";

	const surfaceWord = buildResult.word || word;
	const heading = document.createElement("div");
	heading.className = "breakdown-word";
	heading.textContent = (buildResult.approximate ? "≈ " : "") + buildResult.word;
	host.appendChild(heading);
	const martha = createMarthaLink(surfaceWord);
	if (martha) host.appendChild(martha);
	const dictHit = typeof opts.dictHit === "boolean" ? opts.dictHit : Boolean(opts.isDictHit?.(surfaceWord));
	const oqLinks = createOqLinks(surfaceWord, seq, buildResult, { dictHit });
	if (oqLinks) host.appendChild(oqLinks);

	const presentationPreferences = opts.presentationPreferences ?? { numberPreference: "singular", determinationPreference: "indefinite" };
	const allItems = glossSummaryItems(seq, { lang: opts.lang, ...presentationPreferences });
	const translation = composedTranslation(allItems, opts.headlineGloss, { lang: opts.lang });
	if (translation) {
		const translationEl = document.createElement("p");
		translationEl.className = "breakdown-translation";
		translationEl.textContent = translation;
		host.appendChild(translationEl);
	}
	const variants = allItems.find((item) => item.presentationVariants)?.presentationVariants;
	if (variants) {
		const controls = document.createElement("div");
		controls.className = "presentation-variant-controls";
		const values = variants[opts.lang ?? "en"] ?? variants.en ?? variants.da;
		for (const [numberPreference, determinationPreference, label] of [["singular", "indefinite", "sg · indef"], ["singular", "definite", "sg · def"], ["plural", "indefinite", "pl · indef"], ["plural", "definite", "pl · def"]]) {
			const value = values?.[numberPreference]?.[determinationPreference];
			if (!value) continue;
			const button = document.createElement("button");
			button.type = "button";
			button.textContent = `${label}: ${value}`;
			button.className = numberPreference === presentationPreferences.numberPreference && determinationPreference === presentationPreferences.determinationPreference ? "is-active" : "";
			button.addEventListener("click", () => renderBreakdown(container, word, seq, buildResult, glossSummaryItems, { ...opts, presentationPreferences: { numberPreference, determinationPreference } }));
			controls.appendChild(button);
		}
		host.appendChild(controls);
	}

	let items = allItems.filter((item) => item.marker !== "Ø");
	if (opts.reverseOrder) items = items.slice().reverse();

	const rows = document.createElement("div");
	rows.className = "breakdown-rows";
	for (const item of items) {
		const row = document.createElement("div");
		row.className = "breakdown-row";

		const morphemeId = item.id || item.preset?.id || item.preset?.catalogId;
		const spelling = document.createElement(morphemeId ? "a" : "span");
		spelling.className = "breakdown-spelling";
		const spellingText = `${item.marker ?? ""}${item.text ?? item.spelling ?? ""}`;
		spelling.textContent = spellingText;
		if (morphemeId) {
			spelling.href = oqDeconstructUrl(surfaceWord, morphemeId);
			spelling.target = "_blank";
			spelling.rel = "noopener noreferrer";
			spelling.setAttribute?.("aria-label", translate("oqMorphemeDetails", { morpheme: spellingText || morphemeId }));
		}
		row.appendChild(spelling);

		const { moodLabel, rest } = splitMoodLabel((opts.fillBlanks ? item.shortGloss : item.rawShortGloss ?? item.shortGloss) || item.gloss || item.meaning || translate("noGloss"), item.moodLabel);
		if (moodLabel) {
			const badge = document.createElement("span");
			badge.className = "breakdown-mood";
			badge.textContent = moodLabel;
			row.appendChild(badge);
		}

		const gloss = document.createElement("span");
		gloss.className = "breakdown-gloss";
		gloss.textContent = item.secondary ? `${rest} / ${item.secondary}` : rest;
		row.appendChild(gloss);

		rows.appendChild(row);
	}
	host.appendChild(rows);

	if (!buildResult.closed) {
		const note = document.createElement("p");
		note.className = "breakdown-note";
		note.textContent = translate("openDerivation");
		host.appendChild(note);
	}
}

/**
 * Adds the lower-ranked verified analyses below the primary breakdown. They
 * stay collapsed so the best-ranked explanation remains the easy-to-read
 * default, while each alternative remains directly usable as a builder link.
 * @param {HTMLElement} container
 * @param {{ seq: any[], built: any }[]} alternatives
 * @param {(seq: any[], opts?: any) => any[]} glossSummaryItems
 * @param {{ reverseOrder?: boolean, lang?: "en"|"da", builderHref?: (seq: any[]) => string }} [opts]
 */
export function renderAlternativeBreakdowns(container, alternatives, glossSummaryItems, opts = {}) {
	if (!alternatives?.length) return;

	const details = document.createElement("details");
	details.id = "alternative-breakdowns";
	details.className = "alternative-breakdowns";
	const summary = document.createElement("summary");
	summary.textContent = translate("otherBreakdowns", { count: alternatives.length });
	details.appendChild(summary);

	const list = document.createElement("div");
	list.className = "alternative-breakdown-list";
	for (const alternative of alternatives) {
		const entry = document.createElement("article");
		entry.className = "alternative-breakdown";
		const content = document.createElement("div");
		renderBreakdown(content, opts.word || alternative.built.word, alternative.seq, alternative.built, glossSummaryItems, opts);
		entry.appendChild(content);

		if (opts.builderHref) {
			const link = document.createElement("a");
			link.className = "breakdown-builder-link";
			link.href = opts.builderHref(alternative.seq);
			link.textContent = translate("openInBuilder");
			entry.appendChild(link);
		}
		list.appendChild(entry);
	}
	details.appendChild(list);
	container.appendChild(details);
}

const READING_BAND_KEY = {
	gold: "bandGold",
	hard_exact: "bandExact",
	soft_exact: "bandSoft",
	none: "bandNone",
};

function readingBandLabel(band) {
	const key = READING_BAND_KEY[band];
	return key ? translate(key) : band;
}

function localizedNote(note, tFn, vars) {
	if (!note) return "";
	if (!/^[A-Za-z][A-Za-z0-9]*$/.test(note)) return note;
	return tFn(note, vars || {});
}

/**
 * Sentence Deconstruct panel: one section per source sentence, a reading
 * band per word, and a verified chain only when that word actually built.
 * Does not touch the summary chrome or the share URL.
 * @returns {string} readings joined for the panel summary
 */
export function renderSentenceBreakdown(container, plan, glossSummaryItems, opts = {}) {
	const t = opts.t ?? ((key) => key);
	const visibleAssembly = opts.visibleAssembly ?? ((assembly) => assembly?.text || "");
	container.innerHTML = "";
	if (plan.sentences.length > 1 && plan.assembly?.text) {
		const lead = document.createElement("p");
		lead.className = "sentence-assembly sentence-assembly-all";
		lead.textContent = visibleAssembly(plan.assembly);
		container.appendChild(lead);
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
		const sentenceMartha = createMarthaLink(sentence.source);
		if (sentenceMartha) head.appendChild(sentenceMartha);
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
		if (sentence.assemblyDa?.text && opts.showDanish) {
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
			band.textContent = `${readingBandLabel(word.band)} · ${word.surface}`;
			article.appendChild(band);
			if (word.seq && word.built?.ok) {
				renderBreakdown(article, word.surface, word.seq, word.built, glossSummaryItems, {
					reverseOrder: opts.reverseOrder,
					fillBlanks: opts.fillBlanks,
					lang: opts.lang,
					showOther: opts.showOther,
					headlineGloss: opts.headlineGloss,
					presentationPreferences: opts.presentationPreferences,
					dictHit: word.dictHit,
					isDictHit: opts.isDictHit,
				});
			} else {
				const heading = document.createElement("div");
				heading.className = "breakdown-word";
				heading.textContent = word.raw;
				article.appendChild(heading);
				const surfaceOrRaw = word.surface || word.raw;
				const wordMartha = createMarthaLink(surfaceOrRaw);
				if (wordMartha) article.appendChild(wordMartha);
				const dictHit = typeof word.dictHit === "boolean" ? word.dictHit : Boolean(opts.isDictHit?.(surfaceOrRaw));
				const wordOqLinks = createOqLinks(surfaceOrRaw, null, null, { dictHit });
				if (wordOqLinks) article.appendChild(wordOqLinks);
				if (word.headline && word.headline !== word.raw) {
					const gloss = document.createElement("p");
					gloss.className = "breakdown-translation";
					gloss.textContent = word.headline;
					article.appendChild(gloss);
				}
				if (word.compositional && word.compositional !== word.headline) {
					const unused = document.createElement("p");
					unused.className = "breakdown-note";
					unused.textContent = t("closedChainUnused", { text: word.compositional });
					article.appendChild(unused);
				}
				const note = document.createElement("p");
				note.className = "breakdown-note";
				note.textContent = localizedNote(word.note, t, word.noteVars) || t("notOnCanvas");
				article.appendChild(note);
			}
			if (word.alternatives?.length) {
				const list = document.createElement("ul");
				list.className = "sentence-also";
				for (const alt of word.alternatives) {
					const item = document.createElement("li");
					item.textContent = `${readingBandLabel(alt.band)}: ${alt.headline || alt.ids.join(" + ")}`;
					list.appendChild(item);
				}
				article.appendChild(list);
			}
			section.appendChild(article);
		});
		container.appendChild(section);
	});
	return metas.join("  ·  ");
}

/**
 * Single-word (or several independent words) Deconstruct panel.
 * @returns {string} per-word row counts joined for the panel summary
 */
export function renderWordBreakdowns(container, parts, glossSummaryItems, opts = {}) {
	container.innerHTML = "";
	const metas = [];
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		const article = document.createElement("article");
		if (i === 0) article.id = "primary-breakdown";
		article.classList.add("word-toned");
		article.dataset.wordTone = wordTone(i);
		if (parts.length > 1) article.classList.add("sentence-word-breakdown");
		if (part.missing || !part.seq || !part.built?.ok) {
			const note = document.createElement("p");
			note.className = "breakdown-note";
			note.textContent = translate("noVerifiedBreakdown", { token: part.word });
			article.appendChild(note);
			const dictHit = typeof part.dictHit === "boolean" ? part.dictHit : Boolean(opts.isDictHit?.(part.word));
			const missingOqLinks = createOqLinks(part.word, null, null, { dictHit });
			if (missingOqLinks) article.appendChild(missingOqLinks);
			container.appendChild(article);
			metas.push(note.textContent);
			continue;
		}
		renderBreakdown(article, part.word, part.seq, part.built, glossSummaryItems, {
			reverseOrder: opts.reverseOrder,
			fillBlanks: opts.fillBlanks,
			lang: opts.lang,
			showOther: opts.showOther,
			headlineGloss: opts.headlineGloss,
			presentationPreferences: opts.presentationPreferences,
			dictHit: part.dictHit,
			isDictHit: opts.isDictHit,
		});
		container.appendChild(article);
		if (part.alternatives?.length) {
			renderAlternativeBreakdowns(container, part.alternatives, glossSummaryItems, {
				word: part.word,
				reverseOrder: opts.reverseOrder,
				fillBlanks: opts.fillBlanks,
				lang: opts.lang,
				showOther: opts.showOther,
				headlineGloss: opts.headlineGloss,
				builderHref: opts.builderHref,
				presentationPreferences: opts.presentationPreferences,
				dictHit: part.dictHit,
				isDictHit: opts.isDictHit,
			});
		}
		const n = article.querySelectorAll(".breakdown-row").length;
		const translation = article.querySelector(".breakdown-translation")?.textContent;
		metas.push(translation ? `${n} · ${translation}` : String(n));
	}
	return metas.join("  ·  ");
}
