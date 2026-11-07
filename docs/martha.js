// Shared playback control for Oqaasileriffik's Martha text-to-speech tool.

import { getLocale, t } from "./i18n.js";

const MARTHA_PATHS = Object.freeze({
	en: "/en/langtech/martha/",
	da: "/da/sprogteknologi/martha/",
	kl: "/oqaaserpassualerineq/martha/",
});
const MARTHA_TTS = "https://oqaasileriffik.gl/martha/tts/";
const MARTHA_DATA = "https://oqaasileriffik.gl/martha/data/";
const MARTHA_SPEECH_KEY = "bloq:martha-speech";
const MARTHA_SPEECH_LEGACY_KEY = "bl-oq-ly:martha-speech";

/** @type {HTMLAudioElement|null} */
let audio = null;
let playbackTurn = 0;

/** @returns {boolean} */
export function isMarthaSpeechEnabled() {
	try {
		if (typeof localStorage === "undefined") return true;
		const saved = localStorage.getItem(MARTHA_SPEECH_KEY) ?? localStorage.getItem(MARTHA_SPEECH_LEGACY_KEY);
		return saved !== "false";
	} catch {
		return true;
	}
}

/** @param {boolean} enabled */
export function setMarthaSpeechEnabled(enabled) {
	try {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(MARTHA_SPEECH_KEY, enabled ? "true" : "false");
		}
	} catch {
		/* storage unavailable */
	}
	syncMarthaLinks();
}

/** @param {string} value */
export function marthaSpeechText(value) {
	return String(value ?? "").replace(/^\s*≈\s*/u, "").replace(/\s+/gu, " ").trim().replace(/[!?]+$/u, "");
}

/** @param {string} text @param {"en"|"da"|"kl"} [locale] @returns {string} */
export function marthaUrl(text, locale = getLocale()) {
	const path = MARTHA_PATHS[locale] ?? MARTHA_PATHS.kl;
	const clean = String(text ?? "").replace(/^\s*≈\s*/u, "").trim();
	return `https://oqaasileriffik.gl${path}?${new URLSearchParams({ st: clean }).toString()}`;
}

/** Request Martha's public clip metadata and play its returned audio. @param {string} value @param {HTMLButtonElement} button */
export async function playMartha(value, button) {
	const spoken = marthaSpeechText(value);
	if (!spoken || typeof globalThis.Audio !== "function") return;
	const player = audio ?? (audio = new globalThis.Audio());
	const mine = ++playbackTurn;
	player.pause();
	const idle = button.dataset.marthaIdle || t("martha.listen");
	button.dataset.marthaTurn = String(mine);
	button.disabled = true;
	button.textContent = t("martha.loading");
	try {
		const params = new URLSearchParams({ n: "json", t: spoken });
		const response = await fetch(`${MARTHA_TTS}?${params.toString()}`);
		if (!response.ok) throw new Error(`Martha ${response.status}`);
		const meta = await response.json();
		if (!meta?.fn) throw new Error("Martha returned no clip");
		if (mine !== playbackTurn) return;
		const filename = String(meta.fn);
		player.src = `${MARTHA_DATA}${filename.slice(0, 2)}/${filename.slice(2, 4)}/${filename}`;
		await player.play();
	} catch (error) {
		if (button.dataset.marthaTurn === String(mine)) {
			button.title = error instanceof Error ? error.message : t("martha.error");
		}
	} finally {
		if (button.dataset.marthaTurn === String(mine)) {
			button.disabled = false;
			button.innerHTML = SPEAKER_ICON_SVG;
			button.append(idle);
		}
	}
}

// Filled speaker icon (Material Symbols "volume_up"), reused for every link
// so the pill reads as an audio affordance instead of the bare "▶️" emoji.
const SPEAKER_ICON_SVG = `<svg class="martha-link-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16.5 12a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12z"/></svg>`;

/** @param {string} text @returns {HTMLSpanElement | null} */
export function createMarthaLink(text) {
	const clean = marthaSpeechText(text);
	if (!clean || typeof document === "undefined") return null;
	const raw = String(text ?? "").replace(/^\s*≈\s*/u, "").trim();
	const enabled = isMarthaSpeechEnabled();
	const controls = document.createElement("span");
	controls.className = "martha-controls";
	controls.hidden = !enabled;
	const button = document.createElement("button");
	button.type = "button";
	button.className = "martha-link";
	button.dataset.marthaWord = raw;
	button.dataset.marthaIdle = t("martha.listen");
	button.innerHTML = SPEAKER_ICON_SVG;
	button.append(t("martha.listen"));
	if (typeof button.setAttribute === "function") {
		button.setAttribute("aria-label", t("martha.listenAria", { word: raw }));
	}
	button.hidden = !enabled;
	if (typeof button.addEventListener === "function") {
		button.addEventListener("click", (event) => {
			event.stopPropagation();
			void playMartha(raw, button);
		});
	}
	const pageLink = document.createElement("a");
	pageLink.className = "martha-page-link";
	pageLink.href = marthaUrl(raw);
	pageLink.target = "_blank";
	pageLink.rel = "noopener noreferrer";
	pageLink.textContent = t("martha.openPage");
	if (typeof pageLink.setAttribute === "function") {
		pageLink.setAttribute("aria-label", t("martha.openPageAria", { word: raw }));
	}
	pageLink.hidden = !enabled;
	if (typeof pageLink.addEventListener === "function") {
		pageLink.addEventListener("click", (event) => event.stopPropagation());
	}
	controls.append(button, pageLink);
	return controls;
}

/** Keep already-rendered cards/results in sync with the setting toggle and UI locale. */
export function syncMarthaLinks() {
	if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return;
	const enabled = isMarthaSpeechEnabled();
	for (const controls of document.querySelectorAll(".martha-controls")) {
		const button = controls.querySelector?.(".martha-link");
		const pageLink = controls.querySelector?.(".martha-page-link");
		if (!button || !pageLink) continue;
		const word = button.dataset?.marthaWord ?? "";
		controls.hidden = !enabled;
		button.dataset.marthaIdle = t("martha.listen");
		button.innerHTML = SPEAKER_ICON_SVG;
		button.append(t("martha.listen"));
		button.setAttribute?.("aria-label", t("martha.listenAria", { word }));
		button.hidden = !enabled;
		pageLink.href = marthaUrl(word);
		pageLink.textContent = t("martha.openPage");
		pageLink.setAttribute?.("aria-label", t("martha.openPageAria", { word }));
		pageLink.hidden = !enabled;
	}
}
