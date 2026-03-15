"use client";

import { useState, useEffect, useMemo } from "react";

interface Props {
  userName: string;
  delay?: number;
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function GreetingHeader({ userName, delay = 0 }: Props) {
  const fullText = useMemo(() => `Good ${getTimeOfDay()}, ${userName}`, [userName]);
  const [charIndex, setCharIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setCharIndex(0); }, [fullText]);

  useEffect(() => {
    if (!mounted) return;
    if (charIndex < fullText.length) {
      const timer = setTimeout(() => setCharIndex((i) => i + 1), 45);
      return () => clearTimeout(timer);
    }
  }, [charIndex, fullText, mounted]);

  return (
    <div
      className="mb-2"
      style={{ animation: `fadeSlideUp 600ms ease-out ${delay}ms both` }}
    >
      <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] text-[#E8EAF0] min-h-[2.75rem] leading-tight">
        {mounted ? fullText.slice(0, charIndex) : fullText}
        {mounted && charIndex < fullText.length && (
          <span className="inline-block w-[2px] h-[1.1em] bg-[#5DCAA5] ml-0.5 align-middle" style={{ animation: "blink 1s step-end infinite" }} />
        )}
      </h1>
      <p className="font-sans text-sm sm:text-base lg:text-lg text-[#A0A8B8]/40 mt-1.5">
        {formatDate()}
      </p>
    </div>
  );
}
