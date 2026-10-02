"use client"
import React, { useEffect, useState } from 'react'
import ModalIntro from '../modal/ModalIntro';
import { Icon } from '@iconify/react/dist/iconify.js';

type props = {
  children: React.ReactNode
}
function LayoutMain({
  children
}: props) {
  const [isOpenModal, setIsOpenModal] = useState(false)
  const [firstTimeChat, setFirstTimeChat] = useState(0)

  useEffect(() => {
    // 2025/01/31 17:23
    const firstTime = new Date("2026/10/02 11:30").getTime()
    const timeNow = new Date().getTime()
    const time = Math.floor((timeNow - firstTime) / 1000 / 24 / 3600)

    setFirstTimeChat(time)
  }, [])

  return (
    <div className=''>
      {/* <div
        className='blockIntroduction fixed z-[1000] bottom-10 right-10 w-16 h-16 p-2 rounded-full cursor-pointer'
        onClick={() => setIsOpenModal(true)}
      >
        <div className='relative'>
          <div className='w-10 h-10 flex justify-center items-center'>
            <Icon icon="tdesign:gesture-click-filled" />
          </div>
          <div className='absolute top-0 left-0 w-10 h-10 bg-green-600 blur-xl'></div>
        </div>
      </div> */}
      <div className='fixed z-[1000] top-3 left-[50%] translate-x-[-50%] text-xl font-mono'>{firstTimeChat} ngày</div>
      {children}
      {/* <ModalIntro isOpenModal={isOpenModal} setIsOpenModal={setIsOpenModal} /> */}
    </div>
  )
}

export default LayoutMain