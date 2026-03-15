"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────
type Tab = "signin" | "signup";

// ── Password strength ──────────────────────────────────────────────────
function getStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  if (pw.length > 12 && /\d/.test(pw)) return 3; // teal
  if (pw.length > 8) return 2;                    // amber
  if (pw.length > 0) return 1;                    // red
  return 0;
}

const STRENGTH_COLOR = ["transparent", "#D85A30", "#EF9F27", "#1D9E75"];
const STRENGTH_LABEL = ["", "Too short", "Almost there", "Strong"];

// ── Eye icon ───────────────────────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l14 14M12.5 12.5A2.5 2.5 0 0 1 7.5 7.5M5.5 5.5C3.7 6.8 2 10 2 10s3 6 8 6c1.5 0 2.9-.4 4-.9M14.5 14.5C16.3 13.2 18 10 18 10s-3-6-8-6c-.4 0-.8 0-1.2.1" />
    </svg>
  );
}

// ── Google SVG logo ────────────────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
      <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"/>
      <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24Z"/>
      <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09Z"/>
      <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"/>
    </svg>
  );
}

// ── Input component ────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

function Field({ error, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <input
        {...props}
        className={`w-full bg-[#0D0F14] border-2 rounded-xl py-3 px-4 font-sans text-[14px] text-[#E8EAF0] placeholder-[#A0A8B8]/40 outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#1D9E75]/60 focus:shadow-[0_0_0_3px_rgba(29,158,117,0.08)] ${
          error ? "border-[#D85A30]/50" : "border-white/8"
        } ${className}`}
      />
      {error && <p className="text-[11.5px] text-[#D85A30]/80 font-sans">{error}</p>}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────
export default function LoginPage() {
  const router  = useRouter();


  const [tab, setTab]           = useState<Tab>("signin");
  const [visible, setVisible]   = useState(false); // entrance animation
  const [showPw, setShowPw]     = useState(false);

  // Sign-in state
  const [siEmail, setSiEmail]   = useState("");
  const [siPw, setSiPw]         = useState("");
  const [siErrors, setSiErrors] = useState<{ email?: string; pw?: string }>({});
  const [siMsg, setSiMsg]       = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [siLoading, setSiLoading] = useState(false);

  // Sign-up state
  const [suName, setSuName]     = useState("");
  const [suEmail, setSuEmail]   = useState("");
  const [suPw, setSuPw]         = useState("");
  const [suErrors, setSuErrors] = useState<{ name?: string; email?: string; pw?: string }>({});
  const [suMsg, setSuMsg]       = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [suLoading, setSuLoading] = useState(false);

  const strength = getStrength(suPw);

  // Redirect already-signed-in users straight to dashboard
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) router.push("/dashboard");
      } catch {
        // If session check fails, stay on login page — do nothing
      }
    };
    checkSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // ── Validation ───────────────────────────────────────────────────────
  function validateEmail(email: string) {
    return email.includes("@") && email.includes(".") ? "" : "Enter a valid email address.";
  }
  function validatePw(pw: string) {
    return pw.length >= 8 ? "" : "Password must be at least 8 characters.";
  }

  // ── Sign in ──────────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const emailErr = validateEmail(siEmail);
    const pwErr    = validatePw(siPw);
    setSiErrors({ email: emailErr, pw: pwErr });
    if (emailErr || pwErr) return;

    setSiLoading(true);
    setSiMsg(null);

    const { error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPw });

    if (error) {
      const msg =
        error.message.toLowerCase().includes("invalid")
          ? "Wrong email or password."
          : error.message.toLowerCase().includes("confirm")
          ? "Check your inbox to confirm your email."
          : error.message;
      setSiMsg({ type: "error", text: msg });
      setSiLoading(false);
    } else {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const previousUserId = sessionStorage.getItem("BrainDump_current_user");
          if (previousUserId && previousUserId !== user.id) {
            sessionStorage.clear();
          }
          sessionStorage.setItem("BrainDump_current_user", user.id);
          const storedDisplayName = (() => {
            try { return localStorage.getItem('clearhead_display_name') } catch { return null }
          })()
          const metaName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || null
          const emailSlug = (() => {
            if (!user?.email) return 'User'
            const slug = user.email.split('@')[0]
            return slug.replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
          })()
          sessionStorage.setItem("BrainDump_user", storedDisplayName || metaName || emailSlug);
        }
      } catch {
        sessionStorage.clear();
      }
      const params = new URLSearchParams(window.location.search);
      const fromDump = params.get("from") === "dump";
      router.push(fromDump ? "/dashboard?restored=true" : "/dashboard");
    }
  }

  // ── Sign up ──────────────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const nameErr  = suName.trim() ? "" : "Display name is required.";
    const emailErr = validateEmail(suEmail);
    const pwErr    = validatePw(suPw);
    setSuErrors({ name: nameErr, email: emailErr, pw: pwErr });
    if (nameErr || emailErr || pwErr) return;

    setSuLoading(true);
    setSuMsg(null);

    const { error } = await supabase.auth.signUp({
      email: suEmail,
      password: suPw,
      options: { data: { display_name: suName } },
    });

    if (error) {
      setSuMsg({ type: "error", text: error.message });
    } else {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          sessionStorage.setItem("BrainDump_current_user", user.id);
          const storedDisplayName = (() => {
            try { return localStorage.getItem('clearhead_display_name') } catch { return null }
          })()
          const metaName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || null
          const emailSlug = (() => {
            if (!user?.email) return 'User'
            const slug = user.email.split('@')[0]
            return slug.replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
          })()
          sessionStorage.setItem("BrainDump_user", storedDisplayName || metaName || emailSlug);
        }
      } catch { /* ignore */ }
      setSuMsg({ type: "success", text: "Check your email to confirm your account." });
    }
    setSuLoading(false);
  }

  // ── Google OAuth ─────────────────────────────────────────────────────
  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback" },
    });
  }

  return (
    <div className="min-h-screen bg-[#0D0F14] flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Watermark */}
      <span
        aria-hidden
        className="pointer-events-none select-none fixed left-[-2vw] top-1/2 -translate-y-1/2 font-serif text-[20vw] text-[#E8EAF0] leading-none"
        style={{ opacity: 0.028 }}
      >
        Clear.
      </span>

      {/* Card */}
      <div
        className="relative w-full max-w-sm transition-[opacity,transform] duration-300 ease-out"
        style={{
          opacity:   visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
        }}
      >
        <div className="bg-[#13161C] border-2 border-white/6 rounded-2xl p-7 shadow-[0_32px_64px_rgba(0,0,0,0.5)]">

          {/* Logo */}
          <div className="text-center mb-6">
            <span className="font-serif text-2xl text-[#E8EAF0]">
              Clear<em className="text-[#5DCAA5] italic">Head</em>
            </span>
          </div>

          {/* Tab toggle */}
          <div className="flex items-center justify-center gap-6 mb-7">
            <button
              onClick={() => { setTab("signin"); setSiMsg(null); }}
              className={`font-sans text-sm pb-0.5 border-b-2 transition-colors duration-150 ${
                tab === "signin"
                  ? "text-[#5DCAA5] border-[#5DCAA5]"
                  : "text-[#A0A8B8]/50 border-transparent hover:text-[#A0A8B8]"
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setTab("signup"); setSuMsg(null); }}
              className={`font-sans text-sm pb-0.5 border-b-2 transition-colors duration-150 ${
                tab === "signup"
                  ? "text-[#5DCAA5] border-[#5DCAA5]"
                  : "text-[#A0A8B8]/50 border-transparent hover:text-[#A0A8B8]"
              }`}
            >
              Create account
            </button>
          </div>

          {/* ── Sign in form ─────────────────────────────────────── */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} noValidate className="flex flex-col gap-3.5">
              <Field
                type="email"
                placeholder="Email"
                value={siEmail}
                onChange={(e) => setSiEmail(e.target.value)}
                onBlur={() => setSiErrors((p) => ({ ...p, email: validateEmail(siEmail) }))}
                error={siErrors.email}
                autoComplete="email"
              />

              {/* Password with show/hide */}
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Password"
                    value={siPw}
                    onChange={(e) => setSiPw(e.target.value)}
                    onBlur={() => setSiErrors((p) => ({ ...p, pw: validatePw(siPw) }))}
                    autoComplete="current-password"
                    className={`w-full bg-[#0D0F14] border-2 rounded-xl py-3 pl-4 pr-11 font-sans text-[14px] text-[#E8EAF0] placeholder-[#A0A8B8]/40 outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#1D9E75]/60 focus:shadow-[0_0_0_3px_rgba(29,158,117,0.08)] ${
                      siErrors.pw ? "border-[#D85A30]/50" : "border-white/8"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A8B8]/40 hover:text-[#A0A8B8] transition-colors"
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showPw} />
                  </button>
                </div>
                {siErrors.pw && <p className="text-[11.5px] text-[#D85A30]/80 font-sans">{siErrors.pw}</p>}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="font-sans text-[12px] text-[#A0A8B8]/40 hover:text-[#A0A8B8] transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {siMsg && (
                <p className={`text-[12.5px] font-sans px-3 py-2 rounded-lg ${
                  siMsg.type === "error"
                    ? "text-[#E07878] bg-[#D85A30]/8 border-2 border-[#D85A30]/15"
                    : "text-[#5DCAA5] bg-[#1D9E75]/8 border-2 border-[#1D9E75]/15"
                }`}>
                  {siMsg.text}
                </p>
              )}

              <button
                type="submit"
                disabled={siLoading}
                className="w-full py-3 bg-[#1D9E75] hover:bg-[#5DCAA5] disabled:opacity-50 disabled:cursor-not-allowed text-white font-sans font-medium text-[15px] rounded-xl transition-colors mt-1"
              >
                {siLoading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}

          {/* ── Create account form ───────────────────────────────── */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} noValidate className="flex flex-col gap-3.5">
              <Field
                type="text"
                placeholder="Display name"
                value={suName}
                onChange={(e) => setSuName(e.target.value)}
                onBlur={() => setSuErrors((p) => ({ ...p, name: suName.trim() ? "" : "Display name is required." }))}
                error={suErrors.name}
                autoComplete="name"
              />
              <Field
                type="email"
                placeholder="Email"
                value={suEmail}
                onChange={(e) => setSuEmail(e.target.value)}
                onBlur={() => setSuErrors((p) => ({ ...p, email: validateEmail(suEmail) }))}
                error={suErrors.email}
                autoComplete="email"
              />

              {/* Password + strength */}
              <div className="flex flex-col gap-1.5">
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Password (min. 8 characters)"
                    value={suPw}
                    onChange={(e) => setSuPw(e.target.value)}
                    onBlur={() => setSuErrors((p) => ({ ...p, pw: validatePw(suPw) }))}
                    autoComplete="new-password"
                    className={`w-full bg-[#0D0F14] border-2 rounded-xl py-3 pl-4 pr-11 font-sans text-[14px] text-[#E8EAF0] placeholder-[#A0A8B8]/40 outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#1D9E75]/60 focus:shadow-[0_0_0_3px_rgba(29,158,117,0.08)] ${
                      suErrors.pw ? "border-[#D85A30]/50" : "border-white/8"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A8B8]/40 hover:text-[#A0A8B8] transition-colors"
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showPw} />
                  </button>
                </div>
                {suErrors.pw && <p className="text-[11.5px] text-[#D85A30]/80 font-sans">{suErrors.pw}</p>}

                {/* Strength bar */}
                {suPw.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/6 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${(strength / 3) * 100}%`,
                          backgroundColor: STRENGTH_COLOR[strength],
                        }}
                      />
                    </div>
                    <span className="font-sans text-[10px] shrink-0" style={{ color: STRENGTH_COLOR[strength] }}>
                      {STRENGTH_LABEL[strength]}
                    </span>
                  </div>
                )}
              </div>

              {suMsg && (
                <p className={`text-[12.5px] font-sans px-3 py-2 rounded-lg ${
                  suMsg.type === "error"
                    ? "text-[#E07878] bg-[#D85A30]/8 border-2 border-[#D85A30]/15"
                    : "text-[#5DCAA5] bg-[#1D9E75]/8 border-2 border-[#1D9E75]/15"
                }`}>
                  {suMsg.text}
                </p>
              )}

              <button
                type="submit"
                disabled={suLoading}
                className="w-full py-3 bg-[#1D9E75] hover:bg-[#5DCAA5] disabled:opacity-50 disabled:cursor-not-allowed text-white font-sans font-medium text-[15px] rounded-xl transition-colors mt-1"
              >
                {suLoading ? "Creating account…" : "Create account"}
              </button>
            </form>
          )}

          {/* ── Divider ──────────────────────────────────────────── */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/6" />
            <span className="font-sans text-[12px] text-[#A0A8B8]/35">or</span>
            <div className="flex-1 h-px bg-white/6" />
          </div>

          {/* ── Google OAuth ──────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-gray-50 border-2 border-white/10 rounded-xl font-sans text-[14px] text-gray-700 font-medium transition-colors"
          >
            <GoogleLogo />
            Continue with Google
          </button>

        </div>

        {/* Below card */}
        <div className="mt-5 text-center flex flex-col gap-2">
          <p className="font-sans text-[12px] text-[#A0A8B8]/35">
            By continuing you agree to our terms. Your data is yours.
          </p>
          <Link
            href="/"
            className="font-sans text-[12px] text-[#A0A8B8]/40 hover:text-[#A0A8B8] transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
