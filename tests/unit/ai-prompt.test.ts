import { describe, it, expect } from 'vitest';
import { parseAIResponse, buildUserMessage } from '$lib/services/ai/prompt';
import type { BrowserContext } from '$lib/services/ai/types';

describe('parseAIResponse', () => {
	it('splits the GQL command from a REASON summary', () => {
		const r = parseAIResponse(
			'NAVIGATE BRCA1\nREASON: Interpreted "the breast cancer gene" as BRCA1.'
		);
		expect(r.type).toBe('gql');
		expect(r.content).toBe('NAVIGATE BRCA1');
		expect(r.reasoning).toBe('Interpreted "the breast cancer gene" as BRCA1.');
	});

	it('works when no REASON line is present', () => {
		const r = parseAIResponse('SELECT GENES IN VIEW');
		expect(r.content).toBe('SELECT GENES IN VIEW');
		expect(r.reasoning).toBeUndefined();
	});

	it('strips markdown fences while keeping the reason', () => {
		const r = parseAIResponse('```gql\nNAVIGATE TP53\n```\nREASON: TP53 is a gene symbol.');
		expect(r.content).toBe('NAVIGATE TP53');
		expect(r.reasoning).toBe('TP53 is a gene symbol.');
	});

	it('handles CLARIFY and ERROR without a reason', () => {
		expect(parseAIResponse('CLARIFY: In view or all data?')).toEqual({
			type: 'clarify',
			content: 'In view or all data?'
		});
		expect(parseAIResponse('ERROR: cannot translate')).toEqual({
			type: 'error',
			content: 'cannot translate'
		});
	});

	it('accumulates multiple REASON lines instead of dropping all but the last', () => {
		const r = parseAIResponse('NAVIGATE BRCA1\nREASON: first thought.\nREASON: refined.');
		expect(r.content).toBe('NAVIGATE BRCA1');
		expect(r.reasoning).toBe('first thought. refined.');
	});
});

describe('buildUserMessage — track context bounds', () => {
	const ctx = (tracks: BrowserContext['tracks']): BrowserContext => ({
		tracks,
		viewport: { chromosome: 'chr1', start: 0, end: 1000 },
		knownGenes: []
	});

	it('caps the track list and notes how many more there are', () => {
		const tracks = Array.from({ length: 45 }, (_, i) => ({
			name: `t${i}`,
			type: 'bed' as const,
			featureCount: 1
		}));
		const msg = buildUserMessage('list genes', ctx(tracks));
		expect(msg).toMatch(/and 15 more tracks/);
		expect(msg).not.toContain('"t40"'); // beyond the cap, not listed
	});

	it('labels empty track names instead of emitting "" ', () => {
		const msg = buildUserMessage('x', ctx([{ name: '', type: 'bed', featureCount: 1 }]));
		expect(msg).toContain('(unnamed track)');
	});
});
