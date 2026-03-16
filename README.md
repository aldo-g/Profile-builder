# Profile Builder

A desktop application that AI-interviews you to build a comprehensive professional profile, then uses it to generate tailored CVs and cover letters for specific job listings — powered by Claude AI.

## Download

[Download for Mac (Apple Silicon)](https://github.com/aldo-g/Profile-builder/releases/latest)

> Requires a Claude API key from [console.anthropic.com](https://console.anthropic.com)

---

## How It Works

![CV Enhancement Pipeline](resources/CV%20Enhancement%20Pipeline.png)

Profile Builder runs a multi-agent pipeline across three phases:

**Phase 1 — Build Your Profile**
A hybrid wizard + chat experience guides you through structured sections (work history, skills, education, certifications, portfolio, and more). The Interviewer agent asks follow-up questions and extracts detail you'd otherwise leave out. The result is a rich `profile.json` that persists across every application you make.

**Phase 2 — Match a Job Listing**
Paste a job listing. The Gap Analyser agent compares it against your profile, identifies missing skills and experience, and asks targeted questions to fill them. Your profile grows richer with each role you target.

**Phase 3 — Generate Documents**
With a filled profile and a target job, a four-agent pipeline runs automatically:
1. **Generator** — produces a tailored CV and cover letter in your template's structure and tone
2. **Researcher** — searches the web for company context to inform the cover letter
3. **Overseer** — scores the output across keyword coverage, tone fit, structural completeness, and quality
4. **Editor** — refines any section that scores below threshold

Export as PDF or DOCX.

---

## Architecture

### Multi-agent pipeline

```
Job listing + profile
        │
        ▼
  ┌─────────────┐
  │ Gap Analyser│  — structured JSON: missing skills, highlight experience, fit score
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐   ┌────────────┐
  │  Generator  │◄──│ Researcher │  — web_search tool, company summary
  └──────┬──────┘   └────────────┘
         │
         ▼
  ┌─────────────┐
  │   Overseer  │  — scores 0–10 across 4 dimensions
  └──────┬──────┘
         │ score < 8.0
         ▼
  ┌─────────────┐
  │    Editor   │  — targeted refinement pass
  └──────┬──────┘
         │
         ▼
   CV + Cover Letter (PDF / DOCX)
```

Each agent uses Claude's tool use API to return structured output — no prompt-parsed JSON, no brittle regex extraction.

### Electron IPC bridge

The app splits cleanly across Electron's process boundary:

- **Renderer** (React): UI state, chat history, document preview, streaming display
- **Main** (Node): file I/O, PDF/DOCX export, all Anthropic API calls
- **Preload**: typed context bridge — the renderer calls `window.api.X()`, which maps to `ipcMain.handle('X', ...)` in main

All agent calls live in the main process. Streaming responses are forwarded to the renderer via `event.sender.send()` as they arrive, so the UI updates in real time without blocking.

### Profile as single source of truth

Everything the agents produce is distilled into a single `profile.json`. It accumulates across sessions: the Interviewer adds career detail, the Gap Analyser adds job-specific context, the Importer extracts from uploaded PDFs and LinkedIn exports. Each write is preceded by a snapshot for one-click rollback.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 33 |
| Frontend | React 18 + TypeScript |
| Styling | TailwindCSS 3.4 |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| State management | Zustand 5 |
| PDF parsing | pdf-parse |
| DOCX generation | docx |
| Build tooling | Vite + electron-vite |

---

## Prerequisites

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **npm** v9 or later (bundled with Node.js)
- **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com) _(entered in the app on first launch, not required at setup)_

---

## Setup

**1. Clone the repository**

```bash
git clone https://github.com/your-username/profile-builder.git
cd profile-builder
```

**2. Install dependencies**

```bash
npm install
```

**3. Run the app**

```bash
npm run dev
```

This starts both the Vite dev server and the Electron window.

---

## Building for Production

```bash
# Compile and package
npm run build

# Build + package as installable app (dmg / exe / AppImage)
npm run package
```

Output is placed in the `out/` directory.

---

## Project Structure

```
profile-builder/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry point & window setup
│   │   ├── markdownToHtml.ts    # Markdown → HTML for PDF rendering
│   │   └── ipc/index.ts         # IPC handlers (file I/O, agent calls)
│   ├── preload/
│   │   └── index.ts             # Context bridge — exposes API to renderer
│   ├── renderer/                # React frontend
│   │   └── src/
│   │       ├── App.tsx          # Root component & routing
│   │       ├── pages/           # IntroPage, InterviewPage, ImportPage, JobMatchPage, GeneratePage
│   │       ├── components/      # Chat, wizard, editor, document viewer, etc.
│   │       └── store/index.ts   # Zustand global state
│   ├── agents/                  # AI agent logic
│   │   ├── interviewer.ts       # Profile-building agent
│   │   ├── gap-analyser.ts      # Job listing comparison agent
│   │   ├── generator.ts         # CV / cover letter generation
│   │   ├── overseer.ts          # Quality review + scoring
│   │   ├── editor.ts            # Targeted document refinement
│   │   ├── researcher.ts        # Company research (web search)
│   │   ├── importer.ts          # PDF / LinkedIn document parsing
│   │   └── deduplicator.ts      # Profile deduplication
│   └── schema/
│       └── profile.schema.ts    # TypeScript types for profile.json
├── profile.json                 # Your generated profile (gitignored)
├── AGENTS.md                    # Agent behaviour and prompt specs
├── PROFILE_SCHEMA.md            # Full profile.json schema documentation
└── README.md
```

---

## AI Agents

| Agent | Model | Purpose |
|---|---|---|
| **Interviewer** | claude-sonnet-4-6 | Guides profile building via structured conversation |
| **Gap Analyser** | claude-sonnet-4-6 | Compares a job listing to your profile and identifies gaps |
| **Generator** | claude-sonnet-4-6 | Produces a tailored CV and cover letter |
| **Overseer** | claude-sonnet-4-6 | Scores output quality across 4 dimensions (threshold: 8.0/10) |
| **Editor** | claude-sonnet-4-6 | Refines documents based on Overseer feedback |
| **Researcher** | claude-sonnet-4-6 | Researches companies via web search for cover letter context |
| **Importer** | claude-sonnet-4-6 | Extracts structured data from PDFs and LinkedIn exports |
| **Deduplicator** | claude-sonnet-4-6 | Cleans up duplicate entries in your profile |

All agents use Claude's tool use API to return structured output. See [AGENTS.md](AGENTS.md) for full prompt specs and design notes.

---

## Profile JSON

Your profile is stored as a single `profile.json` (gitignored). It grows over time as you interview, import documents, and answer job-specific questions. Every write is preceded by a timestamped snapshot for rollback.

Top-level keys: `meta`, `personal`, `summary`, `workExperience`, `education`, `certifications`, `skills`, `portfolio`, `languages`, `softSkills`, `references`, `extras`

See [PROFILE_SCHEMA.md](PROFILE_SCHEMA.md) for the full documented schema.

---

## Input Sources

- **PDF upload** — CVs, certificates, transcripts
- **LinkedIn data export** — ZIP from LinkedIn's "Get a copy of your data" tool
- **Plain text paste** — paste any text for the importer to extract from
- **Manual entry** — type directly in the wizard sections

---

## Type Checking

```bash
npm run typecheck
```

---

## Roadmap

- [x] Phase 1: Electron + React scaffold with Anthropic integration
- [x] Phase 2: Wizard sections for core profile areas
- [x] Phase 3: PDF and LinkedIn import parsing
- [x] Phase 4: Job listing input + gap analysis
- [x] Phase 5: CV and cover letter generation + export (PDF/DOCX)
- [ ] Phase 6: Profile versioning and history
