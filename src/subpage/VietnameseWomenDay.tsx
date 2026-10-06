"use client"
import OpeningLetter from '@/components/VietnameseWomenDay/Letter/OpeningLetter'
import PickingFlowers from '@/components/VietnameseWomenDay/PickingFlowers'
import WriteDesire from '@/components/VietnameseWomenDay/WriteDesire'
import React, { useEffect, useRef, useState } from 'react'
import styles from './VietnameseWomenDay.module.css'

const pageThemes = ['letter', 'flowers', 'wish'] as const

function VietnameseWomenDay() {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activePage, setActivePage] = useState(0)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    let targetPage: number | null = null
    let queuedDirection = 0
    let lastWheelTime = 0
    let lastWheelDirection = 0
    let unlockTimer: ReturnType<typeof setTimeout> | undefined

    const cancelTransition = () => {
      clearTimeout(unlockTimer)
      targetPage = null
      queuedDirection = 0
    }

    const finishTransition = () => {
      const direction = queuedDirection
      cancelTransition()
      if (direction) changePage(direction)
    }

    const changePage = (direction: number) => {
      const currentPage = Math.round(container.scrollTop / container.clientHeight)
      const nextPage = Math.max(0, Math.min(container.children.length - 1, currentPage + direction))
      if (nextPage === currentPage) return

      targetPage = nextPage
      // Release the lock even if native scrolling is interrupted before arrival.
      unlockTimer = setTimeout(finishTransition, 1000)
      container.scrollTo({
        top: nextPage * container.clientHeight,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }

    const handleScroll = () => {
      if (targetPage !== null && Math.abs(container.scrollTop - targetPage * container.clientHeight) <= 1) {
        finishTransition()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
        cancelTransition()
      }
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return

      const section = event.target instanceof Element
        ? event.target.closest('section')
        : null
      if (section && section.scrollHeight > section.clientHeight) {
        const canScroll = event.deltaY > 0
          ? section.scrollTop + section.clientHeight < section.scrollHeight - 1
          : section.scrollTop > 1
        if (canScroll) return
      }

      event.preventDefault()

      const now = performance.now()
      const direction = event.deltaY > 0 ? 1 : -1
      const isNewGesture = now - lastWheelTime > 150 || direction !== lastWheelDirection
      lastWheelTime = now
      lastWheelDirection = direction

      if (targetPage !== null) {
        // Keep a new gesture, while ignoring the current gesture's inertia.
        if (isNewGesture) queuedDirection = direction
        return
      }

      changePage(direction)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('scroll', handleScroll, { passive: true })
    container.addEventListener('pointerdown', cancelTransition)
    container.addEventListener('keydown', handleKeyDown)
    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('scroll', handleScroll)
      container.removeEventListener('pointerdown', cancelTransition)
      container.removeEventListener('keydown', handleKeyDown)
      cancelTransition()
    }
  }, [])

  return (
    <div
      ref={scrollContainerRef}
      tabIndex={0}
      role='region'
      aria-label='Ngày Phụ nữ Việt Nam'
      data-theme={pageThemes[activePage]}
      onScroll={(event) => {
        const container = event.currentTarget
        setActivePage(Math.max(0, Math.min(pageThemes.length - 1, Math.round(container.scrollTop / container.clientHeight))))
      }}
      className={`${styles.scroller} relative flex h-screen supports-[height:100dvh]:h-[100dvh] w-full flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain snap-y snap-mandatory scroll-smooth motion-reduce:scroll-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}
    >
      <section aria-label='Mở thư' data-theme='letter' className={`${styles.screen} flex h-screen supports-[height:100dvh]:h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center overflow-y-auto px-4 pt-16 pb-6`}>
        <OpeningLetter />
      </section>
      <section aria-label='Chọn hoa' data-theme='flowers' className={`${styles.screen} flex h-screen supports-[height:100dvh]:h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center overflow-y-auto px-4 pt-16 pb-6`}>
        <PickingFlowers />
      </section>
      <section aria-label='Viết điều ước' data-theme='wish' className={`${styles.screen} flex h-screen supports-[height:100dvh]:h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center overflow-y-auto px-4 pt-16 pb-6`}>
        <WriteDesire />
      </section>
    </div>
  )
}

export default VietnameseWomenDay
