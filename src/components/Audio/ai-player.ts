import {
  DEFAULT_TTS_MODEL, READING_LANGUAGE, getSettingsKey, splitSpeechChunks,
  type AudioPosition, type SpeechChunk, type VoiceSettings,
} from "@/lib/audio/speech"

export type ReaderState = {
  currentWordIndex: number
  isSpeaking: boolean
  isPaused: boolean
  isBuffering: boolean
}

type PlayerOptions = {
  getClip: (bookId: string, chunk: SpeechChunk, settings: VoiceSettings, signal: AbortSignal) => Promise<Blob>
  onChange: (state: ReaderState) => void
  onStatus: (message: string) => void
  createAudio?: () => HTMLAudioElement
}

const PREFETCH_LEAD_SECONDS = 15

export class AiAudioPlayer {
  private settings: VoiceSettings = { language: "vi-VN", tone: "warm", voice: "Algenib", model: DEFAULT_TTS_MODEL, rate: 1, volume: 1 }
  private chunks: SpeechChunk[] = []
  private bookId = ""
  private wordIndex = 0
  private desiredPlaying = false
  private hasStarted = false
  private pending = false
  private revision = 0
  private controller: AbortController | null = null
  private prefetched: { index: number; controller: AbortController; promise: Promise<Blob | null> } | null = null
  private position: AudioPosition | undefined
  private active: { audio: HTMLAudioElement; url: string; index: number; settingsKey: string } | null = null

  constructor(private options: PlayerOptions) {}

  private emit() {
    this.options.onChange({
      currentWordIndex: this.wordIndex,
      isSpeaking: this.desiredPlaying,
      isPaused: this.hasStarted && !this.desiredPlaying,
      isBuffering: this.pending,
    })
  }

  private updateProgress() {
    if (!this.active) return
    const { audio, index } = this.active
    const chunk = this.chunks[index]
    if (!chunk || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    const fraction = Math.min(1, Math.max(0, audio.currentTime / audio.duration))
    this.wordIndex = Math.min(chunk.endIndex - 1, chunk.startIndex + Math.floor(fraction * (chunk.endIndex - chunk.startIndex)))
    this.position = { chunkStartWordIndex: chunk.startIndex, seconds: audio.currentTime, settingsKey: this.active.settingsKey }
  }

  getPosition() {
    this.updateProgress()
    return this.position ? { ...this.position } : undefined
  }

  getWordIndex() {
    this.updateProgress()
    return this.wordIndex
  }

  private releaseAudio() {
    if (!this.active) return
    const { audio, url } = this.active
    audio.onended = audio.ontimeupdate = audio.onerror = null
    audio.pause()
    audio.removeAttribute("src")
    audio.load()
    URL.revokeObjectURL(url)
    this.active = null
  }

  private cancelOperation(preservePrefetchIndex?: number) {
    this.revision += 1
    this.controller?.abort()
    this.controller = null
    this.pending = false
    if (this.prefetched && this.prefetched.index !== preservePrefetchIndex) {
      this.prefetched.controller.abort()
      this.prefetched = null
    }
    this.releaseAudio()
  }

  setBook(bookId: string, words: string[], wordIndex = 0, position?: AudioPosition) {
    this.cancelOperation()
    this.bookId = bookId
    this.chunks = splitSpeechChunks(words)
    this.wordIndex = Math.min(words.length, Math.max(0, wordIndex))
    this.position = position
    this.desiredPlaying = false
    this.hasStarted = false
    this.emit()
  }

  setSettings(settings: VoiceSettings) {
    settings = { ...settings, language: READING_LANGUAGE }
    const profileChanged = getSettingsKey(settings) !== getSettingsKey(this.settings)
    if (profileChanged) {
      this.updateProgress()
      const shouldResume = this.desiredPlaying
      this.cancelOperation()
      this.position = undefined
      this.settings = { ...settings }
      if (shouldResume) {
        this.play()
        return
      }
    } else {
      this.settings = { ...settings }
      if (this.active) {
        this.active.audio.playbackRate = settings.rate
        this.active.audio.volume = settings.volume
        this.prefetchNext()
      }
    }
    this.emit()
  }

  private prefetchNext() {
    if (!this.desiredPlaying || this.pending || !this.active) return
    const { audio, index } = this.active
    const nextIndex = index + 1
    if (nextIndex >= this.chunks.length || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    const rate = audio.playbackRate
    if (!Number.isFinite(rate) || rate <= 0) return
    const remaining = (audio.duration - audio.currentTime) / rate
    const lead = Math.min(PREFETCH_LEAD_SECONDS, audio.duration / rate / 2)
    if (remaining > lead || this.prefetched?.index === nextIndex) return

    this.prefetched?.controller.abort()
    const controller = new AbortController()
    // Keep just one lookahead request, including failures, until playback advances.
    const promise = this.options.getClip(this.bookId, this.chunks[nextIndex], { ...this.settings }, controller.signal)
      .then((blob) => controller.signal.aborted ? null : blob)
      .catch(() => null)
    this.prefetched = { index: nextIndex, controller, promise }
  }

  private async getChunkBlob(index: number, settings: VoiceSettings, signal: AbortSignal) {
    const prefetched = this.prefetched
    if (prefetched?.index === index) {
      const abort = () => prefetched.controller.abort()
      signal.addEventListener("abort", abort, { once: true })
      try {
        const blob = await prefetched.promise
        signal.throwIfAborted()
        if (blob) return blob
      } finally {
        signal.removeEventListener("abort", abort)
        if (this.prefetched === prefetched) this.prefetched = null
      }
    }
    return this.options.getClip(this.bookId, this.chunks[index], settings, signal)
  }

  private async prepareChunk(index: number, revision: number, signal: AbortSignal) {
    const settings = { ...this.settings }
    const blob = await this.getChunkBlob(index, settings, signal)
    signal.throwIfAborted()
    if (revision !== this.revision) throw new DOMException("Canceled", "AbortError")
    this.releaseAudio()
    const url = URL.createObjectURL(blob)
    const audio = this.options.createAudio?.() ?? new Audio()
    audio.preload = "auto"
    audio.playbackRate = settings.rate
    audio.volume = settings.volume
    this.active = { audio, url, index, settingsKey: getSettingsKey(settings) }
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        audio.removeEventListener("loadedmetadata", loaded)
        audio.removeEventListener("error", failed)
        signal.removeEventListener("abort", aborted)
      }
      const loaded = () => {
        cleanup()
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) reject(new Error("Audio không có thời lượng hợp lệ."))
        else resolve()
      }
      const failed = () => { cleanup(); reject(new Error("Trình duyệt không phát được audio này.")) }
      const aborted = () => { cleanup(); reject(new DOMException("Canceled", "AbortError")) }
      const timer = setTimeout(failed, 15000)
      audio.addEventListener("loadedmetadata", loaded)
      audio.addEventListener("error", failed)
      signal.addEventListener("abort", aborted, { once: true })
      audio.src = url
      audio.load()
    })
    signal.throwIfAborted()
    audio.playbackRate = this.settings.rate
    audio.volume = this.settings.volume
    return audio
  }

  private async playActive() {
    if (!this.active || !this.desiredPlaying) return
    const active = this.active
    const revision = this.revision
    try {
      await active.audio.play()
      if (revision !== this.revision || !this.desiredPlaying) active.audio.pause()
      else this.prefetchNext()
    } catch {
      if (revision !== this.revision || !this.desiredPlaying) return
      this.desiredPlaying = false
      this.options.onStatus("Chưa phát được audio. Nhấn Tiếp tục để thử lại.")
      this.emit()
    }
  }

  private move(index: number, seconds: number, fraction?: number) {
    const preserveIndex = fraction === undefined && this.active?.index === index && seconds >= this.active.audio.duration
      ? index + 1 : index
    this.cancelOperation(preserveIndex)
    const revision = this.revision
    const controller = new AbortController()
    this.controller = controller
    this.pending = true
    this.hasStarted = true
    this.options.onStatus("Đang chuẩn bị giọng đọc AI...")
    this.emit()
    void this.finishMove(index, seconds, fraction, revision, controller.signal)
  }

  private async finishMove(index: number, seconds: number, fraction: number | undefined, revision: number, signal: AbortSignal) {
    try {
      let audio = await this.prepareChunk(index, revision, signal)
      if (fraction !== undefined) seconds += fraction * audio.duration
      // Load adjacent clips only when the requested seek crosses their boundaries.
      while (seconds < 0 && index > 0) {
        index -= 1
        audio = await this.prepareChunk(index, revision, signal)
        seconds += audio.duration
      }
      while (seconds >= audio.duration && index < this.chunks.length - 1) {
        seconds -= audio.duration
        index += 1
        audio = await this.prepareChunk(index, revision, signal)
      }
      signal.throwIfAborted()
      if (revision !== this.revision) return
      audio.currentTime = Math.max(0, Math.min(seconds, audio.duration))
      this.pending = false
      this.updateProgress()
      audio.ontimeupdate = () => {
        if (revision !== this.revision) return
        this.updateProgress()
        this.prefetchNext()
        this.emit()
      }
      audio.onerror = () => {
        if (revision !== this.revision) return
        this.desiredPlaying = false
        this.options.onStatus("Không phát được audio. Nhấn Tiếp tục để thử lại.")
        this.emit()
      }
      audio.onended = () => {
        if (revision !== this.revision || !this.desiredPlaying) return
        if (index + 1 < this.chunks.length) {
          this.wordIndex = this.chunks[index].endIndex
          this.position = { chunkStartWordIndex: this.chunks[index + 1].startIndex, seconds: 0, settingsKey: getSettingsKey(this.settings) }
          this.move(index + 1, 0)
        } else {
          this.wordIndex = this.chunks[index].endIndex
          this.position = undefined
          this.desiredPlaying = false
          this.hasStarted = false
          this.releaseAudio()
          this.options.onStatus("Đã đọc xong truyện.")
          this.emit()
        }
      }
      this.options.onStatus(this.desiredPlaying ? "Đang đọc bằng giọng AI." : "Đã tạm dừng.")
      this.emit()
      await this.playActive()
    } catch (error) {
      if (revision !== this.revision || signal.aborted) return
      this.pending = false
      this.desiredPlaying = false
      this.releaseAudio()
      this.options.onStatus(error instanceof Error ? error.message : "Không tạo được giọng đọc AI.")
      this.emit()
    }
  }

  play() {
    if (!this.chunks.length) return
    this.desiredPlaying = true
    this.hasStarted = true
    if (this.pending) {
      this.emit()
      return
    }
    if (this.active) {
      this.emit()
      void this.playActive()
      return
    }
    const saved = this.position
    const savedIndex = saved?.settingsKey === getSettingsKey(this.settings)
      ? this.chunks.findIndex((chunk) => chunk.startIndex === saved.chunkStartWordIndex)
      : -1
    if (saved && savedIndex >= 0 && Number.isFinite(saved.seconds) && saved.seconds >= 0) {
      this.move(savedIndex, saved.seconds)
    } else {
      let index = this.chunks.findIndex((chunk) => this.wordIndex < chunk.endIndex)
      if (index < 0) { index = 0; this.wordIndex = 0 }
      const chunk = this.chunks[index]
      const fraction = Math.max(0, (this.wordIndex - chunk.startIndex) / (chunk.endIndex - chunk.startIndex))
      this.move(index, 0, fraction)
    }
  }

  pause() {
    this.desiredPlaying = false
    this.active?.audio.pause()
    this.updateProgress()
    this.options.onStatus("Đã tạm dừng.")
    this.emit()
  }

  stop() {
    this.updateProgress()
    this.cancelOperation()
    this.desiredPlaying = false
    this.hasStarted = false
    this.emit()
  }

  seek(seconds: number) {
    if (!this.chunks.length || this.pending) return
    this.updateProgress()
    const saved = this.position
    const index = saved?.settingsKey === getSettingsKey(this.settings)
      ? this.chunks.findIndex((chunk) => chunk.startIndex === saved.chunkStartWordIndex)
      : -1
    if (saved && index >= 0) {
      const target = saved.seconds + seconds
      const audio = this.active?.audio
      if (audio && target >= 0 && target < audio.duration) {
        audio.currentTime = target
        this.updateProgress()
        this.prefetchNext()
        this.emit()
      } else {
        this.move(index, target)
      }
    } else {
      let chunkIndex = this.chunks.findIndex((chunk) => this.wordIndex < chunk.endIndex)
      if (chunkIndex < 0) chunkIndex = this.chunks.length - 1
      const chunk = this.chunks[chunkIndex]
      this.move(chunkIndex, seconds, Math.min(1, Math.max(0, (this.wordIndex - chunk.startIndex) / (chunk.endIndex - chunk.startIndex))))
    }
  }

  dispose() {
    this.updateProgress()
    this.cancelOperation()
    this.desiredPlaying = false
  }
}
