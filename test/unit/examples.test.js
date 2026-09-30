import test from "node:test";
import assert from "node:assert/strict";
import {
	normalizeExamplesCatalog,
	glossForExample,
} from "../../docs/examples-schema.js";

test("normalizeExamplesCatalog maps worked and sentences, including gloss_en/da", () => {
	const catalog = normalizeExamplesCatalog({
		worked: [
			{ id: "neri", surface: "nerivoq", gloss_en: "He eats.", gloss_da: "Han spiser." },
			{ surface: "ajorpoq", gloss: "It is bad." },
		],
		sentences: [
			{ id: "s1", words: ["Piitap", "inaaniippoq"], gloss: "in Peter's room" },
			{ surface: "a b", gloss_da: "da only" },
		],
	});
	assert.equal(catalog.worked.length, 2);
	assert.equal(catalog.worked[0].surface, "nerivoq");
	assert.equal(catalog.worked[0].gloss_en, "He eats.");
	assert.equal(catalog.worked[0].kind, "words");
	assert.equal(catalog.sentences[0].surface, "Piitap inaaniippoq");
	assert.deepEqual(catalog.sentences[0].words, ["Piitap", "inaaniippoq"]);
	assert.equal(catalog.sentences[1].surface, "a b");
	assert.equal(catalog.sentences[1].gloss_da, "da only");
});

test("normalizeExamplesCatalog tolerates empty or unknown input", () => {
	assert.deepEqual(normalizeExamplesCatalog(null), { worked: [], sentences: [] });
	assert.deepEqual(normalizeExamplesCatalog({}), { worked: [], sentences: [] });
});

test("glossForExample prefers locale-specific fields", () => {
	const item = {
		id: "x",
		surface: "x",
		gloss: "fallback",
		gloss_en: "English",
		gloss_da: "Dansk",
		kind: "words",
	};
	assert.equal(glossForExample(item, "en"), "English");
	assert.equal(glossForExample(item, "da"), "Dansk");
	assert.equal(glossForExample({ id: "y", surface: "y", gloss: "only", kind: "words" }, "da"), "only");
});
