import LayoutMain from "@/components/layout";
import Subpage from "@/subpage";
import VietnameseWomenDay from "@/subpage/VietnameseWomenDay";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Memory',
  description: 'Lưu giữ kỉ niệm',
  icons: {
    icon: 'https://firebasestorage.googleapis.com/v0/b/storagefile-8768a.appspot.com/o/leevyy%2Fleevyy.jpeg?alt=media&token=e151604d-5d1e-49fa-9d41-7c04599a4b8d',
  },
  generator: 'tntchat',
  applicationName: 'Memory',
  referrer: 'origin-when-cross-origin',
  keywords: ['Memory', 'quoctephunu', 'phunu', "sinhnhat", "20/10", "25/10"],
  authors: [{ name: 'trungtn' }, { name: 'trungtn', url: 'https://tntchat.vercel.app' }],
  creator: 'trungtn',
  publisher: 'VietNam',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'Memory',
    description: 'Lưu giữ kỉ niệm',
    url: 'https://memory.vercel.app',
    siteName: 'Memory',
    images: [
      {
        url: 'https://cdn-media.sforum.vn/storage/app/media/anhthem/meme-tinh-yeu-64.jpg', // Must be an absolute URL
        width: 800,
        height: 600,
      },
      {
        url: 'https://cdn-media.sforum.vn/storage/app/media/anhthem/meme-tinh-yeu-64.jpg', // Must be an absolute URL
        width: 1800,
        height: 1600,
        alt: 'My custom alt',
      },
    ],
    videos: [
      {
        url: 'https://nextjs.org/video.mp4', // Must be an absolute URL
        width: 800,
        height: 600,
      },
    ],
    audio: [
      {
        url: 'https://nextjs.org/audio.mp3', // Must be an absolute URL
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    site: '@trungtn',
    title: 'Memory',
    description: 'Lưu giữ kỉ niệm',
    images: ['https://cdn-media.sforum.vn/storage/app/media/anhthem/meme-tinh-yeu-64.jpg']
  },
  metadataBase: new URL('https://acme.com'),
}

export default function Home() {
  return (
    <LayoutMain>
      <VietnameseWomenDay />
    </LayoutMain>
  );
}
