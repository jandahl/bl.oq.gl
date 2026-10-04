// Align identical API IDs in sequence order. A shared ID is a structural
// match only; this helper makes no claim about semantic equivalence.
export function alignChainIds(left = [], right = []) {
	const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
	for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--) {
		rows[i][j] = left[i] === right[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
	}
	const aligned = [];
	let i = 0, j = 0;
	while (i < left.length || j < right.length) {
		if (i < left.length && j < right.length && left[i] === right[j]) {
			aligned.push({ leftIndex: i++, rightIndex: j++, shared: true });
		} else if (j >= right.length || (i < left.length && rows[i + 1][j] >= rows[i][j + 1])) {
			aligned.push({ leftIndex: i++, rightIndex: null, shared: false });
		} else aligned.push({ leftIndex: null, rightIndex: j++, shared: false });
	}
	return aligned;
}
