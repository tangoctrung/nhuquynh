"use client"

import { Icon } from "@iconify/react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DEFAULT_TTS_MODEL, GEMINI_TTS_MODELS, READING_LANGUAGE, type AudioPosition, type GeminiTtsModel, type ReaderMode } from "@/lib/audio/speech"
import { getBookText, removeBookText, saveBookText } from "./storage"
import { useAiReader } from "./useAiReader"
import { useBrowserReader } from "./useBrowserReader"

type BookHistory = {
  id: string
  title: string
  sourceLabel: string
  sourceType: "file" | "url"
  currentWordIndex: number
  totalWords: number
  updatedAt: string
  audioPosition?: AudioPosition
}

type PdfModule = {
  GlobalWorkerOptions: {
    workerSrc: string
  }
  getDocument: (source: { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{
          items: Array<{ str?: string }>
        }>
      }>
    }>
  }
}

const HISTORY_KEY = "audio-pdf-reader-history"
const VOICE_SETTINGS_KEY = "audio-pdf-reader-voice-settings"
const READER_MODES: Array<{ value: ReaderMode; label: string }> = [
  { value: "browser", label: "Giọng trình duyệt" },
  { value: "ai", label: "Trầm ấm, ma mị (AI)" },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getWords(text: string) {
  return text.match(/\S+/g) ?? []
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function getHistories() {
  if (typeof window === "undefined") return []

  try {
    const rawValue = window.localStorage.getItem(HISTORY_KEY)
    return rawValue ? (JSON.parse(rawValue) as BookHistory[]) : []
  } catch {
    return []
  }
}

function saveHistories(histories: BookHistory[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(histories))
}

function upsertHistory(nextHistory: BookHistory) {
  const histories = getHistories()
  const filteredHistories = histories.filter((history) => history.id !== nextHistory.id)
  const nextHistories = [nextHistory, ...filteredHistories].slice(0, 12)
  saveHistories(nextHistories)
  return nextHistories
}

async function extractTextFromPdf(arrayBuffer: ArrayBuffer) {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfModule
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url,
  ).toString()

  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const pageTexts: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => item.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()

    if (pageText) {
      pageTexts.push(pageText)
    }
  }

  return pageTexts.join("\n\n")
}

function AudioPage() {
  const [sourceUrl, setSourceUrl] = useState("")
  const [title, setTitle] = useState("")
  const [bookId, setBookId] = useState("")
  const [bookText, setBookText] = useState("")
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState("Chọn file PDF hoặc dán link PDF để bắt đầu.")
  const [histories, setHistories] = useState<BookHistory[]>([])
  const [readerMode, setReaderMode] = useState<ReaderMode>("browser")
  const [ttsModel, setTtsModel] = useState<GeminiTtsModel>(DEFAULT_TTS_MODEL)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const [voiceSettingsLoaded, setVoiceSettingsLoaded] = useState(false)
  const [rate, setRate] = useState(1)
  const [volume, setVolume] = useState(1)

  const words = useMemo(() => getWords(bookText), [bookText])
  const aiReader = useAiReader({
    settings: { language: READING_LANGUAGE, tone: "warm", voice: "Algenib", model: ttsModel, rate, volume },
    onProgress: (index) => { if (readerMode === "ai") setCurrentWordIndex(index) },
    onStatus: (message) => { if (readerMode === "ai") setStatusMessage(message) },
  })
  const browserReader = useBrowserReader({
    rate, volume,
    onProgress: (index) => { if (readerMode === "browser") setCurrentWordIndex(index) },
    onStatus: (message) => { if (readerMode === "browser") setStatusMessage(message) },
  })
  const reader = readerMode === "ai" ? aiReader : browserReader
  const voiceReady = readerMode === "ai" ? aiConfigured === true : browserReader.isSupported === true
  const { isSpeaking, isPaused, isBuffering } = reader
  const sourceRef = useRef<{ label: string; type: "file" | "url" }>({ label: "", type: "file" })

  const percent = words.length ? Math.round((currentWordIndex / words.length) * 100) : 0

  useEffect(() => {
    setHistories(getHistories())

    try {
      const saved = JSON.parse(window.localStorage.getItem(VOICE_SETTINGS_KEY) ?? "null")
      if (saved?.readerMode === "ai") setReaderMode("ai")
    } catch {
      // Keep the defaults if saved settings are unavailable.
    }
    setVoiceSettingsLoaded(true)
  }, [])

  useEffect(() => {
    if (readerMode !== "ai") return
    setAiConfigured(null)
    const controller = new AbortController()
    fetch("/api/audio/speech", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((status) => {
        setAiConfigured(Boolean(status.configured))
        if (GEMINI_TTS_MODELS.includes(status.model)) setTtsModel(status.model)
      })
      .catch(() => { if (!controller.signal.aborted) setAiConfigured(false) })
    return () => controller.abort()
  }, [readerMode])

  useEffect(() => {
    if (!voiceSettingsLoaded) return
    try {
      window.localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify({ language: READING_LANGUAGE, readerMode }))
    } catch {
      // Reading still works when browser storage is disabled.
    }
  }, [readerMode, voiceSettingsLoaded])

  const persistProgress = useCallback(
    (nextWordIndex = reader.getWordIndex()) => {
      if (!bookId || !title || !words.length) return

      const nextHistories = upsertHistory({
        id: bookId,
        title,
        sourceLabel: sourceRef.current.label,
        sourceType: sourceRef.current.type,
        currentWordIndex: clamp(nextWordIndex, 0, words.length),
        totalWords: words.length,
        updatedAt: new Date().toISOString(),
        audioPosition: reader.getPosition(),
      })

      setHistories(nextHistories)
    },
    [bookId, title, words.length, reader],
  )

  const persistRef = useRef(persistProgress)
  const resumeAiAfterSwitch = useRef(false)
  persistRef.current = persistProgress
  useEffect(() => {
    const persist = () => persistRef.current()
    const timer = window.setInterval(persist, 5000)
    window.addEventListener("pagehide", persist)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("pagehide", persist)
      persist()
    }
  }, [])

  useEffect(() => {
    if (!isSpeaking && !isBuffering) persistRef.current()
  }, [isSpeaking, isBuffering])

  const stopReading = () => {
    resumeAiAfterSwitch.current = false
    persistProgress(reader.getWordIndex())
    reader.stop()
  }

  const playOrResume = () => {
    resumeAiAfterSwitch.current = false
    if (!bookText) {
      setStatusMessage("Chọn file PDF hoặc dán link PDF trước nha.")
      return
    }

    if (readerMode === "ai" && !aiConfigured) {
      setStatusMessage("Giọng Gemini chưa được cấu hình. Cần cấu hình GEMINI_API_KEY trong .env hoặc .env.local rồi khởi động lại server.")
      return
    }
    reader.play()
  }

  const changeReaderMode = (nextMode: ReaderMode) => {
    if (nextMode === readerMode) return
    const index = reader.getWordIndex()
    const shouldResume = isSpeaking
    resumeAiAfterSwitch.current = shouldResume && nextMode === "ai"
    if (nextMode === "ai") setAiConfigured(null)
    persistProgress(index)
    reader.stop()
    aiReader.setBook(bookId, words, index)
    browserReader.setBook(bookId, words, index)
    setCurrentWordIndex(index)
    setReaderMode(nextMode)
    setStatusMessage(nextMode === "ai" ? "Đã chọn giọng trầm ấm, ma mị." : "Đã chọn giọng trình duyệt.")
    if (shouldResume && nextMode === "browser") browserReader.play()
  }

  useEffect(() => {
    if (readerMode !== "ai") { resumeAiAfterSwitch.current = false; return }
    if (aiConfigured === true && resumeAiAfterSwitch.current) {
      resumeAiAfterSwitch.current = false
      aiReader.play()
    }
  }, [readerMode, aiConfigured, aiReader])

  const pauseReading = () => {
    if (!isSpeaking && !resumeAiAfterSwitch.current) return

    resumeAiAfterSwitch.current = false
    reader.pause()
    persistProgress(reader.getWordIndex())
  }

  const seekBySeconds = (seconds: number) => {
    if (!words.length || !voiceReady || isBuffering) return
    reader.seek(seconds)
    persistProgress(reader.getWordIndex())
  }

  const loadBook = async (params: {
    id: string
    nextTitle: string
    text: string
    sourceLabel: string
    sourceType: "file" | "url"
    startWordIndex?: number
    audioPosition?: AudioPosition
  }) => {
    const nextWords = getWords(params.text)

    if (!nextWords.length) {
      setStatusMessage("PDF này không trích được chữ. Có thể đây là PDF scan ảnh.")
      return
    }

    const startIndex = clamp(params.startWordIndex ?? 0, 0, nextWords.length)
    resumeAiAfterSwitch.current = false
    if (bookId) persistProgress(reader.getWordIndex())
    aiReader.setBook(params.id, nextWords, startIndex, params.audioPosition)
    browserReader.setBook(params.id, nextWords, startIndex)
    sourceRef.current = { label: params.sourceLabel, type: params.sourceType }
    setBookId(params.id)
    setTitle(params.nextTitle)
    setBookText(params.text)
    setCurrentWordIndex(startIndex)
    setStatusMessage(`Đã tải "${params.nextTitle}" (${nextWords.length.toLocaleString("vi-VN")} từ).`)

    await saveBookText({ id: params.id, text: params.text })
    const nextHistories = upsertHistory({
      id: params.id,
      title: params.nextTitle,
      sourceLabel: params.sourceLabel,
      sourceType: params.sourceType,
      currentWordIndex: startIndex,
      totalWords: nextWords.length,
      updatedAt: new Date().toISOString(),
      audioPosition: params.audioPosition,
    })
    setHistories(nextHistories)
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setStatusMessage("Đang đọc file PDF...")

    try {
      const arrayBuffer = await file.arrayBuffer()
      const text = await extractTextFromPdf(arrayBuffer)
      const id = `file:${file.name}:${file.size}:${file.lastModified}`
      await loadBook({
        id,
        nextTitle: file.name.replace(/\.pdf$/i, ""),
        text,
        sourceLabel: file.name,
        sourceType: "file",
      })
    } catch {
      setStatusMessage("Không đọc được file PDF này.")
    } finally {
      setIsLoading(false)
      event.target.value = ""
    }
  }

  const handleLoadUrl = async () => {
    const normalizedUrl = sourceUrl.trim()
    if (!normalizedUrl) {
      setStatusMessage("Dán link PDF trước nha.")
      return
    }

    setIsLoading(true)
    setStatusMessage("Đang tải PDF từ link...")

    try {
      const response = await fetch(normalizedUrl)
      if (!response.ok) throw new Error("Can not download PDF")

      const arrayBuffer = await response.arrayBuffer()
      const text = await extractTextFromPdf(arrayBuffer)
      const url = new URL(normalizedUrl)
      const fileName = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "Truyện PDF")

      await loadBook({
        id: `url:${normalizedUrl}`,
        nextTitle: fileName.replace(/\.pdf$/i, ""),
        text,
        sourceLabel: normalizedUrl,
        sourceType: "url",
      })
    } catch {
      setStatusMessage("Không tải được link PDF. Một số website chặn CORS nên browser không đọc trực tiếp được.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = async (history: BookHistory) => {
    setIsLoading(true)
    setStatusMessage("Đang mở lại lịch sử đọc...")

    try {
      const text = await getBookText(history.id)
      if (!text) {
        setStatusMessage("Không còn nội dung đã lưu cho truyện này, hãy tải lại PDF.")
        return
      }

      await loadBook({
        id: history.id,
        nextTitle: history.title,
        text,
        sourceLabel: history.sourceLabel,
        sourceType: history.sourceType,
        startWordIndex: history.currentWordIndex,
        audioPosition: history.audioPosition,
      })
    } catch {
      setStatusMessage("Không mở lại được lịch sử đọc.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteHistory = async (historyId: string) => {
    try {
      if (bookId === historyId) {
        aiReader.setBook("", [])
        browserReader.setBook("", [])
        setBookId("")
        setTitle("")
        setBookText("")
        setCurrentWordIndex(0)
      }
      await removeBookText(historyId)
      const nextHistories = getHistories().filter((history) => history.id !== historyId)
      saveHistories(nextHistories)
      setHistories(nextHistories)
    } catch {
      setStatusMessage("Không xóa được lịch sử đọc. Thử lại sau.")
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-[#2d241d]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#a15f39]">Audio PDF</p>
          <h1 className="text-3xl font-bold text-[#241c16] sm:text-4xl">Đọc truyện PDF thành audio</h1>
          <p className="max-w-2xl text-sm leading-6 text-[#6b5b4f]">
            Đọc truyện bằng tiếng Việt.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-lg border border-[#e4d4c5] bg-white p-4 shadow-sm">
            <div className="grid gap-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#c58b65] bg-[#fff9f2] px-4 py-8 text-center transition hover:border-[#9d5d38]">
                <Icon icon="mdi:cloud-upload-outline" className="h-9 w-9 text-[#a15f39]" />
                <span className="font-semibold">Chọn file truyện PDF</span>
                <span className="text-xs text-[#806c5c]">PDF dạng text đọc tốt nhất; PDF scan ảnh có thể không trích được chữ.</span>
                <input className="sr-only" type="file" accept="application/pdf,.pdf" onChange={handleFileChange} disabled={isLoading} />
              </label>

              <div className="grid gap-2">
                <label className="text-sm font-semibold" htmlFor="pdf-url">
                  Link PDF
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="pdf-url"
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="https://example.com/story.pdf"
                    className="min-h-11 flex-1 rounded-md border border-[#d9c7b7] px-3 text-sm text-[#2d241d] outline-none transition focus:border-[#a15f39]"
                  />
                  <button
                    type="button"
                    onClick={handleLoadUrl}
                    disabled={isLoading}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#9d5d38] px-4 font-semibold text-white transition hover:bg-[#80482a] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon icon="mdi:link-variant" className="h-5 w-5" />
                    Tải link
                  </button>
                </div>
              </div>

              <div role="status" className="rounded-md bg-[#f7f2ea] px-3 py-2 text-sm text-[#654f40]">{isLoading ? "Đang xử lý..." : statusMessage}</div>
              {readerMode === "ai" && aiConfigured === false && <p className="text-sm text-[#9d5d38]">Giọng đọc Gemini chưa được cấu hình. Thêm GEMINI_API_KEY trong .env rồi khởi động lại server.</p>}
              {readerMode === "browser" && browserReader.isSupported === false && <p className="text-sm text-[#9d5d38]">Trình duyệt không hỗ trợ đọc văn bản. Chọn giọng AI để đọc.</p>}
            </div>
          </section>

          <section className="rounded-lg border border-[#e4d4c5] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#806c5c]">Đang mở</p>
                <h2 className="mt-1 line-clamp-2 text-xl font-bold">{title || "Chưa có truyện"}</h2>
              </div>
              <div className="rounded-md bg-[#f1e3d5] px-3 py-2 text-sm font-bold text-[#7f4527]">{percent}%</div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#ead9c9]">
              <div className="h-full rounded-full bg-[#a15f39] transition-all" style={{ width: `${percent}%` }} />
            </div>

            <div className="mt-3 flex justify-between text-xs text-[#806c5c]">
              <span>{currentWordIndex.toLocaleString("vi-VN")} từ</span>
              <span>{words.length.toLocaleString("vi-VN")} từ</span>
            </div>

            <div className="mt-5 grid grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => seekBySeconds(-10)}
                disabled={!words.length || !voiceReady || isBuffering || isLoading}
                className="flex aspect-square items-center justify-center rounded-md border border-[#d9c7b7] text-[#5d4636] transition hover:bg-[#fff6ed] disabled:cursor-not-allowed disabled:opacity-40"
                title={readerMode === "ai" ? "Tua lùi 10 giây" : "Tua lùi khoảng 10 giây"}
              >
                <Icon icon="mdi:rewind-10" className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={isPaused || !isSpeaking ? playOrResume : pauseReading}
                disabled={!words.length || !voiceReady || isLoading}
                className="col-span-2 flex min-h-14 items-center justify-center gap-2 rounded-md bg-[#2f5d50] px-4 font-semibold text-white transition hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon icon={isBuffering ? "mdi:loading" : isSpeaking ? "mdi:pause" : "mdi:play"} className={`h-6 w-6 ${isBuffering ? "animate-spin" : ""}`} />
                {isSpeaking ? "Tạm dừng" : isPaused ? "Tiếp tục" : "Đọc"}
              </button>
              <button
                type="button"
                onClick={() => seekBySeconds(10)}
                disabled={!words.length || !voiceReady || isBuffering || isLoading}
                className="flex aspect-square items-center justify-center rounded-md border border-[#d9c7b7] text-[#5d4636] transition hover:bg-[#fff6ed] disabled:cursor-not-allowed disabled:opacity-40"
                title={readerMode === "ai" ? "Tua tới 10 giây" : "Tua tới khoảng 10 giây"}
              >
                <Icon icon="mdi:fast-forward-10" className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={stopReading}
                disabled={!isSpeaking && !isPaused && !resumeAiAfterSwitch.current}
                className="flex aspect-square items-center justify-center rounded-md border border-[#d9c7b7] text-[#5d4636] transition hover:bg-[#fff6ed] disabled:cursor-not-allowed disabled:opacity-40"
                title="Dừng đọc"
              >
                <Icon icon="mdi:stop" className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Ngôn ngữ</span>
                <span>Tiếng Việt</span>
              </div>

              <fieldset className="min-w-0">
                <legend className="mb-1 text-sm font-semibold">Giọng đọc</legend>
                <div className="grid gap-2">
                  {READER_MODES.map(({ value, label }) => (
                    <label key={value} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${readerMode === value ? "border-[#2f5d50] bg-[#edf5f1] text-[#24483e]" : "border-[#d9c7b7]"}`}>
                      <input type="radio" name="reading-voice" value={value} checked={readerMode === value} onChange={() => changeReaderMode(value)} className="accent-[#2f5d50]" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Tốc độ: {rate.toFixed(1)}x</span>
                <input min="0.6" max="1.6" step="0.1" type="range" value={rate} onChange={(event) => setRate(Number(event.target.value))} />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Âm lượng: {Math.round(volume * 100)}%</span>
                <input min="0" max="1" step="0.1" type="range" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
              </label>
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-[#e4d4c5] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:history" className="h-5 w-5 text-[#a15f39]" />
            <h2 className="text-lg font-bold">Lịch sử đọc</h2>
          </div>

          {histories.length ? (
            <div className="mt-4 grid gap-2">
              {histories.map((history) => {
                const historyPercent = history.totalWords
                  ? Math.round((history.currentWordIndex / history.totalWords) * 100)
                  : 0

                return (
                  <div key={history.id} className="grid gap-3 rounded-md border border-[#ead9c9] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <button type="button" onClick={() => handleRestore(history)} disabled={isLoading} className="min-w-0 text-left disabled:opacity-60">
                      <span className="block truncate font-semibold">{history.title}</span>
                      <span className="mt-1 block truncate text-xs text-[#806c5c]">
                        {historyPercent}% • {formatDate(history.updatedAt)} • {history.sourceType === "url" ? "Link PDF" : "File PDF"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHistory(history.id)}
                      disabled={isLoading}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#d9c7b7] px-3 text-sm font-semibold text-[#7f4527] transition hover:bg-[#fff6ed]"
                    >
                      <Icon icon="mdi:trash-can-outline" className="h-5 w-5" />
                      Xóa
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#806c5c]">Chưa có lịch sử đọc.</p>
          )}
        </section>
      </section>
    </main>
  )
}

export default AudioPage
