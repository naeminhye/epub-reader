type SpeakOptions = {
  lang?: string;          // explicit override (e.g. 'en-US', 'ko-KR')
  bookLang?: string;      // language from currentBook (e.g. 'en-US', 'ko-KR')
  rate?: number;          // Speech speed (0.5 - 2)
  pitch?: number;         // Voice pitch (0 - 2)
  volume?: number;        // Volume (0 - 1)
  voiceName?: string;     // Optional specific voice name
  splitBySentence?: boolean; // Whether to split text into sentences
};

let queue: SpeechSynthesisUtterance[] = [];
let speaking = false;

// Detect language based on character patterns
export function detectLang(text: string): string {
  const t = text.trim();
  if (!t) return 'en-US';

  if (/[가-힣]/.test(t)) return 'ko-KR'; // Korean
  if (/[ăâđêôơưĂÂĐÊÔƠƯà-ỹÀ-Ỹ]/.test(t)) return 'vi-VN'; // Vietnamese
  if (/[ぁ-んァ-ン一-龯]/.test(t)) return 'ja-JP'; // Japanese
  if (/[\u4e00-\u9fff]/.test(t)) return 'zh-CN'; // Chinese
  if (/[a-zA-Z]/.test(t)) return 'en-US'; // English

  return 'en-US';
}

// Select the most appropriate voice
function pickVoice(lang: string, voiceName?: string) {
  const voices = window.speechSynthesis.getVoices();

  // Try exact voice name match first
  if (voiceName) {
    const v = voices.find(v => v.name === voiceName);
    if (v) return v;
  }

  // Try exact language match, then fallback to partial match
  return (
    voices.find(v => v.lang === lang) ||
    voices.find(v => v.lang.startsWith(lang.split('-')[0])) ||
    voices[0]
  );
}

// Split text into sentences for smoother playback
function splitSentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?。！？])\s+/);
}

function normalizeLang(lang?: string): string | undefined {
  if (!lang) return;

  const map: Record<string, string> = {
    en: 'en-US',
    ko: 'ko-KR',
    vi: 'vi-VN',
    ja: 'ja-JP',
    zh: 'zh-CN',
  };

  return map[lang] || lang;
}

// Resolve final language
function resolveLang(text: string, opts: SpeakOptions) {
  // 1. explicit lang (highest priority)
  if (opts.lang) return opts.lang;

  // 2. book language
  const normalizedBookLang = normalizeLang(opts.bookLang);
  if (normalizedBookLang) return normalizedBookLang;

  // 3. fallback detect
  return detectLang(text);
}

// Main function to speak text
export function speakText(text: string, opts: SpeakOptions = {}) {
  if (!('speechSynthesis' in window)) return;

  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return;

  stopSpeak();

  const lang = resolveLang(clean, opts);

  const parts = opts.splitBySentence
    ? splitSentences(clean)
    : [clean];

  queue = parts.map(part => {
    const u = new SpeechSynthesisUtterance(part);
    u.lang = lang;
    u.rate = opts.rate ?? 1;
    u.pitch = opts.pitch ?? 1;
    u.volume = opts.volume ?? 1;
    u.voice = pickVoice(lang, opts.voiceName);
    return u;
  });

  speaking = true;
  speakNext();
}

// Internal function to process the queue
function speakNext() {
  if (!queue.length) {
    speaking = false;
    return;
  }

  const utterance = queue.shift()!;
  utterance.onend = speakNext;

  window.speechSynthesis.speak(utterance);
}

// Pause current speech
export function pauseSpeak() {
  window.speechSynthesis.pause();
}

// Resume paused speech
export function resumeSpeak() {
  window.speechSynthesis.resume();
}

// Stop all speech and clear queue
export function stopSpeak() {
  queue = [];
  speaking = false;
  window.speechSynthesis.cancel();
}

// Check if currently speaking
export function isSpeaking() {
  return speaking || window.speechSynthesis.speaking;
}