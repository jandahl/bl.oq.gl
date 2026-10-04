/** Build only feature coordinates explicitly published by the API catalog. */
export function inflectionGridGroups(presets = [], wordClass = "V") {
	const groups = new Map();
	for (const preset of presets) {
		if (preset?.morpheme_type !== "inflectional_ending") continue;
		const features = preset.seq?.[0]?.inflection;
		let group, row, column;
		if (wordClass === "V") {
			if (!features?.mood || !features?.transitivity || !features?.subject || !Number.isFinite(features.subject.person) || !features.subject.number) continue;
			group = [features.transitivity, features.polarity ?? "positive"];
			row = [features.subject.person, features.subject.number, features.object?.person ?? null, features.object?.number ?? null];
			column = features.mood;
		} else if (wordClass === "N") {
			const possessor = features?.possessor;
			if (!features?.case || !features?.number || !Object.hasOwn(features, "possessor")) continue;
			group = [features.case];
			row = [possessor?.person ?? null, possessor?.number ?? null];
			column = features.number;
		} else continue;
		const groupKey = JSON.stringify(group);
		const entry = groups.get(groupKey) ?? { key: groupKey, features: group, rows: [], columns: [], cells: new Map() };
		const rowKey = JSON.stringify(row), columnKey = JSON.stringify(column);
		if (!entry.rows.includes(rowKey)) entry.rows.push(rowKey);
		if (!entry.columns.includes(columnKey)) entry.columns.push(columnKey);
		const cellKey = `${rowKey}\u0000${columnKey}`;
		const candidates = entry.cells.get(cellKey) ?? [];
		candidates.push({ preset, features });
		entry.cells.set(cellKey, candidates);
		groups.set(groupKey, entry);
	}
	return [...groups.values()];
}
