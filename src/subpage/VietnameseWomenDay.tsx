"use client"
import OpeningLetter from '@/components/VietnameseWomenDay/Letter/OpeningLetter'
import PickingFlowers from '@/components/VietnameseWomenDay/Letter/PickingFlowers'
import WriteDesire from '@/components/VietnameseWomenDay/Desire/WriteDesire'
import React, { useEffect, useRef, useState } from 'react'
import styles from './VietnameseWomenDay.module.css'
import Start, { type StartPage } from '@/components/VietnameseWomenDay/Start'
import { animate, type AnimationPlaybackControls } from 'framer-motion'
import End from '@/components/VietnameseWomenDay/End'

const pageThemes = ['start', 'letter', 'flowers', 'wish', 'end'] as const

function VietnameseWomenDay() {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activePage, setActivePage] = useState(0)
  const pageNavigationRef = useRef<((page: number) => void) | null>(null)

  const navigateToPage = (page: StartPage) => {
    const container = scrollContainerRef.current
    if (!container) return
    const index = pageThemes.indexOf(page)
    const section = container.children[index] as HTMLElement | undefined
    section?.focus({ preventScroll: true })
    pageNavigationRef.current?.(index)
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    let targetPage: number | null = null
    let queuedDirection = 0
    let lastWheelTime = 0
    let lastWheelDirection = 0
    let animation: AnimationPlaybackControls | undefined
    let displayedPage = 0
    let previousHeight = container.clientHeight
    let lastBlend = ''
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const cancelTransition = () => {
      animation?.stop()
      animation = undefined
      targetPage = null
      queuedDirection = 0
      container.dataset.transitioning = 'false'
    }

    const syncPosition = () => {
      const height = container.clientHeight
      if (!height) return
      const position = container.scrollTop / height
      const page = Math.max(0, Math.min(pageThemes.length - 1, Math.round(position)))
      if (page !== displayedPage) {
        displayedPage = page
        setActivePage(page)
      }
      // Both sides share an edge color; keep the blend invisible on settled screens.
      const distance = Math.abs(position - Math.round(position))
      const blend = distance < 0.002 ? '0' : Math.min(1, distance / 0.12).toFixed(3)
      if (blend !== lastBlend) {
        lastBlend = blend
        container.style.setProperty('--boundary-opacity', blend)
      }
    }

    const scrollToPage = (page: number) => {
      cancelTransition()
      const nextPage = Math.max(0, Math.min(pageThemes.length - 1, page))
      const destination = nextPage * container.clientHeight
      const from = container.scrollTop
      if (reducedMotion.matches || Math.abs(from - destination) <= 1) {
        container.scrollTop = destination
        syncPosition()
        return
      }

      targetPage = nextPage
      // Native snapping must not fight the animation's intermediate scroll positions.
      container.dataset.transitioning = 'true'
      animation = animate(from, destination, {
        duration: 0.74 + Math.min(3, Math.abs(destination - from) / container.clientHeight) * 0.18,
        ease: [0.4, 0, 0.2, 1],
        onUpdate: value => {
          container.scrollTop = value
          syncPosition()
        },
        onComplete: () => {
          container.scrollTop = destination
          syncPosition()
          const direction = queuedDirection
          cancelTransition()
          if (direction) changePage(direction)
        },
      })
    }

    const changePage = (direction: number) => {
      const currentPage = Math.round(container.scrollTop / container.clientHeight)
      const nextPage = Math.max(0, Math.min(pageThemes.length - 1, currentPage + direction))
      if (nextPage !== currentPage) scrollToPage(nextPage)
    }

    const canScrollInside = (target: EventTarget | null, direction: number) => {
      let scrollable = target instanceof Element ? target.closest('textarea, [data-page-scroll], section') : null
      while (scrollable && scrollable !== container) {
        if (scrollable.scrollHeight > scrollable.clientHeight) {
          const canScroll = direction > 0
            ? scrollable.scrollTop + scrollable.clientHeight < scrollable.scrollHeight - 1
            : scrollable.scrollTop > 1
          if (canScroll) return true
        }
        scrollable = scrollable.parentElement?.closest('[data-page-scroll], section') ?? null
      }
      return false
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
      if (event.key === ' ' && target?.closest('a, button, [role="button"]')) return
      const direction = ['ArrowDown', 'PageDown'].includes(event.key) || event.key === ' ' && !event.shiftKey ? 1
        : ['ArrowUp', 'PageUp'].includes(event.key) || event.key === ' ' && event.shiftKey ? -1 : 0
      if (!direction && !['Home', 'End'].includes(event.key)) return
      if (canScrollInside(event.target, direction || (event.key === 'End' ? 1 : -1))) return
      event.preventDefault()
      if (event.repeat) return
      if (event.key === 'Home' || event.key === 'End') {
        scrollToPage(event.key === 'Home' ? 0 : pageThemes.length - 1)
      } else if (targetPage !== null) {
        queuedDirection = direction
      } else {
        changePage(direction)
      }
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      const direction = event.deltaY > 0 ? 1 : -1
      if (canScrollInside(event.target, direction)) return
      event.preventDefault()
      const now = performance.now()
      const isNewGesture = !lastWheelTime || now - lastWheelTime > 150 || direction !== lastWheelDirection
      lastWheelTime = now
      lastWheelDirection = direction
      if (targetPage !== null) {
        if (isNewGesture) queuedDirection = direction
        return
      }
      if (isNewGesture) changePage(direction)
    }

    const handleMotionChange = () => {
      if (reducedMotion.matches) {
        const page = targetPage ?? Math.round(container.scrollTop / container.clientHeight)
        scrollToPage(page)
      }
    }
    const resizeObserver = new ResizeObserver(() => {
      const height = container.clientHeight
      if (height && height !== previousHeight) {
        const page = targetPage ?? Math.round(container.scrollTop / previousHeight)
        previousHeight = height
        cancelTransition()
        container.scrollTop = Math.min(pageThemes.length - 1, page) * height
        syncPosition()
      }
    })
    resizeObserver.observe(container)
    pageNavigationRef.current = scrollToPage
    syncPosition()
    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('scroll', syncPosition, { passive: true })
    container.addEventListener('pointerdown', cancelTransition)
    container.addEventListener('keydown', handleKeyDown)
    reducedMotion.addEventListener('change', handleMotionChange)
    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('scroll', syncPosition)
      container.removeEventListener('pointerdown', cancelTransition)
      container.removeEventListener('keydown', handleKeyDown)
      reducedMotion.removeEventListener('change', handleMotionChange)
      resizeObserver.disconnect()
      pageNavigationRef.current = null
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
      className={`${styles.scroller} relative flex h-screen supports-[height:100dvh]:h-[100dvh] w-full flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain snap-y snap-mandatory`}
    >
      <section aria-label='Bắt đầu' data-theme='start' className={`${styles.screen} flex h-screen supports-[height:100dvh]:h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center overflow-y-auto px-4 pt-16 pb-6`}>
        <Start onNavigate={navigateToPage} />
      </section>
      <section id='vwd-letter' tabIndex={-1} aria-label='Mở thư' data-theme='letter' className={`${styles.screen} flex h-screen supports-[height:100dvh]:h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center overflow-y-auto px-4 pt-16 pb-6`}>
        <OpeningLetter />
      </section>
      <section id='vwd-flowers' tabIndex={-1} aria-label='Chọn hoa' data-theme='flowers' className={`${styles.screen} flex h-screen supports-[height:100dvh]:h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center overflow-y-auto px-4 pt-16 pb-6`}>
        <PickingFlowers />
      </section>
      <section id='vwd-wish' tabIndex={-1} aria-label='Viết điều ước' data-theme='wish' className={`${styles.screen} flex h-screen supports-[height:100dvh]:h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center overflow-y-auto px-4 pt-16 pb-6`}>
        <WriteDesire />
      </section>
      <section id='vwd-end' tabIndex={-1} aria-label='Kết thúc' data-theme='end' className={`${styles.screen} flex h-screen supports-[height:100dvh]:h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center overflow-y-auto px-4 pt-16 pb-6`}>
        <End />
      </section>
    </div>
  )
}

export default VietnameseWomenDay
