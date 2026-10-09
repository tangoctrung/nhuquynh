"use client"

import { useReducedMotion } from 'framer-motion'
import { Icon } from '@iconify/react'
import Image from 'next/image'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import styles from './PickingFlowers.module.css'
import FlowerTree, { canopyLeafAnchors } from './FlowerTree'
import dialogIcons from './flowerDialogIcons.json'
import usePickingFlowersSounds from './usePickingFlowersSounds'

function PickingFlowers() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const islandRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const leafCanvasRef = useRef<HTMLCanvasElement>(null)
  const waterRef = useRef<HTMLButtonElement>(null)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const closeHelp = useCallback(() => setIsHelpOpen(false), [])
  const { soundEnabled, toggleSound, playLeafWater, playWater, playFlower } = usePickingFlowersSounds(isActive)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const scene = sceneRef.current
    const canvas = canvasRef.current
    const leafCanvas = leafCanvasRef.current
    const tree = treeRef.current
    const water = waterRef.current
    const context = canvas?.getContext('2d')
    const leafContext = leafCanvas?.getContext('2d')
    if (!scene || !canvas || !context || !leafCanvas || !leafContext || !tree || !water) return

    const colors = ['#e8f5ff', '#fff0d6', '#b9e8dd']
    const stars = Array.from({ length: 480 }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      radius: 0.45 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      period: 2.8 + Math.random() * 5,
      color: colors[index % colors.length],
      sparkle: index % 9 === 0,
    }))
    const comets = [
      { fromX: 0.08, fromY: 0.08, toX: 0.72, toY: 0.38, delay: 1.4, duration: 1.8, period: 10, color: '#d9f6ff' },
      { fromX: 0.96, fromY: 0.2, toX: 0.57, toY: 0.52, delay: 4.8, duration: 2, period: 13, color: '#ffe8cf' },
      { fromX: 0.3, fromY: 0.03, toX: 0.84, toY: 0.32, delay: 8.5, duration: 1.6, period: 16, color: '#d2efdf' },
    ]
    const planets = [
      { x: 0.18, y: 0.18, radius: 45, period: 64, phase: 0.5, light: '#c9e1d9', surface: '#648f83', dark: '#12292a', ring: false },
      { x: 0.81, y: 0.29, radius: 34, period: 86, phase: 2.8, light: '#f0dfbb', surface: '#b0946e', dark: '#382c27', ring: true },
      { x: 0.6, y: 0.12, radius: 25, period: 100, phase: 4.2, light: '#efcbd2', surface: '#ac798c', dark: '#392131', ring: false },
    ]
    const backdrop = document.createElement('canvas')
    const backdropContext = backdrop.getContext('2d')
    const reflectedSky = document.createElement('canvas')
    const reflectionContext = reflectedSky.getContext('2d')
    let ripples: { x: number; y: number; born: number; kind: 'click' | 'leaf' }[] = []
    let leaves: { x: number; y: number; startX: number; startY: number; born: number; duration: number; phase: number; color: string; landed: boolean }[] = []
    let nextLeafAt = 3.8
    let feedbackTimer: ReturnType<typeof setTimeout> | undefined
    let width = 0
    let height = 0
    let count = 160
    let frame = 0
    let elapsed = 0
    let lastFrame = 0
    let lastPaint = 0
    let visible = false

    const paint = (seconds: number) => {
      context.clearRect(0, 0, width, height)
      leafContext.clearRect(0, 0, width, height)
      const horizon = height * 2 / 3
      if (!reduceMotion && visible && seconds >= nextLeafAt) {
        const treeBounds = tree.getBoundingClientRect()
        const islandBounds = islandRef.current?.getBoundingClientRect()
        const sceneBounds = scene.getBoundingClientRect()
        const shore = islandBounds ? (islandBounds.left - sceneBounds.left) / width : 0.15
        const anchors = [...canopyLeafAnchors]
        const batchSize = 2 + Math.floor(Math.random() * 2)
        // Stagger leaves from distinct canopy points, landing beside the island.
        for (let index = 0; index < batchSize; index++) {
          const [anchor] = anchors.splice(Math.floor(Math.random() * anchors.length), 1)
          const inset = Math.max(12 / width, shore * (0.45 + Math.random() * 0.3))
          const x = anchor.x < 0.5 ? inset : 1 - inset
          leaves.push({
            x,
            y: 0.8 + Math.random() * 0.13,
            startX: (treeBounds.left - sceneBounds.left + treeBounds.width * anchor.x) / width,
            startY: (treeBounds.top - sceneBounds.top + treeBounds.height * anchor.y) / height,
            born: seconds + index * 0.16,
            duration: 3.6 + Math.random() * 0.8,
            phase: Math.random() * Math.PI * 2,
            color: ['#667049', '#887550', '#577052'][Math.floor(Math.random() * 3)],
            landed: false,
          })
        }
        nextLeafAt = seconds + 8 + Math.random() * 5
      }
      leaves = leaves.filter(leaf => seconds - leaf.born < leaf.duration + 3)
      for (const leaf of leaves) {
        if (!leaf.landed && seconds - leaf.born >= leaf.duration) {
          leaf.landed = true
          playLeafWater()
          ripples.push({ x: leaf.x, y: leaf.y, born: leaf.born + leaf.duration, kind: 'leaf' })
          ripples = ripples.slice(-8)
        }
      }
      if (backdrop.width && backdrop.height) context.drawImage(backdrop, 0, 0, width, height)
      for (let index = 0; index < count; index++) {
        const star = stars[index]
        const brightness = 0.5 + Math.sin(seconds * Math.PI * 2 / star.period + star.phase) * 0.5
        const x = star.x * width
        const y = star.y * (horizon - 8)
        context.globalAlpha = 0.2 + brightness * 0.7
        context.fillStyle = star.color
        context.beginPath()
        context.arc(x, y, star.radius, 0, Math.PI * 2)
        context.fill()

        if (star.sparkle && brightness > 0.75) {
          const reach = star.radius * (2 + brightness)
          context.globalAlpha *= 0.55
          context.strokeStyle = star.color
          context.lineWidth = 0.65
          context.beginPath()
          context.moveTo(x - reach, y)
          context.lineTo(x + reach, y)
          context.moveTo(x, y - reach)
          context.lineTo(x, y + reach)
          context.stroke()
        }

      }

      planets.forEach(planet => {
        const phase = seconds * Math.PI * 2 / planet.period + planet.phase
        const x = (planet.x + Math.sin(phase) * 0.035) * width
        const y = (planet.y + Math.cos(phase) * 0.018) * horizon
        const scale = Math.min(1.2, Math.max(0.6, width / 1000), height / 480)
        const radius = planet.radius * scale
        context.save()
        context.translate(x, y)
        context.globalAlpha = 0.95
        context.strokeStyle = '#ddcbaa99'
        context.lineWidth = 5 * scale
        if (planet.ring) {
          context.save()
          context.rotate(-0.35)
          context.beginPath()
          context.ellipse(0, 0, radius * 1.85, radius * 0.48, 0, 0, Math.PI * 2)
          context.stroke()
          context.restore()
        }
        const shade = context.createRadialGradient(-radius * 0.4, -radius * 0.45, 0, 0, 0, radius)
        shade.addColorStop(0, planet.light)
        shade.addColorStop(0.45, planet.surface)
        shade.addColorStop(1, planet.dark)
        context.fillStyle = shade
        context.beginPath()
        context.arc(0, 0, radius, 0, Math.PI * 2)
        context.fill()
        context.save()
        context.clip()
        for (let band = 0; band < 9; band++) {
          context.globalAlpha = planet.ring ? 0.22 : 0.1
          context.strokeStyle = band % 2 ? planet.light : planet.dark
          context.lineWidth = radius * (planet.ring ? 0.1 : 0.06)
          context.beginPath()
          context.ellipse(-radius * 0.12, (band / 8 - 0.5) * radius * 1.8, radius * 1.15, radius * 0.19, -0.15, 0, Math.PI)
          context.stroke()
        }
        // Deterministic surface detail stays steady as the planet drifts.
        for (let detail = 0; detail < 35; detail++) {
          const angle = detail * 2.39996
          const distance = Math.sqrt((detail + 0.5) / 35) * radius * 0.9
          const detailX = Math.cos(angle) * distance
          const detailY = Math.sin(angle) * distance
          const size = radius * (0.018 + (detail % 4) * 0.012)
          context.globalAlpha = planet.ring ? 0.08 : 0.18
          context.fillStyle = detail % 3 ? planet.dark : planet.light
          context.beginPath()
          context.ellipse(detailX, detailY, size * 1.4, size, angle, 0, Math.PI * 2)
          context.fill()
        }
        context.strokeStyle = planet.dark
        context.globalAlpha = 0.3
        context.beginPath()
        context.ellipse(-radius * 0.23, -radius * 0.12, radius * 0.19, radius * 0.13, -0.3, 0, Math.PI * 2)
        context.stroke()
        context.beginPath()
        context.ellipse(radius * 0.13, radius * 0.33, radius * 0.11, radius * 0.07, 0.2, 0, Math.PI * 2)
        context.stroke()
        const shadow = context.createLinearGradient(-radius, -radius * 0.3, radius, radius * 0.4)
        shadow.addColorStop(0, '#020a1000')
        shadow.addColorStop(0.5, '#020a1010')
        shadow.addColorStop(1, '#020a10c9')
        context.globalAlpha = 1
        context.fillStyle = shadow
        context.fillRect(-radius, -radius, radius * 2, radius * 2)
        context.restore()
        if (planet.ring) {
          context.rotate(-0.35)
          context.beginPath()
          context.ellipse(0, 0, radius * 1.85, radius * 0.48, 0, 0, Math.PI)
          context.stroke()
        }
        context.restore()

      })

      if (!reduceMotion) comets.forEach(comet => {
        const elapsed = seconds - comet.delay
        if (elapsed < 0) return
        const age = elapsed % comet.period
        if (age >= comet.duration) return
        const progress = age / comet.duration
        const opacity = Math.sin(progress * Math.PI) ** 0.6
        const dx = (comet.toX - comet.fromX) * width
        const dy = (comet.toY - comet.fromY) * horizon
        const distance = Math.hypot(dx, dy)
        if (!distance) return
        const x = comet.fromX * width + dx * progress
        const y = comet.fromY * horizon + dy * progress
        const tail = Math.min(160, width * 0.18)
        context.lineCap = 'round'
        context.strokeStyle = comet.color
        for (let segment = 0; segment < 16; segment++) {
          const from = tail * (1 - segment / 16)
          const to = tail * (1 - (segment + 1) / 16)
          context.globalAlpha = opacity * ((segment + 1) / 16) ** 1.8 * 0.75
          context.lineWidth = 0.5 + (segment + 1) / 16 * 1.5
          context.beginPath()
          context.moveTo(x - dx / distance * from, y - dy / distance * from)
          context.lineTo(x - dx / distance * to, y - dy / distance * to)
          context.stroke()
        }
        context.fillStyle = comet.color
        context.globalAlpha = opacity * 0.15
        context.beginPath()
        context.arc(x, y, 5, 0, Math.PI * 2)
        context.fill()
        context.globalAlpha = opacity
        context.beginPath()
        context.arc(x, y, 1.8, 0, Math.PI * 2)
        context.fill()
      })
      context.globalAlpha = 1

      const waterDepth = height - horizon
      ripples = ripples.filter(ripple => seconds - ripple.born < (ripple.kind === 'leaf' ? 2.1 : 3.2))
      // Mirror the sky with depth-based fading, without shifting the water surface.
      if (reflectionContext && reflectedSky.width && reflectedSky.height) {
        reflectionContext.drawImage(canvas, 0, 0, canvas.width, canvas.height * 2 / 3, 0, 0, reflectedSky.width, reflectedSky.height)
        context.save()
        context.beginPath()
        context.rect(0, horizon, width, waterDepth)
        context.clip()
        context.translate(0, horizon)
        context.scale(1, -1)
        for (let offset = 0; offset < waterDepth; offset += 3) {
          const slice = Math.min(3, waterDepth - offset)
          const depth = offset / waterDepth
          const sourceY = (1 - (offset + slice) / waterDepth) * reflectedSky.height
          const sourceHeight = slice / waterDepth * reflectedSky.height
          context.globalAlpha = 0.5 - depth * 0.12
          context.drawImage(reflectedSky, 0, Math.max(0, sourceY), reflectedSky.width, sourceHeight, 0, -offset - slice, width, slice)
        }
        context.restore()
      }

      context.save()
      context.beginPath()
      context.rect(0, horizon + 1, width, waterDepth - 1)
      context.clip()
      for (let ripple = 0; ripple < 45; ripple++) {
        const depth = (ripple + 1) / 46
        const y = horizon + depth ** 1.6 * waterDepth
        const x = ((ripple * 0.618034) % 1) * width
        const length = (10 + depth * 70) * Math.min(1.5, width / 700)
        context.globalAlpha = 0.045 + (1 - depth) * 0.05
        context.strokeStyle = '#b9dbdc'
        context.lineWidth = 0.6 + depth * 0.5
        context.beginPath()
        context.moveTo(x - length, y)
        context.quadraticCurveTo(x, y - 1.5, x + length, y)
        context.stroke()
      }
      for (const ripple of ripples) {
        const depth = (ripple.y * height - horizon) / waterDepth
        const gentle = ripple.kind === 'leaf'
        const lifetime = gentle ? 1.8 : 2.7
        for (let ring = 0; ring < (gentle ? 2 : 4); ring++) {
          const age = seconds - ripple.born - ring * (gentle ? 0.22 : 0.14)
          if (age < 0 || age > lifetime) continue
          const radius = ((gentle ? 5 : 14) + age * (gentle ? 30 : 110)) * (0.55 + depth * 0.45)
          const fade = (1 - age / lifetime) ** 2
          context.beginPath()
          context.ellipse(ripple.x * width, ripple.y * height, radius, radius * (0.22 + depth * 0.25), 0, 0, Math.PI * 2)
          context.strokeStyle = gentle ? '#a9d8c6' : '#c5ece9'
          context.globalAlpha = fade * (gentle ? 0.06 : 0.12)
          context.lineWidth = gentle ? 3 : 5
          context.stroke()
          context.globalAlpha = fade * (gentle ? 0.3 : 0.65)
          context.lineWidth = gentle ? 0.8 : 1.4
          context.stroke()
        }
      }
      context.restore()
      for (const leaf of leaves) {
        const age = seconds - leaf.born
        if (age < 0) continue
        const progress = Math.min(1, age / leaf.duration)
        const sway = Math.sin(progress * Math.PI * 4 + leaf.phase) * Math.sin(progress * Math.PI) * 0.026
        const x = (leaf.startX + (leaf.x - leaf.startX) * progress + sway) * width
        const y = (leaf.startY + (leaf.y - leaf.startY) * progress ** 1.25) * height
        const size = Math.min(12, Math.max(8, width / 100))
        leafContext.save()
        leafContext.translate(x, y)
        leafContext.rotate(leaf.landed ? 0.4 : -0.7 + progress * Math.PI * 1.6 + Math.sin(progress * Math.PI * 4 + leaf.phase) * 0.5)
        if (leaf.landed) leafContext.scale(1, 0.45)
        leafContext.globalAlpha = leaf.landed ? Math.max(0, 1 - (age - leaf.duration) / 3) * 0.75 : 0.9
        leafContext.fillStyle = leaf.color
        leafContext.beginPath()
        leafContext.moveTo(-size, 0)
        leafContext.bezierCurveTo(-size * 0.2, -size * 0.8, size * 0.65, -size * 0.6, size, 0)
        leafContext.bezierCurveTo(size * 0.25, size * 0.85, -size * 0.65, size * 0.6, -size, 0)
        leafContext.fill()
        leafContext.strokeStyle = '#2e3b28'
        leafContext.lineWidth = 0.7
        leafContext.beginPath()
        leafContext.moveTo(-size * 1.2, 0)
        leafContext.quadraticCurveTo(0, size * 0.1, size * 0.9, 0)
        leafContext.stroke()
        leafContext.restore()
      }
      context.globalAlpha = 1
    }

    const disturbWater = (event: MouseEvent) => {
      if (!visible || document.hidden || event.button !== 0 || !width || !height) return
      const bounds = scene.getBoundingClientRect()
      const x = event.detail === 0 ? width / 2 : event.clientX - bounds.left
      const y = event.detail === 0 ? height * 0.84 : event.clientY - bounds.top
      if (x < 0 || x > width || y < height * 2 / 3 || y > height) return
      ripples.push({ x: x / width, y: y / height, born: elapsed / 1000, kind: 'click' })
      ripples = ripples.slice(-8)
      playWater()
      if (reduceMotion) {
        paint(0)
        clearTimeout(feedbackTimer)
        feedbackTimer = setTimeout(() => {
          ripples = []
          paint(0)
        }, 450)
      }
    }

    const paintBackdrop = (ratio: number) => {
      if (!backdropContext) return
      backdrop.width = canvas.width
      backdrop.height = canvas.height
      backdropContext.setTransform(ratio, 0, 0, ratio, 0, 0)
      const horizon = height * 2 / 3
      const sky = backdropContext.createLinearGradient(0, 0, 0, horizon)
      sky.addColorStop(0, '#090f1a')
      sky.addColorStop(0.55, '#132232')
      sky.addColorStop(1, '#29434b')
      backdropContext.fillStyle = sky
      backdropContext.fillRect(0, 0, width, horizon)

      // Cache the broad, faint galaxy strokes instead of blurring them every frame.
      for (let band = 0; band < 2; band++) {
        for (let layer = 12; layer > 0; layer--) {
          backdropContext.strokeStyle = band ? '#e0ced2' : '#c0dce7'
          backdropContext.globalAlpha = 0.008 + (12 - layer) * 0.0007
          backdropContext.lineWidth = (8 + layer * 5) * Math.min(1, width / 900)
          backdropContext.beginPath()
          backdropContext.moveTo(-width * 0.1, horizon * (0.65 + band * 0.22))
          backdropContext.bezierCurveTo(width * 0.25, horizon * (0.48 + band * 0.12), width * 0.5, horizon * (0.19 + band * 0.15), width * 1.1, horizon * (0.08 + band * 0.1))
          backdropContext.stroke()
        }
      }
      backdropContext.globalAlpha = 1
      const water = backdropContext.createLinearGradient(0, horizon, 0, height)
      water.addColorStop(0, '#203c43')
      water.addColorStop(0.18, '#142b35')
      water.addColorStop(1, '#07141f')
      backdropContext.fillStyle = water
      backdropContext.fillRect(0, horizon, width, height - horizon)
      backdropContext.fillStyle = '#a9d0d126'
      backdropContext.fillRect(0, horizon, width, 1)
    }

    const draw = (time: number) => {
      elapsed += time - lastFrame
      lastFrame = time
      if (time - lastPaint >= 32) {
        paint(elapsed / 1000)
        lastPaint = time
      }
      frame = requestAnimationFrame(draw)
    }

    const resize = () => {
      const bounds = scene.getBoundingClientRect()
      width = bounds.width
      height = bounds.height
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      leafCanvas.width = canvas.width
      leafCanvas.height = canvas.height
      reflectedSky.width = Math.round(width)
      reflectedSky.height = Math.ceil(height * 2 / 3)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      leafContext.setTransform(ratio, 0, 0, ratio, 0, 0)
      count = Math.min(stars.length, Math.max(160, Math.round(width * height / 4200)))
      paintBackdrop(ratio)
      paint(elapsed / 1000)
    }

    const syncPlayback = () => {
      cancelAnimationFrame(frame)
      const active = visible && !document.hidden
      setIsActive(active)
      if (!active) {
        ripples = []
        clearTimeout(feedbackTimer)
        return
      }
      if (reduceMotion) {
        paint(0)
        return
      }
      lastFrame = performance.now()
      lastPaint = 0
      frame = requestAnimationFrame(draw)
    }

    const resizeObserver = new ResizeObserver(resize)
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio > 0.1
      syncPlayback()
    }, { threshold: [0, 0.1] })
    resize()
    resizeObserver.observe(scene)
    visibilityObserver.observe(scene)
    document.addEventListener('visibilitychange', syncPlayback)
    water.addEventListener('click', disturbWater)
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      document.removeEventListener('visibilitychange', syncPlayback)
      water.removeEventListener('click', disturbWater)
      clearTimeout(feedbackTimer)
    }
  }, [reduceMotion, playLeafWater, playWater])

  return (
    <div ref={sceneRef} className={styles.space} data-active={isActive} role='group' aria-label='Hòn đảo giữa mặt nước với cây hai nhánh và hoa phát sáng, dưới bầu trời đêm với dải ngân hà, sao lấp lánh, hành tinh chuyển động và sao chổi'>
      <canvas ref={canvasRef} className={styles.stars} aria-hidden='true' />
      <button ref={helpButtonRef} type='button' className={styles.helpButton} aria-label='Hướng dẫn' title='Hướng dẫn' aria-haspopup='dialog' aria-expanded={isHelpOpen} disabled={!isActive} onClick={() => setIsHelpOpen(true)}>
        <Icon icon={{ ...dialogIcons.icons['help-circle-outline'], width: dialogIcons.width, height: dialogIcons.height }} width={25} aria-hidden='true' />
      </button>
      <button type='button' className={`${styles.helpButton} ${styles.soundButton}`} aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'} title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'} aria-pressed={soundEnabled} disabled={!isActive} onClick={toggleSound}>
        <Icon icon={{ ...dialogIcons.icons[soundEnabled ? 'volume-high' : 'volume-off'], width: dialogIcons.width, height: dialogIcons.height }} width={24} aria-hidden='true' />
      </button>
      <div className={styles.reflection} aria-hidden='true'>
        <Image src='/vietnamese-women-day/floating-island.webp' alt='' width={1536} height={1024} sizes='(max-width: 600px) 86vw, (max-height: 480px) 110vh, 720px' className={styles.reflectionImage} />
      </div>
      <div ref={islandRef} className={styles.island} aria-hidden='true'>
        <Image src='/vietnamese-women-day/floating-island.webp' alt='' width={1536} height={1024} sizes='(max-width: 600px) 86vw, (max-height: 480px) 110vh, 720px' loading='eager' className={styles.islandImage} />
      </div>
      <button ref={waterRef} type='button' className={styles.waterSurface} aria-label='Tạo gợn sóng trên mặt nước' />
      <div ref={treeRef} className={styles.treePosition}>
        <FlowerTree isActive={isActive} isHelpOpen={isHelpOpen} onHelpClose={closeHelp} helpButtonRef={helpButtonRef} onFlowerOpen={playFlower} />
      </div>
      <canvas ref={leafCanvasRef} className={`${styles.stars} ${styles.fallingLeaves}`} aria-hidden='true' />
    </div>
  )
}

export default PickingFlowers
