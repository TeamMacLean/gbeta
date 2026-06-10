/**
 * OpenAI AI Provider
 */

import type { AIProvider, AIModel, TranslationRequest, TranslationResponse } from '../types';
import { buildSystemPrompt, buildUserMessage, parseAIResponse } from '../prompt';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const MODELS: AIModel[] = [
	{
		id: 'gpt-4o-mini',
		name: 'GPT-4o Mini',
		description: 'Fast and affordable',
		isDefault: true
	},
	{
		id: 'gpt-4o',
		name: 'GPT-4o',
		description: 'Most capable'
	},
	{
		id: 'gpt-4-turbo',
		name: 'GPT-4 Turbo',
		description: 'Previous generation, still capable'
	}
];

export const openaiProvider: AIProvider = {
	id: 'openai',
	name: 'OpenAI',
	apiKeyUrl: 'https://platform.openai.com/api-keys',
	apiKeyPlaceholder: 'sk-...',
	models: MODELS,

	async translate(request: TranslationRequest): Promise<TranslationResponse> {
		const { input, context, apiKey, model } = request;

		if (!apiKey) {
			return {
				success: false,
				error: 'API key not configured. Go to Settings to add your OpenAI API key.'
			};
		}

		const systemPrompt = buildSystemPrompt();
		const userMessage = buildUserMessage(input, context);

		try {
			const response = await fetch(OPENAI_API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model: model || 'gpt-4o-mini',
					max_tokens: 256,
					temperature: 0,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: userMessage }
					]
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

				if (response.status === 401) {
					return {
						success: false,
						error: 'Invalid API key. Check your OpenAI API key in Settings.'
					};
				}

				return {
					success: false,
					error: `OpenAI API error: ${errorMessage}`
				};
			}

			const data = await response.json();
			const rawResponse = data.choices?.[0]?.message?.content || '';

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

			if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
				return {
					success: false,
					error: 'Network error connecting to OpenAI API.'
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
			const response = await fetch(OPENAI_API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model: 'gpt-4o-mini',
					max_tokens: 10,
					messages: [
						{ role: 'user', content: 'Hi' }
					]
				})
			});

			return response.ok;
		} catch {
			return false;
		}
	}
};
