"use client"

import { Icon } from '@iconify/react'
import Image from 'next/image'
import { useEffect, type CSSProperties } from 'react'
import icons from './startIcons.json'
import styles from './Start.module.css'
import { sendMessageTelegram } from '@/utils'

export type StartPage = 'letter' | 'flowers' | 'wish'

const postcards: { page: StartPage; name: string; title: string; guide: string; action: string; color: string }[] = [
  {
    page: 'letter',
    name: 'OpenLetter',
    title: 'Mở thư',
    guide: 'Chạm vào con dấu "Mở" trên phong bì để nhận lời chúc 20/10 và những bông hoa dành cho em.',
    action: 'Nhận lời chúc',
    color: '#a74f5c',
  },
  {
    page: 'flowers',
    name: 'PickFlower',
    title: 'Chọn hoa',
    guide: 'Mở lần lượt 3 trong 10 bông hoa. Em sẽ nhận được 1 phần quà đặc biệt ở lần chọn thứ 2 hoặc 3.',
    action: 'Hái hoa may mắn',
    color: '#44677f',
  },
  {
    page: 'wish',
    name: 'WriteDesire',
    title: 'Viết điều ước',
    guide: 'Viết những điều em mong muốn vào bức thư, rồi bấm Gửi để anh nhận được lời nhắn của em.',
    action: 'Gửi điều ước',
    color: '#42694f',
  },
]

function Start({ onNavigate }: { onNavigate: (page: StartPage) => void }) {
  useEffect(() => {
    sendMessageTelegram(" TRUY CẬP 20/10", true)
  }, [])
  return (
    <div className={styles.start}>
      <div className={styles.content} data-page-scroll>
        <div className={styles.inner}>
          <header className={styles.header}>
            <p className={styles.date}>20 / 10</p>
            <h1>Ba tấm thiệp dành cho em</h1>
          </header>
          <div className={styles.cards}>
            {postcards.map((postcard, index) => (
              <article key={postcard.page} className={styles.postcard} style={{ '--accent': postcard.color, '--tilt': `${index === 0 ? -1 : index === 2 ? 1 : 0}deg` } as CSSProperties}>
                <div
                  className={styles.cardLink}
                  aria-label={postcard.title}
                  aria-describedby={`start-${postcard.page}-guide`}
                >
                  <div className={styles.preview}>
                    <picture>
                      <source media='(max-width: 700px)' srcSet={`/vietnamese-women-day/start-preview-${postcard.page}-portrait.webp`} type='image/webp' />
                      <Image src={`/vietnamese-women-day/start-preview-${postcard.page}.webp`} alt='' fill sizes='(max-width: 700px) 112px, (max-width: 1000px) 30vw, 350px' />
                    </picture>
                    <span className={styles.stamp} aria-hidden='true'>20<br />10</span>
                  </div>
                  <div className={styles.copy}>
                    <p className={styles.part}><span>{String(index + 1).padStart(2, '0')}</span>{postcard.name}</p>
                    <h2>{postcard.title}</h2>
                    <p id={`start-${postcard.page}-guide`} className={styles.guide}>{postcard.guide}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Start
