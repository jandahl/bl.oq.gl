// Generation card projection and translation contract validation helpers for BLOQ.
// Consumes oq-api's generation-sentence-cards, sentence-generation, and translation-contracts.

export const GENERATION_CARD_SCHEMA = "generation-card/v1";
export const GENERATION_CARD_FINISHED_SCHEMA = "generation-card-finished/v1";
export const GENERATION_CARD_PROJECTION_RECORDED = "recorded_chain";
export const GENERATION_CARD_PROJECTION_LIVE = "live_generation";
export const GENERATION_CARD_PROJECTION_UNKNOWN = "unknown";

export const SOURCE_ANALYSIS_SCHEMA = "source-analysis/v1";
export const MEANING_GRAPH_SCHEMA = "meaning-graph/v1";
export const TARGET_PLAN_SCHEMA = "target-plan/v1";
export const GENERATION_CANDIDATE_SCHEMA = "generation-candidate/v1";

export function inferGenerationCardProjectionKind(card, engine = {}) {
	if (typeof engine.inferGenerationCardProjectionKind === "function") {
		return engine.inferGenerationCardProjectionKind(card);
	}
	if (card?.projection_kind === GENERATION_CARD_PROJECTION_RECORDED) return GENERATION_CARD_PROJECTION_RECORDED;
	if (card?.projection_kind === GENERATION_CARD_PROJECTION_LIVE) return GENERATION_CARD_PROJECTION_LIVE;
	return GENERATION_CARD_PROJECTION_UNKNOWN;
}

export function generationCardFinishedState(card, engine = {}) {
	if (typeof engine.generationCardFinishedState === "function") {
		return engine.generationCardFinishedState(card);
	}
	if (!card || typeof card !== "object") {
		return {
			schema_version: GENERATION_CARD_FINISHED_SCHEMA,
			showable: false,
			complete: false,
			status_label: "Malformed generation card",
		};
	}
	const isRecorded = card.projection_kind === GENERATION_CARD_PROJECTION_RECORDED;
	return {
		schema_version: GENERATION_CARD_FINISHED_SCHEMA,
		showable: Boolean(card.ok),
		complete: Boolean(card.ok && !isRecorded),
		status_label: card.ok ? "Ready" : "Incomplete",
	};
}

export function projectGenerationCard(result, options = {}, engine = {}) {
	if (typeof engine.projectGenerationCard === "function") {
		return engine.projectGenerationCard(result, options);
	}
	const words = Array.isArray(result?.words) ? result.words : [];
	return {
		schema_version: GENERATION_CARD_SCHEMA,
		ok: Boolean(result?.ok ?? true),
		projection_kind: GENERATION_CARD_PROJECTION_LIVE,
		words: words.map((w) => ({
			surface: w.surface || w.text || "",
			morpheme_ids: w.morpheme_ids || w.canvasIds || [],
		})),
		options,
	};
}

export function projectRecordedChainCard(args, engine = {}) {
	if (typeof engine.projectRecordedChainCard === "function") {
		return engine.projectRecordedChainCard(args);
	}
	return {
		schema_version: GENERATION_CARD_SCHEMA,
		ok: true,
		projection_kind: GENERATION_CARD_PROJECTION_RECORDED,
		words: [{ surface: args?.surface || "", morpheme_ids: args?.morpheme_ids || [] }],
	};
}

/**
 * Validate translation contract documents.
 *
 * @param {"source-analysis" | "meaning-graph" | "target-plan" | "generation-candidate"} kind
 * @param {any} document
 * @param {any} [context]
 * @param {object} [engine]
 * @returns {{ ok: boolean, errors?: any[] }}
 */
export function validateTranslationDocument(kind, document, context = undefined, engine = {}) {
	switch (kind) {
		case "source-analysis":
			return typeof engine.validateSourceAnalysis === "function"
				? engine.validateSourceAnalysis(document)
				: { ok: Boolean(document?.schema_version === SOURCE_ANALYSIS_SCHEMA), errors: [] };
		case "meaning-graph":
			return typeof engine.validateMeaningGraph === "function"
				? engine.validateMeaningGraph(document)
				: { ok: Boolean(document?.schema_version === MEANING_GRAPH_SCHEMA), errors: [] };
		case "target-plan":
			return typeof engine.validateTargetPlan === "function"
				? engine.validateTargetPlan(document, context)
				: { ok: Boolean(document?.schema_version === TARGET_PLAN_SCHEMA), errors: [] };
		case "generation-candidate":
			return typeof engine.validateGenerationCandidate === "function"
				? engine.validateGenerationCandidate(document, context)
				: { ok: Boolean(document?.schema_version === GENERATION_CANDIDATE_SCHEMA), errors: [] };
		default:
			throw new TypeError(`Unknown translation document kind "${kind}"`);
	}
}
