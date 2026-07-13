import { PromptSafetyError } from '../errors.js';
import type { ChatMessage } from '../types.js';

/**
 * Defense-in-depth against prompt injection and jailbreaks.
 *
 * This is NOT a silver bullet — it is one layer. The stronger structural
 * defenses live in how we build prompts (untrusted content is always wrapped
 * in clearly delimited, clearly-labelled blocks and the system prompt states
 * that instructions inside those blocks must be ignored). This guard adds a
 * fast heuristic tripwire and hard input-size limits on top.
 */
export interface PromptGuardOptions {
  /** Reject any single message longer than this many characters. */
  maxMessageChars: number;
  /** Reject the whole conversation if total characters exceed this. */
  maxTotalChars: number;
  /** When false, suspicious input is sanitized+flagged instead of thrown. */
  throwOnDetection: boolean;
}

const DEFAULTS: PromptGuardOptions = {
  maxMessageChars: 8_000,
  maxTotalChars: 24_000,
  throwOnDetection: true,
};

/**
 * Patterns that strongly indicate an attempt to subvert the system prompt.
 * Kept deliberately conservative to minimise false positives on legitimate
 * fan questions ("ignore" appears in normal speech, so we require it to be
 * paired with instruction-override intent).
 */
const INJECTION_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: 'ignore-previous', re: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts?|rules)/i },
  { id: 'disregard-system', re: /disregard\s+(the\s+)?(system|above|previous)\s+(prompt|message|instructions)/i },
  { id: 'reveal-system', re: /(reveal|show|print|repeat|output)\s+(me\s+)?(your\s+)?(system\s+prompt|initial\s+instructions|the\s+prompt\s+above)/i },
  { id: 'role-override', re: /you\s+are\s+now\s+(a|an|in)\s+(developer|dan|jailbreak|admin|god)\s*mode/i },
  { id: 'pretend-unrestricted', re: /pretend\s+(you\s+are|to\s+be)\s+(an?\s+)?(unrestricted|uncensored|unfiltered)/i },
  { id: 'delimiter-escape', re: /(<\/?(system|assistant|instructions)>|\[\/?(inst|sys)\])/i },
  { id: 'exfiltrate-secrets', re: /(print|reveal|leak|show)\s+(the\s+)?(api|secret|env|environment)\s*(key|keys|token|variable)/i },
];

export interface GuardResult {
  safe: boolean;
  sanitized: ChatMessage[];
  flags: string[];
}

export class PromptGuard {
  private readonly options: PromptGuardOptions;

  constructor(options: Partial<PromptGuardOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /**
   * Inspect user/assistant messages (system messages are trusted, authored by
   * us). Throws {@link PromptSafetyError} on detection when configured to,
   * otherwise returns the sanitized messages with flags for logging.
   */
  inspect(messages: ChatMessage[]): GuardResult {
    const flags: string[] = [];
    let total = 0;

    for (const message of messages) {
      total += message.content.length;
      if (message.content.length > this.options.maxMessageChars) {
        flags.push('message-too-long');
      }
      // Only untrusted roles are scanned for injection intent.
      if (message.role !== 'system') {
        for (const { id, re } of INJECTION_PATTERNS) {
          if (re.test(message.content)) flags.push(`injection:${id}`);
        }
      }
    }
    if (total > this.options.maxTotalChars) flags.push('conversation-too-long');

    const safe = flags.length === 0;
    if (!safe && this.options.throwOnDetection) {
      throw new PromptSafetyError(flags.join(', '));
    }

    return {
      safe,
      flags,
      sanitized: safe ? messages : messages.map((m) => this.truncate(m)),
    };
  }

  /**
   * Wrap untrusted free-text in a labelled, delimited block for safe
   * interpolation into a prompt. The accompanying system prompt instructs the
   * model to treat everything inside as data, never as instructions.
   */
  static wrapUntrusted(label: string, value: string): string {
    const fence = '«';
    const close = '»';
    // Strip our own fence chars from the payload so it cannot forge a boundary.
    const cleaned = value.replaceAll(fence, '').replaceAll(close, '');
    return `${fence}${label}\n${cleaned}\n${label}${close}`;
  }

  private truncate(message: ChatMessage): ChatMessage {
    if (message.content.length <= this.options.maxMessageChars) return message;
    return { ...message, content: message.content.slice(0, this.options.maxMessageChars) };
  }
}
