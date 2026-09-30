// Probe the live API and catalog once before running the full suite. When an
// upstream is unavailable, each test would otherwise spend its own startup
// timeout loading the same dependencies before maxFailures can stop the run.
import { chromium } from "@playwright/test";

const STARTUP_TIMEOUT_MS = 20_000;

export default async function globalSetup() {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		await page.goto("http://127.0.0.1:8000", { timeout: STARTUP_TIMEOUT_MS });
		await page.waitForFunction(
			() => document.querySelector("#status-line")?.textContent?.startsWith("Loaded"),
			undefined,
			{ timeout: STARTUP_TIMEOUT_MS },
		);
	} catch (error) {
		throw new Error(`E2E startup preflight failed within ${STARTUP_TIMEOUT_MS}ms: ${error.message}`, { cause: error });
	} finally {
		await browser.close();
	}
}
