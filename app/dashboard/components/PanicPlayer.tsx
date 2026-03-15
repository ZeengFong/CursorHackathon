'use client'

import { useCallback, useEffect, useState } from 'react'

interface PanicPlayerProps {
  onClose: () => void
}

// Default: lofi hip hop chill beats (YouTube)
const DEFAULT_EMBED =
  'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&rel=0'

// Convert any YouTube or Spotify URL to an embeddable src
function toEmbedUrl(input: string): string {
  if (!input || input.trim() === '') return DEFAULT_EMBED

  const raw = input.trim()

  try {
    // ── SPOTIFY ─────────────────────────────────────────────────────────
    if (raw.includes('spotify.com')) {
      // Already an embed URL
      if (raw.includes('open.spotify.com/embed')) return raw

      // Convert open.spotify.com/TYPE/ID → embed
      const spotifyMatch = raw.match(
        /open\.spotify\.com\/(playlist|track|album|artist)\/([A-Za-z0-9]+)/
      )
      if (spotifyMatch) {
        const [, type, id] = spotifyMatch
        return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&autoplay=1`
      }

      // Could not parse — fall back to default
      return DEFAULT_EMBED
    }

    // ── YOUTUBE ──────────────────────────────────────────────────────────
    if (raw.includes('youtube.com') || raw.includes('youtu.be')) {
      // Already a valid embed URL — return as-is
      if (raw.includes('youtube.com/embed/')) return raw

      let url: URL
      try {
        url = new URL(raw.startsWith('http') ? raw : 'https://' + raw)
      } catch {
        return DEFAULT_EMBED
      }

      const videoId = url.searchParams.get('v')
      const listId = url.searchParams.get('list')

      // youtu.be/ID short URL
      if (url.hostname === 'youtu.be') {
        const id = url.pathname.slice(1).split('?')[0]
        if (!id) return DEFAULT_EMBED
        const listParam = listId ? `&list=${listId}` : ''
        return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0${listParam}`
      }

      // Has a video ID — embed that video (include playlist if present)
      if (videoId) {
        const listParam = listId ? `&list=${listId}` : ''
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0${listParam}`
      }

      // Playlist only (no specific video)
      if (listId) {
        return `https://www.youtube.com/embed/videoseries?list=${listId}&autoplay=1&rel=0`
      }

      // Homepage or channel URL — cannot embed, fall back to default
      return DEFAULT_EMBED
    }

    // Unknown URL — fall back to default
    return DEFAULT_EMBED
  } catch {
    return DEFAULT_EMBED
  }
}

function detectPlatform(url: string): 'youtube' | 'spotify' | 'default' {
  if (!url) return 'default'
  if (url.includes('spotify.com')) return 'spotify'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  return 'default'
}

export default function PanicPlayer({ onClose }: PanicPlayerProps) {
  const [embedSrc, setEmbedSrc] = useState('')
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState<'youtube' | 'spotify' | 'default'>('default')

  useEffect(() => {
    // Read user's configured panic URL from localStorage
    const stored = (() => {
      try {
        return localStorage.getItem('BrainDump_panic_url') || ''
      } catch {
        return ''
      }
    })()

    // If the stored URL could not be converted (returned default),
    // that is fine — the default video plays. No error shown.
    // The user will see lofi beats which is a valid break experience.
    setEmbedSrc(toEmbedUrl(stored || DEFAULT_EMBED))
    setPlatform(detectPlatform(stored))

    // Trigger entrance animation after mount
    const t = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(t)
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 300)
  }, [onClose])

  // Escape key closes the player
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleClose])

  const isSpotify = embedSrc.includes('spotify.com')

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: '#0A0C10',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Left: branding */}
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#D85A30' }}
          />
          <span
            className="font-sans text-sm"
            style={{ color: 'rgba(160,168,184,0.6)' }}
          >
            {platform === 'spotify'
              ? 'Playing on Spotify'
              : platform === 'youtube'
              ? 'Playing on YouTube'
              : 'Take a break — you deserve it'}
          </span>
        </div>

        {/* Right: back button */}
        <button
          onClick={handleClose}
          className="flex items-center gap-2 font-sans text-sm transition-colors duration-150"
          style={{ color: 'rgba(160,168,184,0.5)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#E8EAF0')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(160,168,184,0.5)')}
          aria-label="Close panic player and return to dashboard"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="w-4 h-4"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 3L5 8l5 5" />
          </svg>
          Back to work
        </button>
      </div>

      {/* Player — fills remaining space */}
      <div
        className="flex-1 relative flex items-center justify-center"
        style={{ background: '#0A0C10' }}
      >
        {embedSrc && (
          <iframe
            src={embedSrc}
            style={{
              border: 'none',
              width: '100%',
              height: '100%',
              // Spotify embeds are compact — center with max-width
              ...(isSpotify && {
                maxWidth: '480px',
                height: '380px',
                borderRadius: '12px',
              }),
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title="BrainDump break player"
          />
        )}
      </div>

      {/* Footer hint */}
      <div
        className="flex-shrink-0 flex justify-center py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <span
          className="font-sans text-[11px]"
          style={{ color: 'rgba(160,168,184,0.25)' }}
        >
          Press Esc or click &ldquo;Back to work&rdquo; when ready
        </span>
      </div>
    </div>
  )
}
