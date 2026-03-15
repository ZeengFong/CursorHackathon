"use client";

interface Props {
  nextActionText: string | null;
  onDismiss: () => void;
  /** Unconditionally speaks – caller decides whether voice is enabled */
  speak: (text: string) => void;
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 0 1 0 7.072M12 6.343a7 7 0 0 1 0 11.314M5 10H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2l4 3V7L5 10Z" />
    </svg>
  );
}

export default function MascotOrb({ nextActionText, onDismiss, speak }: Props) {
  const isActive = nextActionText !== null;

  return (
    /*
     * Position: desktop — fixed bottom-right of viewport (outside sidebar).
     * Mobile — bottom-left, above the 64px bottom tab bar.
     */
    <div className="fixed z-40 bottom-20 left-6 sm:bottom-6 sm:left-auto sm:right-6">
      <div className="group relative">
        {/* ── Orb ── */}
        <div
          className={`
            w-14 h-14 rounded-full bg-[#13161C] border-2 cursor-pointer
            flex items-center justify-center
            transition-[border-color,box-shadow] duration-300
            animate-orb-pulse
            ${isActive
              ? "border-[#1D9E75] shadow-[0_0_20px_rgba(29,158,117,0.30)]"
              : "border-[rgba(29,158,117,0.4)]"
            }
          `}
        >
          {/* Waveform — 3 bars animated at different delays */}
          <div className="flex items-center gap-[3px]" style={{ height: "18px" }}>
            {[0, 200, 400].map((delay) => (
              <div
                key={delay}
                style={{
                  width: "3px",
                  height: "100%",
                  background: isActive ? "#5DCAA5" : "rgba(29,158,117,0.55)",
                  borderRadius: "2px",
                  transformOrigin: "center",
                  animation: `wave-bar 0.85s ease-in-out ${delay}ms infinite alternate`,
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Hover card (only when active) ── */}
        {isActive && (
          <div
            className="
              absolute bottom-full right-0 mb-3 w-52
              bg-[#13161C] border border-[#1D9E75]/30 rounded-xl p-3
              shadow-[0_8px_32px_rgba(0,0,0,0.5)]
              opacity-0 pointer-events-none
              group-hover:opacity-100 group-hover:pointer-events-auto
              transition-opacity duration-150
            "
          >
            <p className="font-sans text-[13px] text-[#E8EAF0] leading-snug">
              {nextActionText}
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={() => speak(nextActionText!)}
                aria-label="Read aloud"
                className="w-7 h-7 flex items-center justify-center text-[#A0A8B8]/50 hover:text-[#5DCAA5] transition-colors rounded-lg hover:bg-[#1D9E75]/10"
              >
                <SpeakerIcon />
              </button>
              <button
                onClick={onDismiss}
                aria-label="Dismiss"
                className="w-7 h-7 flex items-center justify-center text-[#A0A8B8]/40 hover:text-[#E8EAF0] transition-colors font-sans text-xs rounded-lg hover:bg-white/5"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
