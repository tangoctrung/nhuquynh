const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
const { webcrypto } = require("node:crypto")

function loadTs(file, globals = {}, cache = new Map()) {
  const filename = path.resolve(file)
  if (cache.has(filename)) return cache.get(filename)
  const module = { exports: {} }
  cache.set(filename, module.exports)
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const localRequire = (name) => {
    if (name.startsWith("@/")) return loadTs(`src/${name.slice(2)}.ts`, globals, cache)
    if (name.startsWith(".")) return loadTs(path.resolve(path.dirname(filename), `${name}.ts`), globals, cache)
    return require(name)
  }
  new Function("require", "module", "exports", ...Object.keys(globals), code)(localRequire, module, module.exports, ...Object.values(globals))
  return module.exports
}

const speech = loadTs("src/lib/audio/speech.ts")
const clipDurations = new WeakMap()
const audioDurations = new Map()
const { AiAudioPlayer } = loadTs("src/components/Audio/ai-player.ts", {
  URL: {
    createObjectURL(blob) {
      const url = URL.createObjectURL(blob)
      audioDurations.set(url, clipDurations.get(blob) ?? 30)
      return url
    },
    revokeObjectURL(url) { audioDurations.delete(url); URL.revokeObjectURL(url) },
  },
})
const { BrowserSpeechPlayer } = loadTs("src/components/Audio/browser-player.ts")
const settings = { language: "vi-VN", tone: "warm", voice: "Algenib", model: speech.DEFAULT_TTS_MODEL, rate: 1, volume: 1 }
const words = Array.from({ length: 650 }, (_, index) => `word${index}`)
const chunks = speech.splitSpeechChunks(words)
const settle = () => new Promise((resolve) => setImmediate(resolve))

class FakeAudio extends EventTarget {
  constructor(duration) {
    super()
    this.duration = duration
    this.currentTime = 0
    this.paused = true
    this.src = ""
    this.playCount = 0
  }
  load() {
    if (this.src) {
      this.duration = audioDurations.get(this.src) ?? this.duration
      queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")))
    }
  }
  async play() { this.paused = false; this.playCount += 1 }
  pause() { this.paused = true }
  removeAttribute() { this.src = "" }
  tick(time) { this.currentTime = time; this.ontimeupdate?.() }
}

function createPlayer(getClip) {
  const states = [], statuses = [], requests = [], audios = []
  const player = new AiAudioPlayer({
    getClip: async (bookId, chunk, voiceSettings, signal) => {
      requests.push({ bookId, chunk, settings: voiceSettings, signal })
      const blob = getClip ? await getClip(signal, chunk, voiceSettings) : new Blob(["fake wav"], { type: "audio/wav" })
      clipDurations.set(blob, chunks.findIndex((item) => item.startIndex === chunk.startIndex) === 1 ? 40 : 30)
      return blob
    },
    createAudio: () => { const audio = new FakeAudio(30); audios.push(audio); return audio },
    onChange: (state) => states.push(state),
    onStatus: (status) => statuses.push(status),
  })
  player.setSettings(settings)
  player.setBook("book", words)
  return { player, requests, audios, states, statuses }
}

test("story chunks preserve Vietnamese text and stay within the API limit", () => {
  const text = Array(250).fill("Đêm ấy, tiếng mưa rơi nhẹ trên mái nhà.").join(" ")
  const result = speech.splitSpeechChunks(text.split(/\s+/))
  assert.equal(result.map((chunk) => chunk.text).join(" "), text)
  assert.ok(result.every((chunk) => chunk.text.length <= speech.MAX_SPEECH_CHARS))
  assert.throws(() => speech.splitSpeechChunks(["x".repeat(1201)]))
})

test("pause/resume reuses audio; speed and volume do not regenerate speech", async () => {
  const h = createPlayer()
  h.player.play(); await settle()
  const audio = h.audios.at(-1)
  audio.tick(12.35)
  h.player.pause()
  assert.equal(h.states.at(-1).isPaused, true)
  assert.equal(h.player.getPosition().seconds, 12.35)
  h.player.setSettings({ ...settings, rate: 1.4, volume: 0.6 })
  h.player.play(); await settle()
  assert.equal(h.requests.length, 1)
  assert.equal(audio.currentTime, 12.35)
  assert.equal(audio.playbackRate, 1.4)
  assert.equal(audio.volume, 0.6)
  assert.equal(audio.paused, false)
  h.player.dispose()
})

test("10-second seeking is exact within and across clips in both directions", async () => {
  const h = createPlayer()
  h.player.play(); await settle()
  h.audios.at(-1).tick(5)
  h.player.seek(10)
  assert.equal(h.audios.at(-1).currentTime, 15)
  assert.equal(h.requests.length, 2)
  h.audios.at(-1).tick(25)
  h.player.seek(10); await settle()
  assert.equal(h.player.getPosition().chunkStartWordIndex, chunks[1].startIndex)
  assert.equal(h.audios.at(-1).currentTime, 5)
  assert.equal(h.requests.filter((request) => request.chunk.startIndex === chunks[1].startIndex).length, 1)
  h.player.seek(-10); await settle()
  assert.equal(h.player.getPosition().chunkStartWordIndex, 0)
  assert.equal(h.audios.at(-1).currentTime, 25)
  h.player.pause()
  h.player.seek(-10)
  assert.equal(h.audios.at(-1).currentTime, 15)
  assert.equal(h.states.at(-1).isPaused, true)
  h.player.dispose()
})

test("restored history resumes the exact timestamp with the same voice profile", async () => {
  const h = createPlayer()
  h.player.setBook("book", words, chunks[1].startIndex + 20, {
    chunkStartWordIndex: chunks[1].startIndex, seconds: 22.35, settingsKey: speech.getSettingsKey(settings),
  })
  h.player.play(); await settle()
  assert.equal(h.audios.at(-1).currentTime, 22.35)
  assert.equal(h.requests[0].chunk.startIndex, chunks[1].startIndex)
  h.player.dispose()
})

test("disposing the player retains its last position for navigation history", async () => {
  const h = createPlayer()
  h.player.play(); await settle()
  h.audios.at(-1).currentTime = 18.35
  h.player.dispose()
  assert.equal(h.player.getPosition().seconds, 18.35)
  assert.ok(h.player.getWordIndex() > 0)
})

test("OpenAI reading history migrates by word position without reusing the old voice timestamp", async () => {
  const h = createPlayer()
  h.player.setBook("book", words, 3, {
    chunkStartWordIndex: 0, seconds: 25, settingsKey: JSON.stringify(["openai-story-v1", "vi-VN", "warm", "onyx"]),
  })
  h.player.play(); await settle()
  assert.ok(h.audios.at(-1).currentTime < 1)
  assert.equal(h.requests[0].settings.voice, "Algenib")
  assert.equal(h.player.getPosition().settingsKey, speech.getSettingsKey(settings))
  h.player.dispose()
})

test("changing tone while paused waits for resume; active changes keep the reading position", async () => {
  const h = createPlayer()
  h.player.play(); await settle()
  h.audios.at(-1).tick(15)
  h.player.pause()
  h.player.setSettings({ ...settings, tone: "clear" })
  assert.equal(h.requests.length, 2)
  h.player.play(); await settle()
  assert.equal(h.requests.at(-1).settings.tone, "clear")
  assert.ok(Math.abs(h.audios.at(-1).currentTime - 15) < 0.3)
  h.player.setSettings({ ...settings, voice: "Iapetus" }); await settle()
  assert.equal(h.requests.at(-1).settings.language, "vi-VN")
  assert.equal(h.requests.at(-1).settings.voice, "Iapetus")
  assert.equal(h.states.at(-1).isSpeaking, true)
  h.player.dispose()
})

test("pause during generation prevents autoplay, and stop discards late responses", async () => {
  let resolveClip
  const h = createPlayer(() => new Promise((resolve) => { resolveClip = resolve }))
  h.player.play()
  h.player.pause()
  resolveClip(new Blob(["audio"])); await settle()
  assert.equal(h.audios.at(-1).playCount, 0)
  assert.equal(h.states.at(-1).isPaused, true)
  h.player.dispose()

  const stopped = createPlayer(() => new Promise((resolve) => { resolveClip = resolve }))
  stopped.player.play(); stopped.player.stop()
  resolveClip(new Blob(["audio"])); await settle()
  assert.equal(stopped.audios.length, 0)
  assert.equal(stopped.requests[0].signal.aborted, true)
  assert.equal(stopped.states.at(-1).isSpeaking, false)
  assert.equal(stopped.states.at(-1).isBuffering, false)
  stopped.player.dispose()
})

test("pausing a pending play does not report a playback failure", async () => {
  const h = createPlayer()
  h.player.play(); await settle()
  h.player.pause()
  let rejectPlay
  h.audios.at(-1).play = () => new Promise((resolve, reject) => { rejectPlay = reject })
  h.player.play()
  h.player.pause()
  rejectPlay(new DOMException("Playback interrupted by pause", "AbortError")); await settle()
  assert.equal(h.statuses.at(-1), "Đã tạm dừng.")
  assert.equal(h.states.at(-1).isPaused, true)
  h.player.dispose()
})

test("natural endings advance chapters and mark the story complete", async () => {
  const h = createPlayer()
  h.player.play(); await settle()
  for (let i = 0; i < chunks.length; i++) {
    h.audios.at(-1).onended(); await settle()
  }
  assert.equal(h.player.getWordIndex(), words.length)
  assert.equal(h.states.at(-1).isSpeaking, false)
  assert.equal(h.states.at(-1).isPaused, false)
  assert.equal(h.statuses.at(-1), "Đã đọc xong truyện.")
  h.player.dispose()
})

test("generation errors clear buffering and allow a retry", async () => {
  let fail = true
  const h = createPlayer(async () => { if (fail) throw new Error("generation failed"); return new Blob(["audio"]) })
  h.player.play(); await settle()
  assert.equal(h.states.at(-1).isBuffering, false)
  assert.equal(h.states.at(-1).isSpeaking, false)
  assert.equal(h.statuses.at(-1), "generation failed")
  fail = false
  h.player.play(); await settle()
  assert.equal(h.audios.at(-1).paused, false)
  h.player.dispose()
})

test("prefetch starts near the end, does not buffer current playback, and reuses the next clip", async () => {
  const h = createPlayer()
  h.player.play(); await settle()
  const audio = h.audios.at(-1)
  audio.tick(14)
  assert.equal(h.requests.length, 1)
  audio.tick(15); await settle()
  assert.equal(h.requests.length, 2)
  assert.equal(h.requests[1].chunk.startIndex, chunks[1].startIndex)
  assert.equal(h.states.at(-1).isBuffering, false)
  assert.equal(audio.paused, false)
  audio.tick(20); audio.tick(29)
  assert.equal(h.requests.length, 2)
  audio.onended(); await settle()
  assert.equal(h.requests.length, 2)
  assert.equal(h.audios.at(-1).duration, 40)
  assert.equal(h.audios.at(-1).currentTime, 0)
  assert.equal(h.audios.at(-1).paused, false)
  assert.equal(h.requests[1].signal.aborted, false)
  h.player.dispose()
})

test("a transition waits for in-flight prefetch without a duplicate request or autoplay while paused", async () => {
  let resolveNext
  const h = createPlayer((signal, chunk) => chunk.startIndex === 0
    ? Promise.resolve(new Blob(["audio"]))
    : new Promise((resolve) => { resolveNext = resolve }))
  h.player.play(); await settle()
  const audio = h.audios.at(-1)
  audio.tick(20)
  audio.onended(); await settle()
  assert.equal(h.requests.length, 2)
  assert.equal(h.requests[1].signal.aborted, false)
  assert.equal(h.states.at(-1).isBuffering, true)
  h.player.pause()
  resolveNext(new Blob(["next audio"])); await settle()
  assert.equal(h.audios.at(-1).playCount, 0)
  h.player.play(); await settle()
  assert.equal(h.requests.length, 2)
  assert.equal(h.audios.at(-1).paused, false)
  h.player.dispose()
})

test("prefetch errors leave playback running and retry only when the next clip is needed", async () => {
  let nextCalls = 0
  const h = createPlayer(async (signal, chunk) => {
    if (chunk.startIndex !== 0 && ++nextCalls === 1) throw new Error("quota error")
    return new Blob(["audio"])
  })
  h.player.play(); await settle()
  const audio = h.audios.at(-1)
  audio.tick(20); await settle()
  assert.equal(h.states.at(-1).isSpeaking, true)
  assert.equal(h.states.at(-1).isBuffering, false)
  audio.tick(25); audio.tick(29); await settle()
  assert.equal(nextCalls, 1)
  audio.onended(); await settle()
  assert.equal(nextCalls, 2)
  assert.equal(h.audios.at(-1).paused, false)
  h.player.dispose()
})

test("pause retains prefetch but stop, new books, voice changes, backward seeks and disposal cancel it", async () => {
  for (const action of ["stop", "book", "voice", "seek", "dispose"]) {
    let resolveNext
    const h = createPlayer((signal, chunk) => chunk.startIndex === 0
      ? Promise.resolve(new Blob(["audio"]))
      : new Promise((resolve) => { resolveNext = resolve }))
    h.player.play(); await settle()
    h.audios.at(-1).tick(20)
    const prefetched = h.requests[1]
    h.player.pause()
    h.audios.at(-1).tick(25)
    assert.equal(h.requests.length, 2)
    assert.equal(prefetched.signal.aborted, false)
    if (action === "stop") h.player.stop()
    if (action === "book") h.player.setBook("other", words)
    if (action === "voice") h.player.setSettings({ ...settings, voice: "Sulafat" })
    if (action === "seek") h.player.seek(-40)
    if (action === "dispose") h.player.dispose()
    assert.equal(prefetched.signal.aborted, true, action)
    resolveNext(new Blob(["late audio"])); await settle()
    assert.equal(h.states.at(-1).isSpeaking, false, action)
    h.player.dispose()
  }
})

test("prefetch respects playback rate and never requests beyond the final chunk", async () => {
  const h = createPlayer()
  h.player.play(); await settle()
  h.player.setSettings({ ...settings, rate: 2 })
  h.audios.at(-1).tick(14)
  assert.equal(h.requests.length, 1)
  h.audios.at(-1).tick(16); await settle()
  assert.equal(h.requests.length, 2)
  h.player.pause()
  h.player.setBook("book", words, chunks.at(-1).startIndex)
  h.player.play(); await settle()
  const count = h.requests.length
  h.audios.at(-1).tick(29); await settle()
  assert.equal(h.requests.length, count)
  h.player.dispose()
})

test("legacy English settings are normalized to Vietnamese before requesting audio", async () => {
  const h = createPlayer()
  h.player.setSettings({ ...settings, language: "en-US" })
  h.player.play(); await settle()
  assert.equal(h.requests[0].settings.language, "vi-VN")
  h.player.dispose()
})

function createBrowserPlayer(t, voices = [
  { lang: "en-US", default: true, localService: true },
  { lang: "vi-VN", default: false, localService: true },
]) {
  const synthesis = new EventTarget()
  const utterances = [], states = [], statuses = []
  let now = 0
  let availableVoices = voices
  synthesis.getVoices = () => availableVoices
  synthesis.pause = () => { synthesis.paused = true }
  synthesis.resume = () => { synthesis.paused = false }
  synthesis.cancel = () => { synthesis.cancelCount = (synthesis.cancelCount ?? 0) + 1 }
  synthesis.speak = (utterance) => { utterances.push(utterance); utterance.onstart?.() }
  const player = new BrowserSpeechPlayer({
    synthesis,
    createUtterance: (text) => ({ text }),
    now: () => now,
    onChange: (state) => states.push(state),
    onStatus: (status) => statuses.push(status),
  })
  player.setBook("book", words)
  t.after(() => player.dispose())
  return { player, synthesis, utterances, states, statuses,
    advance: (milliseconds) => { now += milliseconds },
    setVoices: (value) => { availableVoices = value; synthesis.dispatchEvent(new Event("voiceschanged")) },
  }
}

test("browser reader selects only Vietnamese, pauses/resumes without creating new speech and retains history", (t) => {
  const h = createBrowserPlayer(t)
  h.player.play()
  const utterance = h.utterances[0]
  assert.equal(utterance.lang, "vi-VN")
  assert.equal(utterance.voice.lang, "vi-VN")
  assert.ok(utterance.text.length <= 400)
  assert.equal(h.states.at(-1).isBuffering, false)
  h.advance(2000)
  h.player.pause()
  assert.equal(h.player.getWordIndex(), 6)
  assert.equal(h.synthesis.paused, true)
  h.advance(10000)
  assert.equal(h.player.getWordIndex(), 6)
  h.player.play()
  assert.equal(h.utterances.length, 1)
  h.advance(1000)
  assert.equal(h.player.getWordIndex(), 9)
  assert.equal(h.player.getPosition(), undefined)
  h.player.dispose()
  assert.equal(h.player.getWordIndex(), 9)
})

test("browser reader estimates 10-second seeks, honors rate/volume and does not autoplay when paused", (t) => {
  const h = createBrowserPlayer(t)
  h.player.play(); h.player.pause()
  h.player.seek(10)
  assert.equal(h.player.getWordIndex(), 30)
  assert.equal(h.utterances.length, 1)
  h.player.seek(-10)
  assert.equal(h.player.getWordIndex(), 0)
  h.player.setSettings({ rate: 1.5, volume: 0.4 })
  h.player.play()
  assert.equal(h.utterances.at(-1).rate, 1.5)
  assert.equal(h.utterances.at(-1).volume, 0.4)
  h.player.pause(); h.player.seek(10)
  assert.equal(h.player.getWordIndex(), 45)
  assert.equal(h.states.at(-1).isPaused, true)
})

test("browser boundary events track words and natural endings advance chunks and complete the story", (t) => {
  const h = createBrowserPlayer(t)
  h.player.setBook("book", words, 5)
  h.player.play()
  h.advance(400)
  h.utterances[0].onboundary({ charIndex: 6 })
  assert.equal(h.player.getWordIndex(), 6)
  const nextIndex = 5 + h.utterances[0].text.split(" ").length
  h.utterances[0].onend()
  assert.equal(h.player.getWordIndex(), nextIndex)
  assert.ok(h.utterances[1].text.startsWith(words[nextIndex] + " "))
  h.player.setBook("book", words, words.length - 3)
  h.player.play()
  h.utterances.at(-1).onend()
  assert.equal(h.player.getWordIndex(), words.length)
  assert.equal(h.states.at(-1).isSpeaking, false)
  assert.equal(h.states.at(-1).isPaused, false)
  assert.equal(h.statuses.at(-1), "Đã đọc xong truyện.")
})

test("browser reader waits for asynchronously loaded Vietnamese voices and can cancel the wait", (t) => {
  const h = createBrowserPlayer(t, [])
  h.player.play()
  assert.equal(h.states.at(-1).isBuffering, true)
  h.player.pause()
  h.setVoices([{ lang: "vi-VN" }])
  assert.equal(h.utterances.length, 0)
  h.player.play()
  assert.equal(h.utterances.length, 1)
  h.player.stop()
  h.setVoices([])
  h.player.play()
  h.setVoices([{ lang: "vi-VN" }])
  assert.equal(h.utterances.length, 2)
  assert.equal(h.states.at(-1).isBuffering, false)
})

test("browser reader never falls back to English and reports missing or failing voices", (t) => {
  const h = createBrowserPlayer(t, [{ lang: "en-US", default: true }])
  h.player.play()
  assert.equal(h.utterances.length, 0)
  assert.equal(h.states.at(-1).isSpeaking, false)
  assert.match(h.statuses.at(-1), /chưa có giọng tiếng Việt/)
  h.setVoices([{ lang: "vi-VN" }])
  h.synthesis.speak = () => { throw new Error("speech unavailable") }
  h.player.play()
  assert.equal(h.states.at(-1).isBuffering, false)
  assert.equal(h.states.at(-1).isSpeaking, false)
  assert.match(h.statuses.at(-1), /Không phát được/)
})

test("browser stop and book changes discard late native callbacks and restore by word position", (t) => {
  const h = createBrowserPlayer(t)
  h.player.play()
  const lateEnd = h.utterances[0].onend
  h.advance(1000)
  h.player.stop()
  lateEnd()
  assert.equal(h.utterances.length, 1)
  assert.equal(h.player.getWordIndex(), 3)
  h.player.setBook("other", words, 120)
  h.player.play()
  assert.ok(h.utterances.at(-1).text.startsWith("word120 "))
  assert.equal(h.player.getWordIndex(), 120)
})

test("short browser chunks do not reject long words that the AI reader accepts", (t) => {
  const h = createBrowserPlayer(t)
  const longWord = "x".repeat(500)
  h.player.setBook("book", [longWord, "tiếp"])
  h.player.play()
  assert.equal(h.utterances[0].text, longWord)
  h.utterances[0].onend()
  assert.equal(h.utterances[1].text, "tiếp")
})

function request(body, origin) {
  return new Request("http://localhost:3020/api/audio/speech", {
    method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
  })
}
const validInput = { text: "Đêm ấy, tiếng mưa rơi nhẹ.", language: "vi-VN", tone: "warm", voice: "Algenib", model: speech.DEFAULT_TTS_MODEL }

test("speech API validates requests and reports missing configuration without calling Gemini", async () => {
  const route = loadTs("src/app/api/audio/speech/route.ts", {
    process: { env: {} }, fetch: () => { throw new Error("must not call Gemini") },
  })
  assert.equal((await route.GET().json()).configured, false)
  assert.equal((await route.POST(request(validInput))).status, 503)
  for (const input of [null, { ...validInput, language: "fr-FR" }, { ...validInput, language: "en-US" }, { ...validInput, voice: "unknown" }, { ...validInput, text: "x".repeat(1201) }]) {
    assert.equal((await route.POST(request(input))).status, 400)
  }
  assert.equal((await route.POST(request(validInput, "https://unrelated.example"))).status, 403)
})

function makeWav() {
  const wav = Buffer.alloc(48)
  wav.write("RIFF", 0); wav.writeUInt32LE(40, 4); wav.write("WAVE", 8)
  wav.write("fmt ", 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28)
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(4, 40)
  return wav
}

test("speech API forwards verbatim text with separate narrator styling and returns Gemini WAV without exposing its key", async () => {
  let sent
  const wav = makeWav()
  const route = loadTs("src/app/api/audio/speech/route.ts", {
    process: { env: { GEMINI_API_KEY: "test-only-key" } },
    fetch: async (url, options) => {
      sent = { url, ...options, body: JSON.parse(options.body) }
      return Response.json({ steps: [
        { type: "user_input", content: [{ type: "audio", data: "ignore-this-input" }] },
        { type: "model_output", content: [{ type: "audio", data: wav.toString("base64"), mime_type: "audio/wav" }] },
      ] })
    },
  })
  const status = await route.GET().json()
  assert.deepEqual(status, { configured: true, model: speech.DEFAULT_TTS_MODEL })
  const response = await route.POST(request(validInput))
  assert.equal(sent.url, "https://generativelanguage.googleapis.com/v1beta/interactions")
  assert.equal(sent.headers["x-goog-api-key"], "test-only-key")
  assert.equal(sent.body.input[0].content[0].text, validInput.text)
  assert.match(sent.body.input[0].content[0].annotations[0].style, /Vietnamese/)
  assert.match(sent.body.input[0].content[0].annotations[0].style, /deep, low-register, warm/)
  assert.match(sent.body.input[0].content[0].annotations[0].style, /mysterious, haunting/)
  assert.deepEqual(sent.body.response_format, { type: "audio", mime_type: "audio/wav" })
  assert.deepEqual(sent.body.generation_config.speech_config, [{ voice: "Algenib" }])
  assert.equal(response.headers.get("Content-Type"), "audio/wav")
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), wav)
})

test("upstream quota and invalid-key errors have useful, sanitized responses", async () => {
  for (const [upstreamStatus, expected] of [[429, 429], [401, 502], [403, 502], [404, 502], [500, 502]]) {
    const route = loadTs("src/app/api/audio/speech/route.ts", {
      process: { env: { GEMINI_API_KEY: "test-only-key" } },
      fetch: async () => new Response("sensitive upstream details", { status: upstreamStatus }),
    })
    const response = await route.POST(request(validInput))
    assert.equal(response.status, expected)
    assert.ok(!(await response.text()).includes("sensitive upstream details"))
  }
})

test("configuration checks and generation use the same Gemini key and model", async () => {
  const oldProvider = loadTs("src/app/api/audio/speech/route.ts", {
    process: { env: { OPENAI_API_KEY: "old-provider-key" } },
    fetch: () => { throw new Error("must not call old provider") },
  })
  assert.equal((await oldProvider.GET().json()).configured, false)
  assert.equal((await oldProvider.POST(request(validInput))).status, 503)
  const misconfigured = loadTs("src/app/api/audio/speech/route.ts", {
    process: { env: { GEMINI_API_KEY: "test-only-key", GEMINI_TTS_MODEL: "gemini-chat-model" } },
    fetch: () => { throw new Error("must not call unsupported model") },
  })
  assert.equal((await misconfigured.GET().json()).configured, false)
  assert.equal((await misconfigured.POST(request(validInput))).status, 503)
  let sent
  const model = "gemini-3.8-flash-lite-tts"
  const googleKey = loadTs("src/app/api/audio/speech/route.ts", {
    process: { env: { GEMINI_API_KEY: " ", GOOGLE_API_KEY: "test-google-key", GEMINI_TTS_MODEL: model } },
    fetch: async (url, options) => { sent = options; return Response.json({ steps: [{ type: "model_output", content: [{ type: "audio", data: makeWav().toString("base64") }] }] }) },
  })
  assert.deepEqual(await googleKey.GET().json(), { configured: true, model })
  assert.equal((await googleKey.POST(request(validInput))).status, 409)
  assert.equal((await googleKey.POST(request({ ...validInput, model }))).status, 200)
  assert.equal(sent.headers["x-goog-api-key"], "test-google-key")
  assert.equal(JSON.parse(sent.body).model, model)
})

test("missing, blocked or malformed Gemini audio returns a useful error instead of a broken clip", async () => {
  for (const result of [null, { steps: "invalid" }, {}, { steps: [{ type: "model_output", content: [{ type: "text", text: "blocked" }] }] },
    { steps: [{ type: "model_output", content: [{ type: "audio", data: "%%%" }] }] },
    { steps: [{ type: "model_output", content: [{ type: "audio", data: Buffer.from("invalid wav").toString("base64") }] }] }]) {
    const route = loadTs("src/app/api/audio/speech/route.ts", {
      process: { env: { GEMINI_API_KEY: "test-only-key" } }, fetch: async () => Response.json(result),
    })
    const response = await route.POST(request(validInput))
    assert.equal(response.status, 502)
    assert.ok((await response.json()).error.includes("Gemini"))
  }
})

test("audio cache reuses clips and separates tone, voice and model; it works without IndexedDB", async () => {
  let calls = 0
  const storage = loadTs("src/components/Audio/storage.ts", {
    crypto: webcrypto,
    indexedDB: { open() { throw new Error("storage disabled") } },
    fetch: async () => { calls += 1; return new Response(new Blob(["wav"], { type: "audio/wav" })) },
  })
  const signal = new AbortController().signal
  await storage.getAudioClip("book", chunks[0], settings, signal)
  await storage.getAudioClip("book", chunks[0], { ...settings, rate: 1.4 }, signal)
  assert.equal(calls, 1)
  await storage.getAudioClip("book", chunks[0], { ...settings, tone: "clear" }, signal)
  await storage.getAudioClip("book", chunks[0], { ...settings, voice: "Iapetus" }, signal)
  await storage.getAudioClip("book", chunks[0], { ...settings, model: "gemini-3.8-flash-lite-tts" }, signal)
  assert.equal(calls, 4)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(storage.getAudioClip("book", chunks[0], settings, controller.signal), { name: "AbortError" })
  assert.equal(calls, 4)
})

test("audio clips persist across reloads, preserve old book text on upgrade, and are removed with history", async () => {
  const stores = new Map([["bookTexts", new Map([["book", { id: "book", text: "old text" }]])]])
  let upgraded = false
  const db = {
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore(name) { stores.set(name, new Map()); return { createIndex() {} } },
    close() {},
    transaction() {
      const tx = {
        objectStore(name) {
          const records = stores.get(name)
          return {
            get(id) { const request = {}; queueMicrotask(() => { request.result = records.get(id); request.onsuccess?.() }); return request },
            put(record) { records.set(record.id, record); queueMicrotask(() => tx.oncomplete?.()) },
            delete(id) { records.delete(id) },
            index() {
              return { openKeyCursor(bookId) {
                const request = {}, matches = [...records].filter(([, record]) => record.bookId === bookId)
                let index = 0
                const advance = () => queueMicrotask(() => {
                  request.result = index < matches.length ? { primaryKey: matches[index++][0], continue: advance } : null
                  request.onsuccess?.()
                  if (!request.result) queueMicrotask(() => tx.oncomplete?.())
                })
                advance()
                return request
              } }
            },
          }
        },
      }
      return tx
    },
  }
  let calls = 0
  const globals = {
    crypto: webcrypto,
    IDBKeyRange: { only: (value) => value },
    indexedDB: { open(name, version) {
      assert.equal(version, 2)
      const request = {}
      queueMicrotask(() => {
        request.result = db
        if (!upgraded) { request.onupgradeneeded(); upgraded = true }
        request.onsuccess()
      })
      return request
    } },
    fetch: async () => { calls += 1; return new Response(new Blob(["wav"], { type: "audio/wav" })) },
  }
  const first = loadTs("src/components/Audio/storage.ts", globals)
  const signal = new AbortController().signal
  assert.equal(await first.getBookText("book"), "old text")
  await first.getAudioClip("book", chunks[0], settings, signal)
  const reloaded = loadTs("src/components/Audio/storage.ts", globals)
  await reloaded.getAudioClip("book", chunks[0], settings, signal)
  assert.equal(calls, 1)
  await reloaded.removeBookText("book")
  assert.equal(await reloaded.getBookText("book"), "")
  assert.equal(stores.get("audioClips").size, 0)
  await reloaded.getAudioClip("book", chunks[0], settings, signal)
  assert.equal(calls, 2)
})
