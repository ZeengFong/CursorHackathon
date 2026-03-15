'use client'

import { useEffect, useRef, useState } from 'react'

type Task = {
  id: string
  text: string
  category: string
  status: string
  source: string
  due_date?: string | null
}

interface MindLetterProps {
  tasks: Task[]
  onClose: () => void
}

const CACHE_KEY = 'clearhead_letter'

export default function MindLetter({ tasks, onClose }: MindLetterProps) {
  const [letter, setLetter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const letterRef = useRef('')
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)

  useEffect(() => {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      setLetter(cached)
      setLoading(false)
      setStreaming(false)
      return
    }
    fetchLetter()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Cleanup reader on unmount
  useEffect(() => {
    return () => {
      readerRef.current?.cancel()
    }
  }, [])

  async function fetchLetter() {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Failed to fetch letter')
      }

      const reader = res.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()

      setLoading(false)
      setStreaming(true)
      letterRef.current = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        letterRef.current += chunk
        setLetter(letterRef.current)
      }

      setStreaming(false)
      sessionStorage.setItem(CACHE_KEY, letterRef.current)
    } catch {
      setError('Could not generate your letter. Try again.')
      setLoading(false)
      setStreaming(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,12,16,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full rounded-2xl p-8"
        style={{
          background: '#13161C',
          border: '1px solid rgba(29,158,117,0.2)',
          animation: 'fadeSlideUp 300ms ease-out forwards',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-md text-[#A0A8B8] hover:text-[#E8EAF0] transition-colors duration-150"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          aria-label="Close"
        >
          ×
        </button>

        {/* Eyebrow */}
        <p
          className="font-sans text-[10px] font-medium tracking-[0.1em] uppercase mb-1"
          style={{ color: 'rgba(93,202,165,0.7)' }}
        >
          Your mind letter
        </p>

        {/* Divider */}
        <div className="h-px mb-5" style={{ background: 'rgba(29,158,117,0.1)' }} />

        {/* Letter body */}
        <div className="min-h-[120px]">
          {loading && (
            <div className="space-y-3">
              {[100, 85, 92, 78, 60].map((w, i) => (
                <div
                  key={i}
                  className="h-4 rounded animate-pulse"
                  style={{
                    width: `${w}%`,
                    background: 'rgba(29,158,117,0.08)',
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              ))}
            </div>
          )}

          {error && (
            <p className="font-sans text-sm" style={{ color: 'rgba(224,75,74,0.8)' }}>
              {error}
            </p>
          )}

          {!loading && !error && (
            <p
              className="font-serif whitespace-pre-wrap leading-[1.8]"
              style={{ fontSize: '1.05rem', color: '#D8DAEA' }}
            >
              {letter}
              {streaming && (
                <span
                  className="inline-block ml-0.5 w-px h-[1.1em] align-middle"
                  style={{
                    background: '#5DCAA5',
                    animation: 'blink 1s step-end infinite',
                  }}
                />
              )}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-between items-center">
          <p className="font-sans text-[11px]" style={{ color: 'rgba(160,168,184,0.4)' }}>
            Press Esc or click outside to close
          </p>
          {!loading && !streaming && !error && (
            <button
              onClick={onClose}
              className="font-sans text-sm px-4 py-1.5 rounded-lg transition-colors duration-150"
              style={{
                color: '#A0A8B8',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent',
              }}
              onMouseEnter={e => {
                (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={e => {
                (e.target as HTMLElement).style.background = 'transparent'
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
