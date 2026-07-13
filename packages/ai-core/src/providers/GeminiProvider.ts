import {
  ProviderRequestError,
  ProviderUnavailableError,
  RateLimitError,
} from '../errors.js';
import type {
  AIProvider,
  ChatMessage,
  CompletionChunk,
  CompletionRequest,
  CompletionResponse,
} from '../types.js';

export interface GeminiProviderOptions {
  apiKey: string | undefined;
  model?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
}
interface GeminiResponseBody {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * Last-resort provider. Google Gemini uses its own `generateContent` REST shape
 * rather than the OpenAI dialect, so it implements {@link AIProvider} directly
 * instead of extending the OpenAI-compatible base. It sits last because we want
 * to preserve its quota for when every other provider is exhausted.
 */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: GeminiProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'gemini-2.0-flash';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.requestTimeoutMs ?? 20_000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = performance.now();
    const body = await this.generate(request);
    const text =
      body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return {
      content: text.trim(),
      provider: this.name,
      model: this.model,
      usage: {
        promptTokens: body.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: body.usageMetadata?.totalTokenCount ?? 0,
      },
      cached: false,
      latencyMs: Math.round(performance.now() - start),
    };
  }

  /**
   * Gemini streaming (`streamGenerateContent`) returns a JSON array streamed in
   * fragments. For robustness we buffer, then emit the full text as a single
   * terminal chunk — the higher layers treat a one-shot stream identically.
   */
  async *stream(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    const response = await this.complete(request);
    yield { delta: response.content, done: false, provider: this.name, model: this.model };
    yield { delta: '', done: true, provider: this.name, model: this.model };
  }

  private async generate(request: CompletionRequest): Promise<GeminiResponseBody> {
    const { systemInstruction, contents } = this.toGeminiPayload(request.messages);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    if (request.signal) {
      request.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey ?? '',
        },
        body: JSON.stringify({
          ...(systemInstruction ? { systemInstruction } : {}),
          contents,
          generationConfig: {
            temperature: request.temperature ?? 0.2,
            maxOutputTokens: request.maxTokens ?? 1024,
          },
        }),
      });
    } catch (error) {
      throw new ProviderUnavailableError(this.name, undefined, error);
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) return (await response.json()) as GeminiResponseBody;

    const detail = await response.text().catch(() => '');
    if (response.status === 429) throw new RateLimitError(this.name);
    if (response.status >= 500) throw new ProviderUnavailableError(this.name, response.status);
    throw new ProviderRequestError(this.name, detail.slice(0, 200), response.status);
  }

  /** Map ATLAS chat messages onto Gemini's `contents` + `systemInstruction`. */
  private toGeminiPayload(messages: ChatMessage[]): {
    systemInstruction?: { parts: Array<{ text: string }> };
    contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  } {
    const systemText = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.content }],
      }));
    return {
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      contents,
    };
  }
}
