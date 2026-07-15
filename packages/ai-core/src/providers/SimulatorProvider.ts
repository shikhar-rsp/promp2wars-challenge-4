import type {
  AIProvider,
  CompletionChunk,
  CompletionRequest,
  CompletionResponse,
} from '../types.js';

/** Model identifier reported by the offline simulator. */
const MODEL = 'atlas-sim-v1';

/**
 * Zero-dependency, offline provider of last resort.
 *
 * It never calls the network, so the entire platform remains fully
 * demonstrable with no API keys and no quota — critical for reliable judging
 * and CI. It is deliberately deterministic: the same prompt yields the same
 * response, which also makes it a perfect fixture for tests.
 *
 * It is always "configured" and therefore acts as the guaranteed terminal link
 * in the failover chain.
 */
export class SimulatorProvider implements AIProvider {
  readonly name = 'simulator' as const;

  constructor(private readonly latencyMs = 12) {}

  isConfigured(): boolean {
    return true;
  }

  complete(request: CompletionRequest): Promise<CompletionResponse> {
    const content = this.synthesize(request);
    const promptTokens = this.estimateTokens(request);
    const completionTokens = Math.ceil(content.length / 4);
    return Promise.resolve({
      content,
      provider: this.name,
      model: MODEL,
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
      cached: false,
      latencyMs: this.latencyMs,
    });
  }

  async *stream(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    // Reuse complete() so the streamed and buffered content stay identical.
    const { content } = await this.complete(request);
    for (const word of content.split(' ')) {
      yield { delta: `${word} `, done: false, provider: this.name, model: MODEL };
    }
    yield { delta: '', done: true, provider: this.name, model: MODEL };
  }

  /**
   * If the system prompt asks for JSON, return schema-plausible JSON;
   * otherwise return a concise, on-brand operational acknowledgement. Enough to
   * exercise the full request pipeline without any external dependency.
   */
  private synthesize(request: CompletionRequest): string {
    const system = request.messages.find((m) => m.role === 'system')?.content ?? '';
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const wantsJson = /json/i.test(system) || /json/i.test(lastUser);

    if (wantsJson) {
      return JSON.stringify({
        simulated: true,
        summary:
          'Simulated ATLAS response. Configure an AI provider key to enable live reasoning.',
        note: 'Deterministic offline output from SimulatorProvider.',
      });
    }
    const preview = lastUser.slice(0, 120).replace(/\s+/g, ' ').trim();
    return [
      '[ATLAS offline mode] I can see your request',
      preview ? `about "${preview}".` : '.',
      'Live AI reasoning is unavailable because no provider key is configured,',
      'so this is a deterministic simulated reply.',
    ].join(' ');
  }

  private estimateTokens(request: CompletionRequest): number {
    return Math.ceil(request.messages.reduce((n, m) => n + m.content.length, 0) / 4);
  }
}
