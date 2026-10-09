import { READING_LANGUAGE, splitSpeechChunks, type SpeechChunk, type VoiceSettings } from "@/lib/audio/speech"
import type { ReaderState } from "./ai-player"

type BrowserPlayerOptions = {
  onChange: (state: ReaderState) => void
  onStatus: (message: string) => void
  synthesis?: SpeechSynthesis
  createUtterance?: (text: string) => SpeechSynthesisUtterance
  now?: () => number
}

export class BrowserSpeechPlayer {
  private synthesis: SpeechSynthesis | undefined
  private words: string[] = []
  private chunks: SpeechChunk[] = []
  private wordIndex = 0
  private rate = 1
  private volume = 1
  private desiredPlaying = false
  private hasStarted = false
  private pending = false
  private revision = 0
  private active: SpeechSynthesisUtterance | null = null
  private timer: ReturnType<typeof setInterval> | undefined
  private cancelVoiceWait: (() => void) | undefined
  private anchorIndex = 0
  private anchorTime = 0
  private startedAt: number | undefined
  private elapsed = 0
  private wordsPerSecond = 3
  private chunkEnd = 0

  constructor(private options: BrowserPlayerOptions) {
    this.synthesis = options.synthesis ?? (typeof window !== "undefined" ? window.speechSynthesis : undefined)
  }

  private now() { return this.options.now?.() ?? performance.now() }

  private emit() {
    this.options.onChange({ currentWordIndex: this.wordIndex, isSpeaking: this.desiredPlaying, isPaused: this.hasStarted && !this.desiredPlaying, isBuffering: this.pending })
  }

  private readingTime() {
    return this.elapsed + (this.startedAt === undefined ? 0 : (this.now() - this.startedAt) / 1000)
  }

  private updateProgress() {
    if (!this.active || this.startedAt === undefined) return
    const estimate = this.anchorIndex + Math.floor(Math.max(0, this.readingTime() - this.anchorTime) * this.wordsPerSecond * this.rate)
    this.wordIndex = Math.min(this.chunkEnd - 1, Math.max(this.wordIndex, estimate))
  }

  private startClock() {
    this.startedAt = this.now()
    clearInterval(this.timer)
    this.timer = setInterval(() => { this.updateProgress(); this.emit() }, 250)
  }

  private freezeClock() {
    this.updateProgress()
    this.elapsed = this.readingTime()
    this.startedAt = undefined
    clearInterval(this.timer)
    this.timer = undefined
  }

  private cancel() {
    this.revision += 1
    this.cancelVoiceWait?.()
    this.cancelVoiceWait = undefined
    this.pending = false
    this.freezeClock()
    if (this.active) {
      this.active.onstart = this.active.onend = this.active.onerror = this.active.onboundary = null
      this.active = null
      this.synthesis?.cancel()
    }
  }

  setBook(_bookId: string, words: string[], wordIndex = 0) {
    this.cancel()
    this.words = words
    const chunkLimit = words.reduce((limit, word) => Math.max(limit, word.length), 400)
    this.chunks = splitSpeechChunks(words, chunkLimit)
    this.wordIndex = Math.min(words.length, Math.max(0, wordIndex))
    this.wordsPerSecond = 3
    this.desiredPlaying = false
    this.hasStarted = false
    this.emit()
  }

  setSettings(settings: Pick<VoiceSettings, "rate" | "volume">) {
    if (this.rate === settings.rate && this.volume === settings.volume) return
    const shouldResume = this.desiredPlaying
    this.updateProgress()
    this.cancel()
    this.rate = settings.rate
    this.volume = settings.volume
    if (shouldResume) this.play()
    else this.emit()
  }

  private speak(voice: SpeechSynthesisVoice) {
    if (!this.synthesis || !this.desiredPlaying) return
    const chunk = this.chunks.find((item) => this.wordIndex < item.endIndex)
    if (!chunk) return
    const start = this.wordIndex
    const textWords = this.words.slice(start, chunk.endIndex)
    const offsets: number[] = []
    let offset = 0
    for (const word of textWords) { offsets.push(offset); offset += word.length + 1 }
    const utterance = this.options.createUtterance?.(textWords.join(" ")) ?? new SpeechSynthesisUtterance(textWords.join(" "))
    const revision = this.revision
    utterance.lang = READING_LANGUAGE
    utterance.voice = voice
    utterance.rate = this.rate
    utterance.volume = this.volume
    this.active = utterance
    this.chunkEnd = chunk.endIndex
    this.anchorIndex = start
    this.anchorTime = this.elapsed = 0
    this.startedAt = undefined
    this.pending = true
    utterance.onstart = () => {
      if (revision !== this.revision) return
      this.pending = false
      if (this.desiredPlaying) this.startClock()
      else this.synthesis?.pause()
      this.emit()
    }
    utterance.onboundary = (event) => {
      if (revision !== this.revision || !this.desiredPlaying) return
      let index = 0
      while (index + 1 < offsets.length && offsets[index + 1] <= event.charIndex) index += 1
      const nextIndex = start + index
      const elapsed = this.readingTime()
      const delta = nextIndex - this.anchorIndex
      if (delta > 0 && elapsed > this.anchorTime + 0.1) {
        this.wordsPerSecond = Math.min(8, Math.max(0.5, delta / (elapsed - this.anchorTime) / this.rate))
      }
      this.wordIndex = this.anchorIndex = nextIndex
      this.anchorTime = elapsed
      this.emit()
    }
    utterance.onend = () => {
      if (revision !== this.revision) return
      this.freezeClock()
      this.active = null
      this.pending = false
      this.wordIndex = chunk.endIndex
      if (this.wordIndex === this.words.length) {
        this.desiredPlaying = this.hasStarted = false
        this.options.onStatus("Đã đọc xong truyện.")
      } else if (this.desiredPlaying) {
        this.play()
        return
      }
      this.emit()
    }
    utterance.onerror = () => {
      if (revision !== this.revision) return
      this.cancel()
      this.desiredPlaying = false
      this.options.onStatus("Không phát được giọng tiếng Việt của trình duyệt. Thử lại hoặc chọn giọng AI.")
      this.emit()
    }
    try {
      this.synthesis.resume()
      this.synthesis.speak(utterance)
    } catch {
      this.cancel()
      this.desiredPlaying = false
      this.options.onStatus("Không phát được giọng tiếng Việt của trình duyệt. Thử lại hoặc chọn giọng AI.")
      this.emit()
      return
    }
    this.options.onStatus("Đang đọc bằng giọng trình duyệt.")
    this.emit()
  }

  private chooseVoice() {
    if (!this.synthesis) return
    const voices = this.synthesis.getVoices()
    const vietnamese = voices.filter((voice) => /^vi(?:[-_]|$)/i.test(voice.lang))
    const voice = vietnamese.find((item) => item.default) ?? vietnamese.find((item) => item.localService) ?? vietnamese[0]
    if (voice) {
      this.cancelVoiceWait?.()
      this.cancelVoiceWait = undefined
      this.speak(voice)
      return
    }
    const fail = () => {
      this.cancelVoiceWait?.()
      this.cancelVoiceWait = undefined
      this.pending = this.desiredPlaying = false
      this.options.onStatus("Trình duyệt chưa có giọng tiếng Việt. Cài giọng tiếng Việt trên thiết bị hoặc chọn giọng AI.")
      this.emit()
    }
    if (voices.length) { fail(); return }
    if (this.cancelVoiceWait) return
    this.pending = true
    const changed = () => this.chooseVoice()
    const timeout = setTimeout(fail, 5000)
    this.synthesis.addEventListener("voiceschanged", changed)
    this.cancelVoiceWait = () => {
      clearTimeout(timeout)
      this.synthesis?.removeEventListener("voiceschanged", changed)
    }
    this.options.onStatus("Đang tải giọng tiếng Việt của trình duyệt...")
    this.emit()
  }

  play() {
    if (!this.words.length) return
    if (!this.synthesis) { this.options.onStatus("Trình duyệt này không hỗ trợ đọc văn bản. Chọn giọng AI để đọc."); return }
    this.desiredPlaying = this.hasStarted = true
    if (this.active) {
      this.synthesis.resume()
      if (!this.pending && this.startedAt === undefined) this.startClock()
      this.options.onStatus("Đang đọc bằng giọng trình duyệt.")
      this.emit()
      return
    }
    if (this.wordIndex >= this.words.length) this.wordIndex = 0
    this.chooseVoice()
  }

  pause() {
    this.freezeClock()
    this.desiredPlaying = false
    this.synthesis?.pause()
    if (this.cancelVoiceWait) {
      this.cancelVoiceWait()
      this.cancelVoiceWait = undefined
      this.pending = false
    }
    this.options.onStatus("Đã tạm dừng.")
    this.emit()
  }

  stop() {
    this.cancel()
    this.desiredPlaying = this.hasStarted = false
    this.emit()
  }

  seek(seconds: number) {
    if (!this.words.length) return
    this.updateProgress()
    const target = this.wordIndex + Math.round(seconds * this.wordsPerSecond * this.rate)
    this.cancel()
    this.wordIndex = Math.min(this.words.length - 1, Math.max(0, target))
    this.hasStarted = true
    if (this.desiredPlaying) this.play()
    else this.emit()
  }

  getWordIndex() { this.updateProgress(); return this.wordIndex }
  getPosition() { return undefined }
  dispose() { this.cancel(); this.desiredPlaying = false }
}
