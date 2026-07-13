import type { AIService, CompletionChunk } from '@atlas/ai-core';
import {
  METLIFE_ZONE_INDEX,
  StadiumRouter,
  type CrowdReading,
  type FanContext,
  type Route,
  type Stadium,
} from '@atlas/shared';
import { copilotPrompt } from './prompts.js';

export interface CopilotAnswer {
  answer: string;
  provider: string;
  cached: boolean;
  route?: Route;
}

/**
 * The context-aware, multilingual fan assistant. It is deliberately NOT a raw
 * chatbot: before calling the model it assembles live situational context —
 * an accessibility-aware route, nearby crowd levels, time to kickoff — so the
 * answer is grounded in the fan's actual match-day situation.
 */
export class CopilotService {
  private readonly router: StadiumRouter;

  constructor(
    private readonly ai: AIService,
    stadium: Stadium,
  ) {
    this.router = new StadiumRouter(stadium);
  }

  private buildContext(question: string, fan: FanContext, readings: CrowdReading[]) {
    const seat = fan.seatZoneId ? METLIFE_ZONE_INDEX.get(fan.seatZoneId) : undefined;
    const here = fan.currentZoneId ? METLIFE_ZONE_INDEX.get(fan.currentZoneId) : undefined;

    // If we can infer origin and destination, precompute an accessible route.
    let route: Route | undefined;
    if (fan.currentZoneId && fan.seatZoneId) {
      route = this.router.route(fan.currentZoneId, fan.seatZoneId, {
        requireAccessible: fan.accessibilityNeeds.length > 0,
      });
    }

    const nearbyIds = new Set([fan.currentZoneId, ...(here?.connectedZoneIds ?? [])].filter(Boolean));
    const nearbyReadings = readings.filter((r) => nearbyIds.has(r.zoneId)).slice(0, 6);

    return {
      messages: copilotPrompt({
        question,
        fan,
        ...(here ? { zoneName: here.name } : {}),
        ...(seat ? { seatName: seat.name } : {}),
        ...(route ? { route } : {}),
        nearbyReadings,
        zoneNameById: (id: string) => METLIFE_ZONE_INDEX.get(id)?.name ?? id,
      }),
      route,
    };
  }

  async ask(question: string, fan: FanContext, readings: CrowdReading[]): Promise<CopilotAnswer> {
    const { messages, route } = this.buildContext(question, fan, readings);
    const response = await this.ai.complete({
      messages,
      temperature: 0.3,
      maxTokens: 320,
      cacheNamespace: 'copilot',
    });
    return {
      answer: response.content,
      provider: response.provider,
      cached: response.cached,
      ...(route?.found ? { route } : {}),
    };
  }

  /** Streamed variant for a live typing effect in the UI. */
  async *stream(
    question: string,
    fan: FanContext,
    readings: CrowdReading[],
  ): AsyncIterable<CompletionChunk> {
    const { messages } = this.buildContext(question, fan, readings);
    yield* this.ai.stream({ messages, temperature: 0.3, maxTokens: 320 });
  }
}
