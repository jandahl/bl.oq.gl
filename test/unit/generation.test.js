import test from "node:test";
import assert from "node:assert/strict";
import {
	GENERATION_CARD_SCHEMA,
	GENERATION_CARD_PROJECTION_RECORDED,
	GENERATION_CARD_PROJECTION_LIVE,
	SOURCE_ANALYSIS_SCHEMA,
	MEANING_GRAPH_SCHEMA,
	TARGET_PLAN_SCHEMA,
	GENERATION_CANDIDATE_SCHEMA,
	inferGenerationCardProjectionKind,
	generationCardFinishedState,
	projectGenerationCard,
	projectRecordedChainCard,
	validateTranslationDocument,
} from "../../docs/generation.js";
import {
	generateFromMeaning,
	generateFromSource,
	validateSourceAnalysis,
	validateMeaningGraph,
	validateTargetPlan,
	validateGenerationCandidate,
} from "../../docs/fixtures/engine-stub.js";

const engine = {
	validateSourceAnalysis,
	validateMeaningGraph,
	validateTargetPlan,
	validateGenerationCandidate,
};

test("validateTranslationDocument validates contracts for all 4 pipeline stages [api-feature:translation-contracts]", () => {
	const sourceDoc = { schema_version: SOURCE_ANALYSIS_SCHEMA, text: "nerivoq", tokens: [] };
	const meaningDoc = { schema_version: MEANING_GRAPH_SCHEMA, predicates: [] };
	const targetDoc = { schema_version: TARGET_PLAN_SCHEMA, targets: [] };
	const candidateDoc = { schema_version: GENERATION_CANDIDATE_SCHEMA, candidate: "nerivoq" };

	assert.equal(validateTranslationDocument("source-analysis", sourceDoc, undefined, engine).ok, true);
	assert.equal(validateTranslationDocument("meaning-graph", meaningDoc, undefined, engine).ok, true);
	assert.equal(validateTranslationDocument("target-plan", targetDoc, undefined, engine).ok, true);
	assert.equal(validateTranslationDocument("generation-candidate", candidateDoc, undefined, engine).ok, true);

	// Invalid versions or missing schemas fail validation
	assert.equal(validateTranslationDocument("source-analysis", { schema_version: "wrong" }, undefined, engine).ok, false);
	assert.equal(validateTranslationDocument("meaning-graph", null, undefined, engine).ok, false);
	assert.throws(() => validateTranslationDocument("unknown-stage", {}, undefined, engine), TypeError);
});

test("sentence generation contracts produce generation results [api-feature:sentence-generation]", async () => {
	const meaningResult = await generateFromMeaning({ predicate: "eat", actor: "3sg" });
	assert.equal(meaningResult.ok, true);
	assert.equal(meaningResult.schema_version, "generation-result/v1");
	assert.ok(meaningResult.words.length > 0);

	const sourceResult = await generateFromSource({ source: "he eats", target_lang: "kl" });
	assert.equal(sourceResult.ok, true);
	assert.equal(sourceResult.schema_version, "generation-result/v1");
	assert.ok(sourceResult.words.length > 0);
});

test("generation card projections format live and recorded chains [api-feature:generation-sentence-cards]", () => {
	const liveCard = projectGenerationCard({
		ok: true,
		words: [{ surface: "nerivoq", morpheme_ids: ["neri", "V_IND_INTR_3SG"] }],
	});
	assert.equal(liveCard.schema_version, GENERATION_CARD_SCHEMA);
	assert.equal(liveCard.ok, true);
	assert.equal(inferGenerationCardProjectionKind(liveCard), GENERATION_CARD_PROJECTION_LIVE);

	const finishedState = generationCardFinishedState(liveCard);
	assert.equal(finishedState.showable, true);
	assert.equal(finishedState.complete, true);

	const recordedCard = projectRecordedChainCard({
		surface: "nerivoq",
		morpheme_ids: ["neri", "V_IND_INTR_3SG"],
	});
	assert.equal(recordedCard.schema_version, GENERATION_CARD_SCHEMA);
	assert.equal(inferGenerationCardProjectionKind(recordedCard), GENERATION_CARD_PROJECTION_RECORDED);
});
