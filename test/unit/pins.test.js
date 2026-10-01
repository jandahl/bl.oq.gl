import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Source reads, not imports: docs/oq-api.js top-level-awaits an https
// import(), which node --test cannot load.

const html = readFileSync(new URL("../../docs/index.html", import.meta.url), "utf8");
const api = readFileSync(new URL("../../docs/oq-api.js", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../../docs/catalog.js", import.meta.url), "utf8");

function stringExport(source, name) {
	const match = source.match(new RegExp(`export const ${name} =\\s*"([^"]+)"`));
	assert.ok(match, `${name} string export not found`);
	return match[1];
}

test("index.html modulepreload is the pinned oq-api module, in CORS mode", () => {
	const pin = stringExport(api, "OQ_API_URL");
	assert.match(pin, /\/api\/v0\.3\.\d+\/public-api\.js$/);
	const link = html.match(/<link rel="modulepreload" href="([^"]+)"([^>]*)>/);
	assert.ok(link, "modulepreload link missing");
	assert.equal(link[1], pin);
	assert.match(link[2], /crossorigin="anonymous"/);
	assert.doesNotMatch(html, /v0\.3\.55/);
});

test("index.html catalog preload matches the grammarian mirror fallback", () => {
	const fallback = stringExport(catalog, "GRAMMAR_MORPHEMES_FALLBACK_URL");
	const link = html.match(/<link rel="preload" href="([^"]+)" as="fetch"/);
	assert.ok(link, "catalog preload link missing");
	assert.equal(link[1], fallback);
});
