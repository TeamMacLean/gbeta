import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

import { loadAnalyses, saveAnalysis, deleteAnalysis } from '$lib/services/savedQueries';

beforeEach(() => {
	const store = new Map<string, string>();
	const mock = {
		getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
		setItem: (k: string, v: string) => void store.set(k, String(v)),
		removeItem: (k: string) => void store.delete(k),
		clear: () => store.clear(),
		key: () => null,
		get length() {
			return store.size;
		}
	};
	Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });
	Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true });
});

describe('saved analyses (notebooks)', () => {
	it('saves and loads a named analysis', () => {
		const a = saveAnalysis('My run', ['NAVIGATE BRCA1', 'list genes']);
		expect(a).toBeTruthy();
		const all = loadAnalyses();
		expect(all).toHaveLength(1);
		expect(all[0].name).toBe('My run');
		expect(all[0].queries).toEqual(['NAVIGATE BRCA1', 'list genes']);
	});

	it('rejects an empty name or empty query list', () => {
		expect(saveAnalysis('', ['NAVIGATE BRCA1'])).toBeNull();
		expect(saveAnalysis('x', [])).toBeNull();
		expect(saveAnalysis('x', ['  ', ''])).toBeNull();
		expect(loadAnalyses()).toHaveLength(0);
	});

	it('deletes by id', () => {
		const a = saveAnalysis('A', ['list genes'])!;
		saveAnalysis('B', ['list variants']);
		deleteAnalysis(a.id);
		const all = loadAnalyses();
		expect(all.map((x) => x.name)).toEqual(['B']);
	});

	it('returns [] for corrupted (non-array) storage', () => {
		localStorage.setItem('gbetter_saved_analyses', JSON.stringify({ not: 'array' }));
		expect(loadAnalyses()).toEqual([]);
	});
});
