// Cold catalog load. The oq-api pin (grammarian.oq.gl, behind Cloudflare) is
// the compatibility boundary, but GitHub Actions often cannot open that host
// at all. A fetch with no deadline then sits until the browser gives up, and
// the test or the first visit dies before a word is analyzed. Start the
// GitHub Pages mirror immediately. Keep the pin when it answers quickly;
// otherwise take the mirror and abort the hung request.

export const PRIMARY_CATALOG_WAIT_MS = 3_000;

/**
 * @param {string[]} urls - first entry is the preferred (oq-api) catalog URL
 * @param {{ fetchImpl?: typeof fetch, waitMs?: number }} [options]
 * @returns {Promise<{ response: Response, url: string, index: number }>}
 */
export function raceCatalogResponses(urls, options = {}) {
	const list = [...urls].filter(Boolean);
	if (!list.length) return Promise.reject(new Error("morpheme catalog fetch failed (no url)"));
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	const waitMs = options.waitMs ?? PRIMARY_CATALOG_WAIT_MS;
	const controllers = list.map(() => new AbortController());
	const attempts = list.map((url, index) => fetchImpl(url, {
		cache: "no-cache",
		signal: controllers[index].signal,
	}).then((response) => {
		if (!response?.ok) throw new Error(`HTTP ${response?.status ?? "error"}`);
		return { response, url, index };
	}));
	// Aborting a loser rejects its fetch. A later rejection must not surface
	// as unhandled once another host has already won.
	for (const attempt of attempts) attempt.catch(() => {});

	const abortExcept = (keep) => {
		controllers.forEach((controller, index) => {
			if (index !== keep) controller.abort();
		});
	};

	let timer;
	const wait = new Promise((resolve) => {
		timer = globalThis.setTimeout(() => resolve({ kind: "timeout" }), waitMs);
	});
	const primary = attempts[0].then(
		(result) => ({ kind: "ok", result }),
		(error) => ({ kind: "error", error }),
	);

	const restWaitMs = options.restWaitMs ?? waitMs;

	return Promise.race([primary, wait]).then(async (early) => {
		if (early.kind === "ok") {
			globalThis.clearTimeout(timer);
			abortExcept(0);
			return early.result;
		}
		let restTimer;
		const deadline = new Promise((_, reject) => {
			restTimer = globalThis.setTimeout(() => {
				controllers.forEach((controller) => controller.abort());
				reject(Object.assign(new Error("catalog fetch deadline"), { name: "TimeoutError" }));
			}, restWaitMs);
		});
		try {
			const any = Promise.any(attempts);
			// The deadline can win first. The leftover aggregate must not
			// surface as an unhandled rejection once every host is aborted.
			any.catch(() => {});
			const result = await Promise.race([any, deadline]);
			abortExcept(result.index);
			return result;
		} catch (aggregate) {
			const errors = aggregate?.errors ?? [early.kind === "error" ? early.error : aggregate];
			const detail = (Array.isArray(errors) ? errors : [errors])
				.map((error, index) => {
					if (!error || error.name === "AbortError" || error.name === "TimeoutError") return "";
					return `${list[index] ?? "?"}: ${error.message}`;
				})
				.filter(Boolean)
				.join("; ");
			throw new Error(`morpheme catalog fetch failed (${detail || aggregate?.message || "no response"})`);
		} finally {
			globalThis.clearTimeout(timer);
			globalThis.clearTimeout(restTimer);
		}
	});
}
