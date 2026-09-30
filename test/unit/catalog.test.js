import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { applyCatalogCompatibility, catalogFromPayload } from "../../docs/catalog.js";
import { fixtureMergeMorphemeSources } from "../helpers/catalog-fixture.js";

const root = dirname(fileURLToPath(import.meta.url));
const mini = JSON.parse(readFileSync(join(root, "../../docs/fixtures/catalog-mini.json"), "utf8"));

test("catalogFromPayload requires an injected merge (no live oq-api import)", () => {
	assert.throws(() => catalogFromPayload(mini), /mergeMorphemeSources/);
});

test("catalogFromPayload: fixture mini catalog yields presets without network", () => {
	const { presets, authoritative, meta } = catalogFromPayload(mini, fixtureMergeMorphemeSources);
	assert.equal(authoritative, false);
	assert.equal(meta.status, "fixture");
	assert.ok(presets.length >= 5);
	assert.ok(presets.some((p) => p.id === "qimmeq"));
	const negator = presets.find((p) => p.id === "V_ngngit_Vb");
	assert.ok(negator);
	assert.match(negator.plainGloss.en_short, /do not/);
});

test("applyCatalogCompatibility: legacy negator gloss is patched", () => {
	const legacy = [{
		id: "V_ngngit_Vb",
		expected: "-nngit",
		plainGloss: { en_short: "negation, ___ not" },
	}];
	applyCatalogCompatibility(legacy);
	assert.equal(legacy[0].plainGloss.en_short, "do not ___");
});

test("applyCatalogCompatibility: modern negator gloss is left alone", () => {
	const modern = [{
		id: "V_ngngit_Vb",
		expected: "-nngit",
		plainGloss: { en_short: "do not ___ (ordinary negator)" },
	}];
	applyCatalogCompatibility(modern);
	assert.equal(modern[0].plainGloss.en_short, "do not ___ (ordinary negator)");
});

test("catalogFromPayload + fixture merge: build-shaped seq is present for stems", () => {
	const { presets } = catalogFromPayload(mini, fixtureMergeMorphemeSources);
	const dog = presets.find((p) => p.id === "qimmeq");
	assert.equal(dog.seq[0].id, "qimmeq");
	assert.equal(dog.seq[0].text, "qimmeq");
});
