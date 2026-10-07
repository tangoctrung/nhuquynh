"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

type MusicGraph = {
  context: AudioContext
  gain: GainNode
  buffer: AudioBuffer | null
  source: AudioBufferSourceNode | null
  offset: number
  startedAt: number
}

function note(context: BaseAudioContext, output: AudioNode, frequency: number, at: number, length: number, volume: number, attack: number) {
  const tone = context.createOscillator()
  const envelope = context.createGain()
  tone.type = 'sine'
  tone.frequency.value = frequency
  envelope.gain.setValueAtTime(0, at)
  envelope.gain.linearRampToValueAtTime(volume, at + attack)
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + length)
  tone.connect(envelope).connect(output)
  tone.onended = () => { tone.disconnect(); envelope.disconnect() }
  tone.start(at)
  tone.stop(at + length)
}

async function renderMusic() {
  const OfflineContext = window.OfflineAudioContext || (window as Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
  if (!OfflineContext) return null
  const duration = 28.8
  const context = new OfflineContext(1, Math.ceil(44100 * duration), 44100)
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 2200
  filter.connect(context.destination)
  const chords = [
    [261.63, 329.63, 392, 493.88],
    [220, 261.63, 329.63, 392],
    [174.61, 220, 261.63, 329.63],
    [196, 246.94, 293.66, 392],
  ]
  const pattern = [0, 1, 2, 3, 2, 1, 2, 0]
  chords.forEach((chord, bar) => {
    const start = bar * 7.2
    note(context, filter, chord[0] / 2, start, 6.8, 0.035, 0.4)
    chord.forEach(frequency => note(context, filter, frequency, start, 6.8, 0.012, 0.5))
    pattern.forEach((pitch, beat) => {
      const at = start + beat * 0.9
      // Decay the last notes inside the buffer for a quiet, click-free loop.
      const length = Math.min(2.4, duration - at - 0.04)
      note(context, filter, chord[pitch] * 2, at, length, 0.11, 0.025)
      note(context, filter, chord[pitch] * 4, at, Math.min(0.8, length), 0.009, 0.02)
    })
  })
  return context.startRendering()
}

export default function useEndMusic(isActive: boolean) {
  const graphRef = useRef<MusicGraph | null>(null)
  const activeRef = useRef(isActive)
  const enabledRef = useRef(true)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const stop = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    if (graph.source) {
      graph.offset += graph.context.currentTime - graph.startedAt
      graph.source.stop()
      graph.source.disconnect()
      graph.source = null
    }
    graph.gain.gain.cancelScheduledValues(graph.context.currentTime)
    graph.gain.gain.value = 0
  }, [])

  const start = useCallback(() => {
    const graph = graphRef.current
    if (!graph?.buffer || graph.source || graph.context.state !== 'running' || !activeRef.current || !enabledRef.current || document.hidden) return
    const source = graph.context.createBufferSource()
    source.buffer = graph.buffer
    source.loop = true
    source.connect(graph.gain)
    graph.source = source
    graph.startedAt = graph.context.currentTime
    graph.gain.gain.cancelScheduledValues(graph.startedAt)
    graph.gain.gain.setValueAtTime(0, graph.startedAt)
    graph.gain.gain.linearRampToValueAtTime(0.65, graph.startedAt + 1.5)
    source.start(0, graph.offset % graph.buffer.duration)
  }, [])

  const sync = useCallback(() => {
    const graph = graphRef.current
    if (!graph || graph.context.state === 'closed') return
    if (!activeRef.current || !enabledRef.current || document.hidden) {
      stop()
      if (graph.context.state === 'running') void graph.context.suspend().catch(() => {})
    } else if (graph.context.state === 'running') start()
    else void graph.context.resume().then(() => {
      if (graphRef.current !== graph) return
      if (activeRef.current && enabledRef.current && !document.hidden) start()
      else {
        stop()
        void graph.context.suspend().catch(() => {})
      }
    }).catch(() => {})
  }, [start, stop])

  const unlock = useCallback(() => {
    if (!enabledRef.current || document.hidden) return
    try {
      if (!graphRef.current) {
        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioContextClass) return
        const context = new AudioContextClass()
        const gain = context.createGain()
        gain.gain.value = 0
        gain.connect(context.destination)
        const graph: MusicGraph = { context, gain, buffer: null, source: null, offset: 0, startedAt: 0 }
        graphRef.current = graph
        void renderMusic().then(buffer => {
          if (graphRef.current !== graph) return
          graph.buffer = buffer
          start()
        }).catch(() => {})
      }
      const context = graphRef.current.context
      if (context.state === 'running') sync()
      else if (context.state !== 'closed') void context.resume().then(sync).catch(() => {})
    } catch {
      // Browsers without audio support still show the complete ending scene.
    }
  }, [start, sync])

  const toggleSound = useCallback(() => {
    enabledRef.current = !enabledRef.current
    setSoundEnabled(enabledRef.current)
    if (enabledRef.current) unlock()
    else sync()
  }, [sync, unlock])

  useEffect(() => {
    activeRef.current = isActive
    sync()
  }, [isActive, sync])

  useEffect(() => {
    const onGesture = (event: Event) => { if (event.isTrusted) unlock() }
    const gestures = ['pointerdown', 'touchend', 'click', 'keydown'] as const
    gestures.forEach(event => document.addEventListener(event, onGesture, { capture: true, passive: true }))
    document.addEventListener('visibilitychange', sync)
    return () => {
      gestures.forEach(event => document.removeEventListener(event, onGesture, true))
      document.removeEventListener('visibilitychange', sync)
      stop()
      const graph = graphRef.current
      graphRef.current = null
      if (graph) void graph.context.close().catch(() => {})
    }
  }, [stop, sync, unlock])

  return { soundEnabled, toggleSound }
}
