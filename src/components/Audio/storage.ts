import { getSettingsKey, type SpeechChunk, type VoiceSettings } from "@/lib/audio/speech"

const DB_NAME = "audio-pdf-reader"
const TEXT_STORE = "bookTexts"
const AUDIO_STORE = "audioClips"

async function openReaderDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TEXT_STORE)) db.createObjectStore(TEXT_STORE, { keyPath: "id" })
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: "id" }).createIndex("bookId", "bookId")
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("Đóng tab đọc truyện cũ rồi thử lại."))
  })
}

async function readRecord<T>(store: string, id: string): Promise<T | undefined> {
  const db = await openReaderDb()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = db.transaction(store, "readonly").objectStore(store).get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function writeRecord(store: string, record: object) {
  const db = await openReaderDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite")
      transaction.objectStore(store).put(record)
      transaction.oncomplete = () => resolve()
      transaction.onerror = transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

export function saveBookText(book: { id: string; text: string }) {
  return writeRecord(TEXT_STORE, book)
}

export async function getBookText(id: string) {
  return (await readRecord<{ text: string }>(TEXT_STORE, id))?.text ?? ""
}

export async function removeBookText(id: string) {
  for (const [key, value] of memoryCache) {
    if (value.bookId === id) memoryCache.delete(key)
  }
  const db = await openReaderDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([TEXT_STORE, AUDIO_STORE], "readwrite")
      transaction.objectStore(TEXT_STORE).delete(id)
      const audioStore = transaction.objectStore(AUDIO_STORE)
      const request = audioStore.index("bookId").openKeyCursor(IDBKeyRange.only(id))
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        audioStore.delete(cursor.primaryKey)
        cursor.continue()
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

const memoryCache = new Map<string, { bookId: string; blob: Blob }>()

export async function getAudioClip(
  bookId: string,
  chunk: SpeechChunk,
  settings: VoiceSettings,
  signal: AbortSignal,
) {
  const content = JSON.stringify([bookId, chunk.startIndex, chunk.text, getSettingsKey(settings)])
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content))
  const id = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")
  signal.throwIfAborted()
  const cached = memoryCache.get(id)?.blob ?? await readRecord<{ blob: Blob }>(AUDIO_STORE, id)
    .then((record) => record?.blob).catch(() => undefined)
  signal.throwIfAborted()
  if (cached) return cached

  const response = await fetch("/api/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: chunk.text, language: settings.language, tone: settings.tone, voice: settings.voice, model: settings.model }),
    signal,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.error ?? "Không tạo được giọng đọc AI. Thử lại sau.")
  }
  const blob = await response.blob()
  signal.throwIfAborted()
  if (!blob.size || !blob.type.startsWith("audio/")) throw new Error("Không nhận được audio hợp lệ.")
  memoryCache.set(id, { bookId, blob })
  if (memoryCache.size > 8) memoryCache.delete(memoryCache.keys().next().value!)
  await writeRecord(AUDIO_STORE, { id, bookId, blob }).catch(() => undefined)
  signal.throwIfAborted()
  return blob
}
