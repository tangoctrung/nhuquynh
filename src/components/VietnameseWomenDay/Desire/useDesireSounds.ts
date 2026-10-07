"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

type AudioGraph = {
  context: AudioContext
  musicGain: GainNode
  effects: GainNode
  music: AudioBuffer | null
  musicSource: AudioBufferSourceNode | null
  offset: number
  startedAt: number
  sources: Map<OscillatorNode, GainNode>
}

function note(context: BaseAudioContext, output: AudioNode, frequency: number, start: number, duration: number, volume: number, attack = 0.02, sources?: Map<OscillatorNode, GainNode>) {
  const source = context.createOscillator()
  const gain = context.createGain()
  source.type = 'sine'
  source.frequency.value = frequency
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(gain).connect(output)
  sources?.set(source, gain)
  source.onended = () => {
    sources?.delete(source)
    source.disconnect()
    gain.disconnect()
  }
  source.start(start)
  source.stop(start + duration)
}

async function renderRomanticMusic() {
  const OfflineContext = window.OfflineAudioContext || (window as Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
  if (!OfflineContext) return null
  const duration = 19.2
  const context = new OfflineContext(1, Math.ceil(44100 * duration), 44100)
  const output = context.createGain()
  const filter = context.createBiquadFilter()
  output.gain.value = 0.75
  filter.type = 'lowpass'
  filter.frequency.value = 2400
  output.connect(filter).connect(context.destination)
  const chords = [
    [261.63, 329.63, 392, 493.88],
    [220, 261.63, 329.63, 392],
    [174.61, 220, 261.63, 329.63],
    [196, 246.94, 293.66, 440],
  ]
  const pattern = [0, 2, 1, 3, 2, 1, 0, 2]
  chords.forEach((chord, bar) => {
    const start = bar * 4.8
    note(context, output, chord[0] / 2, start, 4.4, 0.07, 0.3)
    chord.forEach(frequency => note(context, output, frequency, start + 0.1, 4.2, 0.025, 0.28))
    pattern.forEach((pitch, beat) => {
      const at = start + beat * 0.6
      // Let the final notes decay before the loop boundary to avoid a sharp cut.
      const length = Math.min(1.6, duration - at - 0.04)
      note(context, output, chord[pitch], at, length, 0.16)
      note(context, output, chord[pitch] * 2, at, Math.min(0.7, length), 0.018)
    })
  })
  return context.startRendering()
}

function useDesireSounds(isActive: boolean) {
  const graphRef = useRef<AudioGraph | null>(null)
  const activeRef = useRef(isActive)
  const enabledRef = useRef(true)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const stopSounds = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    if (graph.musicSource) {
      graph.offset += graph.context.currentTime - graph.startedAt
      graph.musicSource.stop()
      graph.musicSource.disconnect()
      graph.musicSource = null
    }
    graph.musicGain.gain.cancelScheduledValues(graph.context.currentTime)
    graph.musicGain.gain.value = 0
    graph.sources.forEach((gain, source) => {
      source.onended = null
      source.stop()
      source.disconnect()
      gain.disconnect()
    })
    graph.sources.clear()
  }, [])

  const startMusic = useCallback(() => {
    const graph = graphRef.current
    if (!graph?.music || graph.musicSource || graph.context.state !== 'running' || !activeRef.current || !enabledRef.current || document.hidden) return
    const source = graph.context.createBufferSource()
    source.buffer = graph.music
    source.loop = true
    source.connect(graph.musicGain)
    graph.musicSource = source
    graph.startedAt = graph.context.currentTime
    graph.musicGain.gain.cancelScheduledValues(graph.startedAt)
    graph.musicGain.gain.setValueAtTime(0, graph.startedAt)
    graph.musicGain.gain.linearRampToValueAtTime(0.7, graph.startedAt + 1.2)
    source.start(0, graph.offset % graph.music.duration)
  }, [])

  const syncPlayback = useCallback(() => {
    const graph = graphRef.current
    if (!graph || graph.context.state === 'closed') return
    if (!activeRef.current || !enabledRef.current || document.hidden) {
      stopSounds()
      if (graph.context.state === 'running') void graph.context.suspend().catch(() => {})
      return
    }
    if (graph.context.state === 'running') startMusic()
    else void graph.context.resume().then(() => {
      if (graphRef.current !== graph) return
      if (activeRef.current && enabledRef.current && !document.hidden) startMusic()
      else {
        stopSounds()
        void graph.context.suspend().catch(() => {})
      }
    }).catch(() => {})
  }, [startMusic, stopSounds])

  const unlockAudio = useCallback(() => {
    if (!enabledRef.current || document.hidden) return
    try {
      if (!graphRef.current) {
        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioContextClass) return
        const context = new AudioContextClass()
        const output = context.createGain()
        const musicGain = context.createGain()
        const effects = context.createGain()
        output.gain.value = 0.6
        effects.gain.value = 0.6
        musicGain.gain.value = 0
        output.connect(context.destination)
        effects.connect(output)
        musicGain.connect(output)
        const graph: AudioGraph = { context, musicGain, effects, music: null, musicSource: null, offset: 0, startedAt: 0, sources: new Map() }
        graphRef.current = graph
        void renderRomanticMusic().then(buffer => {
          if (graphRef.current !== graph) return
          graph.music = buffer
          startMusic()
        }).catch(() => {})
      }
      const context = graphRef.current.context
      if (context.state === 'running') syncPlayback()
      else if (context.state !== 'closed') void context.resume().then(syncPlayback).catch(() => {})
    } catch {
      // Sound is optional; unsupported browsers can still write and send a wish.
    }
  }, [startMusic, syncPlayback])

  const toggleSound = useCallback(() => {
    enabledRef.current = !enabledRef.current
    setSoundEnabled(enabledRef.current)
    if (enabledRef.current) unlockAudio()
    else syncPlayback()
  }, [syncPlayback, unlockAudio])

  const playSend = useCallback(() => {
    if (!activeRef.current || !enabledRef.current || document.hidden) return
    unlockAudio()
    const graph = graphRef.current
    if (!graph || graph.context.state === 'closed' || graph.sources.size > 24) return
    const start = graph.context.currentTime
    const frequencies = [523.25, 659.25, 783.99, 1046.5]
    frequencies.forEach((frequency, index) => {
      const at = start + index * 0.12
      note(graph.context, graph.effects, frequency, at, 0.8, 0.14, 0.015, graph.sources)
      note(graph.context, graph.effects, frequency * 2, at, 0.4, 0.018, 0.015, graph.sources)
    })
  }, [unlockAudio])

  useEffect(() => {
    activeRef.current = isActive
    syncPlayback()
  }, [isActive, syncPlayback])

  useEffect(() => {
    const unlockOnGesture = (event: Event) => { if (event.isTrusted) unlockAudio() }
    const gestures = ['pointerdown', 'touchend', 'click', 'keydown'] as const
    gestures.forEach(event => document.addEventListener(event, unlockOnGesture, { capture: true, passive: true }))
    document.addEventListener('visibilitychange', syncPlayback)
    return () => {
      gestures.forEach(event => document.removeEventListener(event, unlockOnGesture, true))
      document.removeEventListener('visibilitychange', syncPlayback)
      stopSounds()
      const graph = graphRef.current
      graphRef.current = null
      if (graph) void graph.context.close().catch(() => {})
    }
  }, [stopSounds, syncPlayback, unlockAudio])

  return { soundEnabled, toggleSound, playSend }
}

export default useDesireSounds
