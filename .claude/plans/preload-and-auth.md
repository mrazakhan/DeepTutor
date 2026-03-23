# Plan: Topic Content Preloading + Test Users

## Feature 1: Topic Content Preloading

**Concept:** Each topic gets a "preload" button on the course detail page. Clicking it generates an AI-powered introduction/explanation for that topic using the TutorAgent (RAG + LLM). This content is stored in the DB and displayed to all users when they open that topic's study page — so the first visit shows instant content instead of an empty chat.

### Backend Changes

1. **New DB model: `TopicContent`** (`src/database/models.py`)
   - `id` (UUID), `topic_id` (FK to topics), `content` (Text — markdown), `generated_by` (String — user who triggered), `created_at`, `updated_at`
   - One topic → one preloaded content (unique constraint on topic_id)

2. **New API endpoints** (`src/api/routers/courses.py`)
   - `POST /api/v1/courses/{course_id}/topics/{topic_id}/preload` — Trigger content generation for a topic. Uses TutorAgent to generate an introduction. Saves to `TopicContent` table. Returns the generated content.
   - `GET /api/v1/courses/{course_id}/topics/{topic_id}/content` — Get preloaded content for a topic (returns null if not yet generated).
   - `GET /api/v1/courses/{course_id}/content-status` — Returns a map of `{topic_id: bool}` indicating which topics have preloaded content (for showing icons on the course page).

3. **Run `alembic` or just `init_db()`** — Since we use `Base.metadata.create_all()`, the new table will be created automatically.

### Frontend Changes

4. **Course detail page** (`web/app/courses/[id]/page.tsx`)
   - Fetch content status on load via `GET /content-status`
   - Add a small icon button next to each topic:
     - Gray download/spark icon = not preloaded
     - Green checkmark = already preloaded
     - Spinner = currently generating
   - Clicking triggers `POST .../preload`, shows spinner, then updates to checkmark
   - Add a "Preload All" button in the Course Content header to batch-generate all topics

5. **Study page** (`web/app/courses/[id]/study/page.tsx`)
   - On load, fetch `GET .../content` for the current topic
   - If preloaded content exists, show it as the first assistant message in the chat (before user types anything)
   - User can still ask follow-up questions via the existing WebSocket chat

## Feature 2: Test Users

**Concept:** Simple username/password auth with two hardcoded test users. No OAuth yet — just enough to identify users. Stored in DB with hashed passwords.

### Backend Changes

6. **New DB model: `User`** (`src/database/models.py`)
   - `id` (UUID), `username` (String, unique), `password_hash` (String), `display_name` (String), `role` (String — "student" | "admin"), `created_at`

7. **New auth router** (`src/api/routers/auth.py`)
   - `POST /api/v1/auth/login` — Takes `{username, password}`, verifies against DB, returns `{token, user}` (simple JWT or session token)
   - `GET /api/v1/auth/me` — Returns current user from token
   - `POST /api/v1/auth/logout` — Invalidates token

8. **Seed test users** in `scripts/seed_courses.py` (or separate script)
   - `student1` / `test1234` — role: student, display: "Test Student"
   - `admin1` / `admin1234` — role: admin, display: "Test Admin"
   - Passwords hashed with `bcrypt` or `hashlib`

9. **Auth middleware** — Simple token check. For now, optional (don't break existing unauthenticated access). The preload endpoint can record `generated_by` from the token if present.

### Frontend Changes

10. **Login page** (`web/app/login/page.tsx`)
    - Simple form: username + password
    - On success, store token in localStorage, redirect to /courses
    - Show error on wrong credentials

11. **Auth context** (`web/lib/auth.tsx`)
    - React context for current user state
    - Auto-check `/auth/me` on app load
    - Provide `login()`, `logout()`, `user` to all components

12. **Navigation updates** — Show username/logout in sidebar if logged in, show login link if not

## Implementation Order

1. TopicContent DB model + migration
2. Content generation endpoint (POST preload)
3. Content retrieval endpoints (GET content, GET content-status)
4. Frontend: preload button on course page
5. Frontend: show preloaded content on study page
6. User DB model + seed test users
7. Auth API endpoints (login/me/logout)
8. Frontend: login page + auth context
9. Tests for all new features
