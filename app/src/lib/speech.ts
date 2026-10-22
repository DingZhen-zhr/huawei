export interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  const win = window as SpeechWindow;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}
