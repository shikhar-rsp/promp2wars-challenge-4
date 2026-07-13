import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';

export interface GroqProviderOptions {
  apiKey: string | undefined;
  model?: string;
  fetchImpl?: typeof fetch;
}

/**
 * First fallback. Groq's LPU inference is extremely fast and has a generous
 * free tier, making it an ideal shock-absorber when OpenRouter is rate limited.
 */
export class GroqProvider extends OpenAICompatibleProvider {
  constructor(options: GroqProviderOptions) {
    super({
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: options.apiKey,
      defaultModel: options.model ?? 'llama-3.3-70b-versatile',
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
  }
}
