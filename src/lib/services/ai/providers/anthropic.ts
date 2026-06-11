/**
 * Anthropic (Claude) AI Provider
 */

import type { AIProvider, AIModel, TranslationRequest, TranslationResponse } from '../types';
import { buildSystemPrompt, buildUserMessage, parseAIResponse } from '../prompt';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const MODELS: AIModel[] = [
	{
		id: 'claude-sonnet-4-6',
		name: 'Claude Sonnet 4.6',
		description: 'Best balance of speed and intelligence',
		isDefault: true
	},
	{
		id: 'claude-haiku-4-5',
		name: 'Claude Haiku 4.5',
		description: 'Fastest, most affordable'
	},
	{
		id: 'claude-opus-4-8',
		name: 'Claude Opus 4.8',
		description: 'Most capable, slower'
	},
	{
		id: 'claude-fable-5',
		name: 'Claude Fable 5',
		description: 'Most powerful and intelligent'
	}
];

// Lightweight model used for the Settings "Test Connection" check.
const TEST_MODEL = 'claude-haiku-4-5';

export const anthropicProvider: AIProvider = {
	id: 'anthropic',
	name: 'Anthropic (Claude)',
	apiKeyUrl: 'https://console.anthropic.com/settings/keys',
	apiKeyPlaceholder: 'sk-ant-...',
	models: MODELS,

	async translate(request: TranslationRequest): Promise<TranslationResponse> {
		const { input, context, apiKey, model, history } = request;

		if (!apiKey) {
			return {
				success: false,
				error: 'API key not configured. Go to Settings to add your Anthropic API key.'
			};
		}

		const systemPrompt = buildSystemPrompt();
		const userMessage = buildUserMessage(input, context);
		// Prior turns first (for multi-turn follow-ups), then the new request.
		const messages = [
			...(history ?? []).map((t) => ({ role: t.role, content: t.content })),
			{ role: 'user' as const, content: userMessage }
		];

		try {
			const response = await fetch(ANTHROPIC_API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
					'anthropic-dangerous-direct-browser-access': 'true'
				},
				body: JSON.stringify({
					model: model || 'claude-sonnet-4-6',
					max_tokens: 256,
					system: systemPrompt,
					messages
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

				if (response.status === 401) {
					return {
						success: false,
						error: 'Invalid API key. Check your Anthropic API key in Settings.'
					};
				}

				return {
					success: false,
					error: `Anthropic API error: ${errorMessage}`
				};
			}

			const data = await response.json();
			const rawResponse = data.content?.[0]?.text || '';

			const parsed = parseAIResponse(rawResponse);

			if (parsed.type === 'clarify') {
				return {
					success: false,
					clarificationNeeded: true,
					clarificationQuestion: parsed.content,
					rawResponse
				};
			}

			if (parsed.type === 'error') {
				return {
					success: false,
					error: parsed.content,
					rawResponse
				};
			}

			return {
				success: true,
				gql: parsed.content,
				explanation: parsed.reasoning,
				rawResponse
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';

			// Check for CORS or network errors
			if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
				return {
					success: false,
					error: 'Network error connecting to Anthropic API. This may be a CORS issue - try using a backend proxy.'
				};
			}

			return {
				success: false,
				error: `Translation failed: ${message}`
			};
		}
	},

	async testConnection(apiKey: string): Promise<boolean> {
		try {
			console.log('Testing Anthropic connection...');
			const response = await fetch(ANTHROPIC_API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
					'anthropic-dangerous-direct-browser-access': 'true'
				},
				body: JSON.stringify({
					model: TEST_MODEL,
					max_tokens: 10,
					messages: [
						{ role: 'user', content: 'Hi' }
					]
				})
			});

			console.log('Anthropic response status:', response.status, 'ok:', response.ok);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('Anthropic test failed:', response.status, errorData);
				return false;
			}

			const data = await response.json();
			console.log('Anthropic test succeeded:', data);
			return true;
		} catch (error) {
			console.error('Anthropic connection error:', error);
			return false;
		}
	}
};
