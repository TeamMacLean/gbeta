/**
 * Saved Queries Service
 * Manages saving, loading, and exporting GQL queries
 */

import { browser } from '$app/environment';
import type { QueryResult } from './queryLanguage';

export interface SavedQuery {
	id: string;
	name: string;
	gql: string;
	description?: string;
	createdAt: number;
	lastUsedAt?: number;
}

/** A named, re-runnable sequence of GQL queries (an analysis "notebook"). */
export interface SavedAnalysis {
	id: string;
	name: string;
	description?: string;
	queries: string[];
	createdAt: number;
}

const STORAGE_KEY = 'gbetter_saved_queries';
const ANALYSES_KEY = 'gbetter_saved_analyses';

// Monotonic counter so rapid saves in the same millisecond don't collide.
let idCounter = 0;
function uid(prefix: string): string {
	return `${prefix}_${Date.now()}_${idCounter++}`;
}

/** Write to localStorage, swallowing quota/serialization errors. Returns success. */
function safeSetItem(key: string, value: unknown): boolean {
	if (!browser) return false;
	try {
		localStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch (e) {
		console.warn(`Failed to save ${key} (storage full or unavailable):`, e);
		return false;
	}
}

/**
 * Load all saved queries from localStorage.
 * Returns [] for missing OR corrupted (non-array) data so callers can always
 * rely on getting an array.
 */
export function loadSavedQueries(): SavedQuery[] {
	if (!browser) return [];

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (Array.isArray(parsed)) {
				// Drop entries that aren't well-formed saved queries.
				return parsed.filter(
					(q): q is SavedQuery => q && typeof q === 'object' && typeof q.gql === 'string'
				);
			}
			console.warn('Saved queries in localStorage were not an array; ignoring.');
		}
	} catch (e) {
		console.warn('Failed to load saved queries:', e);
	}

	return [];
}

/**
 * Save a query to localStorage
 */
export function saveQuery(name: string, gql: string, description?: string): SavedQuery {
	const queries = loadSavedQueries();

	const newQuery: SavedQuery = {
		id: uid('query'),
		name,
		gql,
		description,
		createdAt: Date.now()
	};

	queries.unshift(newQuery);
	safeSetItem(STORAGE_KEY, queries);

	return newQuery;
}

/**
 * Update last used timestamp
 */
export function markQueryUsed(id: string): void {
	const queries = loadSavedQueries();
	const query = queries.find(q => q.id === id);

	if (query) {
		query.lastUsedAt = Date.now();
		safeSetItem(STORAGE_KEY, queries);
	}
}

/**
 * Delete a saved query
 */
export function deleteQuery(id: string): void {
	const queries = loadSavedQueries();
	const filtered = queries.filter(q => q.id !== id);
	safeSetItem(STORAGE_KEY, filtered);
}

/**
 * Export queries to a .gql file
 */
export function exportQueries(queries: SavedQuery[]): void {
	const content = queries.map(q => {
		const created = typeof q.createdAt === 'number' && !isNaN(q.createdAt)
			? `-- Created: ${new Date(q.createdAt).toISOString()}`
			: null;
		const lines = [
			`-- Query: ${q.name ?? 'Untitled'}`,
			q.description ? `-- ${q.description}` : null,
			created,
			q.gql ?? '',
			''
		].filter(Boolean).join('\n');
		return lines;
	}).join('\n');

	const blob = new Blob([content], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `gbetter-queries-${new Date().toISOString().split('T')[0]}.gql`;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * Export the run history as a chronological, re-runnable .gql script.
 * Each entry keeps its natural-language input and AI reasoning as comments,
 * so the file is both a reproducible record and importable as saved queries.
 */
export function exportHistory(history: QueryResult[]): void {
	// History is stored newest-first; export oldest-first so it reads as the
	// sequence of steps that produced the analysis. Skip non-runnable entries
	// (e.g. "no genes found" messages).
	const items = [...history]
		.reverse()
		.filter((h) => h.query?.valid && h.query.raw?.trim());

	const header = [
		'-- GBetter query history',
		`-- Exported: ${new Date().toISOString()}`,
		`-- ${items.length} ${items.length === 1 ? 'query' : 'queries'}`,
		''
	].join('\n');

	const body = items
		.map((h, i) => {
			return [
				`-- Query: ${i + 1}`,
				h.timestamp ? `-- Run: ${new Date(h.timestamp).toISOString()}` : null,
				h.naturalLanguage ? `-- from: "${h.naturalLanguage}"` : null,
				h.reasoning ? `-- reason: ${h.reasoning}` : null,
				h.query.raw,
				''
			]
				.filter(Boolean)
				.join('\n');
		})
		.join('\n');

	const blob = new Blob([header + body], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `gbetter-history-${new Date().toISOString().split('T')[0]}.gql`;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * Export a single query to clipboard or file
 */
export function exportSingleQuery(query: SavedQuery): string {
	return [
		`-- Query: ${query.name}`,
		query.description ? `-- ${query.description}` : null,
		query.gql
	].filter(Boolean).join('\n');
}

/**
 * Parse a .gql file content into queries
 */
export function parseGqlFile(content: string): Array<{ name: string; gql: string; description?: string }> {
	const queries: Array<{ name: string; gql: string; description?: string }> = [];
	const lines = content.split('\n');

	let currentName = '';
	let currentDescription = '';
	let currentGql = '';

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.startsWith('-- Query:')) {
			// Save previous query if exists
			if (currentGql.trim()) {
				queries.push({
					name: currentName || 'Imported Query',
					gql: currentGql.trim(),
					description: currentDescription || undefined
				});
			}
			// Start new query
			currentName = trimmed.replace('-- Query:', '').trim();
			currentDescription = '';
			currentGql = '';
		} else if (trimmed.startsWith('-- Created:')) {
			// Skip created date line
			continue;
		} else if (trimmed.startsWith('--')) {
			// Description line
			if (!currentGql.trim()) {
				currentDescription = trimmed.replace('--', '').trim();
			}
		} else if (trimmed) {
			// GQL line
			currentGql += (currentGql ? '\n' : '') + trimmed;
		}
	}

	// Don't forget the last query
	if (currentGql.trim()) {
		queries.push({
			name: currentName || 'Imported Query',
			gql: currentGql.trim(),
			description: currentDescription || undefined
		});
	}

	return queries;
}

/**
 * Import queries from parsed file content
 */
export function importQueries(parsed: Array<{ name: string; gql: string; description?: string }>): SavedQuery[] {
	const imported: SavedQuery[] = [];

	for (const q of parsed) {
		const saved = saveQuery(q.name, q.gql, q.description);
		imported.push(saved);
	}

	return imported;
}

// ---------------------------------------------------------------------------
// Saved analyses ("notebooks") — a named, ordered list of GQL queries
// ---------------------------------------------------------------------------

/** Load saved analyses; returns [] for missing/corrupted storage. */
export function loadAnalyses(): SavedAnalysis[] {
	if (!browser) return [];
	try {
		const stored = localStorage.getItem(ANALYSES_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (Array.isArray(parsed)) {
				return parsed.filter(
					(a): a is SavedAnalysis =>
						a && typeof a === 'object' && typeof a.name === 'string' && Array.isArray(a.queries)
				);
			}
		}
	} catch (e) {
		console.warn('Failed to load saved analyses:', e);
	}
	return [];
}

/** Save a new analysis (skips empty query lists). */
export function saveAnalysis(name: string, queries: string[], description?: string): SavedAnalysis | null {
	const cleaned = queries.map((q) => q.trim()).filter(Boolean);
	if (!name.trim() || cleaned.length === 0) return null;
	const analysis: SavedAnalysis = {
		id: uid('analysis'),
		name: name.trim(),
		description: description?.trim() || undefined,
		queries: cleaned,
		createdAt: Date.now()
	};
	const analyses = loadAnalyses();
	analyses.unshift(analysis);
	safeSetItem(ANALYSES_KEY, analyses);
	return analysis;
}

export function deleteAnalysis(id: string): void {
	safeSetItem(ANALYSES_KEY, loadAnalyses().filter((a) => a.id !== id));
}

/**
 * Generate a shareable URL with the query encoded
 */
export function generateQueryUrl(gql: string): string {
	const encoded = encodeURIComponent(gql);
	const baseUrl = browser ? window.location.origin + window.location.pathname : '';
	return `${baseUrl}?gql=${encoded}`;
}

/**
 * Extract query from URL if present
 */
export function getQueryFromUrl(): string | null {
	if (!browser) return null;

	const params = new URLSearchParams(window.location.search);
	const gql = params.get('gql');
	if (!gql) return null;

	try {
		return decodeURIComponent(gql);
	} catch (e) {
		// Malformed percent-encoding in the URL — don't crash the app on load.
		console.warn('Ignoring malformed ?gql= URL parameter:', e);
		return null;
	}
}
