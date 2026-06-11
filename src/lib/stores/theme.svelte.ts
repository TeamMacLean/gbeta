/**
 * Theme Store
 *
 * Manages application theme (light/dark/high-contrast) and color palette selection.
 * Persists settings to localStorage and applies CSS classes to document root.
 */

import { browser } from '$app/environment';
import { PALETTES, type PaletteName, type Palette } from '$lib/services/palette';
import { getMigrated } from '$lib/services/storage';

// =============================================================================
// TYPES
// =============================================================================

export type ThemeMode = 'light' | 'dark' | 'high-contrast';

interface ThemeSettings {
	mode: ThemeMode;
	palette: PaletteName;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'gbeta-theme';
const LEGACY_STORAGE_KEY = 'gbetter-theme';
const DEFAULT_SETTINGS: ThemeSettings = {
	mode: 'light',
	palette: 'set2',
};

// =============================================================================
// STATE
// =============================================================================

// Reactive state using Svelte 5 runes
let themeMode = $state<ThemeMode>(DEFAULT_SETTINGS.mode);
let paletteName = $state<PaletteName>(DEFAULT_SETTINGS.palette);

// Initialize from localStorage if in browser
if (browser) {
	const stored = getMigrated(STORAGE_KEY, LEGACY_STORAGE_KEY);
	if (stored) {
		try {
			const settings: ThemeSettings = JSON.parse(stored);
			if (settings.mode) themeMode = settings.mode;
			if (settings.palette && PALETTES[settings.palette]) paletteName = settings.palette;
		} catch (e) {
			console.warn('Failed to parse theme settings:', e);
		}
	}
	// Apply initial theme
	applyThemeToDocument(themeMode);
}

// =============================================================================
// INTERNAL FUNCTIONS
// =============================================================================

function saveSettings(): void {
	if (!browser) return;
	const settings: ThemeSettings = {
		mode: themeMode,
		palette: paletteName,
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function applyThemeToDocument(mode: ThemeMode): void {
	if (!browser) return;
	const root = document.documentElement;
	// Remove all theme classes
	root.classList.remove('light', 'dark', 'high-contrast');
	// Add current theme class
	root.classList.add(mode);
}

// =============================================================================
// EXPORTED STORE
// =============================================================================

function createThemeStore() {
	return {
		/**
		 * Get current theme mode
		 */
		get mode(): ThemeMode {
			return themeMode;
		},

		/**
		 * Get current palette name
		 */
		get paletteName(): PaletteName {
			return paletteName;
		},

		/**
		 * Get the current palette object
		 */
		get palette(): Palette {
			return PALETTES[paletteName] || PALETTES.set2;
		},

		/**
		 * Check if current theme is dark (for conditional rendering)
		 */
		get isDark(): boolean {
			return themeMode === 'dark';
		},

		/**
		 * Check if current theme is light
		 */
		get isLight(): boolean {
			return themeMode === 'light';
		},

		/**
		 * Check if current theme is high contrast
		 */
		get isHighContrast(): boolean {
			return themeMode === 'high-contrast';
		},

		/**
		 * Set theme mode
		 */
		setMode(mode: ThemeMode): void {
			themeMode = mode;
			applyThemeToDocument(mode);
			saveSettings();
		},

		/**
		 * Set color palette
		 */
		setPalette(name: PaletteName): void {
			if (PALETTES[name]) {
				paletteName = name;
				saveSettings();
			}
		},

		/**
		 * Get all available theme modes
		 */
		getAvailableModes(): ThemeMode[] {
			return ['light', 'dark', 'high-contrast'];
		},

		/**
		 * Get all available palette names
		 */
		getAvailablePalettes(): PaletteName[] {
			return Object.keys(PALETTES) as PaletteName[];
		},

		/**
		 * Toggle between light and dark (ignores high-contrast)
		 */
		toggle(): void {
			const newMode = themeMode === 'light' ? 'dark' : 'light';
			this.setMode(newMode);
		},
	};
}

// Export singleton instance
export const theme = createThemeStore();

// Also export a hook-style function for Svelte components
export function useTheme() {
	return theme;
}
