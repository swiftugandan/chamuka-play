"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Minimal shape of the browser SpeechRecognition we rely on. The Web Speech API
 * is not in lib.dom under a stable name (Chrome ships it as `webkitSpeechRecognition`),
 * so we narrow to just the members we touch instead of pulling a global type.
 */
type RecognitionResult = { 0: { transcript: string }; isFinal: boolean };
type RecognitionEvent = { results: ArrayLike<RecognitionResult> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

// Speech support is a client-only fact; reading it via useSyncExternalStore keeps
// SSR rendering `false` (no button) and the client its real value, with no
// hydration mismatch and no set-state-in-effect.
const subscribeToNothing = () => () => {};
const isSupportedClient = () => getRecognitionCtor() !== null;
const isSupportedServer = () => false;

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Wraps the browser Web Speech API as "talk to type". `onResult` is called as the
 * child speaks: `transcript` is the cumulative text for the current utterance, and
 * `isFinal` flips true once the browser has settled on the words. Consumers merge
 * that with any text already in the field (see MicButton).
 *
 * `supported` is false where the API is missing (Firefox, SSR) so callers can hide
 * the affordance entirely rather than offer a button that does nothing.
 */
export function useSpeechInput(
  onResult: (transcript: string, isFinal: boolean) => void,
) {
  const supported = useSyncExternalStore(
    subscribeToNothing,
    isSupportedClient,
    isSupportedServer,
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Keep the latest callback without re-subscribing the recognition handlers.
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    recognitionRef.current?.abort();

    const rec = new Ctor();
    rec.lang =
      (typeof navigator !== "undefined" && navigator.language) || "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let transcript = "";
      let isFinal = false;
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
        if (e.results[i].isFinal) isFinal = true;
      }
      onResultRef.current(transcript.trim(), isFinal);
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  // Stop any in-flight session if the input unmounts mid-utterance.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, toggle };
}
