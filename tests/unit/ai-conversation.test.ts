import { describe, it, expect, vi, afterEach } from 'vitest';
import { anthropicProvider } from '$lib/services/ai/providers/anthropic';
import type { BrowserContext } from '$lib/services/ai/types';

const ctx: BrowserContext = {
	tracks: [],
	viewport: { chromosome: 'chr1', start: 0, end: 1000 },
	knownGenes: []
};

afterEach(() => vi.restoreAllMocks());

describe('Anthropic provider — multi-turn conversation', () => {
	it('includes prior turns before the new user message', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ content: [{ text: 'NAVIGATE TP53\nREASON: the tumour suppressor.' }] })
		});
		vi.stubGlobal('fetch', fetchMock);

		const res = await anthropicProvider.translate({
			input: 'the one I asked about',
			context: ctx,
			apiKey: 'sk-ant-test',
			history: [
				{ role: 'user', content: 'what is the breast cancer gene' },
				{ role: 'assistant', content: 'NAVIGATE BRCA1' }
			]
		});

		expect(res.success).toBe(true);
		expect(res.gql).toBe('NAVIGATE TP53');
		expect(res.explanation).toBe('the tumour suppressor.');

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		const roles = body.messages.map((m: any) => m.role);
		// prior user + prior assistant + the new user turn, in order
		expect(roles).toEqual(['user', 'assistant', 'user']);
		expect(body.messages[0].content).toContain('what is the breast cancer gene');
		expect(body.messages[1].content).toBe('NAVIGATE BRCA1');
		expect(body.messages[2].content).toContain('the one I asked about');
	});

	it('works with no history (single-shot)', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ content: [{ text: 'list genes' }] })
		});
		vi.stubGlobal('fetch', fetchMock);
		const res = await anthropicProvider.translate({ input: 'show all genes', context: ctx, apiKey: 'k' });
		expect(res.gql).toBe('list genes');
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.messages).toHaveLength(1);
	});
});
