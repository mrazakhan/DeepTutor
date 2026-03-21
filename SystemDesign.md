# DeepTutor AP Academy — System Design Document

> A comprehensive AI-powered learning platform for US high school AP exam preparation, built on [DeepTutor](https://github.com/HKUDS/DeepTutor).

**Version:** 1.0
**Date:** March 21, 2026
**License:** AGPL-3.0 (inherited from DeepTutor)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [License Compliance](#2-license-compliance)
3. [DeepTutor: What We Get vs. What We Build](#3-deeptutor-what-we-get-vs-what-we-build)
4. [System Architecture](#4-system-architecture)
5. [AP Course Catalog](#5-ap-course-catalog)
6. [Course Content Structure & Sourcing](#6-course-content-structure--sourcing)
7. [Voice Assistant](#7-voice-assistant)
8. [Image Upload & OCR Pipeline](#8-image-upload--ocr-pipeline)
9. [Assessment Engine](#9-assessment-engine)
10. [Database Schema](#10-database-schema)
11. [Authentication & Multi-Tenancy](#11-authentication--multi-tenancy)
12. [Student & Teacher Dashboards](#12-student--teacher-dashboards)
13. [Deployment Strategy](#13-deployment-strategy)
14. [Implementation Phases](#14-implementation-phases)
15. [Risk Factors & Mitigations](#15-risk-factors--mitigations)
16. [Technology Stack Summary](#16-technology-stack-summary)
17. [Requirements Traceability](#17-requirements-traceability)

---

## 1. Project Overview

### 1.1 Problem Statement

High school students preparing for Advanced Placement (AP) exams need personalized, intelligent tutoring that goes beyond static textbooks and generic Q&A. Current solutions lack:

- **Deep, citation-backed explanations** rooted in actual course material
- **Voice-based interaction** for natural, conversational learning
- **Instant problem scanning** — photograph a problem and get step-by-step solutions
- **AP-format practice exams** with AI-powered scoring and feedback
- **Unified course management** covering all STEM AP subjects in one platform

### 1.2 Solution

**DeepTutor AP Academy** extends the open-source DeepTutor platform into a full learning management system (LMS) for AP exam preparation. It covers 13 AP courses across Computer Science, Mathematics, and Science, with:

- AI tutoring powered by RAG (Retrieval-Augmented Generation) over curated course materials
- Voice-based Q&A using ElevenLabs TTS and Deepgram STT
- Photo/scan upload with Claude Vision OCR for handwritten and printed content
- Full AP exam simulations with timed sections and AI-powered FRQ scoring
- Student dashboards with progress tracking and AP score predictions
- Teacher tools for class management and content authoring

### 1.3 Target Users

| User Type | Description |
|-----------|-------------|
| **Students** | US high school students (grades 9-12) preparing for AP exams |
| **Teachers** | AP course teachers managing classes and monitoring progress |
| **Self-learners** | Independent students studying for AP exams outside school |
| **Admins** | Platform administrators managing courses and users |

---

## 2. License Compliance

### 2.1 AGPL-3.0 — What It Means

DeepTutor is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. Key implications:

| Requirement | Impact |
|-------------|--------|
| **Source code disclosure** | All source code (including modifications) must be publicly available |
| **Network use = distribution** | Deploying as a web service triggers the same obligations as distributing binaries |
| **Derivative works** | Any code that links to or modifies DeepTutor inherits AGPL-3.0 |
| **Patent grant** | Contributors grant patent licenses for their contributions |
| **No additional restrictions** | Cannot impose further restrictions beyond AGPL-3.0 |

### 2.2 Compliance Plan

1. **Public repository**: The entire platform source code will be hosted on a public GitHub repository under AGPL-3.0.
2. **License headers**: All new source files will include the AGPL-3.0 header.
3. **Prominent notice**: The web UI footer will link to the source repository.
4. **Third-party licenses**: All dependencies will be documented in a `THIRD_PARTY_LICENSES` file, ensuring compatibility with AGPL-3.0.
5. **Contributor License Agreement (CLA)**: Contributors agree that their contributions are AGPL-3.0 licensed.

### 2.3 Compatible Dependency Licenses

- MIT, BSD-2, BSD-3, Apache-2.0, ISC — all compatible with AGPL-3.0
- GPL-2.0-only — **not compatible** (avoid)
- Proprietary — **not compatible** for linked code; OK for external API services (ElevenLabs, Deepgram, Claude API are SaaS, not linked code)

---

## 3. DeepTutor: What We Get vs. What We Build

### 3.1 Provided by DeepTutor (No Development Needed)

| Feature | Description |
|---------|-------------|
| **RAG Pipeline** | Document ingestion, vector embedding, semantic search, knowledge graph extraction |
| **Multi-Agent Architecture** | Base agent class with 7 specialized agents (chat, solve, question, guide, research, ideagen, co_writer) |
| **Quiz Generation** | Exam-mimicry and custom question modes from knowledge bases |
| **Knowledge Base Management** | PDF upload, incremental updates, knowledge graph storage |
| **Code Execution** | Sandboxed Python environment for running student/solution code |
| **Web Search** | Integration with Perplexity, Tavily, Serper for real-time information |
| **Guided Learning** | Session creation, topic progression, interactive chat-based learning |
| **Notebook System** | Session persistence and note-taking |
| **TTS Service** | OpenAI text-to-speech (will be replaced with ElevenLabs) |
| **Next.js 16 Frontend** | React 19, TailwindCSS, sidebar navigation, dark mode, i18n |
| **FastAPI Backend** | WebSocket streaming, async API, modular router architecture |
| **Docker Deployment** | docker-compose, multi-arch container images |
| **Configuration System** | YAML-based config (agents.yaml, main.yaml) |

### 3.2 Must Be Built (New Development)

| Feature | Priority | Estimated Effort |
|---------|----------|-----------------|
| **Course Management System** | Critical | 3 weeks |
| **User Authentication & Multi-Tenancy** | Critical | 2 weeks |
| **PostgreSQL Database Layer** | Critical | 2 weeks |
| **AP Course Content Pipeline** | Critical | 4 weeks |
| **Voice Assistant (Deepgram STT + ElevenLabs TTS)** | High | 3 weeks |
| **Image/OCR Pipeline (Claude Vision)** | High | 2 weeks |
| **AP Assessment Engine** | High | 4 weeks |
| **Student Dashboard & Analytics** | High | 3 weeks |
| **Teacher/Admin Dashboard** | Medium | 3 weeks |
| **Java Code Execution (for AP CSA)** | Medium | 1 week |
| **AP Score Prediction Model** | Medium | 1 week |
| **Production Deployment & CI/CD** | High | 2 weeks |

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT                           │
│                   Next.js 16 + React 19 Frontend                │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌────────┐│
│  │ Courses  │ │Dashboard │ │  Exams  │ │  Voice   │ │ Upload ││
│  │ Catalog  │ │& Progress│ │Practice │ │Assistant │ │ /Scan  ││
│  └────┬─────┘ └────┬─────┘ └────┬────┘ └────┬─────┘ └───┬────┘│
│       │             │            │            │           │      │
│  ┌────┴─────┐ ┌────┴─────┐ ┌───┴────┐ ┌────┴────┐ ┌───┴────┐ │
│  │ Solver   │ │ Question │ │ Guide  │ │Notebook │ │ Admin  │ │
│  │(existing)│ │(existing)│ │(exist.)│ │(exist.) │ │ Panel  │ │
│  └──────────┘ └──────────┘ └────────┘ └─────────┘ └────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI BACKEND                              │
│                                                                 │
│  ┌─── NEW ROUTERS ───────────────────────────────────────────┐  │
│  │ /api/v1/auth     — register, login, JWT refresh           │  │
│  │ /api/v1/courses  — catalog, enrollment, content           │  │
│  │ /api/v1/exams    — practice exams, scoring, results       │  │
│  │ /api/v1/voice    — WebSocket voice streaming              │  │
│  │ /api/v1/ocr      — image upload, Claude Vision processing │  │
│  │ /api/v1/students — progress, analytics, study plan        │  │
│  │ /api/v1/admin    — teacher tools, class management        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─── EXISTING ROUTERS (DeepTutor) ─────────────────────────┐  │
│  │ /api/v1/solve     — problem solving agent                 │  │
│  │ /api/v1/question  — question generation agent             │  │
│  │ /api/v1/guide     — guided learning agent                 │  │
│  │ /api/v1/knowledge — knowledge base management             │  │
│  │ /api/v1/chat      — general chat agent                    │  │
│  │ /api/v1/notebook  — session notebooks                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─── NEW SERVICES ──────────────────────────────────────────┐  │
│  │ stt/deepgram_service.py  — Deepgram STT streaming         │  │
│  │ tts/elevenlabs_service.py — ElevenLabs voice synthesis     │  │
│  │ ocr/claude_vision.py     — Claude Vision for image OCR    │  │
│  │ assessment/exam_engine.py — AP exam simulation & scoring   │  │
│  │ assessment/rubric_scorer.py — FRQ rubric-based AI scoring  │  │
│  │ curriculum/course_manager.py — AP course structure mgmt    │  │
│  │ auth/auth_service.py     — JWT auth, RBAC                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─── NEW AGENTS ────────────────────────────────────────────┐  │
│  │ tutor/   — AP-aware tutoring (extends base_agent)         │  │
│  │ exam/    — exam proctor agent (timing, section mgmt)      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─── EXISTING SERVICES (DeepTutor) ────────────────────────┐  │
│  │ rag/ — RAG pipeline, embeddings, vector search            │  │
│  │ llm/ — LLM service (OpenAI, Claude, local models)        │  │
│  │ knowledge/ — knowledge graph, document processing         │  │
│  │ code_executor/ — sandboxed Python execution               │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                               │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  PostgreSQL   │  │    Redis     │  │   MinIO (S3-compat)   │ │
│  │              │  │              │  │                       │ │
│  │ • Users      │  │ • Sessions   │  │ • Uploaded images     │ │
│  │ • Courses    │  │ • Voice buf  │  │ • Audio files         │ │
│  │ • Enrollments│  │ • Cache      │  │ • Generated PDFs      │ │
│  │ • Exams      │  │ • Rate limit │  │ • Course assets       │ │
│  │ • Progress   │  │              │  │                       │ │
│  │ • Analytics  │  │              │  │                       │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  data/knowledge_bases/{user_id}/{course_kb}/              │  │
│  │  (EXISTING DeepTutor: RAG vector store + knowledge graph) │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐│
│  │ Claude API │  │ Deepgram   │  │ ElevenLabs │  │ OpenAI    ││
│  │ (LLM+OCR) │  │ (STT)      │  │ (TTS)      │  │ (Embeddings)│
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Base platform | Fork DeepTutor | Gets RAG, agents, quiz gen, UI for free. ~40% of platform already built |
| Database | PostgreSQL | Multi-tenant LMS needs relational DB with ACID, joins, analytics queries |
| TTS | ElevenLabs | Most natural-sounding voices, low latency, great for educational content |
| STT | Deepgram | Lowest latency STT (~300ms), streaming support, better than Whisper for real-time |
| OCR | Claude Vision | Excellent handwriting + equation recognition. No extra API cost (already using Claude for LLM) |
| Object storage | MinIO | S3-compatible, self-hosted, no cloud vendor lock-in |
| Auth | JWT + bcrypt | Stateless, simple, no external auth service dependency |
| Code execution (Java) | JDK sidecar container | Needed for AP CSA. Isolated from main app for security |

---

## 5. AP Course Catalog

### 5.1 Supported Courses (13 Total)

#### Computer Science (2 courses)

| Course | Units | Exam Format | Key Topics |
|--------|-------|-------------|------------|
| **AP Computer Science A** | 10 units | 40 MCQ (90 min) + 4 FRQ (90 min) | Java, OOP, arrays, recursion, sorting, searching |
| **AP Computer Science Principles** | 5 Big Ideas | 70 MCQ (120 min) + Create Performance Task | Computing, data, algorithms, internet, impact |

#### Mathematics (4 courses)

| Course | Units | Exam Format | Key Topics |
|--------|-------|-------------|------------|
| **AP Calculus AB** | 8 units | 45 MCQ (105 min) + 6 FRQ (90 min) | Limits, derivatives, integrals, FTC |
| **AP Calculus BC** | 10 units | 45 MCQ (105 min) + 6 FRQ (90 min) | All of AB + series, parametric, polar, vectors |
| **AP Statistics** | 9 units | 40 MCQ (90 min) + 6 FRQ (90 min) | Data analysis, probability, inference, regression |
| **AP Precalculus** | 4 units | 40 MCQ (120 min) | Polynomial, rational, exponential, trig, polar functions |

#### Science (7 courses)

| Course | Units | Exam Format | Key Topics |
|--------|-------|-------------|------------|
| **AP Biology** | 8 units | 60 MCQ (90 min) + 6 FRQ (90 min) | Evolution, cells, genetics, ecology, physiology |
| **AP Chemistry** | 9 units | 60 MCQ (90 min) + 7 FRQ (105 min) | Atomic structure, bonding, reactions, kinetics, thermo |
| **AP Physics 1** | 8 units | 50 MCQ (90 min) + 5 FRQ (90 min) | Mechanics, waves, circuits (algebra-based) |
| **AP Physics 2** | 7 units | 50 MCQ (90 min) + 4 FRQ (90 min) | Fluids, thermo, electricity, magnetism, optics, nuclear |
| **AP Physics C: Mechanics** | 7 units | 35 MCQ (45 min) + 3 FRQ (45 min) | Kinematics, Newton's laws, energy, momentum, rotation |
| **AP Physics C: E&M** | 5 units | 35 MCQ (45 min) + 3 FRQ (45 min) | Electrostatics, conductors, circuits, magnetism, EM induction |
| **AP Environmental Science** | 9 units | 80 MCQ (90 min) + 3 FRQ (70 min) | Ecosystems, biodiversity, pollution, energy, climate |

### 5.2 Exam Section Details

Each AP exam has specific section rules that the assessment engine must enforce:

```
AP Calculus AB/BC:
  Section I-A:  30 MCQ, 60 min, NO calculator
  Section I-B:  15 MCQ, 45 min, graphing calculator REQUIRED
  Section II-A: 2 FRQ, 30 min, graphing calculator REQUIRED
  Section II-B: 4 FRQ, 60 min, NO calculator

AP Physics C (each):
  Section I:    35 MCQ, 45 min, calculator permitted
  Section II:   3 FRQ, 45 min, calculator permitted

AP Computer Science A:
  Section I:    40 MCQ, 90 min, NO calculator, Java Quick Reference provided
  Section II:   4 FRQ, 90 min, NO calculator, Java Quick Reference provided
```

---

## 6. Course Content Structure & Sourcing

### 6.1 Content Hierarchy

Each AP course follows the College Board's Course and Exam Description (CED) structure:

```
Course (e.g., "AP Computer Science A")
├── Unit (e.g., "Unit 1: Primitive Types")
│   ├── Topic (e.g., "1.1 Why Programming? Why Java?")
│   │   ├── Learning Objective (e.g., "MOD-1.A")
│   │   │   └── Essential Knowledge (e.g., "MOD-1.A.1")
│   │   ├── Knowledge Base Documents
│   │   │   ├── Textbook chapters (OpenStax, CC-BY)
│   │   │   ├── Teacher-created notes
│   │   │   └── Reference materials
│   │   ├── Practice Problems
│   │   │   ├── MCQ bank (per topic)
│   │   │   └── FRQ bank (per topic, where applicable)
│   │   └── Code Examples (CS courses only)
│   └── Unit Practice Exam
├── Full Practice Exam (AP-format, timed)
├── FRQ Bank (past AP free-response questions)
└── Reference Materials (formula sheets, periodic table, etc.)
```

### 6.2 Content Sourcing Strategy

All content must respect copyright. The following sources are used:

| Source | License | Content Type | Courses |
|--------|---------|-------------|---------|
| **AP Course & Exam Descriptions (CEDs)** | Public (College Board) | Unit/topic structure, learning objectives, sample questions | All 13 |
| **OpenStax Textbooks** | CC-BY 4.0 | Full textbook content for RAG knowledge bases | Bio, Chem, Physics, Calc, Stats, Precalc |
| **Past AP FRQs + Scoring Guidelines** | Public (College Board) | Practice free-response questions with rubrics | All 13 |
| **Teacher-created content** | AGPL-3.0 (platform) | Custom notes, worked examples, practice problems | All 13 |
| **AP Classroom sample questions** | Public (College Board) | MCQ practice items | All 13 |
| **Java Quick Reference** | Public (College Board) | Language reference document | AP CSA |
| **Physics/Chemistry equation sheets** | Public (College Board) | Formula references | Physics, Chemistry |

### 6.3 Content Ingestion Pipeline

```
1. Download AP CEDs (PDF) ──► Parse with DeepTutor's Docling/PyMuPDF
                              ──► Extract unit/topic/LO structure
                              ──► Store in PostgreSQL (course schema)
                              ──► Ingest into per-course knowledge base

2. OpenStax textbooks (PDF) ──► Map chapters to AP units/topics
                              ──► Chunk and embed into vector store
                              ──► Link to knowledge graph

3. Past FRQs (PDF) ──────────► Parse questions and scoring guidelines
                              ──► Store as structured JSON in practice_problems table
                              ──► Tag with topic, difficulty, year

4. Teacher content ──────────► Content authoring UI (extends co_writer agent)
                              ──► Ingest into per-topic knowledge base
                              ──► Version controlled in PostgreSQL
```

### 6.4 Per-Course Content Notes

**AP Computer Science A**: Java-focused. Requires a Java code execution environment (JDK sidecar container). Code examples cover: primitives, strings, classes, arrays, ArrayLists, 2D arrays, inheritance, recursion, sorting/searching. FRQ types: Methods & Control, Class Design, Array/ArrayList, 2D Array.

**AP Calculus AB/BC**: Heavy on equation rendering (KaTeX in frontend). Graphing capabilities via Python matplotlib in code executor. Step-by-step solution generation critical for derivatives, integrals, series.

**AP Statistics**: Data analysis through code executor. Matplotlib/seaborn for visualizations. Calculator emulation for statistics functions (normalcdf, invNorm, etc.).

**AP Physics 1/2/C**: Equation-heavy. Diagram interpretation via Claude Vision OCR. Lab-based FRQ simulations. Physics C integrates calculus concepts.

**AP Biology/Chemistry/Environmental Science**: Diagram-heavy content. Lab procedure understanding. Data interpretation questions. Long FRQ responses with rubric-based scoring.

---

## 7. Voice Assistant

### 7.1 Architecture

```
┌──────────────────────┐
│   Browser Client     │
│                      │
│  ┌────────────────┐  │
│  │ MediaRecorder  │  │    WebSocket (binary audio frames)
│  │ (WebM/opus)    │──┼──────────────────────────────────┐
│  └────────────────┘  │                                  │
│                      │                                  ▼
│  ┌────────────────┐  │    ┌─────────────────────────────────┐
│  │ Audio Player   │◄─┼────│ FastAPI WebSocket                │
│  │ (streaming)    │  │    │ /api/v1/voice/stream             │
│  └────────────────┘  │    │                                 │
│                      │    │  1. Receive audio chunks         │
│  ┌────────────────┐  │    │  2. Buffer in Redis              │
│  │ Text Display   │◄─┼────│  3. Send to Deepgram (streaming) │
│  │ (transcript +  │  │    │  4. Get transcript               │
│  │  AI response)  │  │    │  5. Inject course context        │
│  └────────────────┘  │    │  6. Query RAG (existing agent)   │
│                      │    │  7. Generate response             │
└──────────────────────┘    │  8. Send to ElevenLabs TTS       │
                            │  9. Stream audio + text back     │
                            └─────────────────────────────────┘
```

### 7.2 Technology Choices

| Component | Technology | Details |
|-----------|-----------|---------|
| **Speech-to-Text** | Deepgram Nova-2 | Streaming WebSocket API, ~300ms latency, 36+ languages |
| **Text-to-Speech** | ElevenLabs | Natural voices, streaming audio, configurable voice selection |
| **Audio Format** | WebM/opus (input), MP3 (output) | Opus for efficient browser recording; MP3 for wide playback support |
| **Streaming** | WebSocket | Bidirectional real-time audio/text |
| **Buffer** | Redis | Audio chunk buffering, conversation state |

### 7.3 Configuration

```yaml
# config/voice.yaml
stt:
  provider: deepgram
  model: nova-2
  language: en-US
  smart_format: true
  punctuate: true
  # DEEPGRAM_API_KEY in .env

tts:
  provider: elevenlabs
  model: eleven_turbo_v2_5
  voice_id: "EXAVITQu4vr4xnSDxMaL"  # "Sarah" - clear, educational tone
  output_format: mp3_44100_128
  # ELEVENLABS_API_KEY in .env

voice_assistant:
  silence_threshold_ms: 1500        # Silence before processing
  max_recording_seconds: 120        # Max single recording
  conversation_history_turns: 10    # Context window for follow-ups
```

### 7.4 Voice Interaction Flow

1. Student presses mic button (or uses push-to-talk hotkey)
2. Browser records audio via `MediaRecorder` API (WebM/opus codec)
3. Audio chunks stream to backend via WebSocket
4. Backend pipes audio to Deepgram streaming API in real-time
5. Deepgram returns partial + final transcripts
6. Final transcript is augmented with course context (active course, current topic)
7. Augmented query goes through DeepTutor's existing chat/solve agent with the course knowledge base
8. AI response text is sent back to client AND piped to ElevenLabs TTS
9. ElevenLabs streams audio back through WebSocket
10. Client displays transcript + AI response text AND plays audio simultaneously

### 7.5 Frontend Component

- **Floating mic button**: Always visible when in a course context
- **Waveform visualizer**: Shows audio levels during recording
- **Two modes**: Push-to-talk (hold button) and voice-activity-detection (auto-detect silence)
- **Transcript display**: Shows student's spoken words in real-time (from Deepgram partials)
- **Response display**: Shows AI answer as text + plays audio
- **Conversation history**: Scrollable chat view of voice session

### 7.6 Estimated Costs

| Service | Cost | Usage Estimate (per student/month) |
|---------|------|-----------------------------------|
| Deepgram Nova-2 | $0.0043/min | ~60 min voice = $0.26 |
| ElevenLabs | $0.30/1K chars (~$0.18/min) | ~30 min TTS = $5.40 |
| **Total voice cost** | | **~$5.66/student/month** |

---

## 8. Image Upload & OCR Pipeline

### 8.1 Architecture

```
┌──────────────────┐
│  Browser Client  │
│                  │
│  ┌─────────────┐ │     POST /api/v1/ocr/process
│  │ Camera      │─┼────────────────────────────────┐
│  │ or File     │ │                                │
│  │ Upload      │ │                                ▼
│  └─────────────┘ │    ┌────────────────────────────────┐
│                  │    │  OCR Router                     │
│  ┌─────────────┐ │    │                                │
│  │ Preview +   │◄┼────│  1. Receive image              │
│  │ OCR Result  │ │    │  2. Preprocess (resize, deskew)│
│  │ + Actions   │ │    │  3. Send to Claude Vision API  │
│  └─────────────┘ │    │  4. Get structured text + LaTeX│
│                  │    │  5. Route to action             │
└──────────────────┘    │  6. Store in MinIO + PostgreSQL │
                        └────────────────────────────────┘
                                     │
                        ┌────────────┼────────────┐
                        ▼            ▼            ▼
                   ┌─────────┐ ┌─────────┐ ┌──────────┐
                   │ "Solve  │ │"Explain │ │ "Add to  │
                   │  This"  │ │  This"  │ │ Notebook"│
                   │         │ │         │ │          │
                   │ Solve   │ │ Chat    │ │ Notebook │
                   │ Agent   │ │ Agent   │ │ API      │
                   └─────────┘ └─────────┘ └──────────┘
```

### 8.2 Why Claude Vision (Not Tesseract/Mathpix)

| Feature | Claude Vision | Tesseract | Mathpix |
|---------|--------------|-----------|---------|
| Printed text | Excellent | Good | Good |
| Handwritten text | Excellent | Poor | Good |
| Math equations | Excellent (LaTeX output) | Cannot | Excellent |
| Diagrams/charts | Can describe and interpret | Cannot | Limited |
| Cost per image | ~$0.01-0.03 (already paying for Claude API) | Free | $0.01/request |
| Extra API key | No (uses existing Claude key) | N/A | Yes |

Claude Vision is the clear winner: best accuracy across all content types, can interpret diagrams (not just OCR them), and incurs no additional API cost since we're already using the Claude API for the LLM.

### 8.3 Claude Vision Prompt Strategy

```python
# For math/science content:
MATH_OCR_PROMPT = """
Analyze this image and extract ALL text, equations, and mathematical content.
Output format:
1. EXTRACTED_TEXT: Plain text content
2. EQUATIONS: All equations in LaTeX format
3. DIAGRAMS: Description of any diagrams, graphs, or figures
4. CONTENT_TYPE: one of [printed_text, handwritten, equation, diagram, mixed]
5. SUBJECT: detected subject area (math, physics, chemistry, biology, cs)
"""

# For assignment/quiz scanning:
ASSIGNMENT_OCR_PROMPT = """
This is a student's assignment or quiz. Extract:
1. QUESTIONS: Each question with its number
2. STUDENT_ANSWERS: Any answers the student has written
3. BLANK_QUESTIONS: Questions left unanswered
4. FORMAT: multiple_choice | free_response | mixed
"""
```

### 8.4 Frontend Upload Component

- **Drag-and-drop zone**: Desktop file upload
- **Camera capture button**: Mobile-first — opens device camera directly
- **Crop and rotate tools**: Adjust image before processing
- **OCR result overlay**: Shows extracted text overlaid on the original image
- **Action buttons**: "Solve This", "Explain This", "Grade This", "Add to Notebook"
- **Batch upload**: Upload multiple pages of an assignment at once

### 8.5 Supported Formats

- JPEG, PNG, WebP, HEIC (from iPhone cameras)
- PDF pages (rendered to images, then processed)
- Maximum file size: 10MB per image
- Batch: up to 20 images per upload

---

## 9. Assessment Engine

### 9.1 Exam Types

| Type | Description | Use Case |
|------|-------------|----------|
| **Topic Quiz** | 5-10 MCQ on a single topic | After studying a topic |
| **Unit Exam** | 15-25 MCQ + 1-2 FRQ covering one unit | End of unit review |
| **Full Practice Exam** | Exact AP format (timed sections, calculator rules) | AP exam simulation |
| **Custom Quiz** | Teacher-defined question set | Classroom assignments |
| **Daily Challenge** | 3-5 mixed questions across enrolled courses | Daily engagement |

### 9.2 Exam Engine Architecture

```
┌────────────────────────────────────────────────────┐
│                 ExamSession                         │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ State Machine                                │  │
│  │                                              │  │
│  │  NOT_STARTED ──► SECTION_1_ACTIVE            │  │
│  │                  (timer running)              │  │
│  │                       │                       │  │
│  │                       ▼                       │  │
│  │                  SECTION_1_REVIEW             │  │
│  │                  (can change answers)          │  │
│  │                       │                       │  │
│  │                       ▼                       │  │
│  │                  SECTION_2_ACTIVE             │  │
│  │                  (timer running)              │  │
│  │                       │                       │  │
│  │                       ▼                       │  │
│  │                  COMPLETED ──► SCORED          │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  Rules enforced:                                   │
│  • Timer per section (cannot exceed)               │
│  • Calculator permission per section               │
│  • Cannot return to previous sections              │
│  • Reference materials shown when AP allows it     │
│  • FRQ submission formats match AP requirements    │
└────────────────────────────────────────────────────┘
```

### 9.3 MCQ Auto-Scoring

Straightforward — compare selected answer to correct answer. Calculate:
- Raw score (number correct, no penalty for wrong answers — matches current AP scoring)
- Per-topic breakdown (which learning objectives are strong/weak)
- Time per question analysis

### 9.4 FRQ AI-Powered Scoring

```
Student FRQ Response
        │
        ▼
┌────────────────────────────┐
│  Rubric Scorer             │
│                            │
│  Inputs:                   │
│  • Student response (text) │
│  • Official AP rubric      │
│  • Scoring guidelines      │
│  • Sample responses (if    │
│    available from past APs)│
│                            │
│  Process:                  │
│  1. Claude evaluates       │
│     response against each  │
│     rubric point           │
│  2. Awards points per      │
│     rubric element         │
│  3. Provides justification │
│     for each point         │
│  4. Flags low-confidence   │
│     scores for teacher     │
│     review                 │
│                            │
│  Output:                   │
│  • Points per rubric item  │
│  • Total FRQ score         │
│  • Written feedback        │
│  • Confidence level        │
│  • Suggested improvements  │
└────────────────────────────┘
```

### 9.5 AP Score Prediction

Maps practice exam performance to predicted AP score (1-5):

```
Composite Score = (MCQ_correct × MCQ_weight) + (FRQ_points × FRQ_weight)

Score boundaries (approximate, calibrated per course):
  5: composite >= 70% (varies by course/year)
  4: composite >= 55%
  3: composite >= 40%
  2: composite >= 25%
  1: composite <  25%
```

Refined over time by correlating practice performance patterns with topic mastery scores.

### 9.6 Question Generation

Extends DeepTutor's existing question agent with AP-specific constraints:

- **MCQ format**: Exactly 4 answer choices (A-D), one correct, three distractors based on common misconceptions
- **FRQ format**: Multi-part with point allocation matching AP style
- **Difficulty calibration**: 1-5 scale mapped to AP score ranges
- **Topic tagging**: Every generated question tagged with learning objectives
- **Distractor quality**: Distractors generated from common student misconceptions documented in AP scoring reports

---

## 10. Database Schema

### 10.1 Entity-Relationship Overview

```
users ──────────┬──── enrollments ──── courses
                │                        │
                │                        ├── units
                │                        │     └── topics
                │                        │           ├── learning_objectives
                │                        │           │     └── essential_knowledge
                │                        │           └── topic_knowledge_bases
                │                        │
                │                        └── practice_problems
                │
                ├── topic_progress
                ├── exam_attempts ────── exam_answers
                ├── question_attempts
                ├── voice_sessions
                └── uploads
```

### 10.2 Core Tables

```sql
-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'student',
                    -- 'student', 'teacher', 'admin'
    grade_level     INTEGER,          -- 9, 10, 11, 12
    school_name     VARCHAR(255),
    avatar_url      VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COURSE STRUCTURE
-- ============================================================

CREATE TABLE courses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) UNIQUE NOT NULL,   -- 'AP_CSA', 'AP_CALC_BC'
    name            VARCHAR(200) NOT NULL,
    subject_area    VARCHAR(50) NOT NULL,           -- 'computer_science', 'math', 'science'
    description     TEXT,
    exam_format     JSONB NOT NULL,
    -- Example: {"sections": [{"name": "MCQ", "count": 40, "minutes": 90},
    --                        {"name": "FRQ", "count": 4, "minutes": 90}]}
    reference_materials JSONB,          -- formula sheets, quick references
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE units (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID REFERENCES courses(id) ON DELETE CASCADE,
    unit_number     INTEGER NOT NULL,
    title           VARCHAR(200) NOT NULL,
    big_idea        VARCHAR(200),
    description     TEXT,
    estimated_hours DECIMAL(4,1),
    UNIQUE(course_id, unit_number)
);

CREATE TABLE topics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id         UUID REFERENCES units(id) ON DELETE CASCADE,
    topic_number    VARCHAR(10) NOT NULL,   -- '1.1', '1.2', etc.
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    UNIQUE(unit_id, topic_number)
);

CREATE TABLE learning_objectives (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id        UUID REFERENCES topics(id) ON DELETE CASCADE,
    objective_code  VARCHAR(20) NOT NULL,    -- 'MOD-1.A', 'VAR-2.B'
    description     TEXT NOT NULL,
    skill_category  VARCHAR(50)              -- 'Practice', 'Concept', 'Application'
);

CREATE TABLE essential_knowledge (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objective_id    UUID REFERENCES learning_objectives(id) ON DELETE CASCADE,
    ek_code         VARCHAR(25) NOT NULL,    -- 'MOD-1.A.1'
    description     TEXT NOT NULL
);

-- Links topics to DeepTutor knowledge bases
CREATE TABLE topic_knowledge_bases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id        UUID REFERENCES topics(id) ON DELETE CASCADE,
    kb_name         VARCHAR(200) NOT NULL,   -- DeepTutor KB identifier
    kb_type         VARCHAR(50) NOT NULL,     -- 'textbook', 'notes', 'frq_bank'
    source_citation TEXT
);

-- ============================================================
-- PRACTICE PROBLEMS
-- ============================================================

CREATE TABLE practice_problems (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID REFERENCES courses(id),
    topic_id        UUID REFERENCES topics(id),
    problem_type    VARCHAR(20) NOT NULL,    -- 'mcq', 'frq', 'coding'
    difficulty      INTEGER CHECK (difficulty BETWEEN 1 AND 5),
    content         JSONB NOT NULL,
    -- MCQ: {"stem": "...", "choices": {"A": "...", ...}, "correct": "B",
    --       "explanation": "...", "distractors_reasoning": {...}}
    -- FRQ: {"prompt": "...", "parts": [{"label": "a", "points": 3, "rubric": "..."}],
    --       "total_points": 9, "sample_response": "..."}
    source          VARCHAR(100),            -- 'AP 2023 FRQ #2', 'generated', 'teacher'
    year            INTEGER,
    tags            TEXT[],
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ENROLLMENT & PROGRESS
-- ============================================================

CREATE TABLE enrollments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id       UUID REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at     TIMESTAMPTZ DEFAULT NOW(),
    status          VARCHAR(20) DEFAULT 'active',
                    -- 'active', 'completed', 'paused'
    target_score    INTEGER CHECK (target_score BETWEEN 1 AND 5),
    UNIQUE(user_id, course_id)
);

CREATE TABLE topic_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id   UUID REFERENCES enrollments(id) ON DELETE CASCADE,
    topic_id        UUID REFERENCES topics(id) ON DELETE CASCADE,
    status          VARCHAR(20) DEFAULT 'not_started',
                    -- 'not_started', 'in_progress', 'mastered'
    mastery_score   DECIMAL(5,2),            -- 0.00 to 100.00
    time_spent_min  INTEGER DEFAULT 0,
    questions_attempted INTEGER DEFAULT 0,
    questions_correct   INTEGER DEFAULT 0,
    last_activity   TIMESTAMPTZ,
    UNIQUE(enrollment_id, topic_id)
);

-- ============================================================
-- ASSESSMENTS
-- ============================================================

CREATE TABLE exams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID REFERENCES courses(id),
    exam_type       VARCHAR(30) NOT NULL,    -- 'topic_quiz', 'unit_exam',
                                             -- 'full_practice', 'custom'
    title           VARCHAR(200) NOT NULL,
    unit_id         UUID REFERENCES units(id),  -- NULL for full practice
    topic_id        UUID REFERENCES topics(id), -- NULL for unit/full
    sections        JSONB NOT NULL,           -- timing, calculator rules
    total_points    INTEGER NOT NULL,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exam_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    exam_id         UUID REFERENCES exams(id),
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    raw_score       DECIMAL(5,2),
    scaled_score    INTEGER,                  -- 1-5 AP score
    section_scores  JSONB,                    -- per-section breakdown
    topic_scores    JSONB,                    -- per-topic breakdown
    status          VARCHAR(20) DEFAULT 'in_progress'
);

CREATE TABLE exam_answers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id      UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
    problem_id      UUID REFERENCES practice_problems(id),
    section_number  INTEGER,
    user_answer     JSONB,                    -- MCQ: "B", FRQ: {text, code}
    is_correct      BOOLEAN,                  -- NULL for FRQ until scored
    points_earned   DECIMAL(4,1),
    ai_feedback     TEXT,                     -- rubric-based feedback for FRQ
    time_spent_sec  INTEGER
);

-- ============================================================
-- VOICE & UPLOADS
-- ============================================================

CREATE TABLE voice_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    course_id       UUID REFERENCES courses(id),
    topic_id        UUID REFERENCES topics(id),
    messages        JSONB NOT NULL DEFAULT '[]',
    -- [{role: "student", text: "...", audio_url: "..."},
    --  {role: "tutor", text: "...", audio_url: "..."}]
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE uploads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    file_url        VARCHAR(500) NOT NULL,     -- MinIO URL
    file_type       VARCHAR(20),               -- 'image/jpeg', 'image/png', 'application/pdf'
    ocr_result      JSONB,                     -- Claude Vision output
    action_taken    VARCHAR(50),               -- 'solve', 'explain', 'grade', 'notebook'
    course_id       UUID REFERENCES courses(id),
    topic_id        UUID REFERENCES topics(id),
    processing_status VARCHAR(20) DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ANALYTICS
-- ============================================================

CREATE TABLE study_streaks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    current_streak  INTEGER DEFAULT 0,
    longest_streak  INTEGER DEFAULT 0,
    last_study_date DATE
);

CREATE TABLE daily_activity (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    activity_date   DATE NOT NULL,
    minutes_studied INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    topics_covered  INTEGER DEFAULT 0,
    UNIQUE(user_id, activity_date)
);
```

---

## 11. Authentication & Multi-Tenancy

### 11.1 Auth Flow

```
Register: POST /api/v1/auth/register
  ──► Validate email + password strength
  ──► bcrypt hash password
  ──► Create user record
  ──► Return JWT access token (15min) + refresh token (7d)

Login: POST /api/v1/auth/login
  ──► Verify email + bcrypt compare
  ──► Return JWT access token + refresh token

Protected Routes: Bearer token in Authorization header
  ──► JWT middleware validates + extracts user_id + role
  ──► Role-based access control (student/teacher/admin)

Refresh: POST /api/v1/auth/refresh
  ──► Validate refresh token
  ──► Issue new access + refresh tokens (rotation)
```

### 11.2 Multi-Tenancy Model

**Approach: Shared database, user-scoped data**

- All users share the same PostgreSQL database
- Knowledge bases are namespaced: `data/knowledge_bases/{user_id}/{kb_name}/`
- Course knowledge bases are shared (read-only for students)
- Student-uploaded content is private per user
- Teachers can view their enrolled students' data

### 11.3 Role Permissions

| Action | Student | Teacher | Admin |
|--------|---------|---------|-------|
| Browse course catalog | Yes | Yes | Yes |
| Enroll in courses | Yes | Yes | Yes |
| Study topics (RAG chat) | Yes | Yes | Yes |
| Take exams | Yes | Yes | Yes |
| View own progress | Yes | Yes | Yes |
| Create custom content | No | Yes | Yes |
| View student progress | No | Own classes | All |
| Create custom exams | No | Yes | Yes |
| Manage courses | No | No | Yes |
| Manage users | No | No | Yes |

---

## 12. Student & Teacher Dashboards

### 12.1 Student Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Welcome back, Alex!                    🔥 15-day streak   │
│                                                             │
│  ┌─── My Courses ──────────────────────────────────────────┐│
│  │ ┌────────────┐ ┌────────────┐ ┌────────────┐           ││
│  │ │ AP Calc BC │ │  AP CSA    │ │ AP Physics │           ││
│  │ │ ████░░ 68% │ │ ██████ 92% │ │ ███░░░ 45% │           ││
│  │ │ Pred: 4    │ │ Pred: 5    │ │ Pred: 3    │           ││
│  │ └────────────┘ └────────────┘ └────────────┘           ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─── Topic Mastery Heat Map (AP Calc BC) ─────────────────┐│
│  │ Unit 1: Limits          ██████████ 95%                  ││
│  │ Unit 2: Differentiation ████████░░ 82%                  ││
│  │ Unit 3: Integration     ██████░░░░ 61%  ◄ Focus here   ││
│  │ Unit 4: Diff. Equations ████░░░░░░ 38%  ◄ Focus here   ││
│  │ ...                                                     ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─── Recent Activity ─────────────────────────────────────┐│
│  │ Today     Topic Quiz: Integration by Parts — 7/10       ││
│  │ Yesterday Voice Q&A: Polar coordinates — 15 min         ││
│  │ Mar 19    Scanned Assignment: Ch. 5 HW — all solved     ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─── AI Study Recommendation ─────────────────────────────┐│
│  │ Based on your progress, focus on:                       ││
│  │ 1. Integration by Parts (Unit 3) — mastery at 55%      ││
│  │ 2. Differential Equations (Unit 4) — not started        ││
│  │ 3. Take a Practice Exam for AP Calc BC                  ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Teacher Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  AP Calculus BC — Period 3           24 students enrolled   │
│                                                             │
│  ┌─── Class Overview ──────────────────────────────────────┐│
│  │ Average Progress: 62%     Predicted Score: 3.4 avg      ││
│  │                                                         ││
│  │ Score Distribution:  5: ██ 4     At Risk:               ││
│  │                      4: ████ 8   • Sarah M. (pred: 2)   ││
│  │                      3: ██████ 7 • James T. (pred: 2)   ││
│  │                      2: ███ 4    • Inactive: 1 student  ││
│  │                      1: █ 1                             ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─── Hardest Topics (Class-Wide) ─────────────────────────┐│
│  │ 1. Taylor Series — avg mastery 31%                      ││
│  │ 2. Integration by Parts — avg mastery 45%               ││
│  │ 3. Parametric Equations — avg mastery 48%               ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  Actions: [Create Quiz] [Assign Practice Exam] [Add Content]│
└─────────────────────────────────────────────────────────────┘
```

### 12.3 Backend Endpoints

```
GET  /api/v1/students/dashboard              — student overview
GET  /api/v1/students/courses/{id}/progress  — per-course mastery map
GET  /api/v1/students/courses/{id}/prediction — AP score prediction
GET  /api/v1/students/activity               — recent activity feed
GET  /api/v1/students/study-plan             — AI-recommended next steps

GET  /api/v1/admin/classes/{id}/overview     — class statistics
GET  /api/v1/admin/classes/{id}/students     — student list with progress
GET  /api/v1/admin/classes/{id}/hard-topics  — topics students struggle with
POST /api/v1/admin/content                   — create custom content
POST /api/v1/admin/exams                     — create custom exam
```

---

## 13. Deployment Strategy

### 13.1 Docker Compose (Production)

```yaml
version: "3.9"

services:
  # ── Main Application ──────────────────────────────
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${BACKEND_PORT:-8001}:8001"
      - "${FRONTEND_PORT:-3782}:3782"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_started
    volumes:
      - ./config:/app/config:ro
      - knowledge_data:/app/data/knowledge_bases
      - user_data:/app/data/user
    environment:
      - DATABASE_URL=postgresql+asyncpg://deeptutor:${DB_PASSWORD}@postgres:5432/deeptutor
      - REDIS_URL=redis://redis:6379/0
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - LLM_API_KEY=${LLM_API_KEY}
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped

  # ── PostgreSQL ─────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: deeptutor
      POSTGRES_USER: deeptutor
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U deeptutor"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ── Redis ──────────────────────────────────────────
  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ── MinIO (S3-compatible object storage) ───────────
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes:
      - miniodata:/data
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    ports:
      - "9001:9001"  # MinIO console (internal only in prod)
    restart: unless-stopped

  # ── JDK Sidecar (for AP CSA Java execution) ───────
  java-executor:
    image: eclipse-temurin:21-jdk-alpine
    command: ["tail", "-f", "/dev/null"]  # Keep alive; app sends code via exec
    volumes:
      - java_workspace:/workspace
    mem_limit: 512m
    cpus: 1.0
    restart: unless-stopped

  # ── Reverse Proxy ─────────────────────────────────
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
  miniodata:
  knowledge_data:
  user_data:
  java_workspace:
  caddy_data:
  caddy_config:
```

### 13.2 Server Requirements

| Tier | Users | Specs | Estimated Cost |
|------|-------|-------|---------------|
| **Development** | 1-5 | 2 vCPU, 8 GB RAM, 50 GB SSD | ~$40/mo |
| **Small School** | 50-100 | 4 vCPU, 16 GB RAM, 100 GB SSD | ~$80/mo |
| **Medium** | 100-500 | 8 vCPU, 32 GB RAM, 200 GB SSD | ~$160/mo |
| **Large** | 500+ | 16 vCPU, 64 GB RAM, 500 GB SSD + separate DB | ~$400/mo |

*Note: Server costs do not include API costs (Claude, Deepgram, ElevenLabs), which scale per student.*

### 13.3 Deployment Checklist

1. Provision server (cloud or bare metal)
2. Install Docker + Docker Compose
3. Clone repository
4. Configure `.env` with all API keys and secrets
5. Run `docker compose up -d`
6. Run database migrations: `docker compose exec app alembic upgrade head`
7. Seed AP course data: `docker compose exec app python scripts/seed_courses.py`
8. Ingest AP CED documents into knowledge bases
9. Ingest OpenStax textbooks (mapped to course topics)
10. Configure domain + SSL via Caddy
11. Set up monitoring (Prometheus + Grafana or similar)
12. Configure backups (PostgreSQL pg_dump + MinIO mc mirror)

### 13.4 Scaling Path

```
Phase 1: Single Server (Docker Compose)
  └── All services on one machine

Phase 2: Separate Database
  └── Managed PostgreSQL (AWS RDS / DigitalOcean Managed DB)
  └── App server handles compute only

Phase 3: Horizontal Scaling
  └── Multiple app workers behind load balancer
  └── PgBouncer for connection pooling
  └── Redis cluster for sessions

Phase 4: Kubernetes (if needed)
  └── Helm chart for orchestration
  └── Auto-scaling based on concurrent users
```

---

## 14. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

**Goal**: Basic platform running with auth and course structure.

| Task | Effort | Details |
|------|--------|---------|
| Fork and configure DeepTutor | 2 days | Clone, verify Docker build, understand codebase |
| Add PostgreSQL + Redis + MinIO to docker-compose | 2 days | Services, health checks, volumes |
| SQLAlchemy models + Alembic migrations | 5 days | All tables from schema above |
| Auth system (register, login, JWT) | 4 days | Middleware, role-based access |
| Course management API | 3 days | CRUD for courses, units, topics |
| Seed all 13 AP courses | 3 days | Parse CEDs, populate database |
| Course catalog + enrollment UI | 3 days | Browse courses, enroll button |
| User namespace for knowledge bases | 2 days | Modify DeepTutor's KB manager |

**Deliverable**: Students can register, browse 13 AP courses, and enroll.

### Phase 2: Content & Tutoring (Weeks 5-8)

**Goal**: AI-powered tutoring for every AP topic.

| Task | Effort | Details |
|------|--------|---------|
| Download + ingest AP CEDs (all 13) | 3 days | Parse PDFs into knowledge bases |
| Map and ingest OpenStax textbooks | 5 days | Per-course KB creation |
| Course study interface | 4 days | Topic selection → guided learning |
| AP-format MCQ generation | 4 days | Extend question agent |
| Topic quiz interface | 3 days | Take quiz, auto-score, review |
| Basic student dashboard | 3 days | Course cards, quiz scores |

**Deliverable**: Students can study any AP topic with AI tutoring and take quizzes.

### Phase 3: Assessment Engine (Weeks 9-12)

**Goal**: Full AP exam simulations.

| Task | Effort | Details |
|------|--------|---------|
| Exam engine (timed sections, calculator rules) | 5 days | State machine, timer, rules |
| MCQ exam interface | 3 days | Question navigation, flagging |
| FRQ interface (rich text + code) | 4 days | LaTeX editor, code editor |
| FRQ rubric-based AI scoring | 5 days | Claude with rubric injection |
| Exam results + score prediction | 3 days | Breakdown, AP score estimate |
| Past AP FRQ bank ingestion | 3 days | Parse and tag past questions |
| Java code execution (AP CSA) | 3 days | JDK sidecar, executor class |

**Deliverable**: Full-length AP practice exams with AI-scored FRQs.

### Phase 4: Voice Assistant (Weeks 13-15)

**Goal**: Voice-based Q&A.

| Task | Effort | Details |
|------|--------|---------|
| Deepgram STT service | 3 days | Streaming WebSocket integration |
| ElevenLabs TTS service | 2 days | Replace OpenAI TTS |
| Voice WebSocket endpoint | 3 days | Audio streaming, buffering |
| Voice assistant frontend | 4 days | Mic button, waveform, playback |
| Course context injection | 2 days | Voice queries use active course KB |
| Voice conversation history | 1 day | Persist voice sessions |

**Deliverable**: Students ask questions by voice, get spoken + text answers.

### Phase 5: Image/OCR Pipeline (Weeks 16-18)

**Goal**: Scan and solve problems from photos.

| Task | Effort | Details |
|------|--------|---------|
| Claude Vision OCR service | 3 days | Image processing, LaTeX extraction |
| Upload API endpoints | 2 days | File handling, MinIO storage |
| Upload frontend (camera + drag-drop) | 4 days | Crop, rotate, preview |
| Action routing (solve/explain/grade) | 3 days | Connect OCR output to agents |
| Batch upload support | 2 days | Multi-page assignments |
| Assignment grading flow | 1 day | OCR → rubric scorer |

**Deliverable**: Students photograph problems and get AI-powered solutions.

### Phase 6: Analytics & Teacher Tools (Weeks 19-22)

**Goal**: Progress tracking and class management.

| Task | Effort | Details |
|------|--------|---------|
| Enhanced student dashboard | 4 days | Mastery heat map, streaks, predictions |
| Teacher dashboard | 5 days | Class overview, at-risk students |
| Study plan recommendation engine | 3 days | AI-generated study priorities |
| Content authoring for teachers | 4 days | Create problems, notes via UI |
| Custom exam builder for teachers | 3 days | Select questions, set timing |
| Progress reports (PDF export) | 2 days | Generate and download |

**Deliverable**: Teachers monitor classes; students get AI study recommendations.

### Phase 7: Production Polish (Weeks 23-26)

**Goal**: Production-ready deployment.

| Task | Effort | Details |
|------|--------|---------|
| Performance optimization | 3 days | Query optimization, caching |
| Mobile-responsive design | 4 days | Responsive layout pass |
| Accessibility audit (WCAG 2.1 AA) | 3 days | Screen readers, keyboard nav |
| Security audit (OWASP) | 3 days | Input sanitization, rate limiting |
| Load testing (500 concurrent users) | 2 days | k6 or Locust |
| CI/CD pipeline | 2 days | GitHub Actions: test, build, deploy |
| Documentation | 3 days | User guide, API docs, deployment guide |
| Open-source release prep | 2 days | AGPL-3.0 headers, CONTRIBUTING.md |

**Deliverable**: Production-ready, deployed platform.

### Timeline Summary

```
Week  1-4:   ████████████████  Phase 1: Foundation
Week  5-8:   ████████████████  Phase 2: Content & Tutoring
Week  9-12:  ████████████████  Phase 3: Assessment Engine
Week 13-15:  ████████████████  Phase 4: Voice Assistant
Week 16-18:  ████████████████  Phase 5: Image/OCR
Week 19-22:  ████████████████  Phase 6: Analytics & Teacher Tools
Week 23-26:  ████████████████  Phase 7: Production Polish
```

**Total: ~26 weeks (6.5 months)**

---

## 15. Risk Factors & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **API costs at scale** | High | High | Use smaller models for simple tasks (Claude Haiku for scoring, Sonnet for chat). Cache common responses. Allow self-hosted LLM backends. |
| **FRQ scoring accuracy** | Medium | Medium | Always label scores as "AI-estimated". Allow teacher override. Build calibration dataset. Show confidence levels. |
| **Content licensing issues** | High | Low | Use only CC-licensed (OpenStax) and public domain (College Board published) materials. No copyrighted textbook content. |
| **Upstream DeepTutor breaking changes** | Medium | Medium | Minimize modifications to existing files. Use extension pattern (new routers, agents). Periodically rebase with conflict resolution. |
| **Voice latency > 3 seconds** | Medium | Low | Deepgram streaming is ~300ms. ElevenLabs streaming ~500ms. Stream responses rather than wait for full generation. |
| **Claude Vision OCR misreads equations** | Medium | Low | Provide confidence scores. Allow manual correction. Show OCR result for user verification before action. |
| **AGPL-3.0 compliance** | High | Low | Automate license header checks in CI. Public GitHub repo. Source link in UI footer. |
| **Student data privacy (FERPA/COPPA)** | High | Low | Encrypt PII at rest. No third-party analytics. Data retention policies. Privacy policy. Parental consent flow for under-13. |

---

## 16. Technology Stack Summary

| Layer | Technology | Version | License |
|-------|-----------|---------|---------|
| **Frontend** | Next.js | 16.x | MIT |
| **UI Framework** | React | 19.x | MIT |
| **Styling** | TailwindCSS | 3.4.x | MIT |
| **Math Rendering** | KaTeX | 0.16.x | MIT |
| **Code Editor** | Monaco Editor | latest | MIT |
| **Backend** | FastAPI | 0.110+ | MIT |
| **ORM** | SQLAlchemy | 2.0 | MIT |
| **Migrations** | Alembic | 1.13+ | MIT |
| **Database** | PostgreSQL | 16 | PostgreSQL License |
| **Cache** | Redis | 7 | BSD-3 |
| **Object Storage** | MinIO | latest | AGPL-3.0 |
| **Auth** | python-jose + bcrypt | latest | MIT |
| **LLM** | Claude API (Anthropic) | latest | SaaS (compatible) |
| **STT** | Deepgram Nova-2 | latest | SaaS (compatible) |
| **TTS** | ElevenLabs | latest | SaaS (compatible) |
| **OCR** | Claude Vision API | latest | SaaS (compatible) |
| **RAG** | LlamaIndex + RAGAnything | existing | MIT / Apache-2.0 |
| **Embeddings** | OpenAI / local | existing | SaaS / MIT |
| **Containerization** | Docker + Compose | latest | Apache-2.0 |
| **Reverse Proxy** | Caddy | 2.x | Apache-2.0 |
| **Java Runtime** | Eclipse Temurin | 21 | GPLv2+CE |

All dependencies are AGPL-3.0 compatible.

---

## 17. Requirements Traceability

| # | Requirement | Where Addressed |
|---|-------------|-----------------|
| 1 | Built on DeepTutor with complete learning system features | Sections 3, 4 — Fork DeepTutor, extend with LMS features |
| 2 | Courses for top US high school students | Section 5 — 13 AP courses across CS, Math, Science |
| 3 | Focus on CS, Science, Math | Section 5 — 2 CS + 4 Math + 7 Science courses |
| 4 | AGPL-3.0 open-source compliance | Section 2 — Full compliance plan documented |
| 5 | Voice-based assistant | Section 7 — Deepgram STT + ElevenLabs TTS architecture |
| 6 | Course content and AP exam preparation | Section 6 — Content hierarchy, sourcing strategy, AP framework alignment |
| 7 | Scan/share pictures of concepts and assignments | Section 8 — Claude Vision OCR pipeline with camera capture |
| 8 | Server deployment | Section 13 — Docker Compose, server specs, deployment checklist |
| 9 | System design document | This document (SystemDesign.md) |

---

*This document is licensed under AGPL-3.0, consistent with the DeepTutor base project.*
