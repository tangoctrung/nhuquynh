"use client"

import { useReducedMotion } from 'framer-motion'
import { useEffect, useRef, type RefObject } from 'react'
import styles from './OpeningLetter.module.css'

type Point = { x: number; y: number }

const palettes = [
  ['#ffe397', '#fff5d9', '#ffc174'],
  ['#ffb4d0', '#fff0f6', '#f78cae'],
  ['#a0eddf', '#e1fff6', '#c4d2ff'],
]
const flightDuration = 3100
const burstDuration = 1400
const cycleDuration = flightDuration + burstDuration + 1900

function LetterFireworks({ active, targetRef, onLaunch }: { active: boolean; targetRef: RefObject<HTMLDivElement | null>; onLaunch: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const target = targetRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !target || !active || reduceMotion) return

    let width = 0
    let height = 0
    let radius = 0
    let shots: { start: Point; end: Point }[] = []
    let frame = 0
    let elapsed = 0
    let lastFrame = 0
    let visible = false
    const lastLaunches = [-1, -1, -1]
    const sparks = palettes.map(palette => Array.from({ length: 32 }, (_, index) => ({
      angle: index * Math.PI * 2 / 32 + Math.random() * 0.12,
      reach: 0.55 + Math.random() * 0.45,
      color: palette[index % palette.length],
    })))

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const letter = target.getBoundingClientRect()
      width = bounds.width
      height = bounds.height
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      radius = Math.min(128, letter.width * 0.3)
      shots = [0.1, 0.5, 0.9].map((position, index) => ({
        start: { x: width * [0.12, 0.5, 0.88][index], y: height - 24 },
        end: {
          x: letter.left - bounds.left + letter.width * position,
          y: letter.top - bounds.top + letter.height * (index === 1 ? 0.12 : 0.24),
        },
      }))
    }

    const rocketPoint = (shot: { start: Point; end: Point }, progress: number): Point => ({
      x: shot.start.x + (shot.end.x - shot.start.x) * progress * progress,
      y: shot.start.y + (shot.end.y - shot.start.y) * (1 - (1 - progress) ** 2),
    })

    const line = (from: Point, to: Point, color: string, opacity: number, thickness: number) => {
      context.globalAlpha = opacity
      context.strokeStyle = color
      context.lineWidth = thickness
      context.beginPath()
      context.moveTo(from.x, from.y)
      context.lineTo(to.x, to.y)
      context.stroke()
    }

    const draw = (time: number) => {
      elapsed += time - lastFrame
      lastFrame = time
      context.clearRect(0, 0, width, height)
      context.lineCap = 'round'

      shots.forEach((shot, index) => {
        const shotTime = elapsed - 400 - index * 240
        const age = shotTime % cycleDuration
        if (shotTime < 0 || age > flightDuration + burstDuration) return
        if (age < flightDuration) {
          const cycle = Math.floor(shotTime / cycleDuration)
          if (lastLaunches[index] !== cycle) {
            lastLaunches[index] = cycle
            onLaunch()
          }
          const progress = age / flightDuration
          for (let segment = 0; segment < 14; segment++) {
            const tail = Math.max(0, progress - (14 - segment) * 0.012)
            line(rocketPoint(shot, tail), rocketPoint(shot, Math.min(progress, tail + 0.012)), palettes[index][0], (segment + 1) / 18, 2)
          }
          const head = rocketPoint(shot, progress)
          line({ x: head.x - 3, y: head.y }, { x: head.x + 3, y: head.y }, palettes[index][1], 1, 2)
          line({ x: head.x, y: head.y - 4 }, { x: head.x, y: head.y + 4 }, palettes[index][1], 1, 2)
          return
        }

        const progress = (age - flightDuration) / burstDuration
        const distance = radius * (1 - (1 - progress) ** 3)
        const previousDistance = radius * (1 - (1 - Math.max(0, progress - 0.13)) ** 3)
        const opacity = (1 - progress) ** 1.3
        sparks[index].forEach(spark => {
          const point = (travel: number): Point => ({
            x: shot.end.x + Math.cos(spark.angle) * travel * spark.reach,
            y: shot.end.y + Math.sin(spark.angle) * travel * spark.reach + 35 * progress * progress,
          })
          const head = point(distance)
          line(point(previousDistance), head, spark.color, opacity, 1.6)
          context.fillStyle = spark.color
          context.beginPath()
          context.arc(head.x, head.y, 1.4, 0, Math.PI * 2)
          context.fill()
        })
      })
      context.globalAlpha = 1
      frame = requestAnimationFrame(draw)
    }

    const syncPlayback = () => {
      cancelAnimationFrame(frame)
      if (visible && !document.hidden) {
        lastFrame = performance.now()
        frame = requestAnimationFrame(draw)
      } else {
        // Hidden shots lose their audio, so resume with a fresh synchronized volley.
        elapsed = 0
        lastLaunches.fill(-1)
        context.clearRect(0, 0, width, height)
      }
    }

    const resizeObserver = new ResizeObserver(resize)
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio > 0.1
      syncPlayback()
    }, { threshold: [0, 0.1] })
    resize()
    resizeObserver.observe(canvas)
    resizeObserver.observe(target)
    visibilityObserver.observe(canvas)
    document.addEventListener('visibilitychange', syncPlayback)
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      document.removeEventListener('visibilitychange', syncPlayback)
      context.clearRect(0, 0, width, height)
    }
  }, [active, reduceMotion, targetRef, onLaunch])

  return <canvas ref={canvasRef} className={styles.fireworks} aria-hidden='true' />
}

export default LetterFireworks
