/**
 * Persistence service for localStorage session restore
 * Saves viewport state, track metadata, and UI preferences
 */

import { browser } from '$app/environment';
import { getMigrated } from './storage';

const STORAGE_KEY = 'gbeta_session';
const LEGACY_STORAGE_KEY = 'gbetter_session';
const STORAGE_VERSION = 1;

export interface TrackMetadata {
	id: string;
	name: string;
	typeId: string;
	color: string;
	height: number;
	visible: boolean;
	fileName: string;
	featureCount: number;
}

export interface UIPreferences {
	sidebarCollapsed: boolean;
}

export interface SessionState {
	version: number;
	viewport: {
		chromosome: string;
		start: number;
		end: number;
	};
	tracks: TrackMetadata[];
	ui: UIPreferences;
	savedAt: number;
}

/**
 * Save session state to localStorage
 */
export function saveSession(state: Omit<SessionState, 'version' | 'savedAt'>): void {
	if (!browser) return;

	try {
		const session: SessionState = {
			...state,
			version: STORAGE_VERSION,
			savedAt: Date.now()
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
	} catch (error) {
		console.warn('Failed to save session:', error);
	}
}

/**
 * Load session state from localStorage
 */
export function loadSession(): SessionState | null {
	if (!browser) return null;

	try {
		const stored = getMigrated(STORAGE_KEY, LEGACY_STORAGE_KEY);
		if (!stored) return null;

		const session = JSON.parse(stored) as SessionState;

		// Version check for future migrations
		if (session.version !== STORAGE_VERSION) {
			console.warn('Session version mismatch, clearing');
			clearSession();
			return null;
		}

		return session;
	} catch (error) {
		console.warn('Failed to load session:', error);
		return null;
	}
}

/**
 * Clear saved session
 */
export function clearSession(): void {
	if (!browser) return;
	localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if there's a saved session with tracks
 */
export function hasSavedTracks(): boolean {
	const session = loadSession();
	return session !== null && session.tracks.length > 0;
}

/**
 * Get track metadata for session restore UI
 */
export function getSavedTrackInfo(): TrackMetadata[] {
	const session = loadSession();
	return session?.tracks ?? [];
}
