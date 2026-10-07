"use client"

import { Icon } from '@iconify/react'
import React, { useEffect, useId, useRef, useState } from 'react'
import { sendMessageTelegram } from '@/utils'
import icons from './desireIcons.json'
import styles from './WriteDesire.module.css'
import useDesireSounds from './useDesireSounds'
import DesireScenery from './DesireScenery'

const maxWishLength = 1500

function WriteDesire() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)
  const mountedRef = useRef(false)
  const [isActive, setIsActive] = useState(false)
  const { soundEnabled, toggleSound, playSend } = useDesireSounds(isActive)
  const [wish, setWish] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const inputId = useId()
  const feedbackId = useId()

  useEffect(() => {
    mountedRef.current = true
    let visible = false
    const syncVisibility = () => setIsActive(visible && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio > 0.1
      syncVisibility()
    }, { threshold: [0, 0.1] })
    if (sceneRef.current) observer.observe(sceneRef.current)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      mountedRef.current = false
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncVisibility)
    }
  }, [])

  const submitWish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = wish.trim()
    if (!message || message.length > maxWishLength || sendingRef.current || status === 'success') return
    sendingRef.current = true
    playSend()
    setStatus('sending')
    try {
      const sent = await sendMessageTelegram(` Điều ước 20/10:\n${message}`)
      if (mountedRef.current) setStatus(sent ? 'success' : 'error')
    } catch {
      if (mountedRef.current) setStatus('error')
    } finally {
      sendingRef.current = false
    }
  }

  const feedback = status === 'success' ? 'Điều ước của em đã được gửi.'
    : status === 'error' ? 'Chưa gửi được. Em thử lại nhé.' : ''
  const icon = status === 'sending' ? icons.icons.loading : status === 'success' ? icons.icons.check : icons.icons['send-outline']

  return (
    <div ref={sceneRef} className={styles.scene} data-active={isActive}>
      <DesireScenery active={isActive} />
      <button type='button' className={styles.soundButton} onClick={toggleSound} disabled={!isActive} aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'} title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'} aria-pressed={soundEnabled}>
        <Icon icon={{ ...icons.icons[soundEnabled ? 'volume-high' : 'volume-off'], width: icons.width, height: icons.height }} width={23} aria-hidden='true' />
      </button>
      <div className={styles.content} data-page-scroll>
        <form className={styles.letter} onSubmit={submitWish} aria-busy={status === 'sending'}>
          <div className={styles.letterMark} aria-hidden='true'>
            <Icon icon={{ ...icons.icons['heart-outline'], width: icons.width, height: icons.height }} width={22} />
          </div>
          <h2><label htmlFor={inputId}>Hãy viết những điều em mong muốn ở đây</label></h2>
          <textarea
            id={inputId}
            className={styles.wishInput}
            value={wish}
            onChange={event => { setWish(event.target.value); if (status !== 'idle') setStatus('idle') }}
            placeholder='Điều em mong muốn là…'
            rows={4}
            maxLength={maxWishLength}
            required
            readOnly={status === 'sending'}
            aria-describedby={feedbackId}
          />
          <div className={styles.actions}>
            <span className={styles.characterCount}>{wish.length}/{maxWishLength}</span>
            <button type='submit' className={styles.sendButton} disabled={!wish.trim() || status === 'sending' || status === 'success'}>
              <Icon icon={{ ...icon, width: icons.width, height: icons.height }} width={20} className={status === 'sending' ? styles.spinner : undefined} aria-hidden='true' />
              <span>{status === 'sending' ? 'Đang gửi' : status === 'success' ? 'Đã gửi' : 'Gửi'}</span>
            </button>
          </div>
          <p id={feedbackId} className={styles.feedback} data-state={status} role={status === 'error' ? 'alert' : 'status'} aria-live='polite'>{feedback}</p>
        </form>
      </div>
    </div>
  )
}

export default WriteDesire
