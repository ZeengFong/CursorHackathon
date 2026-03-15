# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cognitive load management web app ("BrainDump") — users dump unstructured thoughts/tasks, AI triages them, provides focused breakdowns, and generates summaries. Built with Next.js 16 (App Router), Supabase, and OpenAI.

## Commands

- `npm run dev` — development server on localhost:3000
- `npm run build` — production build
- `npm run lint` — ESLint
- No test framework is configured

## Architecture

**Stack:** Next.js 16 + React 19 + TypeScript 5 + Tailwind CSS v4 + Supabase + OpenAI

**Path alias:** `@/*` maps to the project root.

**Dashboard modes:** The app is a single dashboard (`app/dashboard/page.tsx`) with switchable modes — each mode is a component in `app/dashboard/components/`:
- **DumpMode** — multi-modal input (text, voice, file upload)
- **TriageMode** — AI-categorized tasks (now/later/drop)
- **FocusMode** — 5-step breakdown of a selected task
- **CalendarMode** — due-date visualization
- **MindLetter** — streaming letter generation from tasks
- **ResetMode** — reset UI

**API routes** (`app/api/`): POST-only handlers that call OpenAI and/or Supabase. Key routes:
- `ai/brain-dump/` — extracts tasks from raw input (uses gpt-4o for files, gpt-4o-mini for text)
- `dump/` — triage endpoint
- `focus/` — task breakdown
- `letter/` — streaming response
- `ai/advisor/` — conversational task management (maintains chat history)
- `tts/` — text-to-speech via OpenAI
- `upload/` — file upload handler

**AI layer** (`lib/ai/`): Prompts in `prompts/`, services in `services/`, config and types at root. Models: gpt-4o (vision/files), gpt-4o-mini (text tasks). Max tokens: 16,384 for brain-dump and advisor.

**Auth:** Supabase Auth with middleware protection on `/dashboard` routes. OAuth callback at `/auth/callback`. Two client files: `lib/supabase.ts` (browser) and `lib/supabase-server.ts` (server).

**File processing flow:** Client uploads to Supabase Storage (`uploads` bucket) → server transfers to OpenAI Files API → processes → cleans up.

**Styling:** Tailwind v4 with custom dark theme (bg #0D0F14, surface #13161C, teal #1D9E75). Custom fonts: DM Serif Display, Sora, Geist. Animations defined in `globals.css`. Uses shadcn/ui (radix-nova style) + lucide-react icons + motion library.

## Key Dependencies

- `@supabase/supabase-js` + `@supabase/auth-helpers-nextjs` — database, auth, storage
- `openai` — AI completions, file processing, TTS
- `radix-ui` — component primitives
- `motion` — animations
- `shadcn` — component registry (configured in `components.json`)

## Environment Variables

Defined in `.env.local`: Supabase URL/keys and OpenAI API key.
