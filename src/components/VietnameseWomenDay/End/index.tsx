"use client"

import { Icon } from '@iconify/react'
import React, { useEffect, useRef, useState, type CSSProperties } from 'react'
import icons from '../Desire/desireIcons.json'
import styles from './End.module.css'
import useEndMusic from './useEndMusic'
import { sendMessageTelegram } from '@/utils'

const sparkles = [[20, 23], [36, 15], [62, 18], [79, 28], [27, 39], [49, 31], [67, 42], [41, 48], [75, 54], [17, 51], [55, 61], [34, 66]]

function End() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const [isActive, setIsActive] = useState(false)
  const { soundEnabled, toggleSound } = useEndMusic(isActive)

  useEffect(() => {
    let visible = false
    const syncVisibility = () => setIsActive(visible && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.9
      syncVisibility()
    }, { threshold: [0, 0.9, 1] })
    if (sceneRef.current) observer.observe(sceneRef.current)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncVisibility)
    }
  }, [])

  useEffect(() => {
    if (isActive) {
      sendMessageTelegram(" Kết thúc 20/10")
    }
  }, [isActive])

  return (
    <div ref={sceneRef} className={styles.scene} data-active={isActive}>
      {/* <picture className={styles.landscape} aria-hidden='true'>
        <source media='(max-width: 600px)' srcSet='/vietnamese-women-day/desire-sunlit-meadow-portrait.webp' />
        <img src='/vietnamese-women-day/desire-sunlit-meadow-wide.webp' alt='' draggable={false} />
      </picture> */}
      <div className={styles.petals} aria-hidden='true'>
        {Array.from({ length: 18 }, (_, index) => (
          <span key={index} className={styles.petal} style={{
            '--left': `${(index * 37 + 8) % 100}%`,
            '--duration': `${11 + index % 6}s`, '--delay': `${-index * 1.7}s`,
            '--drift': `${(index % 2 ? 1 : -1) * (45 + index * 3)}px`,
            '--size': `${9 + index % 4 * 3}px`,
          } as CSSProperties} />
        ))}
      </div>
      <button type='button' className={styles.soundButton} onClick={toggleSound} disabled={!isActive}
        aria-label={soundEnabled ? 'Tắt nhạc màn kết thúc' : 'Bật nhạc màn kết thúc'}
        title={soundEnabled ? 'Tắt nhạc màn kết thúc' : 'Bật nhạc màn kết thúc'} aria-pressed={soundEnabled}>
        <Icon icon={{ ...icons.icons[soundEnabled ? 'volume-high' : 'volume-off'], width: icons.width, height: icons.height }} width={23} aria-hidden='true' />
      </button>
      <div className={styles.content}>
        <div className={styles.bouquet}>
          <img className={styles.bouquetImage} src='/vietnamese-women-day/end-bouquet.webp'
            alt='Bó hoa hồng và mẫu đơn hồng, điểm hoa trắng, thắt nơ dịu dàng' draggable={false} />
          <div className={styles.sparkles} aria-hidden='true'>
            {sparkles.map(([left, top], index) => (
              <span key={index} className={styles.sparkle} style={{
                left: `${left}%`, top: `${top}%`, '--delay': `${-index * 0.57}s`,
                '--duration': `${2.8 + index % 4 * 0.45}s`,
              } as CSSProperties} />
            ))}
          </div>
        </div>
        <div className={styles.message}>
          <h2>20/10 thật vui vẻ</h2>
          <p>Chiều hoàng hôn cho ta cảm giác thân thương gắn bó</p>
          <p>Khi màn đêm buông xuống làm tâm trí ta trống rỗng</p>
          <p>Nhưng rồi bình minh xuất hiện sẽ lại kéo ta về an yên.</p>
          <div className={styles.ending}><span>Hết</span></div>
        </div>
      </div>
    </div>
  )
}

export default End
