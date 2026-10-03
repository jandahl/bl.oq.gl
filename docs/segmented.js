/** Radiogroup of [role=radio][data-value] buttons that behaves like a <select>
 *  (.value getter/setter + change events) so displayOptions() stays unchanged. */
export function enhanceSegmented(root) {
	const buttons = () => [...root.querySelectorAll('[role="radio"]')];
	const apply = (value) => {
		for (const btn of buttons()) {
			const selected = btn.dataset.value === value;
			btn.setAttribute("aria-checked", selected ? "true" : "false");
			btn.tabIndex = selected ? 0 : -1;
		}
		root.dataset.value = value;
	};
	Object.defineProperty(root, "value", {
		configurable: true,
		get() {
			return root.dataset.value
				|| buttons().find((b) => b.getAttribute("aria-checked") === "true")?.dataset.value
				|| "";
		},
		set(value) { apply(value); },
	});
	root.addEventListener("click", (event) => {
		const btn = event.target.closest('[role="radio"]');
		if (!btn || !root.contains(btn)) return;
		if (root.value === btn.dataset.value) return;
		root.value = btn.dataset.value;
		root.dispatchEvent(new Event("change", { bubbles: true }));
	});
	root.addEventListener("keydown", (event) => {
		const current = event.target.closest('[role="radio"]');
		if (!current || !root.contains(current)) return;
		const options = buttons();
		const index = options.indexOf(current);
		const nextIndex = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % options.length
			: event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index - 1 + options.length) % options.length
			: event.key === "Home" ? 0
			: event.key === "End" ? options.length - 1
			: -1;
		if (nextIndex < 0) return;
		event.preventDefault();
		const next = options[nextIndex];
		next.focus();
		if (root.value !== next.dataset.value) {
			root.value = next.dataset.value;
			root.dispatchEvent(new Event("change", { bubbles: true }));
		}
	});
	apply(root.value);
	return root;
}

