'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimal typing for the parts of the Web Speech API we use. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

/**
 * Browser-native speech-to-text via the Web Speech API — no paid STT service.
 * Degrades gracefully: `supported` is false where the API is unavailable, and
 * callers simply hide the mic button.
 */
export function useSpeech(lang = 'en-US') {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Impl = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setSupported(Boolean(Impl));
  }, []);

  const listen = useCallback(
    (onText: (text: string) => void) => {
      const w = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      };
      const Impl = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!Impl) return;

      const recognition = new Impl();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript ?? '';
        if (transcript) onText(transcript);
      };
      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);
      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    },
    [lang],
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, listen, stop };
}
