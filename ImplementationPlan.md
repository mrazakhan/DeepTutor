# DeepTutor++ — Implementation Plan

> Phased implementation plan for building an AP exam prep platform on DeepTutor.

**Version:** 1.0
**Date:** March 21, 2026
**Companion Doc:** [SystemDesign.md](./SystemDesign.md)

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database (Phase 1-5)** | SQLite | Zero setup, no Docker service. Good for dev + small deployments |
| **Database (Phase 6+)** | PostgreSQL | Migrate before school-wide rollout (100+ students) |
| **Auth (Phase 1-5)** | None (single-user) | Ship features first, add auth before multi-user |
| **Voice STT** | Deepgram Nova-2 | Lowest latency streaming STT (~300ms) |
| **Voice TTS** | ElevenLabs | Most natural educational voices |
| **OCR** | Claude Vision API | Handles handwriting + equations + diagrams. No extra API cost |
| **License** | AGPL-3.0 | Inherited from DeepTutor |

---

## Phase 1: Setup & Course Structure ✅ DONE

| Task | Status | Details |
|------|--------|---------|
| Fork/clone DeepTutor | Done | Forked to mrazakhan/DeepTutor |
| SQLite + SQLAlchemy setup | Done | `src/database/` — engine, models, Base |
| Course data model | Done | courses, units, topics, learning_objectives tables |
| Seed 13 AP courses | Done | `scripts/seed_courses.py` — 683 topics seeded |
| Course catalog API | Done | `src/api/routers/courses.py` — list, detail, units, topics |
| Course catalog frontend | Done | `web/app/courses/` — catalog + detail pages, sidebar link |
| Branding | Done | Rebranded to DeepTutor++ everywhere |
| Tests | Done | 16/16 passing (database + API endpoint tests) |
| Deployment | Done | Live at http://66.179.255.201 via Docker + nginx |

---

## Phase 2A: CS & Math Content + Tutoring (1 week) — IN PROGRESS

| Task | Est. | Details |
|------|------|---------|
| Download & ingest CS course materials | 0.5d | AP CSA (Java docs), AP CSP — per-course KBs (parallel) |
| Download & ingest Math textbooks | 0.5d | OpenStax Calc, Stats, Precalc → per-course KBs (parallel) |
| AP Tutor agent | 1d | `src/agents/tutor/` — extends base_agent, course-scoped RAG |
| Topic study interface | 1d | Click topic → guided chat with course KB context |
| User namespace for KBs | 0.5d | Modify KB manager for `{course_code}/{kb_name}` |

**Deliverable**: AI tutoring for CS & Math courses backed by real course materials.

---

## Phase 2B: Science Content (0.5 week)

| Task | Est. | Details |
|------|------|---------|
| Download & ingest Science textbooks | 0.5d | OpenStax Bio, Chem, Physics → per-course KBs (parallel) |
| Past AP FRQ ingestion (all subjects) | 0.5d | Parse FRQs + scoring guidelines |
| Verify tutoring across all 13 courses | 0.5d | End-to-end testing |

**Deliverable**: AI tutoring for all 13 courses with complete content.

---

## Phase 3: Quizzes & Progress (2 weeks)

| Task | Est. | Details |
|------|------|---------|
| Extend question agent for AP MCQ | 2d | 4-choice, distractors, topic-tagged, difficulty 1-5 |
| Quiz API | 1d | Generate quiz, submit answers, auto-score |
| Topic quiz frontend | 2d | Take quiz, review with explanations |
| Progress tracking (DB + API) | 1.5d | topic_progress, auto-update after study/quiz |
| Student dashboard | 2d | Course cards, mastery heat map, activity |
| Study plan recommendations | 1.5d | AI-generated "study next" based on weak topics |

**Deliverable**: Quizzes, progress tracking, and student dashboard.

---

## Phase 4: Full AP Exam Simulation (2 weeks)

| Task | Est. | Details |
|------|------|---------|
| Exam engine | 2d | Timed sections, calculator rules, state machine |
| MCQ exam interface | 2d | Question nav, flagging, timer, calculator toggle |
| FRQ editor (LaTeX + code) | 1.5d | Rich text with KaTeX, code editor for CS |
| FRQ rubric-based AI scoring | 2d | Claude with AP rubric injection |
| Exam results + AP score prediction | 1.5d | Score breakdown, predicted 1-5 |
| Java code execution (AP CSA) | 1d | JDK sidecar in Docker |

**Deliverable**: Full-length AP practice exams with AI-scored FRQs.

---

## Phase 5: OCR Pipeline (1.5 weeks)

| Task | Est. | Details |
|------|------|---------|
| Claude Vision OCR service | 1.5d | Image → structured text + LaTeX |
| OCR API | 1d | Upload, process, route to solve/explain |
| Upload frontend | 2d | Camera capture, drag-drop, crop/rotate |
| Action routing | 1d | Connect OCR output to solve/chat agents |
| Batch upload | 0.5d | Multi-page assignments |

**Deliverable**: Photo-to-solution pipeline.

---

## Phase 6: Auth + PostgreSQL Migration (1.5 weeks)

| Task | Est. | Details |
|------|------|---------|
| PostgreSQL in docker-compose | 0.5d | Replace SQLite, Alembic migrations |
| Data migration script | 1d | SQLite → PostgreSQL |
| Auth system (JWT + bcrypt) | 1.5d | Register, login, refresh, middleware |
| Auth frontend | 1d | Login/register pages, protected routes |
| Role-based access | 1d | student/teacher/admin permissions |
| Multi-tenancy | 0.5d | User-scoped data queries |

**Deliverable**: Multi-user platform ready for school deployment.

---

## Phase 7: Teacher Tools & Analytics (1.5 weeks)

| Task | Est. | Details |
|------|------|---------|
| Teacher dashboard | 2d | Class overview, scores, at-risk students |
| Content authoring | 1.5d | Custom problems/notes |
| Custom exam builder | 1d | Select questions, set timing |
| Enhanced student analytics | 1.5d | Streaks, daily activity, mastery maps |
| Progress report PDF export | 0.5d | Downloadable reports |

**Deliverable**: Teacher class management and enhanced analytics.

---

## Phase 8: Voice Assistant (1.5 weeks)

| Task | Est. | Details |
|------|------|---------|
| Deepgram STT service | 1.5d | Streaming WebSocket |
| ElevenLabs TTS service | 1d | Replace OpenAI TTS |
| Voice WebSocket endpoint | 1.5d | Audio streaming + course context |
| Voice frontend | 2d | Mic button, waveform, playback, history |

**Deliverable**: Voice-based Q&A.

---

## Phase 9: Production Deployment (1 week)

| Task | Est. | Details |
|------|------|---------|
| Security audit (OWASP) | 1d | Sanitization, rate limiting, CORS |
| Performance + responsive | 1d | Caching, responsive layouts |
| CI/CD (GitHub Actions) | 0.5d | Test, build, deploy pipeline |
| Production deployment | 1d | Docker Compose + Caddy SSL |
| Documentation + open-source | 1d | User guide, AGPL-3.0 headers |
| Load testing | 0.5d | Target 500 concurrent |

**Deliverable**: Production-deployed platform.

---

## Timeline Summary

| Phase | Scope | Duration | Cumulative |
|-------|-------|----------|------------|
| **1** | Setup & course structure | 1 week | Week 1 |
| **2** | Content pipeline & AI tutoring | 2 weeks | Week 3 |
| **3** | Quizzes & progress | 2 weeks | Week 5 |
| **4** | Full AP exam simulation | 2 weeks | Week 7 |
| **5** | OCR pipeline | 1.5 weeks | Week 8.5 |
| **6** | Auth + PostgreSQL migration | 1.5 weeks | Week 10 |
| **7** | Teacher tools & analytics | 1.5 weeks | Week 11.5 |
| **8** | Voice assistant | 1.5 weeks | Week 13 |
| **9** | Production deployment | 1 week | Week 14 |
| **Total** | | **~14 weeks (3.5 months)** | |

### Key Milestones
- **Week 1**: Course catalog browsable (13 courses, 683 topics)
- **Week 3**: AI tutoring working for all courses
- **Week 5**: Quizzes + student dashboard
- **Week 7**: Full AP exam simulations
- **Week 10**: Multi-user ready (auth + Postgres)
- **Week 14**: Full platform deployed

---

## Files Created/Modified in Phase 1

### New Files
- `src/database/__init__.py` — Database package init
- `src/database/engine.py` — SQLite engine, session factory, init_db
- `src/database/models.py` — SQLAlchemy models (Course, Unit, Topic, LearningObjective)
- `src/api/routers/courses.py` — Course catalog API (list, detail, units, topics)
- `scripts/seed_courses.py` — Seed all 13 AP courses (683 topics)
- `web/app/courses/page.tsx` — Course catalog page with filtering
- `web/app/courses/[id]/page.tsx` — Course detail page with expandable units
- `data/ap_academy.db` — SQLite database (auto-created)
- `SystemDesign.md` — Full system design document
- `ImplementationPlan.md` — This file

### Modified Files
- `src/api/main.py` — Added courses router
- `web/components/Sidebar.tsx` — Added "AP Courses" nav item
- `web/types/sidebar.ts` — Added "/courses" to default nav order
- `requirements.txt` — Added SQLAlchemy dependency
