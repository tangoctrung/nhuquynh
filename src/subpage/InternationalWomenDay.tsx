'use client'
import LightCycle from '@/components/InternationalWomenDay/LightCycle'
import Start from '@/components/InternationalWomenDay/Start'
import { sendMessageTelegram } from '@/utils'
import React, { useEffect, useRef, useState } from 'react'

function InternationalWomenDay() {
  const [step, setStep] = useState<"start" | "cycle">("start")
  const startContainerRef = useRef<HTMLDivElement>(null)

  const handleStep = () => {
    setStep("cycle")
    setTimeout(() => {
      if (startContainerRef.current) {
        startContainerRef.current.style.opacity = "1"
        startContainerRef.current.style.zIndex = "10"
      }
    }, 500)
  }

  useEffect(() => {
    sendMessageTelegram(new Date().toLocaleDateString().toString() + ": truy cập website")
  }, [])
  return (
    <div className='relative w-full h-[100svh] flex justify-center items-center overflow-hidden bg-black'>
      <div
        className={`absolute top-0 w-full h-full flex justify-center mt-[30svh] transition-all duration-500 ease-linear ${step === "start" ? "opacity-100 z-10" : "opacity-0 -z-10"}`}
      >
        <Start onClick={handleStep} stepMain={step} />
      </div>
      <div
        className={`absolute top-0 left-0 w-full h-full flex items-center justify-center transition-all duration-1000 ${step === "cycle" ? "opacity-100 z-10" : "opacity-0 -z-10"}`}
        ref={startContainerRef}
      >
        <LightCycle />
      </div>
    </div>
  )
}

export default InternationalWomenDay