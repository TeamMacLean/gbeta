/**
 * localStorage helpers with one-time migration from the project's old "gbetter_"
 * / "gbetter-" key names to the current "gbeta_" / "gbeta-" names. Reads the
 * current key; on a miss, copies any legacy value over (and removes the legacy
 * key) so existing data — saved queries, analyses, theme, the AI API key — is
 * preserved across the rename. Migration happens lazily at the read site, so it
 * is correct regardless of store init order.
 */
export function getMigrated(key: string, legacyKey: string): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		let value = localStorage.getItem(key);
		if (value === null) {
			const legacy = localStorage.getItem(legacyKey);
			if (legacy !== null) {
				localStorage.setItem(key, legacy);
				localStorage.removeItem(legacyKey);
				value = legacy;
			}
		}
		return value;
	} catch {
		return null;
	}
}
