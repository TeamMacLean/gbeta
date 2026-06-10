/**
 * Ollama AI Provider (Local LLM)
 *
 * Uses the OpenAI-compatible API exposed by Ollama.
 * No API key required - runs entirely on your machine.
 */

import type { AIProvider, AIModel, TranslationRequest, TranslationResponse } from '../types';
import { buildSystemPrompt, buildUserMessage, parseAIResponse } from '../prompt';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

// Common models that work well for query translation
// Users can also type any model name they have installed
const MODELS: AIModel[] = [
	{
		id: 'llama3.2',
		name: 'Llama 3.2',
		description: 'Latest Llama, good balance of speed and capability',
		isDefault: true
	},
	{
		id: 'mistral',
		name: 'Mistral 7B',
		description: 'Fast and capable'
	},
	{
		id: 'codellama',
		name: 'Code Llama',
		description: 'Optimized for code-like tasks'
	},
	{
		id: 'llama3.1',
		name: 'Llama 3.1',
		description: 'Excellent general purpose model'
	},
	{
		id: 'qwen2.5',
		name: 'Qwen 2.5',
		description: 'Strong multilingual capabilities'
	}
];

/**
 * Get Ollama base URL from localStorage or default
 */
function getOllamaUrl(): string {
	try {
		const stored = localStorage.getItem('gbetter_ollama_url');
		return stored || DEFAULT_OLLAMA_URL;
	} catch {
		return DEFAULT_OLLAMA_URL;
	}
}

/**
 * Save custom Ollama URL to localStorage
 */
export function setOllamaUrl(url: string): void {
	try {
		localStorage.setItem('gbetter_ollama_url', url);
	} catch {
		// Ignore storage errors
	}
}

export const ollamaProvider: AIProvider = {
	id: 'ollama',
	name: 'Ollama (Local)',
	apiKeyUrl: 'https://ollama.ai/download',
	apiKeyPlaceholder: 'No API key needed',
	models: MODELS,

	async translate(request: TranslationRequest): Promise<TranslationResponse> {
		const { input, context, model } = request;
		const baseUrl = getOllamaUrl();
		const apiUrl = `${baseUrl}/v1/chat/completions`;

		const systemPrompt = buildSystemPrompt();
		const userMessage = buildUserMessage(input, context);

		try {
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: model || 'llama3.2',
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

				if (response.status === 404) {
					return {
						success: false,
						error: `Model not found. Run: ollama pull ${model || 'llama3.2'}`
					};
				}

				return {
					success: false,
					error: `Ollama error: ${errorMessage}`
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
					error: `Cannot connect to Ollama at ${baseUrl}. Make sure Ollama is running: ollama serve`
				};
			}

			return {
				success: false,
				error: `Translation failed: ${message}`
			};
		}
	},

	async testConnection(apiKey: string): Promise<boolean> {
		// apiKey parameter is ignored for Ollama - we just test connectivity
		const baseUrl = getOllamaUrl();

		try {
			// Test by listing models - simpler than doing a full inference
			const response = await fetch(`${baseUrl}/api/tags`);
			return response.ok;
		} catch {
			return false;
		}
	}
};
