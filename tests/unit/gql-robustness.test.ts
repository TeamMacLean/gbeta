import { describe, it, expect } from 'vitest';
import { parseQuery } from '$lib/services/queryLanguage';

describe('FILTER operator parsing (was losing the operator)', () => {
	it('keeps >= when attached to the field (filter score>=100)', () => {
		const r = parseQuery('filter score>=100');
		expect(r.valid).toBe(true);
		const params = r.params as Record<string, string>;
		// operator preserved as a value prefix the executor understands
		expect(params.score).toBe('>=100');
		expect(params['score>']).toBeUndefined(); // the old mangled key is gone
	});

	it('keeps <, >, != operators', () => {
		expect((parseQuery('filter score<50').params as any).score).toBe('<50');
		expect((parseQuery('filter count>5').params as any).count).toBe('>5');
		expect((parseQuery('filter type!=exon').params as any).type).toBe('!=exon');
	});

	it('plain equality still works', () => {
		expect((parseQuery('filter type=exon').params as any).type).toBe('exon');
	});

	it('rejects when there is no valid criterion', () => {
		const r = parseQuery('filter');
		expect(r.valid).toBe(false);
	});
});
