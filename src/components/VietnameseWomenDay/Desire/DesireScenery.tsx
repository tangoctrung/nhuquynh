import Image from 'next/image'
import type { CSSProperties } from 'react'
import styles from './DesireScenery.module.css'

const clouds = [
  { top: 9, width: 350, duration: 88, phase: -21, opacity: 0.58 },
  { top: 27, width: 250, duration: 112, phase: -76, opacity: 0.48 },
  { top: 44, width: 420, duration: 96, phase: -52, opacity: 0.55 },
  { top: 66, width: 220, duration: 128, phase: -112, opacity: 0.4 },
  { top: 16, width: 190, duration: 140, phase: -103, opacity: 0.42 },
]

const flowers = [
  { x: -2, height: 192, bottom: -28, lean: -6 },
  { x: 8, height: 146, bottom: -18, lean: 5 },
  { x: 17, height: 104, bottom: -12, lean: -3 },
  { x: 25, height: 158, bottom: -24, lean: 7 },
  { x: 37, height: 116, bottom: -20, lean: -6 },
  { x: 51, height: 134, bottom: -22, lean: 4 },
  { x: 65, height: 114, bottom: -18, lean: -5 },
  { x: 76, height: 166, bottom: -24, lean: 8 },
  { x: 87, height: 126, bottom: -16, lean: -3 },
  { x: 98, height: 206, bottom: -32, lean: 6 },
]

const blossoms = [
  { x: 11, y: 24, portraitX: 7, portraitY: 27, drift: 72, duration: 10.5, phase: -2 },
  { x: 24, y: 21, portraitX: 16, portraitY: 35, drift: 106, duration: 12, phase: -7 },
  { x: 33, y: 35, portraitX: 30, portraitY: 47, drift: 52, duration: 11, phase: -9 },
  { x: 28, y: 43, portraitX: 38, portraitY: 53, drift: 132, duration: 13, phase: -4 },
  { x: 7, y: 37, portraitX: 4, portraitY: 42, drift: 84, duration: 12.5, phase: -11 },
  { x: 19, y: 44, portraitX: 25, portraitY: 56, drift: 110, duration: 14, phase: -6 },
  { x: 15, y: 13, portraitX: 12, portraitY: 30, drift: 64, duration: 11.5, phase: -8 },
]

export default function DesireScenery({ active }: { active: boolean }) {
  return (
    <div className={styles.scenery} data-moving={active} aria-hidden='true'>
      <picture className={styles.backgroundArtwork}>
        <source media='(max-aspect-ratio: 1/1)' srcSet='/vietnamese-women-day/desire-sunlit-meadow-portrait.webp' type='image/webp' />
        <Image src='/vietnamese-women-day/desire-sunlit-meadow-wide.webp' alt='' fill sizes='100vw' className={styles.backgroundImage} />
      </picture>
      <div className={styles.sky}>
        {clouds.map((cloud, index) => (
          <div key={index} className={styles.cloud} style={{ top: `${cloud.top}%`, opacity: cloud.opacity, '--cloud-width': `${cloud.width}px`, '--duration': `${cloud.duration}s`, '--phase': `${cloud.phase}s` } as CSSProperties}>
            <Image src='/vietnamese-women-day/desire-cloud.webp' alt='' fill sizes='420px' />
          </div>
        ))}
      </div>
      <div className={styles.sunlight}>
        {[30, 45, 60, 71].map((angle, index) => (
          <i key={angle} style={{ '--angle': `${angle}deg`, '--ray-width': `${100 + index * 30}px`, '--phase': `${-index * 1.6}s` } as CSSProperties} />
        ))}
      </div>
      <div className={styles.treeBlossoms}>
        {blossoms.map((blossom, index) => (
          <div key={index} className={styles.blossomFall} style={{ '--origin-x': `${blossom.x}%`, '--origin-y': `${blossom.y}%`, '--portrait-x': `${blossom.portraitX}%`, '--portrait-y': `${blossom.portraitY}%`, '--wide-distance': `${90 - blossom.y}dvh`, '--portrait-distance': `${90 - blossom.portraitY}dvh`, '--drift': `${blossom.drift}px`, '--duration': `${blossom.duration}s`, '--phase': `${blossom.phase}s`, '--petal-color': index % 3 === 0 ? '#fff7ef' : '#f3abc2' } as CSSProperties}>
            <span className={styles.blossom}>
              {[0, 1, 2, 3, 4].map(petal => <i key={petal} style={{ rotate: `${petal * 72}deg` }} />)}
              <b />
            </span>
          </div>
        ))}
      </div>
      <div className={styles.flowerField}>
        {flowers.map((flower, index) => (
          <div key={index} className={styles.flower} style={{ left: `${flower.x}%`, bottom: `${flower.bottom}px`, '--plant-height': `${flower.height}px`, '--lean': `${flower.lean}deg`, '--wind-duration': `${5.2 + index % 4 * 0.6}s`, '--wind-phase': `${-index * 0.9}s` } as CSSProperties}>
            <Image src='/vietnamese-women-day/sunrise-cosmos-illustrated.webp' alt='' fill sizes='150px' className={styles.plantImage} />
          </div>
        ))}
      </div>
    </div>
  )
}
