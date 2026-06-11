/**
 * Query history store using Svelte 5 runes
 * Maintains a history of executed queries for reproducibility
 */

import type { QueryResult } from '$lib/services/queryLanguage';
import { browser } from '$app/environment';

const MAX_HISTORY = 50;
const STORAGE_KEY = 'gbetter_query_history';

// Reactive state
let history = $state<QueryResult[]>([]);

/**
 * Load history from localStorage
 */
function loadHistory(): void {
	if (!browser) return;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			// Keep only well-formed entries so corrupted storage can't crash
			// addToHistory / rendering / export downstream.
			history = Array.isArray(parsed)
				? parsed.filter((r) => r && typeof r === 'object' && r.query && typeof r.query.raw === 'string')
				: [];
		}
	} catch (error) {
		console.warn('Failed to load query history:', error);
	}
}

/**
 * Save history to localStorage
 */
function saveHistory(): void {
	if (!browser) return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
	} catch (error) {
		console.warn('Failed to save query history:', error);
	}
}

// Load on module init
if (browser) {
	loadHistory();
}

/**
 * Add a query result to history
 */
function addToHistory(result: QueryResult): void {
	// Only add successful queries or queries with natural language input
	if (result.success || result.naturalLanguage) {
		history = [result, ...history.slice(0, MAX_HISTORY - 1)];
		saveHistory();
	}
}

/**
 * Get history items
 */
function getHistory(): QueryResult[] {
	return history;
}

/**
 * Clear all history
 */
function clearHistory(): void {
	history = [];
	saveHistory();
}

/**
 * Remove a specific history item
 */
function removeFromHistory(timestamp: number): void {
	history = history.filter(h => h.timestamp !== timestamp);
	saveHistory();
}

/**
 * Export history as text (for sharing/saving)
 */
function exportHistory(): string {
	const lines = history.map(h => {
		const date = new Date(h.timestamp).toISOString();
		const status = h.success ? 'OK' : 'FAILED';
		const nl = h.naturalLanguage ? ` # "${h.naturalLanguage}"` : '';
		return `[${date}] [${status}] ${h.query.raw}${nl}`;
	});
	return lines.join('\n');
}

/**
 * Get unique successful commands for quick replay
 */
function getUniqueCommands(): string[] {
	const seen = new Set<string>();
	const unique: string[] = [];

	for (const item of history) {
		if (item.success && !seen.has(item.query.raw)) {
			seen.add(item.query.raw);
			unique.push(item.query.raw);
		}
	}

	return unique;
}

// Export as a reactive store object
export function useQueryHistory() {
	return {
		get items() { return history; },
		get count() { return history.length; },
		addToHistory,
		getHistory,
		clearHistory,
		removeFromHistory,
		exportHistory,
		getUniqueCommands
	};
}
