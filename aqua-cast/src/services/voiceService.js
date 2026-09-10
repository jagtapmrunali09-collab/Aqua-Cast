/**
 * voiceService.js
 * Multilingual AI Voice Navigation Assistant — English, Hindi, and
 * Marathi — for hands-free flood advisories while driving or walking
 * in heavy monsoon rain.
 *
 * ZERO EXTERNAL COST: this uses only the browser's native Web Speech
 * API (`window.speechSynthesis`) — no paid TTS service, no API key, no
 * network call. That also means voice quality depends on whatever
 * language voices the user's OS/browser ships with; see
 * `getBestVoiceForLang` below for how we pick the best available match
 * and fail gracefully when a language voice isn't installed.
 *
 * RESILIENCE CONTRACT: every function in this module is safe to call
 * on any browser, muted device, or missing-voice configuration. Nothing
 * here ever throws past this module or interrupts the simulation loop
 * — worst case, `isSpeechSupported()` is false and the UI simply hides
 * voice controls, or `speakText` silently no-ops via its onError callback.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', label: 'English', nativeLabel: 'English' },
  { code: 'hi-IN', label: 'Hindi', nativeLabel: 'हिंदी' },
  { code: 'mr-IN', label: 'Marathi', nativeLabel: 'मराठी' },
];

const SPEECH_RATE = 0.92; // slightly slower than natural pace for clarity in emergency/rain conditions

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

// Many browsers (notably Chrome) load the installed voice list
// ASYNCHRONOUSLY — getVoices() can return an empty array on the very
// first call after page load. We listen for the 'voiceschanged' event
// once and cache the result so the very first spoken advisory still
// gets a proper language-matched voice instead of silently falling
// back to the browser's default.
let cachedVoices = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

/**
 * Picks the best installed voice for a language code, falling back
 * through progressively looser matches so the assistant still speaks
 * SOMETHING intelligible even on a device that only ships a generic
 * English voice (very common for hi-IN/mr-IN on many browsers today).
 *   1. Exact lang match (e.g. "hi-IN")
 *   2. Same base language, any region (e.g. "hi-*")
 *   3. null — let the browser pick its own default voice for the
 *      utterance's lang attribute, which most engines handle reasonably
 */
function getBestVoiceForLang(langCode) {
  if (!isSpeechSupported()) return null;
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const exact = voices.find((v) => v.lang === langCode);
  if (exact) return exact;

  const base = langCode.split('-')[0];
  const sameBase = voices.find((v) => v.lang?.toLowerCase().startsWith(base));
  return sameBase ?? null;
}

/**
 * Cancels any in-flight speech and speaks new text. Safe to call
 * rapidly (e.g. user taps multiple map markers in a row) — always
 * cancels first, so utterances never queue up and talk over each other.
 *
 * @param {string} text
 * @param {string} lang - one of SUPPORTED_LANGUAGES codes
 * @param {() => void} [onEnd]
 * @param {(err: Error) => void} [onError]
 */
export function speakText(text, lang = 'en-IN', onEnd, onError) {
  if (!isSpeechSupported()) {
    onError?.(new Error('Speech synthesis is not supported in this browser.'));
    return;
  }
  if (!text) {
    onError?.(new Error('No advisory text to speak.'));
    return;
  }

  try {
    // Always cancel first — prevents overlapping/queued speech when the
    // user taps several nodes in quick succession.
    window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = SPEECH_RATE;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = getBestVoiceForLang(lang);
    if (voice) utterance.voice = voice;

    utterance.onend = () => onEnd?.();
    utterance.onerror = (event) => {
      // Muted device, blocked audio permission, interrupted utterance,
      // or no matching voice installed all land here — never thrown,
      // always routed to the caller's onError so the UI can degrade
      // gracefully (e.g. just show the text instead).
      onError?.(new Error(event?.error ? `Speech error: ${event.error}` : 'Speech playback failed.'));
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error('Unexpected speech synthesis failure.'));
  }
}

export function stopSpeech() {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Cancelling is best-effort cleanup (e.g. on unmount) — never worth
    // surfacing an error for.
  }
}

// ---------------------------------------------------------------------
// Advisory text generation
// ---------------------------------------------------------------------

function classifyDepth(depthCm) {
  if (depthCm >= 25) return 'critical';
  if (depthCm >= 10) return 'caution';
  return 'normal';
}

const ROUTE_TEMPLATES = {
  'en-IN': {
    critical: ({ minutes, distanceKm, blocked }) =>
      `Warning. The flood-safe route to your destination takes approximately ${minutes} minutes, covering ${distanceKm} kilometers. ${blocked} intersection${blocked === 1 ? ' is' : 's are'} currently blocked by deep water and ${blocked === 1 ? 'has' : 'have'} been avoided. Please drive carefully.`,
    caution: ({ minutes, distanceKm }) =>
      `Your route is ${minutes} minutes, covering ${distanceKm} kilometers. Some sections have standing water. Please proceed with caution.`,
    normal: ({ minutes, distanceKm }) =>
      `Your route is clear. Estimated travel time is ${minutes} minutes, covering ${distanceKm} kilometers.`,
    noRoute: 'No safe route could be found to this destination right now. Please choose an alternate destination or wait for conditions to improve.',
  },
  'hi-IN': {
    critical: ({ minutes, distanceKm, blocked }) =>
      `चेतावनी। आपके गंतव्य तक सुरक्षित मार्ग में लगभग ${minutes} मिनट लगेंगे, यह ${distanceKm} किलोमीटर का है। ${blocked} चौराह${blocked === 1 ? 'ा' : 'े'} गहरे पानी के कारण अवरुद्ध ${blocked === 1 ? 'है' : 'हैं'} और उन्हें टाला गया है। कृपया सावधानी से गाड़ी चलाएं।`,
    caution: ({ minutes, distanceKm }) =>
      `आपका मार्ग ${minutes} मिनट का है, यह ${distanceKm} किलोमीटर है। कुछ हिस्सों में पानी भरा हुआ है। कृपया सावधानी से आगे बढ़ें।`,
    normal: ({ minutes, distanceKm }) =>
      `आपका मार्ग साफ है। अनुमानित यात्रा समय ${minutes} मिनट है, यह ${distanceKm} किलोमीटर है।`,
    noRoute: 'अभी इस गंतव्य के लिए कोई सुरक्षित मार्ग नहीं मिला। कृपया कोई अन्य गंतव्य चुनें या स्थिति सुधरने की प्रतीक्षा करें।',
  },
  'mr-IN': {
    critical: ({ minutes, distanceKm, blocked }) =>
      `काळजी घ्या! तुमच्या गंतव्यस्थानाकडे जाणाऱ्या सुरक्षित मार्गाला अंदाजे ${minutes} मिनिटे लागतील, हे अंतर ${distanceKm} किलोमीटर आहे. ${blocked} चौक${blocked === 1 ? '' : 'ी'} खोल पाण्यामुळे बंद ${blocked === 1 ? 'आहे' : 'आहेत'} आणि तो टाळण्यात आला आहे. कृपया काळजीपूर्वक गाडी चालवा.`,
    caution: ({ minutes, distanceKm }) =>
      `तुमचा मार्ग ${minutes} मिनिटांचा आहे, हे अंतर ${distanceKm} किलोमीटर आहे. काही भागांत पाणी साचले आहे. कृपया काळजीपूर्वक पुढे जा.`,
    normal: ({ minutes, distanceKm }) =>
      `तुमचा मार्ग मोकळा आहे. अंदाजित प्रवास वेळ ${minutes} मिनिटे आहे, हे अंतर ${distanceKm} किलोमीटर आहे.`,
    noRoute: 'सध्या या ठिकाणासाठी कोणताही सुरक्षित मार्ग सापडला नाही. कृपया दुसरे गंतव्यस्थान निवडा किंवा परिस्थिती सुधारण्याची प्रतीक्षा करा.',
  },
};

const NODE_TEMPLATES = {
  'en-IN': {
    critical: ({ label, depthCm }) =>
      `Warning. ${label} is predicted to have ${depthCm} centimeters of standing water within the next 3 hours. This is critical, vehicle-stalling depth. Avoid this area.`,
    caution: ({ label, depthCm }) =>
      `${label} is predicted to have ${depthCm} centimeters of standing water within the next 3 hours. Proceed with caution.`,
    normal: ({ label, depthCm }) =>
      `${label} looks safe. Predicted water depth over the next 3 hours is only ${depthCm} centimeters.`,
  },
  'hi-IN': {
    critical: ({ label, depthCm }) =>
      `चेतावनी। ${label} पर अगले 3 घंटों में ${depthCm} सेंटीमीटर पानी भरने की आशंका है। यह गंभीर स्तर है, जिसमें वाहन फंस सकते हैं। इस क्षेत्र से बचें।`,
    caution: ({ label, depthCm }) =>
      `${label} पर अगले 3 घंटों में ${depthCm} सेंटीमीटर पानी भरने की आशंका है। कृपया सावधानी से आगे बढ़ें।`,
    normal: ({ label, depthCm }) =>
      `${label} सुरक्षित प्रतीत होता है। अगले 3 घंटों में अनुमानित जल स्तर केवल ${depthCm} सेंटीमीटर है।`,
  },
  'mr-IN': {
    critical: ({ label, depthCm }) =>
      `काळजी घ्या! पुढील ३ तासांत ${label} या ठिकाणी सुमारे ${depthCm} सेंटीमीटर पाणी साचण्याची शक्यता आहे. ही गंभीर पातळी आहे, वाहने अडकू शकतात. हा परिसर टाळा.`,
    caution: ({ label, depthCm }) =>
      `पुढील ३ तासांत ${label} या ठिकाणी सुमारे ${depthCm} सेंटीमीटर पाणी साचण्याची शक्यता आहे. कृपया काळजीपूर्वक पुढे जा.`,
    normal: ({ label, depthCm }) =>
      `${label} सुरक्षित दिसत आहे. पुढील ३ तासांतील अंदाजित पाण्याची पातळी फक्त ${depthCm} सेंटीमीटर आहे.`,
  },
};

/**
 * Builds a spoken route advisory from a computeRoutes() result
 * (src/lib/routing.js). Prefers the flood-safe route's own numbers —
 * the whole point of the assistant is to speak the SAFE plan, not the
 * naive one — falling back to the standard route only if no flood-safe
 * path exists at all.
 *
 * @param {object} routeResult - the object returned by computeRoutes()
 * @param {string} lang - one of SUPPORTED_LANGUAGES codes
 * @returns {string}
 */
export function generateRouteAdvisory(routeResult, lang = 'en-IN') {
  const templates = ROUTE_TEMPLATES[lang] ?? ROUTE_TEMPLATES['en-IN'];
  const route = routeResult?.floodSafe ?? routeResult?.standard;

  if (!routeResult || !route) return templates.noRoute;

  const minutes = Math.round(route.timeMinutes);
  const distanceKm = (route.distanceM / 1000).toFixed(1);
  const blocked = route.blockedNodes?.length ?? 0;
  const floodedCount = route.floodedNodes?.length ?? 0;

  const severity = blocked > 0 ? 'critical' : floodedCount > 0 ? 'caution' : 'normal';
  return templates[severity]({ minutes, distanceKm, blocked });
}

/**
 * Builds a spoken spot-inspection advisory for a single tapped map
 * marker — a drainage node, a shelter, or a citizen hazard report.
 *
 * @param {{ label: string, depthCm: number }} nodeInfo
 * @param {string} lang - one of SUPPORTED_LANGUAGES codes
 * @returns {string}
 */
export function generateNodeAdvisory(nodeInfo, lang = 'en-IN') {
  const templates = NODE_TEMPLATES[lang] ?? NODE_TEMPLATES['en-IN'];
  const depthCm = Math.max(0, Math.round(nodeInfo?.depthCm ?? 0));
  const label = nodeInfo?.label ?? (lang === 'hi-IN' ? 'यह स्थान' : lang === 'mr-IN' ? 'हे ठिकाण' : 'This location');
  const severity = classifyDepth(depthCm);
  return templates[severity]({ label, depthCm });
}

/**
 * Unified advisory generator matching the requested signature: routes
 * to the node-level advisory when nodeInfo is supplied, otherwise the
 * full route-level advisory.
 *
 * @param {object} routeResult
 * @param {string} lang
 * @param {{ label: string, depthCm: number }} [nodeInfo]
 * @returns {string}
 */
export function generateVoiceAdvisory(routeResult, lang = 'en-IN', nodeInfo = null) {
  if (nodeInfo) return generateNodeAdvisory(nodeInfo, lang);
  return generateRouteAdvisory(routeResult, lang);
}
