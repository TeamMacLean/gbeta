/**
 * Gene picker store.
 *
 * Promise-based modal control so callers can `const choice = await
 * genePicker.open(matches)` and branch on the user's selection (or null on
 * cancel). Used when a gene term has multiple matches and the user wants to
 * switch away from the best-guess.
 */

import type { GeneResult } from '$lib/services/geneLookup';

interface PickerState {
	visible: boolean;
	genes: GeneResult[];
}

function createGenePickerStore() {
	let state = $state<PickerState>({ visible: false, genes: [] });
	let resolver: ((g: GeneResult | null) => void) | null = null;

	/** Open the picker with the given matches; resolves to the choice or null. */
	function open(genes: GeneResult[]): Promise<GeneResult | null> {
		// Resolve any previous open promise as cancelled before reopening.
		resolver?.(null);
		state.genes = genes;
		state.visible = true;
		return new Promise((resolve) => {
			resolver = resolve;
		});
	}

	function select(gene: GeneResult): void {
		state.visible = false;
		resolver?.(gene);
		resolver = null;
	}

	function cancel(): void {
		state.visible = false;
		resolver?.(null);
		resolver = null;
	}

	return {
		get visible() {
			return state.visible;
		},
		get genes() {
			return state.genes;
		},
		open,
		select,
		cancel
	};
}

let store: ReturnType<typeof createGenePickerStore> | undefined;

export function useGenePicker() {
	if (!store) store = createGenePickerStore();
	return store;
}
