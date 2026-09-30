// Workshop session state and pure Build computation (bl.oq.gl#93).
//
// app.js binds the DOM and drives UI from the result this module returns.
// Analysis caches and share mode live on the session object — not as module
// globals — so a unit test can feed fixture chains through computeBuild
// without Blockly's injected workspace or the network.

import { canvasSentences } from "./sentence-plan.js";

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
	return JSON.stringify(sentences) === JSON.stringify(canvasSentences(plan));
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
	return JSON.stringify(sentences) === JSON.stringify(expected);
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
	for (let s = 0; s < sentences.length; s++) {
		const words = sentences[s];
		for (let i = 0; i < words.length; i++) {
			const seq = seqForChain(presetsById, words[i]);
			if (!seq) {
				return {
					empty: false,
					error: { message: "Unknown morpheme in stack.", kind: "error" },
					built: [],
					seqs: [],
					surfaces: [],
					kind: "error",
					meta: "",
					reading: "none",
					usePlan: false,
					share: { mode: null, clearDeconstruct: false },
				};
			}
			const result = buildWord(seq);
			if (!result.ok) {
				const where = sentences.length > 1
					? `sentence ${s + 1}, `
					: (words.length > 1 ? `word ${i + 1}, ` : "");
				return {
					empty: false,
					error: {
						message: `✗ ${result.reason || "invalid sequence"}`,
						kind: "error",
						meta: `${where}at position ${result.errorAt >= 0 ? result.errorAt + 1 : "?"}`,
					},
					built: [],
					seqs: [],
					surfaces: [],
					kind: "error",
					meta: "",
					reading: "none",
					usePlan: false,
					share: { mode: null, clearDeconstruct: false },
				};
			}
			built.push(result);
			seqs.push(seq);
		}
	}

	const wordCount = sentences.reduce((n, words) => n + words.length, 0);
	const kind = built.some((r) => r.approximate) ? "approx" : "ok";
	const allClosed = built.every((r) => r.closed);
	const meta = sentences.length > 1
		? `${sentences.length} sentences`
		: (wordCount > 1
			? (allClosed ? `${wordCount} words` : "mid-derivation — keep building")
			: (allClosed ? "complete word" : "mid-derivation — keep building"));
	const surfaces = built.map((r) => `${r.approximate ? "≈ " : ""}${r.word}`);

	if (lastSentencePlan && planMatches) {
		return {
			empty: false,
			error: null,
			built,
			seqs,
			surfaces,
			kind,
			meta,
			reading: "plan",
			usePlan: true,
			share: { mode: "deconstruct", clearDeconstruct: false },
		};
	}

	return {
		empty: false,
		error: null,
		built,
		seqs,
		surfaces,
		kind,
		meta,
		reading: "seqs",
		usePlan: false,
		share: { mode: "build", clearDeconstruct: true },
	};
}
