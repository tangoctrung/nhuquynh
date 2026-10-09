import { useEffect, useRef, useState } from "react"
import { type AudioPosition, type VoiceSettings } from "@/lib/audio/speech"
import { AiAudioPlayer, type ReaderState } from "./ai-player"
import { getAudioClip } from "./storage"

export function useAiReader(options: {
  settings: VoiceSettings
  onProgress: (wordIndex: number) => void
  onStatus: (message: string) => void
}) {
  const callbacks = useRef(options)
  callbacks.current = options
  const player = useRef<AiAudioPlayer | null>(null)
  const [state, setState] = useState<ReaderState>({ currentWordIndex: 0, isSpeaking: false, isPaused: false, isBuffering: false })

  useEffect(() => {
    const instance = new AiAudioPlayer({
      getClip: getAudioClip,
      onChange: (next) => {
        setState(next)
        callbacks.current.onProgress(next.currentWordIndex)
      },
      onStatus: (message) => callbacks.current.onStatus(message),
    })
    player.current = instance
    instance.setSettings(callbacks.current.settings)
    return () => {
      instance.dispose()
    }
  }, [])

  const { language, tone, voice, model, rate, volume } = options.settings
  useEffect(() => {
    player.current?.setSettings({ language, tone, voice, model, rate, volume })
  }, [language, tone, voice, model, rate, volume])

  return {
    ...state,
    setBook: (bookId: string, words: string[], wordIndex = 0, position?: AudioPosition) => player.current?.setBook(bookId, words, wordIndex, position),
    play: () => player.current?.play(),
    pause: () => player.current?.pause(),
    stop: () => player.current?.stop(),
    seek: (seconds: number) => player.current?.seek(seconds),
    getPosition: () => player.current?.getPosition(),
    getWordIndex: () => player.current?.getWordIndex() ?? 0,
  }
}
