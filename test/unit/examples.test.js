import test from "node:test";
import assert from "node:assert/strict";
import {
	normalizeExamplesCatalog,
	adaptLegacyExamplesCatalog,
	glossForExample,
	glossText,
	glossLocales,
	STANDARD_EXAMPLES_SCHEMA,
	EXAMPLES_CDN_URL,
	examplesVersionedUrl,
	resolveExamplesCatalog,
	shapeExamplesPayload,
} from "../../docs/examples-schema.js";

test("normalizeExamplesCatalog maps worked and sentences, including gloss_en/da and object gloss", () => {
	const catalog = normalizeExamplesCatalog({
		schema_version: STANDARD_EXAMPLES_SCHEMA,
		worked: [
			{ id: "neri", surface: "nerivoq", gloss_en: "He eats.", gloss_da: "Han spiser." },
			{ surface: "ajorpoq", gloss: { en: "It is bad.", da: "Det er dårligt." } },
		],
		sentences: [
			{ id: "s1", words: ["Piitap", "inaaniippoq"], gloss: "in Peter's room" },
			{ surface: "a b", gloss_da: "da only" },
		],
	});
	assert.equal(catalog.schema_version, STANDARD_EXAMPLES_SCHEMA);
	assert.equal(catalog.worked.length, 2);
	assert.equal(catalog.worked[0].surface, "nerivoq");
	assert.equal(catalog.worked[0].gloss_en, "He eats.");
	assert.equal(catalog.worked[0].kind, "words");
	assert.equal(catalog.worked[1].gloss_en, "It is bad.");
	assert.equal(catalog.worked[1].gloss_da, "Det er dårligt.");
	assert.equal(catalog.sentences[0].surface, "Piitap inaaniippoq");
	assert.deepEqual(catalog.sentences[0].words, ["Piitap", "inaaniippoq"]);
	assert.equal(catalog.sentences[1].surface, "a b");
	assert.equal(catalog.sentences[1].gloss_da, "da only");
});

test("normalizeExamplesCatalog tolerates empty or unknown input", () => {
	assert.deepEqual(normalizeExamplesCatalog(null), { worked: [], sentences: [] });
	assert.deepEqual(normalizeExamplesCatalog({}), { worked: [], sentences: [] });
});

test("adaptLegacyExamplesCatalog drops pre-v1 attested sentences", () => {
	const adapted = adaptLegacyExamplesCatalog({
		worked: [{ surface: "nerivoq", gloss: "He eats." }],
		sentences: [{ words: ["Piitap", "inaaniippoq"], gloss: "attested phrase" }],
	});
	assert.equal(adapted.worked.length, 1);
	assert.equal(adapted.worked[0].surface, "nerivoq");
	assert.deepEqual(adapted.sentences, []);
});

test("adaptLegacyExamplesCatalog trusts standard-examples/v1 including empty sentences", () => {
	const adapted = adaptLegacyExamplesCatalog({
		schema_version: STANDARD_EXAMPLES_SCHEMA,
		worked: [{ id: "nerivoq", surface: "nerivoq", gloss: "He eats." }],
		sentences: [],
	});
	assert.equal(adapted.schema_version, STANDARD_EXAMPLES_SCHEMA);
	assert.equal(adapted.worked[0].surface, "nerivoq");
	assert.deepEqual(adapted.sentences, []);
});

test("resolveExamplesCatalog rejects a failed override and does not use the local catalog", async () => {
	let localCalls = 0;
	await assert.rejects(
		() => resolveExamplesCatalog({
			override: "https://example.test/missing.json",
			pinSchema: STANDARD_EXAMPLES_SCHEMA,
			fetchCatalog: async () => null,
			getStandardExamples: async () => {
				localCalls += 1;
				return { worked: [{ surface: "nerivoq", gloss: "He eats." }], sentences: [] };
			},
			remoteUrls: ["https://cdn.example/examples.json"],
		}),
		/Examples override failed/,
	);
	assert.equal(localCalls, 0);
});

test("resolveExamplesCatalog adapts a pin payload that is not standard-examples/v1", async () => {
	const { catalog, source } = await resolveExamplesCatalog({
		pinSchema: STANDARD_EXAMPLES_SCHEMA,
		fetchCatalog: async () => {
			throw new Error("CDN should not run when the pin answers");
		},
		getStandardExamples: async () => ({
			worked: [{ surface: "nerivoq", gloss: "He eats." }],
			sentences: [{ words: ["a", "b"], gloss: "legacy" }],
		}),
	});
	assert.equal(source, "oq-api");
	assert.equal(catalog.worked[0].surface, "nerivoq");
	assert.deepEqual(catalog.sentences, []);
});

test("resolveExamplesCatalog keeps sentences on a real v1 pin payload", async () => {
	const { catalog } = await resolveExamplesCatalog({
		pinSchema: STANDARD_EXAMPLES_SCHEMA,
		fetchCatalog: async () => null,
		getStandardExamples: async () => ({
			schema_version: STANDARD_EXAMPLES_SCHEMA,
			worked: [{ surface: "nerivoq", gloss: "He eats." }],
			sentences: [{ surface: "a b", words: ["a", "b"], gloss: "kept" }],
		}),
	});
	assert.equal(catalog.sentences.length, 1);
	assert.equal(catalog.sentences[0].surface, "a b");
});

test("a pin schema other than v1 still consults the remote catalog", async () => {
	let fetched = 0;
	const { catalog, source } = await resolveExamplesCatalog({
		pinSchema: undefined,
		fetchCatalog: async () => {
			fetched += 1;
			return normalizeExamplesCatalog({
				schema_version: STANDARD_EXAMPLES_SCHEMA,
				worked: [{ surface: "from-cdn", gloss: "cdn" }],
				sentences: [],
			});
		},
		getStandardExamples: async () => ({
			worked: [{ surface: "local", gloss: "local" }],
			sentences: [{ words: ["no"] }],
		}),
		remoteUrls: ["https://cdn.example/examples.json"],
	});
	assert.equal(fetched, 1);
	assert.equal(source, "remote");
	assert.equal(catalog.worked[0].surface, "from-cdn");
});

test("shapeExamplesPayload rejects an empty object but keeps a v1 catalog with no sentences", () => {
	assert.equal(shapeExamplesPayload(null), null);
	assert.equal(shapeExamplesPayload([]), null);
	assert.equal(shapeExamplesPayload({}), null);
	assert.equal(shapeExamplesPayload({ worked: [], sentences: [] }), null);
	const v1 = shapeExamplesPayload({
		schema_version: STANDARD_EXAMPLES_SCHEMA,
		worked: [],
		sentences: [],
	});
	assert.equal(v1.schema_version, STANDARD_EXAMPLES_SCHEMA);
	assert.deepEqual(v1.worked, []);
	assert.deepEqual(v1.sentences, []);
});

test("resolveExamplesCatalog does not treat an empty pin payload as success", async () => {
	let fetched = 0;
	const { catalog, source } = await resolveExamplesCatalog({
		pinSchema: STANDARD_EXAMPLES_SCHEMA,
		fetchCatalog: async () => {
			fetched += 1;
			return normalizeExamplesCatalog({
				schema_version: STANDARD_EXAMPLES_SCHEMA,
				worked: [{ surface: "from-cdn", gloss: "cdn" }],
				sentences: [],
			});
		},
		getStandardExamples: async () => ({}),
		remoteUrls: ["https://cdn.example/examples.json"],
	});
	assert.equal(fetched, 1);
	assert.equal(source, "remote");
	assert.equal(catalog.worked[0].surface, "from-cdn");
});

test("resolveExamplesCatalog rejects an override that shapes to nothing", async () => {
	await assert.rejects(
		() => resolveExamplesCatalog({
			override: "https://example.test/empty.json",
			pinSchema: STANDARD_EXAMPLES_SCHEMA,
			fetchCatalog: async () => shapeExamplesPayload({}),
			getStandardExamples: async () => ({
				schema_version: STANDARD_EXAMPLES_SCHEMA,
				worked: [{ surface: "local", gloss: "local" }],
				sentences: [],
			}),
		}),
		/Examples override failed/,
	);
});

test("glossText handles string and locale object glosses", () => {
	assert.equal(glossText("He eats."), "He eats.");
	assert.equal(glossText({ en: "English", da: "Dansk" }, "en"), "English");
	assert.equal(glossText({ en: "English", da: "Dansk" }, "da"), "Dansk");
	assert.equal(glossText({ da: "Kun dansk" }, "en"), "Kun dansk");
	assert.deepEqual(glossLocales("plain"), { en: "plain", da: "", kl: "" });
});

test("glossForExample prefers locale-specific fields and object gloss", () => {
	const item = {
		id: "x",
		surface: "x",
		gloss: { en: "English", da: "Dansk" },
		gloss_en: "English",
		gloss_da: "Dansk",
		kind: "words",
	};
	assert.equal(glossForExample(item, "en"), "English");
	assert.equal(glossForExample(item, "da"), "Dansk");
	assert.equal(glossForExample({ id: "y", surface: "y", gloss: "only", kind: "words" }, "da"), "only");
});

test("EXAMPLES_CDN_URL and versioned URL match oq-api#337 docs", () => {
	assert.equal(
		EXAMPLES_CDN_URL,
		"https://jandahl.github.io/api.oq.gl/examples/standard-examples.json",
	);
	assert.equal(
		examplesVersionedUrl("https://jandahl.github.io/api.oq.gl/api/v0.3.61/public-api.js"),
		"https://jandahl.github.io/api.oq.gl/api/v0.3.61/standard-examples.json",
	);
	assert.equal(examplesVersionedUrl("not-a-url"), null);
});
