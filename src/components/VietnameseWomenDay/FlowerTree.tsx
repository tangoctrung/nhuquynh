"use client"

import { Icon } from '@iconify/react'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { flowerMessages } from './flowerMessages'
import dialogIcons from './flowerDialogIcons.json'
import styles from './FlowerTree.module.css'

export const canopyLeafAnchors = [
  { x: 0.14, y: 0.45 },
  { x: 0.24, y: 0.5 },
  { x: 0.38, y: 0.38 },
  { x: 0.59, y: 0.42 },
  { x: 0.75, y: 0.52 },
  { x: 0.88, y: 0.43 },
]

const flowerImage = '/vietnamese-women-day/camellia-bloom.webp'
const maxFlowerPicks = 3
const helpMessage = 'Ở đây có 10 bông hoa, em chỉ được chọn 3 bông ngẫu nhiên. Trong 3 bông em chọn sẽ có 1 phần quà đặc biệt, chúc em may mắn'

function FlowerTree({ isActive, isHelpOpen, onHelpClose, helpButtonRef }: {
  isActive: boolean
  isHelpOpen: boolean
  onHelpClose: () => void
  helpButtonRef: React.RefObject<HTMLButtonElement | null>
}) {
  const [openedFlowers, setOpenedFlowers] = useState<number[]>([])
  const [activeFlower, setActiveFlower] = useState<number | null>(null)
  const [specialFlower, setSpecialFlower] = useState<number | null>(null)
  const [launch, setLaunch] = useState({ x: 0, y: 0 })
  const openedRef = useRef(new Set<number>())
  const specialPickRef = useRef<number | null>(null)
  const flowerRefs = useRef<(HTMLButtonElement | null)[]>([])
  const treeRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const lastFlowerRef = useRef(0)
  const restoreFocusRef = useRef(false)
  const restoreHelpFocusRef = useRef(false)
  const headingId = useId()
  const messageId = useId()
  const specialMessageId = useId()
  const reduceMotion = useReducedMotion()
  const flower = activeFlower === null ? null : flowerMessages[activeFlower]
  const isSpecialFlower = activeFlower !== null && activeFlower === specialFlower
  const isDialogOpen = isHelpOpen || activeFlower !== null
  const limitReached = openedFlowers.length >= maxFlowerPicks

  useLayoutEffect(() => {
    if (isDialogOpen) {
      const dialog = dialogRef.current
      if (dialog && !dialog.open) dialog.showModal()
      dialog?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
      restoreFocusRef.current = true
      restoreHelpFocusRef.current = isHelpOpen
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = previousOverflow }
    }
    if (restoreFocusRef.current) {
      const next = flowerRefs.current.find((button, index) => index > lastFlowerRef.current && button && !button.disabled)
        ?? flowerRefs.current.find(button => button && !button.disabled)
      const target = restoreHelpFocusRef.current ? helpButtonRef.current : next ?? treeRef.current
      target?.focus({ preventScroll: true })
      restoreFocusRef.current = false
    }
  }, [isDialogOpen, activeFlower, isHelpOpen, helpButtonRef])

  useEffect(() => {
    if (!isActive) {
      dialogRef.current?.close()
      setActiveFlower(null)
      onHelpClose()
    }
  }, [isActive, onHelpClose])

  const openFlower = (index: number, button: HTMLButtonElement) => {
    if (!isActive || isDialogOpen || openedRef.current.has(index) || openedRef.current.size >= maxFlowerPicks) return
    if (specialPickRef.current === null) specialPickRef.current = Math.floor(Math.random() * 2) + 2
    openedRef.current.add(index)
    if (openedRef.current.size === specialPickRef.current) setSpecialFlower(index)
    setOpenedFlowers(current => [...current, index])
    const bounds = button.getBoundingClientRect()
    setLaunch({ x: bounds.x + bounds.width / 2 - window.innerWidth / 2, y: bounds.y + bounds.height / 2 - window.innerHeight / 2 })
    lastFlowerRef.current = index
    setActiveFlower(index)
  }

  const closeDialog = () => {
    dialogRef.current?.close()
    setActiveFlower(null)
    onHelpClose()
  }

  return (
    <div ref={treeRef} className={styles.tree} data-active={isActive} tabIndex={-1}>
      <Image src='/vietnamese-women-day/flower-tree-dense.webp' alt='' aria-hidden='true' fill sizes='(max-width: 600px) 86vw, (max-height: 480px) 80vh, 720px' loading='eager' className={styles.treeImage} />
      {flowerMessages.map((flower, index) => {
        const opened = openedFlowers.includes(index)
        const label = opened ? `${flower.name} (đã mở)` : limitReached ? `${flower.name} (hết lượt chọn)` : flower.name
        return (
          <button
            key={index}
            ref={button => { flowerRefs.current[index] = button }}
            type='button'
            className={styles.flower}
            title={label}
            aria-label={label}
            aria-haspopup='dialog'
            disabled={opened || limitReached}
            data-opened={opened}
            data-locked={limitReached && !opened}
            data-opening={activeFlower === index}
            style={{ left: `${flower.x}%`, top: `${flower.y}%`, '--flower-color': flower.color, '--flower-tone': flower.tone, '--tilt': `${index % 2 ? 9 : -10}deg`, '--phase': `${-index * 0.65}s`, '--wind-duration': `${4.5 + index % 4 * 0.6}s`, '--wind-phase': `${-index * 0.8}s` } as React.CSSProperties}
            onClick={event => openFlower(index, event.currentTarget)}
          >
            <span className={styles.bloom} aria-hidden='true'>
              <Image src={flowerImage} alt='' fill sizes='48px' className={styles.flowerImage} />
            </span>
            <span className={styles.twinkles} aria-hidden='true'>
              {Array.from({ length: 3 }, (_, sparkle) => <i key={sparkle} style={{ '--sparkle-phase': `${-index * 0.4 - sparkle * 1.2}s` } as React.CSSProperties} />)}
            </span>
            {activeFlower === index && <span className={styles.burst} aria-hidden='true'>{Array.from({ length: 8 }, (_, ray) => <i key={ray} style={{ '--angle': `${ray * 45}deg` } as React.CSSProperties} />)}</span>}
          </button>
        )
      })}
      {isDialogOpen && createPortal(
        <dialog
          ref={dialogRef}
          className={styles.dialog}
          aria-labelledby={headingId}
          aria-describedby={isSpecialFlower ? `${messageId} ${specialMessageId}` : messageId}
          aria-modal='true'
          onCancel={event => { event.preventDefault(); closeDialog() }}
          onClose={() => { setActiveFlower(null); onHelpClose() }}
          onClick={event => { if (event.target === event.currentTarget) closeDialog() }}
          onKeyDown={event => {
            if (event.key !== 'Tab') return
            const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
            const first = buttons[0]
            const last = buttons[buttons.length - 1]
            if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
              event.preventDefault()
              const target = event.shiftKey ? last : first
              target?.focus()
            }
          }}
        >
          <motion.div
            className={styles.messageCard}
            data-special={isSpecialFlower}
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: reduceMotion || isHelpOpen ? 0 : 0.24, duration: reduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ '--flower-tone': flower?.tone ?? 'saturate(0.72)' } as React.CSSProperties}
          >
            <button type='button' className={styles.closeButton} onClick={closeDialog} aria-label={isHelpOpen ? 'Đóng hướng dẫn' : 'Đóng lời nhắn'} title={isHelpOpen ? 'Đóng hướng dẫn' : 'Đóng lời nhắn'} autoFocus>
              <Icon icon={{ ...dialogIcons.icons.close, width: dialogIcons.width, height: dialogIcons.height }} width={22} aria-hidden='true' />
            </button>
            <div className={styles.messageFlower} aria-hidden='true'><Image src={flowerImage} alt='' fill sizes='96px' className={styles.flowerImage} /></div>
            <h2 id={headingId}>{isHelpOpen ? 'Hướng dẫn' : flower?.title}</h2>
            <p id={messageId}>{isHelpOpen ? helpMessage : flower?.message}</p>
            {isSpecialFlower && <div className={styles.specialMessage} id={specialMessageId}>
              <h3>Phần quà đặc biệt</h3>
              <p>Hãy viết điều em mong muốn ở bên dưới, anh sẽ giúp em thực hiện</p>
            </div>}
          </motion.div>
          {!reduceMotion && flower && !isHelpOpen && <motion.div
            className={styles.flyingBloom}
            aria-hidden='true'
            style={{ '--flower-tone': flower.tone } as React.CSSProperties}
            initial={{ x: launch.x, y: launch.y, scale: 0.5, opacity: 1, rotate: -10 }}
            animate={{ x: 0, y: -70, scale: [0.5, 1.12, 0.95], opacity: [1, 1, 0], rotate: 9 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          ><Image src={flowerImage} alt='' fill sizes='96px' className={styles.flowerImage} /></motion.div>}
        </dialog>, document.body,
      )}
    </div>
  )
}

export default FlowerTree
