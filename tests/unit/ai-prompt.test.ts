import { describe, it, expect } from 'vitest';
import { parseAIResponse } from '$lib/services/ai/prompt';

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
});
