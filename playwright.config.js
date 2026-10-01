// @ts-check
import { defineConfig, devices } from "@playwright/test";

const live = !!process.env.BLOQ_LIVE;

// The split is by project membership, not by a filename accident.
// A new spec has to be added to exactly one list (see test/unit/playwright-projects.test.js).
// Fixture specs boot the engine stub. They must never run unstubbed: their
// catalog assertion is "< 100 morphemes".
export const fixtureTestMatch = /fixture.*\.spec\.js/;

// These need the pinned public API or the real catalog. PR CI does not run them.
export const liveSpecFiles = [
	"app.spec.js",
	"labelFor-catalog.spec.js",
	"workshop-ux.spec.js",
	"tab-state.spec.js",
];
export const liveTestMatch = liveSpecFiles.map((name) => `**/${name}`);

// Two projects:
// - fixture (default, `npm run test:e2e`): docs/fixtures/engine-stub.js + catalog-mini.json
//   so CI does not depend on jandahl.github.io/api.oq.gl or the grammarian mirror.
// - live: real pinned public-api + grammarian catalog (`npm run test:e2e:live` /
//   `npm run test:live-smoke`, and the weekly live-smoke workflow).
export default defineConfig({
	testDir: "./test/e2e",
	globalSetup: live ? "./test/e2e/global-setup.js" : undefined,
	fullyParallel: !live,
	workers: live ? 1 : undefined,
	forbidOnly: !!process.env.CI,
	retries: live ? 0 : (process.env.CI ? 1 : 0),
	maxFailures: live ? 1 : undefined,
	timeout: live ? 30_000 : 20_000,
	use: {
		baseURL: "http://127.0.0.1:8000",
		trace: "retain-on-failure",
	},
	projects: [
		{ name: "fixture", use: { ...devices["Desktop Chrome"] }, testMatch: fixtureTestMatch },
		{ name: "live", use: { ...devices["Desktop Chrome"] }, testMatch: liveTestMatch },
	],
	webServer: {
		command: "npm run serve",
		url: "http://127.0.0.1:8000",
		reuseExistingServer: !process.env.CI,
	},
});
