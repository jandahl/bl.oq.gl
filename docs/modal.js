/**
 * Shared <dialog> helpers (Misiliineq-style).
 * Light a11y: restore focus, ESC/cancel, backdrop click, optional focus trap.
 */

/**
 * @typedef {object} BindModalOptions
 * @property {HTMLElement | null} [openButton]
 * @property {HTMLElement | null} [closeButton]
 * @property {boolean} [closeOnBackdrop=true]
 * @property {boolean} [trapFocus=true]
 * @property {() => void} [onOpen]
 * @property {() => void} [onClose]
 */

const FOCUSABLE =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @param {HTMLDialogElement | null | undefined} dialog
 * @param {BindModalOptions} [options]
 */
export function bindModal(dialog, options = {}) {
	if (!dialog || typeof dialog.showModal !== "function") {
		return {
			open() {},
			close() {},
			isOpen() {
				return false;
			},
		};
	}

	const {
		openButton = null,
		closeButton = null,
		closeOnBackdrop = true,
		trapFocus = true,
		onOpen = null,
		onClose = null,
	} = options;

	/** @type {HTMLElement | null} */
	let lastFocus = null;

	function open() {
		if (dialog.open) return;
		lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		dialog.showModal();
		const focusTarget =
			dialog.querySelector("[data-modal-initial-focus]") ||
			dialog.querySelector(FOCUSABLE) ||
			dialog;
		if (focusTarget instanceof HTMLElement) {
			try {
				focusTarget.focus();
			} catch {
				/* ignore */
			}
		}
		onOpen?.();
	}

	function close() {
		if (!dialog.open) return;
		dialog.close();
	}

	function restoreFocus() {
		const target = lastFocus;
		lastFocus = null;
		if (target && typeof target.focus === "function" && document.contains(target)) {
			try {
				target.focus();
			} catch {
				/* ignore */
			}
		}
	}

	dialog.addEventListener("close", () => {
		restoreFocus();
		onClose?.();
	});

	if (closeOnBackdrop) {
		dialog.addEventListener("click", (e) => {
			if (e.target === dialog) close();
		});
	}

	if (trapFocus) {
		dialog.addEventListener("keydown", (e) => {
			if (e.key !== "Tab" || !dialog.open) return;
			const nodes = [...dialog.querySelectorAll(FOCUSABLE)].filter(
				(el) => el instanceof HTMLElement && !el.hasAttribute("disabled") && el.offsetParent !== null,
			);
			if (nodes.length === 0) {
				e.preventDefault();
				return;
			}
			const first = nodes[0];
			const last = nodes[nodes.length - 1];
			const active = document.activeElement;
			if (e.shiftKey && active === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && active === last) {
				e.preventDefault();
				first.focus();
			}
		});
	}

	openButton?.addEventListener("click", () => open());
	closeButton?.addEventListener("click", () => close());

	return {
		open,
		close,
		isOpen() {
			return Boolean(dialog.open);
		},
		dialog,
	};
}
