import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureTestMatch, liveSpecFiles } from "../../playwright.config.js";

const e2eDir = join(dirname(fileURLToPath(import.meta.url)), "../e2e");

test("every e2e spec belongs to exactly one Playwright project", () => {
	const specs = readdirSync(e2eDir).filter((name) => name.endsWith(".spec.js")).sort();
	assert.ok(specs.length > 0);
	const live = new Set(liveSpecFiles);
	for (const name of specs) {
		const inFixture = fixtureTestMatch.test(name);
		const inLive = live.has(name);
		assert.equal(inFixture || inLive, true, `${name} is in neither project`);
		assert.equal(inFixture && inLive, false, `${name} is in both projects`);
	}
	for (const name of liveSpecFiles) {
		assert.equal(specs.includes(name), true, `${name} is listed as live but is not a spec file`);
	}
});
