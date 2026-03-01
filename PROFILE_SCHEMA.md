# PROFILE_SCHEMA.md — Profile JSON Structure

This document defines the full structure of `profile.json` — the single source of truth for everything about you professionally.

The schema is designed to be:
- **Comprehensive** — capture far more than a CV ever would
- **Append-friendly** — new information adds to it, nothing is lost
- **LLM-readable** — structured so an AI can reason over it efficiently
- **Selectable** — the generator cherry-picks relevant sections per job

---

## Top-Level Structure

```json
{
  "meta": { ... },
  "personal": { ... },
  "summary": { ... },
  "workExperience": [ ... ],
  "education": [ ... ],
  "certifications": [ ... ],
  "skills": { ... },
  "portfolio": [ ... ],
  "languages": [ ... ],
  "softSkills": [ ... ],
  "references": [ ... ],
  "extras": { ... }
}
```

---

## `meta`

Metadata about the profile itself.

```json
{
  "meta": {
    "version": "1.0.0",
    "createdAt": "2026-03-01T00:00:00Z",
    "updatedAt": "2026-03-01T00:00:00Z",
    "sources": [
      { "type": "pdf", "filename": "cv_2025.pdf", "importedAt": "2026-03-01T00:00:00Z" },
      { "type": "linkedin", "importedAt": "2026-03-01T00:00:00Z" },
      { "type": "manual", "description": "Interview session 1" }
    ],
    "completeness": {
      "workExperience": 0.8,
      "skills": 0.6,
      "education": 1.0
    }
  }
}
```

---

## `personal`

Basic identifying and contact information.

```json
{
  "personal": {
    "fullName": "Alastair Grant",
    "preferredName": "Alastair",
    "email": "alastair@example.com",
    "phone": "+44 7700 000000",
    "location": {
      "city": "London",
      "country": "United Kingdom",
      "remote": true,
      "willingToRelocate": false
    },
    "links": {
      "linkedin": "https://linkedin.com/in/alastairgrant",
      "github": "https://github.com/alastairgrant",
      "portfolio": "https://alastairgrant.dev",
      "other": []
    },
    "nationality": "British",
    "workAuthorisation": ["UK", "EU"]
  }
}
```

---

## `summary`

Professional summary — multiple variants for different contexts.

```json
{
  "summary": {
    "default": "A short 2-3 sentence professional summary.",
    "variants": [
      { "label": "technical", "content": "Tech-focused version for engineering roles." },
      { "label": "leadership", "content": "Leadership-focused version for senior/management roles." }
    ]
  }
}
```

---

## `workExperience`

Array of roles, most recent first.

```json
{
  "workExperience": [
    {
      "id": "role-001",
      "company": "Acme Corp",
      "companyDescription": "A SaaS company building developer tooling for CI/CD pipelines.",
      "title": "Senior Software Engineer",
      "employmentType": "full-time",
      "startDate": "2022-06",
      "endDate": null,
      "current": true,
      "location": {
        "city": "London",
        "country": "UK",
        "remote": true
      },
      "teamSize": 8,
      "reportedTo": "Engineering Manager",
      "directReports": 2,
      "summary": "Led backend development on the core pipeline execution engine.",
      "achievements": [
        {
          "text": "Reduced pipeline execution time by 40% through parallel job scheduling.",
          "impact": "high",
          "quantified": true,
          "tags": ["performance", "backend"]
        }
      ],
      "responsibilities": [
        "Owned the design and implementation of the job scheduler component",
        "Mentored 2 junior engineers"
      ],
      "technologies": {
        "languages": ["TypeScript", "Go"],
        "frameworks": ["Node.js", "gRPC"],
        "tools": ["Docker", "Kubernetes", "GitHub Actions"],
        "databases": ["PostgreSQL", "Redis"],
        "cloud": ["AWS"]
      },
      "projects": [
        {
          "name": "Pipeline Scheduler Rewrite",
          "description": "Rewrote the job scheduler from a polling model to an event-driven model.",
          "outcome": "40% faster execution, 60% reduction in DB load",
          "role": "Lead engineer",
          "technologies": ["Go", "Kafka"]
        }
      ],
      "keywords": ["ci/cd", "distributed systems", "event-driven", "mentoring"]
    }
  ]
}
```

---

## `education`

```json
{
  "education": [
    {
      "id": "edu-001",
      "institution": "University of Edinburgh",
      "degree": "BSc Computer Science",
      "grade": "2:1",
      "startDate": "2015-09",
      "endDate": "2019-06",
      "dissertation": "Optimising graph traversal algorithms for real-time pathfinding",
      "relevantModules": ["Algorithms & Data Structures", "Distributed Systems", "Machine Learning"],
      "activities": ["Robotics Society President"]
    }
  ]
}
```

---

## `certifications`

```json
{
  "certifications": [
    {
      "id": "cert-001",
      "name": "AWS Solutions Architect – Associate",
      "issuer": "Amazon Web Services",
      "issuedDate": "2023-04",
      "expiryDate": "2026-04",
      "credentialId": "AWS-SAA-123456",
      "credentialUrl": "https://aws.amazon.com/verify/...",
      "skills": ["AWS", "cloud architecture", "IAM", "VPC"],
      "imageFile": "aws-saa-cert.pdf"
    }
  ]
}
```

---

## `skills`

Skills organised by category, with proficiency and evidence.

```json
{
  "skills": {
    "technical": [
      {
        "name": "TypeScript",
        "category": "language",
        "proficiency": "expert",
        "yearsExperience": 5,
        "lastUsed": "2026-03",
        "evidenceIds": ["role-001", "role-002", "proj-001"]
      }
    ],
    "domains": [
      {
        "name": "Distributed Systems",
        "proficiency": "advanced",
        "notes": "Designed event-driven microservice architectures at scale"
      }
    ],
    "tools": [
      { "name": "Docker", "proficiency": "advanced" },
      { "name": "Kubernetes", "proficiency": "intermediate" }
    ]
  }
}
```

Proficiency levels: `beginner` | `intermediate` | `advanced` | `expert`

---

## `portfolio`

Personal or side projects, open source contributions, public work.

```json
{
  "portfolio": [
    {
      "id": "proj-001",
      "name": "Profile Builder",
      "description": "AI-powered desktop app to build a professional profile JSON via agent interview.",
      "url": "https://github.com/alastairgrant/profile-builder",
      "status": "active",
      "role": "Solo developer",
      "startDate": "2026-03",
      "endDate": null,
      "technologies": ["Electron", "React", "TypeScript", "Claude API"],
      "highlights": [
        "Built multi-agent system for profile building and CV generation",
        "Implemented PDF and LinkedIn import parsing"
      ],
      "type": "personal"
    }
  ]
}
```

---

## `languages`

```json
{
  "languages": [
    { "language": "English", "proficiency": "native" },
    { "language": "Spanish", "proficiency": "conversational" }
  ]
}
```

Proficiency levels: `native` | `fluent` | `professional` | `conversational` | `basic`

---

## `softSkills`

```json
{
  "softSkills": [
    {
      "skill": "Technical leadership",
      "evidence": "Led a team of 8 engineers across 3 squads at Acme Corp"
    },
    {
      "skill": "Stakeholder communication",
      "evidence": "Presented quarterly roadmap updates to C-suite at multiple companies"
    }
  ]
}
```

---

## `references`

```json
{
  "references": [
    {
      "name": "Jane Smith",
      "title": "Engineering Director",
      "company": "Acme Corp",
      "relationship": "Direct manager",
      "contactEmail": "jane@acmecorp.com",
      "available": true,
      "notes": "Happy to provide written or verbal reference"
    }
  ]
}
```

---

## `extras`

Flexible bucket for anything that doesn't fit neatly elsewhere.

```json
{
  "extras": {
    "publications": [],
    "speakingEngagements": [],
    "awards": [],
    "volunteering": [],
    "hobbies": ["Rock climbing", "Open source contribution"],
    "openToRoles": ["Senior Software Engineer", "Staff Engineer", "Engineering Manager"],
    "salaryExpectation": {
      "currency": "GBP",
      "min": 90000,
      "max": 120000,
      "notes": "Flexible for the right role and equity package"
    },
    "availability": {
      "noticePeriod": "1 month",
      "availableFrom": null
    },
    "preferredWorkStyles": ["remote", "hybrid"],
    "preferredTeamSize": "small to mid (5-20 engineers)"
  }
}
```

---

## TypeScript Type Reference

The canonical TypeScript types live in `src/schema/profile.schema.ts`. This document is the human-readable specification. If there is ever a conflict between this document and the TypeScript types, the TypeScript types are authoritative.

---

## Versioning

The `meta.version` field uses semantic versioning:
- **Major** (`1.0.0 → 2.0.0`): Breaking change to schema structure
- **Minor** (`1.0.0 → 1.1.0`): New optional fields added
- **Patch** (`1.0.0 → 1.0.1`): Data corrections, no structure change

When the app updates the schema version, it runs a migration to transform existing `profile.json` files to the new format.
