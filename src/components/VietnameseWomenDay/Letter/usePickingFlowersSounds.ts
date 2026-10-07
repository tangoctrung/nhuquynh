"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

type AudioGraph = {
  context: AudioContext
  output: GainNode
  effects: GainNode
  musicGain: GainNode
  noise: AudioBuffer
  music: AudioBuffer | null
  musicSource: AudioBufferSourceNode | null
  musicOffset: number
  musicStartedAt: number
  request: AbortController
  sources: Map<AudioScheduledSourceNode, AudioNode[]>
}

function track(graph: AudioGraph, source: AudioScheduledSourceNode, nodes: AudioNode[]) {
  graph.sources.set(source, nodes)
  source.onended = () => {
    graph.sources.delete(source)
    nodes.forEach(node => node.disconnect())
  }
}

function tone(graph: AudioGraph, frequency: number, endFrequency: number, duration: number, volume: number, delay = 0) {
  const start = graph.context.currentTime + delay
  const source = graph.context.createOscillator()
  const gain = graph.context.createGain()
  source.type = 'sine'
  source.frequency.setValueAtTime(frequency, start)
  source.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.018)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(gain).connect(graph.effects)
  track(graph, source, [source, gain])
  source.start(start)
  source.stop(start + duration)
}

function splash(graph: AudioGraph, duration: number, volume: number) {
  const start = graph.context.currentTime
  const source = graph.context.createBufferSource()
  const filter = graph.context.createBiquadFilter()
  const gain = graph.context.createGain()
  source.buffer = graph.noise
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1400, start)
  filter.frequency.exponentialRampToValueAtTime(380, start + duration)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter).connect(gain).connect(graph.effects)
  track(graph, source, [source, filter, gain])
  source.start(start)
  source.stop(start + duration)
}

function usePickingFlowersSounds(isActive: boolean) {
  const graphRef = useRef<AudioGraph | null>(null)
  const activeRef = useRef(isActive)
  const enabledRef = useRef(true)
  const lastLeafRef = useRef(-Infinity)
  const lastWaterRef = useRef(-Infinity)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const stopSounds = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    if (graph.musicSource) {
      graph.musicOffset += graph.context.currentTime - graph.musicStartedAt
      graph.musicSource.stop()
      graph.musicSource.disconnect()
      graph.musicSource = null
    }
    graph.musicGain.gain.cancelScheduledValues(graph.context.currentTime)
    graph.musicGain.gain.value = 0
    graph.sources.forEach((nodes, source) => {
      source.onended = null
      source.stop()
      nodes.forEach(node => node.disconnect())
    })
    graph.sources.clear()
  }, [])

  const startMusic = useCallback(() => {
    const graph = graphRef.current
    if (!graph || !graph.music || graph.musicSource || graph.context.state !== 'running' || !activeRef.current || !enabledRef.current || document.hidden) return
    const source = graph.context.createBufferSource()
    source.buffer = graph.music
    source.loop = true
    source.connect(graph.musicGain)
    graph.musicSource = source
    graph.musicStartedAt = graph.context.currentTime
    graph.musicGain.gain.cancelScheduledValues(graph.context.currentTime)
    graph.musicGain.gain.setValueAtTime(0, graph.context.currentTime)
    graph.musicGain.gain.linearRampToValueAtTime(0.3, graph.context.currentTime + 0.8)
    source.start(0, graph.musicOffset % graph.music.duration)
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
        const effects = context.createGain()
        const musicGain = context.createGain()
        output.gain.value = 0.6
        effects.gain.value = 0.65
        musicGain.gain.value = 0
        output.connect(context.destination)
        effects.connect(output)
        musicGain.connect(output)

        // A quiet, filtered echo gives the chimes a little space, not a sharp beep.
        const echo = context.createDelay(0.5)
        const echoFilter = context.createBiquadFilter()
        const feedback = context.createGain()
        const wet = context.createGain()
        echo.delayTime.value = 0.19
        echoFilter.type = 'lowpass'
        echoFilter.frequency.value = 1800
        feedback.gain.value = 0.16
        wet.gain.value = 0.12
        effects.connect(echo).connect(echoFilter)
        echoFilter.connect(feedback).connect(echo)
        echoFilter.connect(wet).connect(output)

        const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.3), context.sampleRate)
        const samples = noise.getChannelData(0)
        for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1
        const graph: AudioGraph = {
          context, output, effects, musicGain, noise,
          music: null, musicSource: null, musicOffset: 0, musicStartedAt: 0,
          request: new AbortController(), sources: new Map(),
        }
        graphRef.current = graph
        void fetch('/vietnamese-women-day/soundBg.mp3', { signal: graph.request.signal })
          .then(response => {
            if (!response.ok) throw new Error('Background audio unavailable')
            return response.arrayBuffer()
          })
          .then(data => graphRef.current === graph ? context.decodeAudioData(data) : null)
          .then(recording => {
            if (graphRef.current !== graph) return
            graph.music = recording
            startMusic()
          })
          .catch(() => {})
      }
      const graph = graphRef.current
      if (graph.context.state === 'running') syncPlayback()
      else if (graph.context.state !== 'closed') void graph.context.resume().then(syncPlayback).catch(() => {})
    } catch {
      // The scene remains usable when audio is unavailable or blocked.
    }
  }, [startMusic, syncPlayback])

  const toggleSound = useCallback(() => {
    enabledRef.current = !enabledRef.current
    setSoundEnabled(enabledRef.current)
    if (enabledRef.current) unlockAudio()
    else syncPlayback()
  }, [syncPlayback, unlockAudio])

  const playLeafWater = useCallback(() => {
    const graph = graphRef.current
    if (!graph || !activeRef.current || !enabledRef.current || document.hidden || graph.context.state !== 'running' || graph.context.currentTime - lastLeafRef.current < 0.1 || graph.sources.size > 48) return
    lastLeafRef.current = graph.context.currentTime
    tone(graph, 480, 210, 0.19, 0.12)
    tone(graph, 740, 620, 0.3, 0.035, 0.05)
    splash(graph, 0.06, 0.045)
  }, [])

  const playWater = useCallback(() => {
    if (!activeRef.current || !enabledRef.current || document.hidden) return
    unlockAudio()
    const graph = graphRef.current
    if (!graph || graph.context.state === 'closed' || graph.context.currentTime - lastWaterRef.current < 0.09 || graph.sources.size > 48) return
    lastWaterRef.current = graph.context.currentTime
    tone(graph, 560, 160, 0.25, 0.22)
    tone(graph, 390, 190, 0.2, 0.09, 0.08)
    tone(graph, 587.33, 587.33, 0.4, 0.06, 0.12)
    splash(graph, 0.1, 0.085)
  }, [unlockAudio])

  const playFlower = useCallback((special: boolean) => {
    if (!activeRef.current || !enabledRef.current || document.hidden) return
    unlockAudio()
    const graph = graphRef.current
    if (!graph || graph.context.state === 'closed' || graph.sources.size > 48) return
    const notes = [293.66, 349.23, 440, 659.25]
    if (special) notes.push(783.99, 880)
    notes.forEach((frequency, index) => {
      const delay = index * 0.13
      tone(graph, frequency, frequency, 0.75, 0.16, delay)
      tone(graph, frequency * 2, frequency * 2, 0.38, 0.025, delay)
    })
  }, [unlockAudio])

  useEffect(() => {
    activeRef.current = isActive
    syncPlayback()
  }, [isActive, syncPlayback])

  useEffect(() => {
    const unlockOnGesture = (event: Event) => {
      if (event.isTrusted) unlockAudio()
    }
    const gestures = ['pointerdown', 'touchend', 'click', 'keydown'] as const
    gestures.forEach(event => document.addEventListener(event, unlockOnGesture, { capture: true, passive: true }))
    document.addEventListener('visibilitychange', syncPlayback)
    return () => {
      gestures.forEach(event => document.removeEventListener(event, unlockOnGesture, true))
      document.removeEventListener('visibilitychange', syncPlayback)
      stopSounds()
      const graph = graphRef.current
      graphRef.current = null
      if (graph) {
        graph.request.abort()
        void graph.context.close().catch(() => {})
      }
    }
  }, [stopSounds, syncPlayback, unlockAudio])

  return { soundEnabled, toggleSound, playLeafWater, playWater, playFlower }
}

export default usePickingFlowersSounds
