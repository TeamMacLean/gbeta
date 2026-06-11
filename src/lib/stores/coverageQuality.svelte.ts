/**
 * Coverage Quality Settings Store
 *
 * Manages user preferences for coverage quality settings with localStorage persistence
 */

import { getMigrated } from '$lib/services/storage';

export type CoverageQuality = 'fast' | 'medium' | 'detailed';

export interface CoverageQualityStore {
	bamQuality: CoverageQuality;
	bigwigQuality: CoverageQuality;
	setBamQuality: (quality: CoverageQuality) => void;
	setBigwigQuality: (quality: CoverageQuality) => void;
	getQualityForTrackType: (trackType: string) => CoverageQuality;
}

const STORAGE_KEYS = {
	bam: 'gbeta-coverage-quality-bam',
	bigwig: 'gbeta-coverage-quality-bigwig'
} as const;

const LEGACY_KEYS = {
	bam: 'gbetter-coverage-quality-bam',
	bigwig: 'gbetter-coverage-quality-bigwig'
} as const;

const VALID_QUALITIES: CoverageQuality[] = ['fast', 'medium', 'detailed'];

function isValidQuality(value: any): value is CoverageQuality {
	return VALID_QUALITIES.includes(value);
}

function getStoredQuality(key: string, legacyKey: string, defaultQuality: CoverageQuality): CoverageQuality {
	try {
		const stored = getMigrated(key, legacyKey);
		if (stored && isValidQuality(stored)) {
			return stored;
		}
	} catch (error) {
		// localStorage might not be available (SSR, private browsing, etc.)
		console.warn('Failed to read from localStorage:', error);
	}
	return defaultQuality;
}

function setStoredQuality(key: string, quality: CoverageQuality): void {
	try {
		localStorage.setItem(key, quality);
	} catch (error) {
		// localStorage might not be available
		console.warn('Failed to write to localStorage:', error);
	}
}

function validateQuality(quality: CoverageQuality): void {
	if (!isValidQuality(quality)) {
		throw new Error(`Invalid coverage quality: ${quality}. Must be one of: ${VALID_QUALITIES.join(', ')}`);
	}
}

class CoverageQualityStoreImpl implements CoverageQualityStore {
	private _bamQuality = $state<CoverageQuality>('medium');
	private _bigwigQuality = $state<CoverageQuality>('medium');

	constructor() {
		// Initialize from localStorage if available
		this._bamQuality = getStoredQuality(STORAGE_KEYS.bam, LEGACY_KEYS.bam, 'medium');
		this._bigwigQuality = getStoredQuality(STORAGE_KEYS.bigwig, LEGACY_KEYS.bigwig, 'medium');
	}

	get bamQuality(): CoverageQuality {
		return this._bamQuality;
	}

	get bigwigQuality(): CoverageQuality {
		return this._bigwigQuality;
	}

	setBamQuality(quality: CoverageQuality): void {
		validateQuality(quality);
		this._bamQuality = quality;
		setStoredQuality(STORAGE_KEYS.bam, quality);
	}

	setBigwigQuality(quality: CoverageQuality): void {
		validateQuality(quality);
		this._bigwigQuality = quality;
		setStoredQuality(STORAGE_KEYS.bigwig, quality);
	}

	getQualityForTrackType(trackType: string): CoverageQuality {
		switch (trackType.toLowerCase()) {
			case 'bam':
			case 'cram':
				return this._bamQuality;
			case 'bigwig':
			case 'bedgraph':
				return this._bigwigQuality;
			default:
				return 'medium'; // Default for unknown track types
		}
	}
}

// Singleton instance
let coverageQualityStore: CoverageQualityStore | null = null;

export function useCoverageQuality(): CoverageQualityStore {
	if (!coverageQualityStore) {
		coverageQualityStore = new CoverageQualityStoreImpl();
	}
	return coverageQualityStore;
}