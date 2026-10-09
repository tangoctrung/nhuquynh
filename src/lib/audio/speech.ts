export const READING_LANGUAGE = "vi-VN" as const
export type ReadingLanguage = typeof READING_LANGUAGE
export type VoiceTone = "warm" | "clear"
export const AI_VOICES = ["Algenib", "Sulafat", "Gacrux", "Orus", "Iapetus"] as const
export type AiVoice = (typeof AI_VOICES)[number]
export const AI_VOICE_LABELS: Record<AiVoice, string> = {
  Algenib: "Algenib - Khàn nhẹ",
  Sulafat: "Sulafat - Ấm áp",
  Gacrux: "Gacrux - Trưởng thành",
  Orus: "Orus - Chắc giọng",
  Iapetus: "Iapetus - Rõ ràng",
}
export const GEMINI_TTS_MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"] as const
export type GeminiTtsModel = (typeof GEMINI_TTS_MODELS)[number]
export const DEFAULT_TTS_MODEL: GeminiTtsModel = GEMINI_TTS_MODELS[0]
export const MAX_SPEECH_CHARS = 1200
export const SPEECH_CACHE_VERSION = "gemini-story-v2"
export type ReaderMode = "browser" | "ai"

export type VoiceSettings = {
  language: ReadingLanguage
  tone: VoiceTone
  voice: AiVoice
  model: GeminiTtsModel
  rate: number
  volume: number
}

export type AudioPosition = {
  chunkStartWordIndex: number
  seconds: number
  settingsKey: string
}

export type SpeechChunk = { text: string; startIndex: number; endIndex: number }

export function getSettingsKey(settings: Pick<VoiceSettings, "language" | "tone" | "voice" | "model">) {
  return JSON.stringify([SPEECH_CACHE_VERSION, settings.model, settings.language, settings.tone, settings.voice])
}

export function splitSpeechChunks(words: string[], maxChars = MAX_SPEECH_CHARS): SpeechChunk[] {
  const chunks: SpeechChunk[] = []
  let startIndex = 0
  while (startIndex < words.length) {
    let endIndex = startIndex
    let length = 0
    while (endIndex < words.length) {
      const nextLength = length + words[endIndex].length + (endIndex > startIndex ? 1 : 0)
      if (nextLength > maxChars) {
        if (endIndex === startIndex) throw new Error("PDF có một từ quá dài để tạo giọng đọc.")
        break
      }
      length = nextLength
      endIndex += 1
      if (length >= Math.min(500, maxChars / 2) && /[.!?。][\"')\]]*$/.test(words[endIndex - 1])) break
    }
    chunks.push({ text: words.slice(startIndex, endIndex).join(" "), startIndex, endIndex })
    startIndex = endIndex
  }
  return chunks
}

export function getSpeechInstructions(tone: VoiceTone) {
  const pronunciation = "Read in natural Vietnamese with accurate Vietnamese tones and clear native pronunciation."
  const delivery = tone === "warm"
    ? "Use a distinctly deep, low-register, warm and resonant Vietnamese storyteller voice with a mysterious, haunting and subtly eerie atmosphere. Keep the narration intimate, calm and softly suspenseful, with gentle breath and deliberate pauses at punctuation. Maintain clear Vietnamese tones and intelligible words. Avoid shouting, jump scares, sound effects, exaggerated acting, or a bright, thin or robotic sound."
    : "Use a clear, focused audiobook narration voice with crisp articulation, an even natural pace and precise pronunciation. Keep expression natural and pause at punctuation."
  return `${pronunciation} ${delivery} Read only the supplied text, exactly as written. Do not translate, summarize, add an introduction, or read these instructions aloud.`
}
