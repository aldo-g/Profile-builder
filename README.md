# Profile Builder

A desktop application that AI-interviews you to build a comprehensive professional profile, then uses it to generate tailored CVs and cover letters for specific job listings — powered by Claude AI.

---

## How It Works

![CV Enhancement Pipeline](resources/CV%20Enhancement%20Pipeline.png)

---

## What It Does

**Phase 1 — Build Your Profile**
A hybrid wizard + chat experience guides you through structured sections (work history, skills, education, certifications, portfolio, etc.). An AI agent asks follow-up questions, digs deeper, and fills in details you may have missed. The result is a rich JSON profile that captures everything about your professional life.

**Phase 2 — Match a Job Listing**
Paste a job listing. The AI compares it against your profile, identifies gaps, and asks targeted questions to fill them. Your profile grows richer with each job you target.

**Phase 3 — Generate Documents**
With a filled profile and a target job listing, the AI generates:
- A tailored CV (filtered and ordered for the specific role)
- A personalised cover letter
- A skills gap analysis

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
│   │   ├── importer.ts          # PDF / LinkedIn document parsing
│   │   ├── deduplicator.ts      # Profile deduplication
│   │   ├── editor.ts            # Profile editing agent
│   │   ├── overseer.ts          # Workflow orchestration
│   │   └── researcher.ts        # Company research
│   └── schema/
│       └── profile.schema.ts    # TypeScript types for profile.json
├── profile.json                 # Your generated profile (gitignored)
├── .env                         # API keys (gitignored)
├── .env.example                 # Env variable template
├── AGENTS.md                    # Agent behaviour and prompt specs
├── PROFILE_SCHEMA.md            # Full profile.json schema documentation
└── README.md
```

---

## AI Agents

| Agent | Purpose |
|---|---|
| **Interviewer** | Guides profile building via structured conversation |
| **Gap Analyser** | Compares a job listing to your profile and identifies gaps |
| **Generator** | Produces a tailored CV and cover letter |
| **Importer** | Extracts structured data from PDFs and LinkedIn exports |
| **Deduplicator** | Cleans up duplicate entries in your profile |
| **Editor** | Handles targeted profile field edits |
| **Overseer** | Orchestrates multi-agent workflows |
| **Researcher** | Researches companies for cover letter context |

See [AGENTS.md](AGENTS.md) for full specifications and prompt design.

---

## Profile JSON

Your profile is stored as a single `profile.json` at the project root (gitignored). It grows over time as you interview, import documents, and answer job-specific questions.

Top-level keys: `meta`, `personal`, `summary`, `workExperience`, `education`, `certifications`, `skills`, `portfolio`, `languages`, `softSkills`, `references`, `extras`

See [PROFILE_SCHEMA.md](PROFILE_SCHEMA.md) for the full documented schema.

---

## Input Sources

- **PDF upload** — CVs, certificates, transcripts
- **LinkedIn data export** — JSON/CSV from LinkedIn's data export tool
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
