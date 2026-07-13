import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';

export interface OpenRouterProviderOptions {
  apiKey: string | undefined;
  model?: string;
  /** Sent as HTTP-Referer/X-Title for OpenRouter usage attribution. */
  appUrl?: string;
  appName?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Primary provider. OpenRouter fronts many models behind one OpenAI-compatible
 * API, which is exactly why it's first in the failover chain: if a single
 * upstream model is throttled, OpenRouter itself can route around it before we
 * ever fail over to another vendor.
 */
export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(options: OpenRouterProviderOptions) {
    super({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: options.apiKey,
      defaultModel: options.model ?? 'meta-llama/llama-3.3-70b-instruct',
      headers: {
        'HTTP-Referer': options.appUrl ?? 'https://atlas.stadium',
        'X-Title': options.appName ?? 'ATLAS Stadium Intelligence',
      },
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
  }
}
