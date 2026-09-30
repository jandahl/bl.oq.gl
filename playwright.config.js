// @ts-check
import { defineConfig, devices } from "@playwright/test";

// Deliberately hits the REAL live endpoints (the published oq-api module and
// grammarian's published ID-first morphemes-by-id.json catalog) rather than a local
// mirror — see README's
// "Testing" section for why: this repo's own stated stance is that a broken
// build here is a cue to check those upstreams, and a test suite that only
// ever exercises a frozen local snapshot would never catch that class of
// break, which is the single most likely source of regression given both
// upstreams' explicit no-stability-promise posture. The tradeoff is a real
// one (CI can go red for reasons outside this repo's own commits) — accepted
// deliberately, not overlooked.
export default defineConfig({
	testDir: "./test/e2e",
	globalSetup: "./test/e2e/global-setup.js",
	// Every test context loads the live ~9 MB grammarian catalog. Parallel
	// downloads make the upstream endpoint intermittently miss the startup
	// timeout and turn one transient fetch failure into a cascade of failures.
	// Keep the live-endpoint suite deterministic; unit tests remain parallelizable.
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	// The live upstreams are outside this repo's control. Retrying every test
	// after a shared startup failure multiplies the wait across the whole suite.
	// Fail on the first affected test so an upstream outage is reported quickly.
	retries: 0,
	maxFailures: 1,
	// Slightly generous: catalog fetch + Blockly injection is the app's own
	// natural startup cost, not something to race against.
	timeout: 30_000,
	use: {
		baseURL: "http://127.0.0.1:8000",
		trace: "retain-on-failure",
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
	],
	webServer: {
		command: "npm run serve",
		url: "http://127.0.0.1:8000",
		reuseExistingServer: !process.env.CI,
	},
});
