import AudioPage from '@/components/Audio'
import { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  title: 'Audio',
  description: 'Nghe chuyện',
  openGraph: {
    title: 'Memory',
    description: 'Nghe chuyện',
    url: 'https://nhuquynhmain.vercel.app',
    siteName: 'Memory',
    images: [
      {
        url: 'https://www.phucanh.vn/media/news/2511_audio-book-la-gi-su-hap-dan-cua-audio-book-1.jpg', // Must be an absolute URL
        width: 800,
        height: 600,
      },
      {
        url: 'https://www.phucanh.vn/media/news/2511_audio-book-la-gi-su-hap-dan-cua-audio-book-1.jpg', // Must be an absolute URL
        width: 1800,
        height: 1600,
        alt: 'My custom alt',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    site: '@trungtn',
    title: 'Memory',
    description: 'Lưu giữ kỉ niệm',
    images: ['https://www.phucanh.vn/media/news/2511_audio-book-la-gi-su-hap-dan-cua-audio-book-1.jpg']
  },
  metadataBase: new URL('https://acme.com'),
}

function Audio() {
  return (
    <div>
      <AudioPage />
    </div>
  )
}

export default Audio