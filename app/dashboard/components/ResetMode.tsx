"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const PHASES = [
  { label: "Inhale",  seconds: 4 },
  { label: "Hold",    seconds: 4 },
  { label: "Exhale",  seconds: 4 },
  { label: "Hold",    seconds: 4 },
];

export default function ResetMode() {

  const [phaseIndex, setPhaseIndex] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [quote, setQuote] = useState<{ content: string; author: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState(false);

  useEffect(() => {
    const advance = (index: number) => {
      timeoutRef.current = setTimeout(() => {
        const next = (index + 1) % PHASES.length;
        setPhaseIndex(next);
        advance(next);
      }, PHASES[index].seconds * 1000);
    };
    advance(0);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const fetchQuote = async () => {
    setQuoteLoading(true);
    setQuoteError(false);
    try {
      const { data, error } = await supabase
        .from("Quotes")
        .select("Quote, Author")
        .limit(1)
        .order("Quote", { ascending: false })          // needed so .limit applies server-side
        .range(Math.floor(Math.random() * 1664), Math.floor(Math.random() * 1664)); // random offset

      // fallback: pick via raw rpc if range trick returns empty
      let row = data?.[0];
      if (!row || error) {
        // simpler fallback: just grab any one
        const fb = await supabase.from("Quotes").select("Quote, Author").limit(100);
        const arr = fb.data ?? [];
        row = arr[Math.floor(Math.random() * arr.length)];
      }

      if (row?.Quote) {
        setQuote({ content: row.Quote, author: row.Author ?? "Who knows?" });
      } else {
        throw new Error("No quote returned");
      }
    } catch {
      setQuoteError(true);
    } finally {
      setQuoteLoading(false);
    }
  };

  useEffect(() => {
    fetchQuote();
  }, []); // mount only

  const phase = PHASES[phaseIndex];

  return (
    <div className="p-6 sm:p-8 sm:pl-10 sm:pr-20 max-w-lg mx-auto" style={{ animation: "fadeSlideUp 600ms ease-out both" }}>
      <div className="mb-10">
        <h2 className="font-serif text-2xl text-[#E8EAF0]">Reset</h2>
        <p className="mt-1 font-sans text-sm text-[#A0A8B8]/50">
          Breathe. Then read.
        </p>
      </div>

      {/* Breathing circle */}
      <div className="flex flex-col items-center mb-12" style={{ animation: "fadeSlideUp 600ms ease-out 100ms both" }}>
        <div className="relative flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48">
          <div className="animate-breathe absolute inset-0 rounded-full bg-[#1D9E75]/6" />
          <div
            className="animate-breathe absolute w-24 h-24 sm:w-32 sm:h-32 lg:w-36 lg:h-36 rounded-full border-2 border-[#1D9E75]/25 bg-[#1D9E75]/10"
            style={{ animationDelay: "0.4s" }}
          />
          <div
            className="animate-breathe w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full bg-[#1D9E75]/20 flex items-center justify-center"
            style={{ animationDelay: "0.8s" }}
          >
            <div className="w-3 h-3 rounded-full bg-[#5DCAA5]/70" />
          </div>
        </div>

        <p
          key={phaseIndex}
          className="mt-7 font-serif italic text-2xl text-[#5DCAA5] opacity-0 animate-fade-up"
          style={{ animationDuration: "0.4s", animationFillMode: "both" }}
        >
          {phase.label}
        </p>
        <p className="mt-1 font-sans text-[11px] text-[#A0A8B8]/25 tabular-nums">{phase.seconds}s</p>
      </div>

      {/* Daily quote */}
      <div className="mt-10 flex flex-col items-center gap-4">

        {quoteLoading && (
          <div className="w-full max-w-sm flex flex-col items-center gap-2">
            <div
              className="h-4 rounded animate-pulse w-4/5"
              style={{ background: 'rgba(29,158,117,0.08)' }}
            />
            <div
              className="h-4 rounded animate-pulse w-3/5"
              style={{ background: 'rgba(29,158,117,0.08)' }}
            />
            <div
              className="h-3 rounded animate-pulse w-1/3 mt-1"
              style={{ background: 'rgba(29,158,117,0.05)' }}
            />
          </div>
        )}

        {quoteError && !quoteLoading && (
          <p className="font-sans text-xs text-[#A0A8B8]/30 text-center">
            Could not load a quote right now.
          </p>
        )}

        {quote && !quoteLoading && (
          <div
            className="w-full max-w-sm text-center animate-fade-up"
            style={{ animationDuration: '0.6s', animationFillMode: 'both' }}
          >
            {/* Decorative top line */}
            <div className="w-8 h-px mx-auto mb-5 bg-[#1D9E75]/25" />

            <p className="font-serif italic text-base sm:text-[1.05rem] leading-[1.75] text-[#D8DAEA]">
              &ldquo;{quote.content}&rdquo;
            </p>

            <p className="mt-3 font-sans text-[11px] text-[#A0A8B8]/45 tracking-wide">
              — {quote.author}
            </p>

            {/* Refresh button */}
            <button
              onClick={fetchQuote}
              className="mt-5 inline-flex items-center gap-1.5 font-sans text-[11px] text-[#A0A8B8]/35 hover:text-[#5DCAA5] hover:bg-[#1D9E75]/8 px-2 py-1 rounded-lg transition-colors duration-200"
              aria-label="Load another quote"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="w-3 h-3"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 8A5.5 5.5 0 1 1 8 2.5a5.5 5.5 0 0 1 3.89 1.61L13.5 5.5M13.5 5.5V2.5M13.5 5.5H10.5"
                />
              </svg>
              another quote
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
