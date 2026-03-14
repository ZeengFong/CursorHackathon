import InputCard from "./components/InputCard";

// ── Step icons ────────────────────────────────────────────────────────
function MicKeyboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
      />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

// ── Step data ─────────────────────────────────────────────────────────
const STEPS = [
  {
    icon: <MicKeyboardIcon />,
    number: "01",
    title: "Dump everything",
    body: "Type, speak, or drop files. Spelling, grammar, order — none of it matters.",
  },
  {
    icon: <SparkleIcon />,
    number: "02",
    title: "AI organises it",
    body: "Claude reads your dump and extracts every task, worry, and deadline. Then asks if it missed anything.",
  },
  {
    icon: <ChecklistIcon />,
    number: "03",
    title: "One clear plan",
    body: "Now / Later / Drop — plus a calendar view of what's coming. You see exactly what to do next.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <main className="min-h-screen bg-[#0D0F14] text-[#E8EAF0] overflow-x-hidden">
      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#0D0F14]/95 backdrop-blur-sm border-b border-[#1D9E75]/8">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-serif text-[1.1rem] tracking-tight text-[#E8EAF0]">
            Clear<em className="text-[#5DCAA5] italic">Head</em>
          </span>
          <a
            href="/login"
            className="font-sans text-[13px] text-[#A0A8B8]/55 hover:text-[#5DCAA5] transition-colors duration-150"
          >
            Sign in
          </a>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center px-4 pt-24 pb-16">
        {/* Eyebrow */}
        <span
          className="mb-6 inline-flex items-center gap-2 text-[11px] font-sans font-medium tracking-widest uppercase text-[#5DCAA5] opacity-0 animate-fade-up"
          style={{ animationDelay: "0ms", animationFillMode: "both" }}
        >
          <span className="inline-block w-4 h-px bg-[#5DCAA5]" />
          Cognitive load manager
          <span className="inline-block w-4 h-px bg-[#5DCAA5]" />
        </span>

        {/* Headline */}
        <h1
          className="font-serif text-5xl sm:text-[56px] leading-[1.08] tracking-tight text-[#E8EAF0] max-w-xl opacity-0 animate-fade-up"
          style={{ animationDelay: "70ms", animationFillMode: "both" }}
        >
          Stop spinning.
          <br />
          Start{" "}
          <em className="text-[#5DCAA5] italic not-italic font-serif italic">
            clearing.
          </em>
        </h1>

        {/* Subline */}
        <p
          className="mt-6 font-sans text-base sm:text-[17px] leading-relaxed text-[#A0A8B8] max-w-sm opacity-0 animate-fade-up"
          style={{ animationDelay: "150ms", animationFillMode: "both" }}
        >
          Type, speak, or drop files. BrainDump turns the chaos in your head
          into a clear action plan.
        </p>

        {/* Input card */}
        <div
          className="mt-10 w-full max-w-2xl opacity-0 animate-fade-up"
          style={{ animationDelay: "230ms", animationFillMode: "both" }}
        >
          <InputCard />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section
        className="px-4 pb-20 opacity-0 animate-fade-up"
        style={{ animationDelay: "400ms", animationFillMode: "both" }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <div className="flex-1 h-px bg-[#1D9E75]/10" />
            <span className="text-[10px] font-sans font-medium tracking-widest uppercase text-[#A0A8B8]/35">
              How it works
            </span>
            <div className="flex-1 h-px bg-[#1D9E75]/10" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {STEPS.map((step, i) => (
              <div
                key={step.number}
                className="rounded-xl bg-[#13161C] border border-[#1D9E75]/8 px-6 py-7 flex flex-col gap-4 opacity-0 animate-fade-up"
                style={{
                  animationDelay: `${460 + i * 70}ms`,
                  animationFillMode: "both",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#1D9E75]/10 text-[#5DCAA5]">
                    {step.icon}
                  </span>
                  <span className="font-serif italic text-2xl text-[#1D9E75]/30 leading-none select-none">
                    {step.number}
                  </span>
                </div>
                <div>
                  <h3 className="font-sans font-semibold text-[15px] text-[#E8EAF0] mb-1.5">
                    {step.title}
                  </h3>
                  <p className="font-sans text-sm leading-relaxed text-[#A0A8B8]">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof strip ───────────────────────────────────── */}
      <div
        className="border-t border-b border-[#1D9E75]/8 py-5 px-4 opacity-0 animate-fade-up"
        style={{ animationDelay: "650ms", animationFillMode: "both" }}
      >
        <p className="text-center font-sans text-sm text-[#A0A8B8]/45 tracking-wide">
          For knowledge workers, students, caregivers — anyone whose brain
          won&apos;t stop.
        </p>
      </div>

      <div className="h-20" />
    </main>
  );
}
