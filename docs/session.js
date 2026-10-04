// Workshop session state and pure Build computation (bl.oq.gl#93).
//
// app.js binds the DOM and drives UI from the result this module returns.
// Analysis caches and share mode live on the session object — not as module
// globals — so a unit test can feed fixture chains through computeBuild
// without Blockly's injected workspace or the network.

import { canvasSentences } from "./sentence-plan.js";
import { sameIdTree } from "./id-tree.js";

/**
 * Mutable workshop session. Pass this into helpers; do not close over it
 * from another module's top level.
 * @returns {{
 *   mode: "build"|"deconstruct",
 *   presets: any[],
 *   presetsById: Map<string, any>,
 *   workspace: any,
 *   deconstructAbort: AbortController|null,
 *   deconstructRun: number,
 *   deconstructCanvasIds: any,
 *   lastDeconstructIds: any,
 *   lastDeconstructWord: string,
 *   lastDeconstructSeq: any,
 *   lastDeconstructBuilt: any,
 *   lastDeconstructAlternatives: any,
 *   lastDeconstructParts: any,
 *   lastSentencePlan: any,
 * }}
 */
export function createSession() {
	return {
		mode: "build",
		presets: [],
		presetsById: new Map(),
		workspace: null,
		deconstructAbort: null,
		deconstructRun: 0,
		deconstructCanvasIds: null,
		lastDeconstructIds: null,
		lastDeconstructWord: "",
		lastDeconstructSeq: null,
		lastDeconstructBuilt: null,
		lastDeconstructAlternatives: null,
		lastDeconstructParts: null,
		lastSentencePlan: null,
	};
}

/** Clears Deconstruct / sentence-plan caches after a user Build edit or Clear. */
export function clearAnalysisCaches(session) {
	session.lastDeconstructWord = "";
	session.lastDeconstructSeq = null;
	session.lastDeconstructBuilt = null;
	session.lastDeconstructAlternatives = null;
	session.lastDeconstructIds = null;
	session.lastDeconstructParts = null;
	session.lastSentencePlan = null;
}

/**
 * Abort an in-flight Deconstruct and invalidate its run id.
 * `runDeconstruct` captures `deconstructRun` before its awaits; Clear and an
 * empty submit must bump that counter or a late response still paints the
 * canvas and rewrites the share URL.
 * @param {ReturnType<typeof createSession>} session
 */
export function cancelDeconstruct(session) {
	session.deconstructAbort?.abort();
	session.deconstructAbort = null;
	session.deconstructCanvasIds = null;
	session.deconstructRun += 1;
}

/**
 * Resolve catalog presets for a morpheme-id chain into the seq buildWord expects.
 * @param {Map<string, any>} presetsById
 * @param {string[]} ids
 * @returns {any[]|null}
 */
export function seqForChain(presetsById, ids) {
	const seq = [];
	for (const id of ids) {
		const preset = presetsById.get(id);
		if (!preset) return null;
		seq.push(preset.seq[0]);
	}
	return seq;
}

/**
 * Whether the live canvas chains still match a sentence plan's drawable ids.
 * @param {string[][][]} sentences topLevelSentences() shape
 * @param {any} plan
 * @param {{ sentenceContainerCount?: number|null }} [opts]
 */
export function planMatchesCanvas(sentences, plan, { sentenceContainerCount = null } = {}) {
	if (!plan) return false;
	if (sentenceContainerCount != null && sentenceContainerCount !== (plan.sentences?.length ?? 0)) {
		return false;
	}
	return sameIdTree(sentences, canvasSentences(plan));
}

/**
 * Normalize lastDeconstructIds (single word string[], one sentence string[][],
 * or already-sentence string[][][]) to the topLevelSentences() shape.
 * @param {any} ids
 * @returns {string[][][]}
 */
export function normalizeDeconstructIds(ids) {
	if (!Array.isArray(ids) || !ids.length) return [];
	if (typeof ids[0] === "string") return [[ids]];
	if (typeof ids[0]?.[0] === "string") return [ids];
	return ids;
}

/**
 * Whether the live canvas still shows the last Deconstruct result's chains.
 * Used so programmatic label paints (and deferred Blockly events from a
 * Deconstruct render) do not demote an intact Deconstruct share to Build.
 * @param {string[][][]} sentences
 * @param {any} lastDeconstructIds
 */
export function deconstructIdsMatchSentences(sentences, lastDeconstructIds) {
	const expected = normalizeDeconstructIds(lastDeconstructIds);
	if (!expected.length || !sentences?.length) return false;
	return sameIdTree(sentences, expected);
}

/**
 * Pure Build pass over canvas sentence chains. No history, mode, DOM, or timers.
 *
 * @param {{
 *   sentences: string[][][],
 *   presetsById: Map<string, any>,
 *   buildWord: (seq: any[]) => { ok: boolean, reason?: string, errorAt?: number, word?: string, approximate?: boolean, closed?: boolean },
 *   lastSentencePlan?: any,
 *   planMatches?: boolean,
 * }} args
 * @returns {{
 *   empty: boolean,
 *   error: null|{ message: string, kind: string, meta?: string },
 *   built: any[],
 *   seqs: any[][],
 *   surfaces: string[],
 *   kind: string,
 *   meta: string,
 *   reading: "none"|"seqs"|"plan",
 *   usePlan: boolean,
 *   share: { mode: "build"|"deconstruct"|null, clearDeconstruct: boolean },
 * }}
 */
export function computeBuild({
	sentences,
	presetsById,
	buildWord,
	lastSentencePlan = null,
	planMatches = false,
}) {
	const emptyResult = (extras = {}) => ({
		empty: true,
		error: null,
		built: [],
		seqs: [],
		surfaces: [],
		kind: "",
		meta: "",
		reading: "none",
		usePlan: false,
		share: { mode: null, clearDeconstruct: false },
		...extras,
	});

	if (!sentences.length) {
		if (lastSentencePlan && planMatches) {
			return emptyResult({
				usePlan: true,
				reading: "plan",
				share: { mode: "deconstruct", clearDeconstruct: false },
			});
		}
		return emptyResult({
			share: { mode: null, clearDeconstruct: false },
		});
	}

	const built = [];
	const seqs = [];
	const surfaces = [];
	const wordOutcomes = [];
	let firstError = null;

	for (let s = 0; s < sentences.length; s++) {
		const words = sentences[s];
		for (let i = 0; i < words.length; i++) {
			const where = sentences.length > 1
				? `sentence ${s + 1}, word ${i + 1}`
				: (words.length > 1 ? `word ${i + 1}` : "");
			const whereLabel = sentences.length > 1
				? { key: "sentenceWord", sentence: s + 1, word: i + 1 }
				: (words.length > 1 ? { key: "wordIndex", word: i + 1 } : null);
			const seq = seqForChain(presetsById, words[i]);
			if (!seq) {
				const outcome = {
					ok: false,
					kind: "unknown",
					message: "Unknown morpheme in stack.",
					meta: where,
					whereLabel,
					surface: null,
					built: null,
					seq: null,
				};
				wordOutcomes.push(outcome);
				surfaces.push("?");
				if (!firstError) firstError = { message: outcome.message, kind: "error", meta: where, whereLabel };
				continue;
			}
			const result = buildWord(seq);
			if (!result.ok) {
				const reason = result.reason || "invalid sequence";
				const position = result.errorAt >= 0 ? result.errorAt + 1 : "?";
				const meta = `${where ? `${where}, ` : ""}at position ${position}`;
				const outcome = {
					ok: false,
					kind: "invalid",
					message: reason,
					meta,
					whereLabel,
					position,
					surface: null,
					built: result,
					seq,
				};
				wordOutcomes.push(outcome);
				surfaces.push(`✗ ${reason}`);
				if (!firstError) firstError = { message: `✗ ${reason}`, kind: "error", meta, whereLabel, position };
				continue;
			}
			built.push(result);
			seqs.push(seq);
			const surface = `${result.approximate ? "≈ " : ""}${result.word}`;
			surfaces.push(surface);
			wordOutcomes.push({
				ok: true,
				kind: result.approximate ? "approx" : "ok",
				message: null,
				meta: where,
				surface,
				built: result,
				seq,
			});
		}
	}

	const wordCount = sentences.reduce((n, words) => n + words.length, 0);
	const hasError = wordOutcomes.some((o) => !o.ok);
	const kind = hasError ? "error" : (built.some((r) => r.approximate) ? "approx" : "ok");
	const allClosed = built.length > 0 && built.every((r) => r.closed);
	const meta = sentences.length > 1
		? `${sentences.length} sentences`
		: (wordCount > 1
			? (allClosed && !hasError ? `${wordCount} words` : "mid-derivation — keep building")
			: (allClosed && !hasError ? "complete word" : "mid-derivation — keep building"));
	const statusLabel = sentences.length > 1
		? { key: "nSentences", count: sentences.length }
		: (wordCount > 1
			? (allClosed && !hasError ? { key: "nWords", count: wordCount } : { key: "midDerivation" })
			: (allClosed && !hasError ? { key: "completeWord" } : { key: "midDerivation" }));

	const base = {
		empty: false,
		error: firstError,
		built,
		seqs,
		surfaces,
		wordOutcomes,
		kind,
		meta,
		statusLabel,
		reading: hasError ? "none" : "seqs",
		usePlan: false,
		share: { mode: hasError ? null : "build", clearDeconstruct: !hasError },
	};

	if (!hasError && lastSentencePlan && planMatches) {
		return {
			...base,
			reading: "plan",
			usePlan: true,
			share: { mode: "deconstruct", clearDeconstruct: false },
		};
	}

	return base;
}

/**
 * One built result and one seq per canvas word, in canvas order.
 * `built` and `seqs` omit failures, so a caller that indexes them by canvas
 * position paints the next word's surface on the broken block.
 * @param {any} result computeBuild return
 * @returns {{ built: any[], seqs: any[] }}
 */
export function labelsForCanvasWords(result) {
	const outcomes = result?.wordOutcomes;
	if (!Array.isArray(outcomes)) {
		return { built: result?.built ?? [], seqs: result?.seqs ?? [] };
	}
	return {
		built: outcomes.map((outcome) => (outcome?.ok ? outcome.built : null)),
		seqs: outcomes.map((outcome) => (outcome?.ok ? outcome.seq : null)),
	};
}

/**
 * Pure status contract from a computeBuild / plan result.
 * UI only renders this — no ad hoc string assembly at call sites.
 * @param {any} result computeBuild return or { plan, surfaces? }
 * @param {{ t?: (key: string, vars?: Record<string, string|number>) => string }} [opts]
 * @returns {{ kind: string, words: string[]|null, detail: string, meta: string, assertive: boolean }}
 */
export function formatStatus(result, opts = {}) {
	const translate = opts.t || ((key, vars = {}) => {
		const fallback = {
			unknownMorpheme: "Unknown morpheme in stack.",
			emptyCanvasHint: "Drag a morpheme in, or try an example above.",
			noClosedReading: "No closed reading to place on the canvas.",
			completeWord: "complete word",
			midDerivation: "mid-derivation — keep building",
			nWords: "{count} words",
			nSentences: "{count} sentences",
			sentenceWord: "sentence {sentence}, word {word}",
			wordIndex: "word {word}",
			atPosition: "at position {position}",
		};
		let text = fallback[key] ?? key;
		for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
		return text;
	});

	if (!result || result.empty) {
		return { kind: "", words: null, detail: translate("emptyCanvasHint"), meta: "", assertive: false };
	}

	if (result.plan) {
		const plan = result.plan;
		const words = plan.sentences.flatMap((sentence) => sentence.words);
		const missing = words.filter((word) => word.status === "missing" || word.status === "invalid");
		const meta = result.meta || "";
		if (missing.length) {
			return {
				kind: "error",
				words: null,
				detail: missing.map((word) => `${word.raw}: ${localizedNote(word.note, translate, word.noteVars)}`).join(" · "),
				meta,
				assertive: true,
			};
		}
		const surfaces = result.surfaces || [];
		if (!surfaces.length) {
			const text = plan.assembly?.text || translate("noClosedReading");
			return {
				kind: plan.assembly?.text ? "approx" : "error",
				words: null,
				detail: text,
				meta,
				assertive: !plan.assembly?.text,
			};
		}
		const cautious = words.some((word) => word.status !== "verified");
		return { kind: cautious ? "approx" : "ok", words: surfaces, detail: "", meta, assertive: false };
	}

	if (result.wordOutcomes?.length) {
		const failed = result.wordOutcomes.filter((o) => !o.ok);
		if (failed.length) {
			const detail = result.wordOutcomes.map((o) => {
				if (o.ok) return o.surface;
				return o.kind === "unknown" ? translate("unknownMorpheme") : `✗ ${o.message}`;
			}).join(" · ");
			const locators = failed.map((outcome) => locatorText(outcome, translate)).filter(Boolean);
			return {
				kind: "error",
				words: null,
				detail,
				meta: locators.join(" · ") || statusText(result, translate),
				assertive: true,
			};
		}
	}

	if (result.error && !result.wordOutcomes?.length) {
		return {
			kind: result.error.kind || "error",
			words: null,
			detail: result.error.message,
			meta: locatorText(result.error, translate) || result.error.meta || "",
			assertive: true,
		};
	}

	return {
		kind: result.kind || "ok",
		words: result.surfaces || null,
		detail: "",
		meta: statusText(result, translate),
		assertive: false,
	};
}

function statusText(result, translate) {
	if (result?.statusLabel?.key) return translate(result.statusLabel.key, result.statusLabel);
	return result?.meta || "";
}

function locatorText(source, translate) {
	if (!source) return "";
	const where = source.whereLabel?.key ? translate(source.whereLabel.key, source.whereLabel) : "";
	if (source.position == null || source.position === "") return where;
	const at = translate("atPosition", { position: source.position });
	return where ? `${where}, ${at}` : at;
}

function localizedNote(note, translate, vars) {
	if (!note) return "";
	if (!/^[A-Za-z][A-Za-z0-9]*$/.test(note)) return note;
	return translate(note, vars || {});
}
