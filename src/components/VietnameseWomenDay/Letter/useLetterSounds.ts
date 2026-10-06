"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

type AudioGraph = {
  context: AudioContext;
  output: GainNode;
  noise: AudioBuffer;
  firework: AudioBuffer | null;
  fireworkRequest: AbortController;
  sources: Map<AudioScheduledSourceNode, AudioNode[]>;
};

function track(
  graph: AudioGraph,
  source: AudioScheduledSourceNode,
  nodes: AudioNode[],
) {
  graph.sources.set(source, nodes);
  source.onended = () => {
    graph.sources.delete(source);
    nodes.forEach((node) => node.disconnect());
  };
}

function tone(
  graph: AudioGraph,
  frequency: number,
  endFrequency: number,
  duration: number,
  volume: number,
  delay = 0,
  type: OscillatorType = "sine",
) {
  const start = graph.context.currentTime + delay;
  const source = graph.context.createOscillator();
  const gain = graph.context.createGain();
  source.type = type;
  source.frequency.setValueAtTime(frequency, start);
  source.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(gain).connect(graph.output);
  track(graph, source, [source, gain]);
  source.start(start);
  source.stop(start + duration);
}

function noise(
  graph: AudioGraph,
  duration: number,
  volume: number,
  frequency: number,
  endFrequency: number,
  type: BiquadFilterType,
  attack = 0.008,
) {
  const start = graph.context.currentTime;
  const source = graph.context.createBufferSource();
  const filter = graph.context.createBiquadFilter();
  const gain = graph.context.createGain();
  source.buffer = graph.noise;
  filter.type = type;
  filter.Q.value = 0.6;
  filter.frequency.setValueAtTime(frequency, start);
  filter.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(filter).connect(gain).connect(graph.output);
  track(graph, source, [source, filter, gain]);
  source.start(start);
  source.stop(start + duration);
}

function useLetterSounds(stageRef: RefObject<HTMLDivElement | null>) {
  const graphRef = useRef<AudioGraph | null>(null);
  const enabledRef = useRef(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const stopSounds = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.sources.forEach((nodes, source) => {
      source.onended = null;
      source.stop();
      nodes.forEach((node) => node.disconnect());
    });
    graph.sources.clear();
  }, []);

  const unlockAudio = useCallback(() => {
    if (!enabledRef.current) return;
    try {
      if (!graphRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const output = context.createGain();
        output.gain.value = 0.24;
        output.connect(context.destination);
        const buffer = context.createBuffer(
          1,
          context.sampleRate,
          context.sampleRate,
        );
        const samples = buffer.getChannelData(0);
        for (let index = 0; index < samples.length; index++)
          samples[index] = Math.random() * 2 - 1;
        const graph: AudioGraph = {
          context,
          output,
          noise: buffer,
          firework: null,
          fireworkRequest: new AbortController(),
          sources: new Map(),
        };
        graphRef.current = graph;
        void fetch("/vietnamese-women-day/firework-burst.mp3", {
          signal: graph.fireworkRequest.signal,
        })
          .then((response) => {
            if (!response.ok) throw new Error("Firework audio unavailable");
            return response.arrayBuffer();
          })
          .then((data) => {
            if (graphRef.current !== graph) return null;
            return context.decodeAudioData(data);
          })
          .then((recording) => {
            if (graphRef.current === graph) graph.firework = recording;
          })
          .catch(() => {});
      }
      const context = graphRef.current.context;
      if (context.state !== "running" && context.state !== "closed")
        void context.resume().catch(() => {});
    } catch {
      // Audio is optional; unsupported or blocked devices can still open the letter.
    }
  }, []);

  const toggleSound = useCallback(() => {
    const enabled = !enabledRef.current;
    enabledRef.current = enabled;
    setSoundEnabled(enabled);
    const graph = graphRef.current;
    if (graph) graph.output.gain.value = enabled ? 0.24 : 0;
    if (enabled) unlockAudio();
    else stopSounds();
  }, [stopSounds, unlockAudio]);

  const playFirework = useCallback(() => {
    const graph = graphRef.current;
    if (
      !enabledRef.current ||
      !graph?.firework ||
      graph.context.state !== "running"
    )
      return;
    const source = graph.context.createBufferSource();
    const gain = graph.context.createGain();
    const start = graph.context.currentTime;
    source.buffer = graph.firework;
    source.playbackRate.value = 1;
    gain.gain.value = 0.6;
    source.connect(gain).connect(graph.output);
    track(graph, source, [source, gain]);
    source.start(start);
    source.stop(start + graph.firework.duration);
  }, []);

  const playOpen = useCallback(() => {
    unlockAudio();
    const graph = graphRef.current;
    if (!enabledRef.current || !graph || graph.context.state === "closed")
      return;
    tone(graph, 440, 180, 0.1, 0.3, 0, "triangle");
    noise(graph, 0.07, 0.14, 1800, 900, "highpass");
  }, [unlockAudio]);

  const playReveal = useCallback(() => {
    const graph = graphRef.current;
    if (!enabledRef.current || !graph || graph.context.state === "closed")
      return;
    noise(graph, 0.45, 0.2, 700, 3500, "bandpass", 0.12);
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => {
      tone(graph, frequency, frequency, 0.7, 0.18, 0.25 + index * 0.16);
      tone(graph, frequency * 2, frequency * 2, 0.4, 0.04, 0.25 + index * 0.16);
    });
  }, []);

  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.hidden) stopSounds();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || entry.intersectionRatio <= 0.1)
          stopSounds();
      },
      { threshold: [0, 0.1] },
    );
    if (stageRef.current) observer.observe(stageRef.current);
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", stopWhenHidden);
      stopSounds();
      const graph = graphRef.current;
      graphRef.current = null;
      if (graph) {
        graph.fireworkRequest.abort();
        void graph.context.close().catch(() => {});
      }
    };
  }, [stageRef, stopSounds]);

  return {
    soundEnabled,
    toggleSound,
    unlockAudio,
    playFirework,
    playOpen,
    playReveal,
    stopSounds,
  };
}

export default useLetterSounds;
