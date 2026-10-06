'client'
import { Icon } from '@iconify/react/dist/iconify.js'
import React, { useState } from 'react'
import { TypeAnimation } from 'react-type-animation'
import { motion } from 'framer-motion';

type Props = {
  onClick: any;
  stepMain: "start" | "cycle";
}
function Start({
  onClick,
  stepMain
}: Props) {
  const [step, setStep] = useState<"1" | "2">("1")
  const [isSound, setIsSound] = useState<boolean>(true)

  const handleClickNext = () => {
    onClick()
  }
  return (
    <div className='w-full h-full flex flex-col items-center'>
      <motion.div
        className='relative w-[90%] sm:w-[600px] rounded-xl'
        initial={{ x: '-100vw', rotate: -45 }}
        animate={{ x: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 10 }}
      >
        <div className='absolute z-[-1] top-0 left-0 w-full h-full bg-[#0077b6] rounded-xl blur-[150px]'></div>
        <div className='w-full h-full'>
          {(stepMain === "start" && step === "1" || step === "2") &&
            <h2 className='w-full text-center font-serif text-3xl font-bold'>
              Lời mở đầu
            </h2>}
          {(stepMain === "start" && step === "1" || step === "2") &&
            <p className='mt-3 sm:text-base text-sm font-medium font-mono'>
              <TypeAnimation
                sequence={[
                  600,
                  'Xin chào mọi người, \n' +
                  'Đây là trang web của Như Quỳnh.\n' +
                  'Mời mọi người chiêm ngưỡng "Vòng quay ánh sáng" của Như Quỳnh nhé.\n',
                  () => {
                    setIsSound(false);
                    setStep("2")
                  },
                ]}
                speed={40}
                style={{ whiteSpace: 'pre-line', height: '195px', display: 'block' }}
              />
            </p>}
        </div>
        {isSound &&
          <audio autoPlay loop hidden>
            <source src="/soundTypeKeyboard.mp3" type="audio/mpeg" />
          </audio>}
      </motion.div>
      {step === "2" &&
        <div className='mt-6  w-[90%] sm:w-[600px] flex justify-end'>
          <button
            className='w-[100px] h-[42px] hover:scale-[1.15] duration-200 flex items-center justify-center bg-gray-700 font-mono outline-none border-none rounded-lg cursor-pointer'
            title='Click me'
            onClick={handleClickNext}
          >
            <p className="text-sm font-bold">Tiếp</p>
            <div className='h-full w-[36px] flex justify-center items-center'>
              <Icon icon={"tdesign:gesture-click-filled"} className='iconClick w-6 h-6' />
            </div>
          </button>
        </div>
      }
    </div>
  )
}

export default Start