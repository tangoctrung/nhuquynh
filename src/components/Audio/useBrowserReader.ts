import { useEffect, useRef, useState } from "react"
import type { ReaderState } from "./ai-player"
import { BrowserSpeechPlayer } from "./browser-player"

export function useBrowserReader(options: {
  rate: number
  volume: number
  onProgress: (wordIndex: number) => void
  onStatus: (message: string) => void
}) {
  const callbacks = useRef(options)
  callbacks.current = options
  const player = useRef<BrowserSpeechPlayer | null>(null)
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const [state, setState] = useState<ReaderState>({ currentWordIndex: 0, isSpeaking: false, isPaused: false, isBuffering: false })

  useEffect(() => {
    setIsSupported("speechSynthesis" in window && "SpeechSynthesisUtterance" in window)
    const instance = new BrowserSpeechPlayer({
      onChange: (next) => { setState(next); callbacks.current.onProgress(next.currentWordIndex) },
      onStatus: (message) => callbacks.current.onStatus(message),
    })
    player.current = instance
    instance.setSettings(callbacks.current)
    return () => instance.dispose()
  }, [])

  useEffect(() => { player.current?.setSettings({ rate: options.rate, volume: options.volume }) }, [options.rate, options.volume])

  return {
    ...state,
    isSupported,
    setBook: (bookId: string, words: string[], wordIndex = 0) => player.current?.setBook(bookId, words, wordIndex),
    play: () => player.current?.play(),
    pause: () => player.current?.pause(),
    stop: () => player.current?.stop(),
    seek: (seconds: number) => player.current?.seek(seconds),
    getPosition: () => player.current?.getPosition(),
    getWordIndex: () => player.current?.getWordIndex() ?? 0,
  }
}
