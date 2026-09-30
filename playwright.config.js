// @ts-check
import { defineConfig, devices } from "@playwright/test";

const live = !!process.env.BLOQ_LIVE;

// Two projects:
// - fixture (default): injects docs/fixtures/engine-stub.js + catalog-mini.json
//   so CI does not depend on jandahl.github.io/api.oq.gl or the grammarian mirror.
// - live: real pinned public-api + grammarian catalog (npm run test:e2e:live /
//   test:live-smoke). Upstream outages are real information for that project,
//   not for every PR.
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
	projects: live
		? [{ name: "live", use: { ...devices["Desktop Chrome"] } }]
		: [{ name: "fixture", use: { ...devices["Desktop Chrome"] }, testMatch: /fixture.*\.spec\.js/ }],
	webServer: {
		command: "npm run serve",
		url: "http://127.0.0.1:8000",
		reuseExistingServer: !process.env.CI,
	},
});
