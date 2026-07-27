const DARK_WORDS = new Set([
  'dark', 'darkness', 'dying', 'die', 'dead', 'death', 'storm', 'stormy',
  'moody', 'depression', 'depressed', 'sad', 'sadness', 'broken', 'lost',
  'alone', 'lonely', 'pain', 'hurt', 'hollow', 'empty', 'void', 'shadow',
  'shadows', 'fear', 'hate', 'hatred', 'cold', 'numb', 'cry', 'crying',
  'tears', 'tear', 'fallen', 'heavy', 'chaos', 'rage', 'destroy', 'destroyed',
  'burn', 'burning', 'fade', 'fading', 'scream', 'screaming', 'wound',
  'wounded', 'war', 'battle', 'blood', 'bleed', 'bleeding', 'black',
  'nightmare', 'ghost', 'haunted', 'hopeless', 'helpless', 'shattered',
  'bleak', 'grim', 'dread', 'horror', 'despair', 'misery', 'anguish',
  'torment', 'violent', 'violence', 'silent', 'silence', 'ruin', 'ruined',
  'suffocate', 'suffocating', 'trapped', 'sink', 'sinking', 'drown',
  'drowning', 'falling', 'fall', 'collapse', 'collapsing', 'disturbed',
  'disturb', 'disturbing', 'boom', 'crash', 'crashing', 'break', 'breaking',
]);

const LIGHT_WORDS = new Set([
  'sunshine', 'sun', 'sunny', 'light', 'happy', 'happiness', 'joy', 'joyful',
  'friends', 'friend', 'family', 'love', 'loving', 'hope', 'hopeful', 'smile',
  'smiling', 'bright', 'warm', 'warmth', 'bloom', 'flower', 'flowers',
  'beautiful', 'beauty', 'peace', 'peaceful', 'free', 'freedom', 'dance',
  'dancing', 'fly', 'flying', 'glow', 'glowing', 'golden', 'sweet', 'alive',
  'together', 'dream', 'dreaming', 'float', 'floating', 'gentle', 'rise',
  'rising', 'sing', 'singing', 'birds', 'bird', 'bees', 'bee', 'spring',
  'morning', 'sky', 'heart', 'laugh', 'laughing', 'laughter', 'grace',
  'magical', 'magic', 'wonder', 'wonderful', 'amazing', 'fantastic', 'walking',
  'walk', 'breathe', 'breathing', 'life', 'live', 'living', 'touch', 'touched',
  'sparkle', 'sparkling', 'shine', 'shining', 'soft', 'softly', 'gentle',
  'gently', 'flutter', 'floating', 'soar', 'soaring', 'celebrate',
  'celebration', 'good', 'great', 'better', 'positive', 'uplift', 'uplifting',
]);

let _recognition = null;
let _onMood = null;
let _lastDarkTrigger = 0;
let _lastLightTrigger = 0;
const COOLDOWN = 2000;

export function setOnMood(fn) { _onMood = fn; }

export function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return false;

  _recognition = new SR();
  _recognition.continuous = true;
  _recognition.interimResults = true;
  _recognition.lang = 'en-US';
  _recognition.maxAlternatives = 1;

  _recognition.onresult = _onResult;
  _recognition.onend = _restart;
  _recognition.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    console.warn('speech error:', e.error);
  };

  _restart();
  return true;
}

function _restart() {
  try { _recognition.start(); } catch (_) {}
}

function _onResult(event) {
  const now = performance.now();

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript.toLowerCase();
    const words = transcript.split(/\s+/);

    for (const raw of words) {
      const word = raw.replace(/[^a-z]/g, '');
      if (!word) continue;

      if (DARK_WORDS.has(word) && now - _lastDarkTrigger > COOLDOWN) {
        _lastDarkTrigger = now;
        if (_onMood) _onMood({ mood: 'dark', word });
        return;
      }
      if (LIGHT_WORDS.has(word) && now - _lastLightTrigger > COOLDOWN) {
        _lastLightTrigger = now;
        if (_onMood) _onMood({ mood: 'light', word });
        return;
      }
    }
  }
}
