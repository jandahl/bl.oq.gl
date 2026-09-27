// Turns oq-api's sentence lattice (analyzeSentence + assembleClause) into
// the Blockly shape BLOQ already knows: one Sentence container per source
// sentence, each holding Word chains of catalog morpheme ids.
//
// Honesty rules, matching bl.oq.gl/AGENTS.md:
// - Only a closed translator reading (gold / hard_exact / promoted soft_exact)
//   may become a canvas chain.
// - An id that is not in the loaded catalog is a visible miss, never skipped.
// - opaque_proper:* is a synthetic name the engine refused to invent a stem
//   for. It stays in the reading and the assembled gloss, and it does not
//   become a fake morpheme block.
// - A multi-word attested example (spanText) can replace a token's meaning.
//   When that phrase disagrees with the closed chain's own headline, the
//   chain is a different reading. It stays off the canvas.

const SENTENCE_CUT = /([.!?])(?:["'\u201C\u201D\u2018\u2019»)\]]|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)*$/u;

/**
 * More than one analyzable token means "use the sentence lattice", not the
 * single-word Deconstruct path. Edge punctuation stays on the token; a lone
 * word with a period is still one word.
 * @param {string} surface
 */
export function isSentenceInput(surface) {
	const tokens = String(surface ?? "").trim().split(/\s+/).filter(Boolean);
	return tokens.length > 1;
}

/**
 * Group lattice tokens into source sentences. Mirrors the cut assembleClause
 * uses for serial joins: . ! ? and a hard newline end a sentence; a comma
 * stays inside the sentence.
 * @param {Array<{ raw?: string, start?: number, end?: number }>} tokens
 * @param {string} [sourceText]
 */
export function groupTokensIntoSentences(tokens, sourceText = "") {
	/** @type {typeof tokens[]} */
	const groups = [];
	/** @type {typeof tokens} */
	let current = [];
	const list = Array.isArray(tokens) ? tokens : [];
	for (let i = 0; i < list.length; i++) {
		const token = list[i];
		current.push(token);
		const next = list[i + 1];
		const cut = SENTENCE_CUT.exec(String(token?.raw ?? ""));
		const newline = next ? newlineBetween(token, next, sourceText) : false;
		if (!next || newline || (cut && cut[1])) {
			groups.push(current);
			current = [];
		}
	}
	if (current.length) groups.push(current);
	return groups;
}

function newlineBetween(a, b, sourceText) {
	const start = Number(a?.end);
	const end = Number(b?.start);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false;
	return /\n/.test(String(sourceText).slice(start, end));
}

/** First letter of a sentence. Later words keep the casing they were given. */
export function withInitialCapital(text) {
	const source = String(text ?? "");
	const match = /^(\P{L}*)(\p{L})/u.exec(source);
	if (!match) return source;
	const index = match[1].length;
	return source.slice(0, index) + match[2].toUpperCase() + source.slice(index + match[2].length);
}

function isOpaqueId(id) {
	return String(id ?? "").startsWith("opaque_proper:");
}

/**
 * @param {{ raw?: string, surface?: string, readings?: any[], also?: any[] }} token
 * @param {Map<string, any>} presetsById
 * @param {Map<string, { matches?: any[] }>|null} [analysesByWord]
 */
export function wordFromToken(token, presetsById, analysesByWord = null) {
	const surface = String(token?.surface ?? "");
	const raw = String(token?.raw || surface);
	const readings = Array.isArray(token?.readings) ? token.readings : [];
	const primary = readings[0] ?? null;
	const key = surface.trim().toLowerCase();
	const cached = analysesByWord instanceof Map ? analysesByWord.get(key) : null;
	const openMatchCount = Array.isArray(cached?.matches) ? cached.matches.length : 0;
	const base = {
		raw,
		surface,
		headline: primary?.headline || raw,
		band: primary?.band || "none",
		inflection: primary?.inflection ?? null,
		ids: Array.isArray(primary?.ids) ? primary.ids.filter(Boolean) : [],
		canvasIds: [],
		missingIds: [],
		opaqueIds: [],
		seq: null,
		built: null,
		openMatchCount,
		alternatives: readings.slice(1).map(readingSummary).filter((item) => item.headline || item.ids.length),
		heldLabel: "",
		compositional: "",
	};
	const spanText = String(primary?.spanText ?? "").trim();
	const compositional = String(primary?.headline ?? "").trim();
	if (primary && spanText && spanText !== compositional) {
		return {
			...base,
			status: "span",
			headline: spanText,
			compositional,
			heldLabel: "attested phrase",
			note: "Attested phrase. The closed morpheme chain is a different reading, so it is not drawn.",
		};
	}
	if (!primary || base.ids.length === 0) {
		return {
			...base,
			status: "unparsed",
			note: openMatchCount
				? "No closed sentence reading. Open or approximate word analyses stay off the sentence canvas."
				: "No closed reading for this word.",
			heldLabel: "not in the catalog",
		};
	}
	const opaqueIds = base.ids.filter(isOpaqueId);
	const missingIds = base.ids.filter((id) => !isOpaqueId(id) && !presetsById?.has?.(id));
	if (opaqueIds.length || missingIds.length) {
		const status = missingIds.length ? "missing" : "opaque";
		return {
			...base,
			status,
			opaqueIds,
			missingIds,
			note: missingIds.length
				? `Missing catalog morpheme${missingIds.length === 1 ? "" : "s"}: ${missingIds.join(", ")}.`
				: "Name is not a catalog stem, so it is kept in the sentence gloss and not drawn as a block.",
			heldLabel: missingIds.length ? "missing morpheme" : "name",
		};
	}
	return {
		...base,
		status: primary.band === "soft_exact" ? "soft" : "verified",
		canvasIds: base.ids.slice(),
		note: primary.band === "soft_exact" ? "Soft exact — closed, but not a gold reading." : "",
	};
}

function readingSummary(reading) {
	return {
		band: reading?.band || "none",
		headline: String(reading?.headline ?? ""),
		ids: Array.isArray(reading?.ids) ? reading.ids.filter(Boolean) : [],
	};
}

/**
 * @param {{ text?: string, tokens?: any[] }|null|undefined} lattice
 * @param {{ presetsById: Map<string, any>, assembleClause: Function, lang?: "en"|"da", analysesByWord?: Map<string, any>|null, daLattice?: any }} deps
 */
export function planFromLattice(lattice, deps) {
	const lang = deps.lang === "da" ? "da" : "en";
	const tokens = Array.isArray(lattice?.tokens) ? lattice.tokens : [];
	const sourceText = String(lattice?.text ?? "");
	const assemble = typeof deps.assembleClause === "function"
		? deps.assembleClause
		: () => ({ ok: false, reason: "empty", mode: "empty", text: "", parts: [] });
	const full = assemble(lattice, { lang });
	const groups = groupTokensIntoSentences(tokens, sourceText);
	let offset = 0;
	const sentences = groups.map((group) => {
		const sub = { text: sourceText, tokens: group };
		const assembly = assemble(sub, { lang });
		const words = group.map((token, index) => {
			const word = wordFromToken(token, deps.presetsById, deps.analysesByWord ?? null);
			word.latticeIndex = offset + index;
			word.spanId = token.readings?.[0]?.spanId || null;
			return word;
		});
		offset += group.length;
		return {
			source: withInitialCapital(group.map((token) => String(token.raw || token.surface || "")).join(" ")),
			assembly,
			words,
		};
	});
	coverAttestedPhrase(sentences);
	const plan = {
		lang,
		assembly: full,
		assemblyDa: null,
		sentences,
	};
	if (deps.daLattice) {
		const da = planFromLattice(deps.daLattice, {
			...deps,
			lang: "da",
			daLattice: null,
		});
		plan.assemblyDa = da.assembly;
		plan.sentences.forEach((sentence, i) => {
			sentence.assemblyDa = da.sentences[i]?.assembly ?? null;
		});
	}
	return plan;
}

/** An unparsed token inside an attested multi-word example is part of that phrase. */
function coverAttestedPhrase(sentences) {
	const words = sentences.flatMap((sentence) => sentence.words);
	for (const word of words) {
		const match = /^span:(\d+):(\d+)$/.exec(word.spanId || "");
		if (!match) continue;
		const from = Number(match[1]);
		const to = Number(match[2]);
		for (const other of words) {
			if (other.latticeIndex < from || other.latticeIndex > to) continue;
			if (other.status !== "unparsed") continue;
			other.heldLabel = "in the attested phrase";
			other.note = "Part of an attested phrase, and not a catalog stem.";
		}
	}
}

/** Word-id chains that are safe to drop onto the canvas, one array per sentence. */
export function canvasSentences(plan) {
	return (plan?.sentences ?? [])
		.map((sentence) => sentence.words.map((word) => word.canvasIds).filter((ids) => ids.length))
		.filter((words) => words.length);
}

/** Parallel assembly glosses for the sentences that actually get a block. */
export function canvasAssemblies(plan) {
	return (plan?.sentences ?? [])
		.filter((sentence) => sentence.words.some((word) => word.canvasIds.length))
		.map((sentence) => String(sentence.assembly?.text ?? ""));
}
