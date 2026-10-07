import React, { use, useEffect, useState } from 'react';
import Image, { getImageProps } from 'next/image';
import "./index.css"
import { TypeAnimation } from 'react-type-animation';
import { Icon } from '@iconify/react/dist/iconify.js';
import Modal from '@/components/common/modal';
import SakuraFalling from './SakuraFall';
import { sendMessageTelegram } from '@/utils';

const IMAGE_PRELOAD_URLS = [
  '/nhuquynh1.jpg',
  '/nhuquynh2.jpg',
  '/nhuquynh3.jpg',
  '/nhuquynh4.jpg',
  '/nhuquynh5.jpg',
];
const POPUP_IMAGE_SIZES = '(max-width: 640px) 90vw, 400px';

type Props = {
}
function ImageCarousel3D({
}: Props) {

  const myAudioRef = React.useRef<HTMLAudioElement>(null);
  const [isComplete, setIsComplete] = useState(false)
  const [isOpenModal, setIsOpenModal] = useState(false)
  const [isSound, setIsSound] = useState<boolean>(false)
  const [isShowClose, setIsShowClose] = useState(false)
  const [indexImage, setIndexImage] = useState(0)
  const [imageChoosed, setImageChoosed] = useState({
    image1: "/gift.gif",
    image2: "/gift.gif",
    image3: "/gift.gif",
    image4: "/gift.gif",
    image5: "/gift.gif",
  })
  const [dataClick, setDataClick] = useState<{ image: string, text: string }>({
    image: "",
    text: ""
  })
  const dataLightCycle = [
    {
      image: "/nhuquynh1.jpg",
      text: "Trúc xinh trúc mọc đầu đình.\n" +
        "Em xinh em đứng một mình cũng xinh."
    },
    {
      image: "/nhuquynh2.jpg",
      text:
        "Em là đám mây trắng \n" +
        "Anh là bầu trời xanh \n" +
        "Trời hôm nay trống vắng \n" +
        "Mây mau về với anh."
    },
    {
      image: "/nhuquynh3.jpg",
      text:
        "Bỏ ngoài tai trăm lời tán tỉnh \n" +
        "Bởi vì tôi chỉ thấy mình em xinh \n" +
        "Thề với chúa đây không phải thính \n" +
        "Đây là em trong ánh mắt kẻ si tình"
    },
    {
      image: "/nhuquynh4.jpg",
      text: "Chúc em:\n" +
        "Một ngày hạnh phúc,\n" +
        "một đời bình yên,\n" +
        "cuộc sống không ưu phiền,\n" +
        "và có anh kề bên.\n" +
        "😊😊😊😊😊",
    },
    {
      image: "/nhuquynh5.jpg",
      text:
        "Đời anh sẽ chỉ là màn đêm\n" +
        "Nếu như không bao giờ em đến\n" +
        "Đời anh sẽ vô cùng hạnh phúc\n" +
        "Nếu như đã có em kề bên\n"
    }
  ]

  useEffect(() => {
    if (isComplete && myAudioRef.current) {
      myAudioRef.current.volume = 0.6;
    }
  }, [isComplete])

  useEffect(() => {
    const imagePreloaders = IMAGE_PRELOAD_URLS.map((src) => {
      const { props } = getImageProps({
        src,
        width: 600,
        height: 800,
        alt: '',
        sizes: POPUP_IMAGE_SIZES,
      });
      const image = new window.Image();
      image.decoding = 'async';
      image.srcset = props.srcSet ?? '';
      image.sizes = props.sizes ?? POPUP_IMAGE_SIZES;
      image.src = props.src;
      image.decode().catch(() => undefined);
      return image;
    });

    return () => {
      imagePreloaders.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, []);

  function handleClickImage(name: "image1" | "image2" | "image3" | "image4" | "image5") {
    if (imageChoosed[`${name}`] !== "/gift.gif") {
      return
    }
    setImageChoosed({
      ...imageChoosed,
      [name]: dataLightCycle[indexImage].image
    })
    setDataClick(dataLightCycle[indexImage])
    setIndexImage(i => i + 1)
  }

  function handleCloseImage() {
    setDataClick({
      image: "",
      text: ""
    })
    setIsShowClose(false)
    if (indexImage >= 5) {
      setIsComplete(true)
      sendMessageTelegram(" Hoàn thành Vòng quay ánh sáng")
    }
  }

  function handleClickGuide() {
    setIsOpenModal(true)
  }

  return (
    <div
      className='relative w-full h-full flex flex-col items-center justify-center overflow-hidden'
      style={{
        background: 'linear-gradient(135deg, rgba(14, 17, 30, 0.96) 0%, rgba(28, 24, 49, 0.94) 28%, rgba(20, 29, 42, 0.96) 62%, rgba(18, 12, 28, 0.98) 100%)',
      }}
    >
      <div
        className='absolute inset-0 pointer-events-none opacity-80'
        style={{
          background: 'radial-gradient(circle at 20% 20%, rgba(255, 110, 170, 0.2), transparent 28%), radial-gradient(circle at 75% 15%, rgba(98, 138, 255, 0.25), transparent 30%), radial-gradient(circle at 50% 82%, rgba(145, 106, 255, 0.22), transparent 38%)',
          filter: 'blur(56px)',
        }}
      />
      <div
        className='absolute inset-0 pointer-events-none'
        style={{
          backgroundImage: `
            radial-gradient(2px 2px at 6% 18%, rgba(255,255,255,0.95) 0, transparent 100%),
            radial-gradient(1.5px 1.5px at 12% 42%, rgba(255,255,255,0.7) 0, transparent 100%),
            radial-gradient(1.8px 1.8px at 18% 72%, rgba(188,214,255,0.9) 0, transparent 100%),
            radial-gradient(2.2px 2.2px at 26% 26%, rgba(255,255,255,0.85) 0, transparent 100%),
            radial-gradient(1.7px 1.7px at 32% 58%, rgba(255,220,180,0.8) 0, transparent 100%),
            radial-gradient(2px 2px at 40% 18%, rgba(255,255,255,0.95) 0, transparent 100%),
            radial-gradient(1.8px 1.8px at 45% 78%, rgba(214,217,255,0.8) 0, transparent 100%),
            radial-gradient(2.1px 2.1px at 52% 30%, rgba(255,255,255,0.9) 0, transparent 100%),
            radial-gradient(1.7px 1.7px at 58% 68%, rgba(255,255,255,0.8) 0, transparent 100%),
            radial-gradient(2px 2px at 64% 12%, rgba(192,245,255,0.9) 0, transparent 100%),
            radial-gradient(1.8px 1.8px at 72% 34%, rgba(255,255,255,0.85) 0, transparent 100%),
            radial-gradient(2.2px 2.2px at 78% 18%, rgba(255,255,255,0.9) 0, transparent 100%),
            radial-gradient(1.9px 1.9px at 84% 46%, rgba(255,188,220,0.8) 0, transparent 100%),
            radial-gradient(2px 2px at 90% 24%, rgba(255,255,255,0.95) 0, transparent 100%),
            radial-gradient(1.6px 1.6px at 94% 68%, rgba(250,255,255,0.8) 0, transparent 100%),
            radial-gradient(2.3px 2.3px at 14% 88%, rgba(255,255,255,0.9) 0, transparent 100%),
            radial-gradient(1.6px 1.6px at 30% 92%, rgba(183,239,255,0.75) 0, transparent 100%),
            radial-gradient(2px 2px at 48% 92%, rgba(255,255,255,0.9) 0, transparent 100%),
            radial-gradient(1.8px 1.8px at 66% 86%, rgba(255,207,176,0.8) 0, transparent 100%),
            radial-gradient(2.1px 2.1px at 82% 88%, rgba(255,255,255,0.9) 0, transparent 100%),
            radial-gradient(1.5px 1.5px at 96% 88%, rgba(210,215,255,0.75) 0, transparent 100%)
          `,
          opacity: 1,
        }}
      />
      {!isComplete &&
        <div className='fixed left-[20px] top-20'>
          <button
            className='w-[130px] h-[42px] hover:scale-[1.15] duration-200 flex items-center justify-center bg-gray-700 font-mono outline-none border-none rounded-lg cursor-pointer'
            title='Click me'
            onClick={handleClickGuide}
          >
            <p className="text-sm font-bold text-white">Hướng dẫn</p>
            <div className='h-full w-[36px] flex justify-center items-center'>
              <Icon icon={"tdesign:gesture-click-filled"} className='iconClick w-6 h-6' />
            </div>
          </button>
        </div>}
      {/* <div className='absolute w-full h-full bg-slate-400 blur-[100px]'></div> */}
      <div className={`containerLightCycle relative z-20 ${isComplete ? "containerLightCyclePlaying w-[135px] h-[180px] sm:w-[210px] sm:h-[280px]" : "w-[145px] h-[195px] sm:w-[180px] sm:h-[240px]"} ${dataClick.image ? "containerLightCyclePaused" : ""} mt-0 transition-all duration-300`}>
        <div className='itemContainerImage itemContainerImage1'>
          <Image
            src={imageChoosed.image1}
            width={400}
            height={800}
            alt=''
            className='itemImage'
            onClick={() => handleClickImage("image1")}
          />
        </div>
        <div className='itemContainerImage itemContainerImage2'>
          <Image
            src={imageChoosed.image2}
            width={400}
            height={800}
            alt=''
            className='itemImage'
            onClick={() => handleClickImage("image2")}
          />
        </div>
        <div className='itemContainerImage itemContainerImage3'>
          <Image
            src={imageChoosed.image3}
            width={400}
            height={800}
            alt=''
            className='itemImage'
            onClick={() => handleClickImage("image3")}
          />
        </div>
        <div className='itemContainerImage itemContainerImage4'>
          <Image
            src={imageChoosed.image4}
            width={400}
            height={800}
            alt=''
            className='itemImage'
            onClick={() => handleClickImage("image4")}
          />
        </div>
        <div className='itemContainerImage itemContainerImage5'>
          <Image
            src={imageChoosed.image5}
            width={400}
            height={800}
            alt=''
            className='itemImage'
            onClick={() => handleClickImage("image5")}
          />
        </div>
      </div >

      <div className={`fixed left-0 top-0 w-[100svw] h-[100svh] bg-[#050814] transition-opacity duration-300
        ${dataClick.image ? "z-[900] opacity-100 " : "-z-10 opacity-0"}
      `}
      >
        <div className={`w-full h-full flex items-center justify-center flex-col`}>
          {dataClick.image &&
            <div className='relative max-w-[400px] w-[90%] sm:w-[40%] rounded-xl aspect-[3/4]'>
              {/* <ImageEffect imageUrl={dataClick.image || ""} isVisible={dataClick.image ? true : false} /> */}
              <Image
                src={dataClick.image || ""}
                width={600}
                height={800}
                sizes={POPUP_IMAGE_SIZES}
                alt=''
                className='itemImage imageReveal'
              />
              <div className='absolute z-[101] bottom-0 left-0 max-w-[100%] rounded-xl bg-gray-600/70 p-2 flex justify-center'>
                <h3 className='w-fit font-mono text-base font-semibold'>
                  <TypeAnimation
                    sequence={[
                      // Same substring at the start will only be typed once, initially
                      1000,
                      () => {
                        setIsSound(true);
                        setIsShowClose(false);
                      },
                      dataClick.text,
                      () => {
                        setIsSound(false);
                        setIsShowClose(true);
                      },
                    ]}
                    speed={60}
                    style={{ whiteSpace: 'pre-line', display: 'block' }}
                  />
                </h3>
              </div>
              {isShowClose &&
                <div
                  className='flex justify-center items-center gap-1 absolute z-[101] bottom-[-40px] left-1/2 -translate-x-1/2 cursor-pointer px-3 py-1 rounded-lg bg-white font-mono font-semibold text-sm'
                  onClick={handleCloseImage}
                >
                  <Icon icon="iconamoon:close-bold" className='text-red-600 text-2xl' />
                </div>}
            </div>}
        </div>
      </div>
      <Modal isOpen={isOpenModal} setIsOpen={setIsOpenModal}>
        <div className='p-5 rounded-xl w-[90%] sm:w-[460px] bg-slate-700'>
          <p className='text-base font-bold'>Ở đây có 5 ô bí ẩn: </p>
          <ul className='mt-2 text-sm font-semibold font-mono text-gray-300'>
            <li className=''>+ Em ấn vào từng ô ,nó sẽ hiện ảnh và thông điệp mà anh muốn gửi đến em.</li>
            <li>+ Khi thông điệp chạy xong sẽ hiện một nút để tắt ở góc dưới nhé. </li>
            <li>+ Em mở xong 5 ô là hoàn thành:)), sau đó hãy thưởng thức thứ phía sau nó.</li>
          </ul>
        </div>
      </Modal>
      {isSound &&
        <audio autoPlay loop hidden>
          <source src="/soundTypeKeyboard.mp3" type="audio/mpeg" />
        </audio>}

      {isComplete &&
        <audio autoPlay loop hidden ref={myAudioRef}>
          <source src="/baby.mp3" type="audio/mpeg" />
        </audio>}

      {isComplete &&
        <div className='fixed w-full flex flex-col items-center justify-center z-10 bottom-10 text-gray-400 font-mono'>
          <p className='w-[90%] sm:w-1/2 text-center'>Vũ trụ rộng lớn ai cũng biết, nhưng chẳng ai biết tại sao ta gặp nhau.</p>
        </div>
      }

      {isComplete && <SakuraFalling />}
    </div>
  );
}

export default ImageCarousel3D;
