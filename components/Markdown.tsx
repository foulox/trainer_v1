'use client'
import dynamic from 'next/dynamic'
const Markdown = dynamic(() => import('react-markdown'), { ssr: false })
export default Markdown
