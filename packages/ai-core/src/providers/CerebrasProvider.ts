import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';

export interface CerebrasProviderOptions {
  apiKey: string | undefined;
  model?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Second fallback. Cerebras offers wafer-scale inference with another
 * independent quota pool, giving the chain a third distinct capacity source
 * before we resort to the last-resort provider.
 */
export class CerebrasProvider extends OpenAICompatibleProvider {
  constructor(options: CerebrasProviderOptions) {
    super({
      name: 'cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      apiKey: options.apiKey,
      defaultModel: options.model ?? 'llama-3.3-70b',
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
  }
}
