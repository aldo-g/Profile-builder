# Profile Builder

A desktop application that interviews you about your professional experience and builds a comprehensive, structured JSON profile of you. That profile is then used to generate tailored CVs and cover letters for specific job listings — powered by Claude AI.

---

## What It Does

### Phase 1 — Build Your Profile
You are guided through a hybrid wizard + chat experience. The app walks you through structured sections (work history, skills, education, certifications, portfolio, etc.) but uses an AI agent to ask follow-up questions, dig deeper, and fill in details you may have missed. The result is a rich, deeply detailed JSON file that captures everything about your professional life.

### Phase 2 — Input a Job Listing
Paste or upload a job listing. The AI compares it against your profile JSON, identifies gaps, and asks you targeted questions to fill them. If you provide new information, it updates your profile. The result is a profile that grows richer over time.

### Phase 3 — Generate Documents
With a filled profile and a target job listing, the AI generates:
- A tailored CV (filtered and ordered for the specific role)
- A personalised cover letter
- Optionally: a skills gap analysis

---

## Key Features

- **Electron + React + TypeScript** desktop app (cross-platform)
- **Claude AI** (Anthropic API) as the interview and generation agent
- **Hybrid UI**: structured wizard sections + conversational chat per section
- **Multi-source input**: PDF upload (CVs, certs), LinkedIn export, plain text paste, manual entry
- **Single source of truth**: one `profile.json` that grows over time
- **Job-aware gap filling**: when you give it a job listing, it knows what to ask
- **Non-destructive updates**: profile is append/update only, nothing is lost

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Frontend | React + TypeScript |
| Styling | TailwindCSS |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| PDF parsing | `pdf-parse` or `pdfjs-dist` |
| Profile storage | Local JSON file (with versioning) |
| State management | Zustand |
| Build tooling | Vite + electron-vite |

---

## Project Structure

```
profile-builder/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry point
│   │   └── ipc/                 # IPC handlers (file I/O, API calls)
│   ├── renderer/                # React frontend
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Interview.tsx    # Wizard + chat hybrid
│   │   │   ├── JobMatch.tsx     # Job listing input + gap analysis
│   │   │   └── Generate.tsx     # CV / cover letter output
│   │   ├── components/
│   │   │   ├── ChatPane.tsx     # Conversational AI panel
│   │   │   ├── WizardSection.tsx
│   │   │   └── ProfileViewer.tsx
│   │   └── store/               # Zustand state
│   ├── agents/                  # AI agent logic (prompt engineering)
│   │   ├── interviewer.ts       # Profile-building agent
│   │   ├── gap-analyser.ts      # Job listing comparison agent
│   │   └── generator.ts        # CV / cover letter generation agent
│   └── schema/
│       └── profile.schema.ts    # TypeScript types for profile JSON
├── profile.json                 # Your profile (gitignored)
├── AGENTS.md                    # Agent behaviour and prompt specs
├── PROFILE_SCHEMA.md            # Full schema documentation
└── README.md
```

---

## Getting Started

> Setup instructions will be added once the initial scaffold is built.

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run build
```

---

## Profile JSON

The core output is a single `profile.json`. See [PROFILE_SCHEMA.md](PROFILE_SCHEMA.md) for the full documented schema.

At a high level it contains:

- Personal info & contact details
- Work experience (with projects, achievements, technologies per role)
- Education & qualifications
- Certifications (with issuer, date, credential ID)
- Skills (categorised, with self-assessed proficiency)
- Portfolio projects (with links, tech stack, outcomes)
- Soft skills & competencies
- Languages
- References
- Meta (last updated, profile version, sources used to build it)

---

## Roadmap

- [ ] Phase 1: Electron + React scaffold with Anthropic integration
- [ ] Phase 2: Wizard sections for core profile areas
- [ ] Phase 3: PDF and LinkedIn import parsing
- [ ] Phase 4: Job listing input + gap analysis
- [ ] Phase 5: CV and cover letter generation + export (PDF/DOCX)
- [ ] Phase 6: Profile versioning and history
