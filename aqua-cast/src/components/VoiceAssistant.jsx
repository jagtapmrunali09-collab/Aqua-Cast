import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Languages } from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  isSpeechSupported,
  speakText,
  stopSpeech,
  generateVoiceAdvisory,
} from '../services/voiceService.js';

const LANG_STORAGE_KEY = 'aqua-cast-voice-lang';

function getInitialLang() {
  if (typeof window === 'undefined') return 'en-IN';
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return SUPPORTED_LANGUAGES.some((l) => l.code === stored) ? stored : 'en-IN';
}

/**
 * Persistent, hands-free voice navigation control. Mounted once in
 * TopBar for screen-wide use (speaks the current route advisory), and
 * its `speak` behavior is also reused directly by MapPanel for
 * per-marker spot advisories via the shared voiceService module — this
 * component itself only owns the language preference and the
 * play/stop toggle UI.
 */
export default function VoiceAssistant({ routeResult = null }) {
  const [lang, setLang] = useState(getInitialLang);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    setSupported(isSpeechSupported());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, [lang]);

  // Automatic cleanup on unmount — never leave a spoken advisory
  // running after the component (or the whole app) goes away.
  useEffect(() => {
    return () => stopSpeech();
  }, []);

  const handleToggle = () => {
    if (!supported) return;

    if (speaking) {
      stopSpeech();
      setSpeaking(false);
      return;
    }

    const text = generateVoiceAdvisory(routeResult, lang);
    setErrorMessage(null);
    setSpeaking(true);
    speakText(
      text,
      lang,
      () => setSpeaking(false),
      (err) => {
        setSpeaking(false);
        setErrorMessage(err.message);
      }
    );
  };

  if (!supported) {
    return (
      <div
        className="flex items-center gap-1.5 rounded border border-hairline-strong dark:border-slate-700 px-2 py-1 text-[11px] text-ink-faint dark:text-slate-500"
        title="Voice navigation isn't supported in this browser"
      >
        <VolumeX className="h-3.5 w-3.5" />
        Voice N/A
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor="voice-lang-select">
        Voice advisory language
      </label>
      <div className="flex items-center gap-1 rounded border border-hairline-strong dark:border-slate-700 px-1.5 py-1">
        <Languages className="h-3 w-3 text-ink-faint dark:text-slate-500" />
        <select
          id="voice-lang-select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="bg-transparent text-[11px] font-medium text-ink-muted dark:text-slate-400 focus:outline-none"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeLabel}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleToggle}
        className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors ${
          speaking
            ? 'border-water-500 bg-water-50 text-water-600 dark:bg-water-500/20 dark:text-water-300'
            : 'border-hairline-strong dark:border-slate-700 text-ink-muted dark:text-slate-400 hover:border-water-500 hover:text-water-600 dark:hover:text-water-300'
        }`}
        aria-label={speaking ? 'Stop voice advisory' : 'Play voice advisory'}
        title={speaking ? 'Stop voice advisory' : 'Play voice advisory'}
      >
        {speaking && (
          <span className="absolute inset-0 -z-10 animate-ping rounded border border-water-400 opacity-60" />
        )}
        {speaking ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      </button>

      {errorMessage && (
        <span className="hidden max-w-[140px] truncate text-[10px] text-risk-caution sm:inline" title={errorMessage}>
          {errorMessage}
        </span>
      )}
    </div>
  );
}

/**
 * Exported so other components (e.g. MapPanel, for tap-to-speak on a
 * marker) can trigger the exact same speak/cancel behavior without
 * re-implementing it, while still reading the user's persisted
 * language preference.
 */
export function speakNodeAdvisory(nodeInfo, lang, { onStart, onEnd, onError } = {}) {
  if (!isSpeechSupported()) {
    onError?.(new Error('Speech synthesis is not supported in this browser.'));
    return;
  }
  const text = generateVoiceAdvisory(null, lang, nodeInfo);
  onStart?.();
  speakText(text, lang, onEnd, onError);
}

export function getPersistedVoiceLang() {
  return getInitialLang();
}
