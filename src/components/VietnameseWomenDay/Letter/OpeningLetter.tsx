"use client"

import { Icon } from '@iconify/react'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import LetterFireworks from './LetterFireworks'
import useLetterSounds from './useLetterSounds'
import styles from './OpeningLetter.module.css'

const flowerImage = '/vietnamese-women-day/flowers.png'
const gardenLayers = [
  {
    depth: 'far',
    plants: [
      { left: 4, height: 46 }, { left: 12, height: 58 },
      { left: 20, height: 40 }, { left: 29, height: 52 },
      { left: 37, height: 43 }, { left: 45, height: 56 },
      { left: 54, height: 48 }, { left: 63, height: 60 },
      { left: 71, height: 42 }, { left: 80, height: 54 },
      { left: 88, height: 46 }, { left: 96, height: 57 },
    ],
  },
  {
    depth: 'middle',
    plants: [
      { left: 7, height: 96 }, { left: 17, height: 112 },
      { left: 26, height: 84 }, { left: 35, height: 106 },
      { left: 45, height: 90 }, { left: 55, height: 118 },
      { left: 65, height: 88 }, { left: 74, height: 102 },
      { left: 83, height: 110 }, { left: 93, height: 94 },
    ],
  },
  {
    depth: 'near',
    plants: [
      { left: 6, height: 180 }, { left: 23, height: 215 },
      { left: 40, height: 150 }, { left: 61, height: 170 },
      { left: 78, height: 205 }, { left: 94, height: 185 },
    ],
  },
]
const flowerFlights = [
  { x: -1, y: -0.8, rotate: -55 },
  { x: 1, y: -0.65, rotate: 55 },
  { x: -0.3, y: -1.2, rotate: -20 },
]

function OpeningLetter() {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'flying' | 'open'>('closed')
  const [launch, setLaunch] = useState({ x: 0, y: 0, scaleX: 0.7, scaleY: 0.5, spread: 180 })
  const paperRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef(false)
  const letterId = useId()
  const headingId = useId()
  const reduceMotion = useReducedMotion()
  const dialogVisible = phase === 'flying' || phase === 'open'
  const { soundEnabled, toggleSound, unlockAudio, playFirework, playOpen, playReveal, stopSounds } = useLetterSounds(stageRef)

  useEffect(() => {
    if (dialogVisible) playReveal()
  }, [dialogVisible, playReveal])

  useEffect(() => {
    if (phase !== 'opening') return
    const timer = setTimeout(() => {
      const rect = paperRef.current?.getBoundingClientRect()
      if (rect) {
        setLaunch({
          x: rect.x + rect.width / 2 - window.innerWidth / 2,
          y: rect.y + rect.height / 2 - window.innerHeight / 2,
          scaleX: rect.width / Math.min(520, window.innerWidth - 32),
          scaleY: rect.height / Math.min(480, window.innerHeight - 40),
          spread: Math.min(200, window.innerWidth * 0.32),
        })
      }
      setPhase('flying')
    }, 500)
    return () => clearTimeout(timer)
  }, [phase])

  useLayoutEffect(() => {
    if (dialogVisible) {
      if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
      restoreFocusRef.current = true
      if (reduceMotion) setPhase(current => current === 'flying' ? 'open' : current)
    } else if (restoreFocusRef.current) {
      openButtonRef.current?.focus({ preventScroll: true })
      restoreFocusRef.current = false
    }
  }, [dialogVisible, reduceMotion])

  const closeLetter = () => {
    stopSounds()
    dialogRef.current?.close()
    setPhase('closed')
  }

  return (
    <div ref={stageRef} className={styles.stage} onPointerDownCapture={unlockAudio} onClickCapture={unlockAudio} onKeyDownCapture={unlockAudio}>
      <div className={styles.sunlight} aria-hidden='true'>
        <span className={styles.sunRay} />
        <span className={styles.sunRay} />
        <span className={styles.sunRay} />
        <span className={styles.sunRay} />
      </div>
      <button
        type='button'
        className={styles.soundButton}
        onClick={toggleSound}
        aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
        aria-pressed={soundEnabled}
        title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
      >
        <Icon icon={soundEnabled ? 'mdi:volume-high' : 'mdi:volume-off'} width={22} aria-hidden='true' />
      </button>
      <div className={styles.garden} aria-hidden='true'>
        {gardenLayers.map(layer => (
          <div key={layer.depth} className={styles.gardenLayer} data-depth={layer.depth}>
            {layer.plants.map((plant, index) => (
              <div
                key={plant.left}
                className={styles.plant}
                style={{
                  '--plant-left': `${plant.left}%`,
                  '--plant-height': `${plant.height}px`,
                  '--plant-delay': `${-index * 0.73 - 0.5}s`,
                  '--plant-duration': `${5.8 + (index % 4) * 0.6}s`,
                  '--flower-direction': index % 2 ? -1 : 1,
                } as React.CSSProperties}
              >
                <div className={styles.plantSway}>
                  <span className={styles.stem} />
                  <span className={`${styles.leaf} ${styles.leafLeft}`} />
                  <span className={`${styles.leaf} ${styles.leafRight}`} />
                  <Image src={flowerImage} alt='' width={1334} height={1179} sizes={layer.depth === 'far' ? '44px' : layer.depth === 'middle' ? '88px' : '(max-width: 600px) 100px, 140px'} className={styles.plantFlowers} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <LetterFireworks active={phase === 'closed'} targetRef={sceneRef} onLaunch={playFirework} />
      <div ref={sceneRef} className={styles.scene} data-phase={phase}>
        <div className={styles.envelope}>
          <div
            ref={paperRef}
            className={styles.letter}
            aria-hidden='true'
            style={{ opacity: dialogVisible ? 0 : 1 }}
          >
            <Image src={flowerImage} alt='' width={1334} height={1179} sizes='180px' className={styles.previewFlowers} priority />
          </div>

          <div className={styles.front} aria-hidden='true' />
          <motion.div
            className={styles.flap}
            aria-hidden='true'
            initial={false}
            animate={{ rotateX: phase === 'closed' ? 0 : -180 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.4, 0, 0.2, 1] }}
            style={{ zIndex: dialogVisible ? 0 : 4 }}
          >
            <span className={styles.flapFace} />
          </motion.div>

          <button
            type='button'
            ref={openButtonRef}
            className={styles.openButton}
            aria-controls={letterId}
            aria-haspopup='dialog'
            aria-expanded={phase !== 'closed'}
            disabled={phase !== 'closed'}
            onClick={() => { stopSounds(); playOpen(); setPhase('opening') }}
          >
            <span className={styles.sealLabel}>Mở</span>
          </button>
        </div>
      </div>

      {dialogVisible && createPortal(
        <dialog
          ref={dialogRef}
          id={letterId}
          className={styles.dialog}
          aria-labelledby={headingId}
          aria-modal='true'
          onCancel={(event) => { event.preventDefault(); closeLetter() }}
          onClose={() => { stopSounds(); setPhase('closed') }}
          onClick={(event) => { if (event.target === event.currentTarget) closeLetter() }}
        >
          <motion.div
            className={styles.modalPaper}
            initial={reduceMotion ? false : { x: launch.x, y: launch.y, scaleX: launch.scaleX, scaleY: launch.scaleY, rotate: -4 }}
            animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.85, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() => setPhase(current => current === 'flying' ? 'open' : current)}
          >
            <div className={styles.paperBorder} aria-hidden='true' />
            <button type='button' className={styles.closeButton} onClick={closeLetter} aria-label='Đóng thư' title='Đóng thư'>
              <Icon icon='mdi:close' width={22} aria-hidden='true' />
            </button>
            <motion.h2
              id={headingId}
              className={styles.heading}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
              animate={{ opacity: phase === 'open' ? 1 : 0, y: phase === 'open' ? 0 : 12 }}
              transition={{ duration: reduceMotion ? 0 : 0.35 }}
            >
              <span>Chúc mừng</span>{' '}
              <strong>20/10</strong>
            </motion.h2>
            <motion.div className={styles.paperFlowers} aria-hidden='true' initial={{ opacity: 0 }} animate={{ opacity: phase === 'open' ? 1 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.4 }}>
              <Image src={flowerImage} alt='' width={1334} height={1179} sizes='160px' className={styles.flowerLeft} />
              <Image src={flowerImage} alt='' width={1334} height={1179} sizes='160px' className={styles.flowerRight} />
            </motion.div>
          </motion.div>

          {!reduceMotion && flowerFlights.map((flight, index) => (
            <motion.div
              key={index}
              className={styles.flyingFlower}
              aria-hidden='true'
              initial={{ x: launch.x, y: launch.y, scale: 0.3, rotate: 0, opacity: 0 }}
              animate={{
                x: [launch.x, flight.x * launch.spread, flight.x * launch.spread * 1.15],
                y: [launch.y, flight.y * launch.spread, flight.y * launch.spread + 80],
                rotate: [0, flight.rotate, flight.rotate * 1.3],
                scale: [0.3, 1.2, 0.8],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 1.6, delay: index * 0.06, ease: 'easeOut' }}
            >
              <Image src={flowerImage} alt='' width={1334} height={1179} sizes='100px' />
            </motion.div>
          ))}
        </dialog>,
        document.body,
      )}
    </div>
  )
}

export default OpeningLetter
