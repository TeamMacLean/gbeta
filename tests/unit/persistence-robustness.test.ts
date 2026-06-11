import { describe, it, expect, beforeEach, vi } from 'vitest';

// The persistence helpers gate on SvelteKit's `browser`; force it on so the
// localStorage paths run under jsdom.
vi.mock('$app/environment', () => ({ browser: true }));

import {
	loadSavedQueries,
	saveQuery,
	getQueryFromUrl,
	exportHistory
} from '$lib/services/savedQueries';
import { loadAISettings } from '$lib/services/ai';

beforeEach(() => {
	// jsdom in this project has no working localStorage — install an in-memory one.
	const store = new Map<string, string>();
	const mock = {
		getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
		setItem: (k: string, v: string) => void store.set(k, String(v)),
		removeItem: (k: string) => void store.delete(k),
		clear: () => store.clear(),
		key: (i: number) => [...store.keys()][i] ?? null,
		get length() {
			return store.size;
		}
	};
	Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });
	Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true });
});

describe('savedQueries — corrupted localStorage', () => {
	it('loadSavedQueries returns [] when stored value is a non-array object (was a crash)', () => {
		localStorage.setItem('gbetter_saved_queries', JSON.stringify({ id: 'x', gql: 'oops' }));
		expect(loadSavedQueries()).toEqual([]);
	});

	it('loadSavedQueries returns [] on garbage JSON', () => {
		localStorage.setItem('gbetter_saved_queries', '{not json');
		expect(loadSavedQueries()).toEqual([]);
	});

	it('loadSavedQueries drops malformed entries from an array', () => {
		localStorage.setItem(
			'gbetter_saved_queries',
			JSON.stringify([{ id: 'a', name: 'ok', gql: 'NAVIGATE chr1:1-2', createdAt: 1 }, null, 42, { id: 'b' }])
		);
		const out = loadSavedQueries();
		expect(out).toHaveLength(1);
		expect(out[0].gql).toBe('NAVIGATE chr1:1-2');
	});

	it('saveQuery does not throw when storage was corrupted (critical #0)', () => {
		localStorage.setItem('gbetter_saved_queries', JSON.stringify({ not: 'an array' }));
		expect(() => saveQuery('Test', 'SELECT GENES')).not.toThrow();
		const out = loadSavedQueries();
		expect(out).toHaveLength(1);
		expect(out[0].gql).toBe('SELECT GENES');
	});
});

describe('getQueryFromUrl — malformed encoding', () => {
	it('returns null instead of throwing on a bad %-escape', () => {
		window.history.pushState({}, '', '/?gql=%E0%A4%A'); // invalid UTF-8 percent sequence
		expect(getQueryFromUrl()).toBeNull();
	});

	it('decodes a valid encoded query', () => {
		window.history.pushState({}, '', '/?gql=' + encodeURIComponent('NAVIGATE BRCA1'));
		expect(getQueryFromUrl()).toBe('NAVIGATE BRCA1');
	});
});

describe('loadAISettings — corrupted nested maps (#5)', () => {
	it('coerces a null activeModels/apiKeys to objects so lookups do not crash', () => {
		localStorage.setItem(
			'gbetter_ai_settings',
			JSON.stringify({ activeProvider: 'anthropic', activeModels: null, apiKeys: null })
		);
		const s = loadAISettings();
		expect(s.activeModels && typeof s.activeModels).toBe('object');
		expect(s.apiKeys && typeof s.apiKeys).toBe('object');
		// lookup that used to crash
		expect(() => s.activeModels[s.activeProvider]).not.toThrow();
		expect(s.activeModels.anthropic).toBeTruthy();
	});
});

describe('exportHistory — skips non-runnable / malformed entries', () => {
	it('does not throw on entries with a missing/invalid query', () => {
		// jsdom lacks URL.createObjectURL; stub the download surface.
		const origCreate = URL.createObjectURL;
		(URL as any).createObjectURL = vi.fn(() => 'blob:mock');
		(URL as any).revokeObjectURL = vi.fn();
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		try {
			const history: any[] = [
				{ success: false, message: 'no genes found', timestamp: 1, query: { command: 'unknown', raw: 'zzz', valid: false } },
				{ success: true, message: 'ok', timestamp: 2, query: { command: 'navigate', raw: 'navigate BRCA1', valid: true } },
				{ success: true, message: 'broken', timestamp: 3, query: undefined }
			];
			expect(() => exportHistory(history)).not.toThrow();
		} finally {
			clickSpy.mockRestore();
			(URL as any).createObjectURL = origCreate;
		}
	});
});
