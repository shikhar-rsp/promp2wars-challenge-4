import { AIService } from './AIService.js';
import { CerebrasProvider } from './providers/CerebrasProvider.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { GroqProvider } from './providers/GroqProvider.js';
import { OpenRouterProvider } from './providers/OpenRouterProvider.js';
import { SimulatorProvider } from './providers/SimulatorProvider.js';
import { PromptGuard } from './security/PromptGuard.js';
import type { AIProvider } from './types.js';

export interface AIEnv {
  // Values come from `process.env`, so a present-but-undefined key is valid —
  // hence `| undefined` rather than a bare optional (which, under
  // exactOptionalPropertyTypes, would forbid passing an explicit undefined).
  OPENROUTER_API_KEY?: string | undefined;
  GROQ_API_KEY?: string | undefined;
  CEREBRAS_API_KEY?: string | undefined;
  GEMINI_API_KEY?: string | undefined;
  OPENROUTER_MODEL?: string | undefined;
  GROQ_MODEL?: string | undefined;
  CEREBRAS_MODEL?: string | undefined;
  GEMINI_MODEL?: string | undefined;
}

/**
 * Build a production-ready {@link AIService} from environment variables with
 * the mandated priority order: OpenRouter → Groq → Cerebras → Gemini, and a
 * always-on {@link SimulatorProvider} as the guaranteed terminal fallback so
 * the platform is fully functional even with zero API keys.
 */
export function createAIServiceFromEnv(env: AIEnv, fetchImpl?: typeof fetch): AIService {
  const opt = (key: string | undefined) => (key && key.trim() ? key.trim() : undefined);

  const providers: AIProvider[] = [
    new OpenRouterProvider({
      apiKey: opt(env.OPENROUTER_API_KEY),
      ...(env.OPENROUTER_MODEL ? { model: env.OPENROUTER_MODEL } : {}),
      ...(fetchImpl ? { fetchImpl } : {}),
    }),
    new GroqProvider({
      apiKey: opt(env.GROQ_API_KEY),
      ...(env.GROQ_MODEL ? { model: env.GROQ_MODEL } : {}),
      ...(fetchImpl ? { fetchImpl } : {}),
    }),
    new CerebrasProvider({
      apiKey: opt(env.CEREBRAS_API_KEY),
      ...(env.CEREBRAS_MODEL ? { model: env.CEREBRAS_MODEL } : {}),
      ...(fetchImpl ? { fetchImpl } : {}),
    }),
    new GeminiProvider({
      apiKey: opt(env.GEMINI_API_KEY),
      ...(env.GEMINI_MODEL ? { model: env.GEMINI_MODEL } : {}),
      ...(fetchImpl ? { fetchImpl } : {}),
    }),
    new SimulatorProvider(),
  ];

  return new AIService({
    providers,
    promptGuard: new PromptGuard(),
    // ATLAS serves interactive endpoints, so a failing provider must fail over
    // FAST rather than exhaust a long retry budget. With a 12s per-request
    // timeout, one retry caps a dead provider at ~24s before the next provider
    // (or the instant simulator) takes over, and the breaker opens after two
    // failures so subsequent requests skip it entirely.
    retry: { maxAttempts: 2 },
    circuit: { threshold: 2, cooldownMs: 20_000 },
  });
}

/** True when at least one real (non-simulator) provider has credentials. */
export function hasLiveProvider(env: AIEnv): boolean {
  return Boolean(
    env.OPENROUTER_API_KEY || env.GROQ_API_KEY || env.CEREBRAS_API_KEY || env.GEMINI_API_KEY,
  );
}
