# DevTrack — Developer Learning Tracker

A full-stack web application for developers who take their learning seriously. DevTrack goes beyond basic note-taking — it tracks progress, measures growth, spots knowledge gaps, and automates logging so you spend time learning, not administrating.

---

## Tech Stack

| Layer    | Technology                             |
| -------- | -------------------------------------- |
| Frontend | React 18, TailwindCSS, D3.js, Recharts |
| Backend  | FastAPI, SQLAlchemy, PostgreSQL        |
| AI       | Groq (Llama 3.3 70B) — free tier       |
| Auth     | JWT (python-jose)                      |
| Infra    | Docker Compose, hot reload             |
| PDF      | ReportLab                              |
| Scraping | httpx + BeautifulSoup4                 |

---

## Quick Start

```bash
git clone https://github.com/Zakaria-Raddaoui/devtrack-fastapi-react
cd devtrack-fastapi-react

# Copy env and add your Groq API key (free at console.groq.com)
cp .env.example .env

docker compose up --build
```

Open **http://localhost:3000**

---

## Features

### Core Learning Management

**Topics — Kanban Board**

- Drag & drop across To Learn / Learning / Mastered columns
- Set goal hours and track progress with a live progress bar per card
- Filter and sort by date or hours logged
- Click any card to open the full Topic Detail page
- **⏱ Start Session** button on hover — launches a Study Session directly for that topic

**Daily Logs — Smart List View**

- Rich markdown editor with write/preview toggle
- Cards collapse to 3 lines with gradient fade — click to expand and read full log
- Built-in Pomodoro timer that auto-fills time spent
- **Confidence Slider** — rate your confidence (0–100%) after each session; stored and used for gap analysis
- Bulk selection with custom-styled checkboxes — delete multiple logs at once
- Calendar view with heat intensity showing daily study patterns

**Notes — Two-Panel Editor**

- Sidebar list + full markdown editor
- Folder organization with right-click context menu (move, duplicate, delete)
- Auto-save with 1s debounce, Ctrl+E to toggle preview/edit
- Pin notes to top
- **AI Auto-Tagging** — AI proposes tags from note content, hierarchical tags can merge over time (docker-compose + docker-volumes → `docker` with subtopics)

**Resources — Enhanced**

- Star ratings (1–5), mark as read/unread, notes per resource
- Filter by type (article/video/course/book/docs/tool), topic, read status
- Sort by top rated, recent, or A–Z
- Stats bar: total, read count, avg rating

**Roadmaps**

- Ordered steps with checkboxes, progress ring
- Link steps to Topics — appears in Topic Detail page
- Collapsible right panel, completion animation

**Goals**

- Set learning goals with deadlines and target hours
- Auto-calculates progress from logged hours if linked to a topic
- Active / Completed tabs, deadline urgency colors (green → orange → red)
- Stats: overdue count, due this week

---

### AI-Powered Features

**AI Assistant**

- Full conversation interface with Groq Llama 3.3 70B (streaming)
- Persistent conversations stored in DB, auto-titled from first message
- Rename/delete conversations
- Warm personality, markdown formatting

**Study Session Autopilot** (`Ctrl+Shift+S` or sidebar button)

- Pick topic + duration (25 / 50 / 90 min or custom)
- Fullscreen focus mode with animated circular countdown ring
- Motivational message changes as timer progresses
- Three-note chime when session ends (Web Audio API)
- **Debrief screen** — type a rough brain dump (or nothing)
- AI generates:
  - Clean markdown log entry
  - 3-bullet summary of what was covered
  - "Next session" suggestion
- Review and edit before saving — one click creates the log

**Quick Capture** (`Ctrl+Shift+V` or ⚡ sidebar button)

- Paste any URL → DevTrack auto-detects type and fetches metadata:
  - **GitHub PR/Commit** — title, repo, files changed, estimated time
  - **YouTube** — video title, duration → estimates time from video length
  - **LeetCode** — problem name, difficulty (Easy/Medium/Hard)
  - **Udemy/Coursera** — course title
  - **Articles/Docs** — page title, domain
  - **Any URL** — og:title fallback
- Auto-matches to your existing topics (NLP-lite keyword matching)
- Topic selection is required before saving
- Simultaneously saves a Resource entry linked to the topic
- Auto-reads clipboard on open — if you already copied a URL, it's pre-filled

---

### Unique Intelligence Features

**Confidence & Evidence Tracking** (`/confidence` page)

The core insight: separating _feeling_ confident from _being_ confident.

- **Confidence score** (0–100): subjective, from the slider after each log session
- **Evidence score** (0–100): objective, computed from:
  - Hours logged — 35 pts (saturates at 20h)
  - Consistency — 20 pts (distinct days logged, saturates at 12)
  - Depth — 20 pts (avg note length per session, saturates at 300 chars)
  - Resources read — 10 pts (saturates at 5)
  - Roadmap steps completed — 10 pts (saturates at 5)
  - Goals completed — 5 pts (saturates at 2)
- **Gap analysis**: Overconfident / Aligned / Underestimating yourself
- Dual ring gauge per topic (outer = evidence, inner = confidence)
- Confidence trend sparkline from last 5 slider ratings
- Filter view: see only overconfident or underestimating topics

**Knowledge Graph** (`/graph` page, `Ctrl+0`)

An auto-built visual map of your knowledge from topic titles, notes, logs, and resources.

- Force-directed D3.js graph — drag nodes, scroll to zoom, drag canvas to pan
- Nodes sized by how often a concept appears — your topics get a glow ring
- Edges: solid = co-occurrence in same topic, dashed = same domain
- **Domain clusters**: Frontend, Backend, DevOps, Database, AI/ML, Networking, Security, CS Fundamentals
- **Missing prerequisites detection**: "You've touched Kubernetes but haven't covered Docker or Networking basics"
- Click any domain in the sidebar to isolate that cluster
- Hover any node for details: domain, hours logged, status, prerequisites

---

### Analytics & Insights

**Analytics Page**

- GitHub-style full-year heatmap of learning activity
- Hours per month bar chart
- Best days to learn (by average hours)
- Hours by topic (horizontal bar)
- Time distribution donut chart
- Week-over-week comparison with trend message

**Dashboard**

- 6 stat cards: total hours, in progress, mastered, this week, streak, learning pace
- Daily goal ring with today's progress
- "Continue where you left off" card
- Recent logs panel
- Weekly area chart + top topics bar chart
- Quick Capture and Quick Log buttons

---

### Profile & Settings

**Profile Page**

- Stats overview: 8 metrics (hours, sessions, active days, topics, mastered, goals done, notes, roadmaps)
- Edit email, bio, public/private toggle with live URL preview
- Password change with live strength indicator (5-bar)
- **Export to PDF** — downloads a formatted report with stats table, topics, recent logs, and goals
- Public profile at `/u/{username}` — owners can view their own private profile

---

### Navigation & UX

**Sidebar** (hover to expand, auto-collapses)

- Clean SVG line icon set — consistent 17×17 stroke icons
- ⚡ Quick Capture + ⏱ Study Session buttons always accessible
- User avatar, theme toggle, sign out in the bottom zone

**Keyboard Shortcuts** (`Ctrl+/` to open overlay)

```
Ctrl+1     Dashboard          Ctrl+6     Goals
Ctrl+2     Topics             Ctrl+7     Resources
Ctrl+3     Logs               Ctrl+8     Analytics
Ctrl+4     Notes              Ctrl+9     AI Assistant
Ctrl+5     Roadmaps           Ctrl+0     Knowledge Graph
Ctrl+K     Search             Ctrl+/     Shortcuts overlay
Ctrl+Shift+V  Quick Capture   Ctrl+Shift+S  Study Session
Ctrl+E     Toggle note preview Ctrl+S    Save note
```

**Global Search** (`Ctrl+K`)

- Searches topics, logs, resources, and notes simultaneously
- Results with type icons and subtitles
- Keyboard navigation

---

## Project Structure

```
devtrack-fastapi-react/
├── backend/
│   ├── routers/
│   │   ├── auth.py          — Register, login, JWT
│   │   ├── topics.py        — CRUD + topic detail endpoint
│   │   ├── logs.py          — CRUD with confidence field
│   │   ├── resources.py     — CRUD with rating/is_read/notes
│   │   ├── notes.py         — CRUD with tags
│   │   ├── folders.py       — Note folder management
│   │   ├── roadmaps.py      — Roadmaps + steps CRUD
│   │   ├── goals.py         — Goals with deadline tracking
│   │   ├── dashboard.py     — Aggregated stats
│   │   ├── search.py        — Global full-text search
│   │   ├── profile.py       — Public/private profile + stats
│   │   ├── assistant.py     — Groq streaming chat
│   │   ├── confidence.py    — Evidence scoring + gap analysis
│   │   ├── graph.py         — Knowledge graph + prerequisite detection
│   │   ├── capture.py       — URL analysis (GitHub/YouTube/LeetCode)
│   │   ├── session.py       — Study session AI summarization
│   │   └── export.py        — PDF report generation
│   ├── models.py            — SQLAlchemy ORM models
│   ├── schemas.py           — Pydantic request/response schemas
│   ├── security.py          — JWT + password hashing
│   ├── database.py          — DB session + engine
│   ├── main.py              — FastAPI app + router registration
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/axios.js
│   │   ├── components/
│   │   │   ├── Layout.jsx           — Sidebar, global search, keyboard nav
│   │   │   ├── ShortcutsOverlay.jsx — Keyboard shortcuts panel
│   │   │   ├── QuickCapture.jsx     — URL paste + metadata fetch modal
│   │   │   ├── QuickCaptureGlobal.jsx — Self-contained wrapper for Layout
│   │   │   ├── StudySession.jsx     — Fullscreen timer + AI debrief
│   │   │   ├── PomodoroTimer.jsx    — Reusable timer component
│   │   │   └── ConfirmDialog.jsx    — Portal-based confirm modal
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Topics.jsx           — Kanban + Start Session per card
│   │   │   ├── TopicDetail.jsx      — Logs, resources, roadmap steps
│   │   │   ├── Logs.jsx             — List/calendar + bulk actions + confidence slider
│   │   │   ├── Notes.jsx            — Two-panel editor + folders + AI tags
│   │   │   ├── Resources.jsx        — Ratings + read status + filters
│   │   │   ├── Roadmaps.jsx
│   │   │   ├── Goals.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Confidence.jsx       — Confidence vs Evidence dashboard
│   │   │   ├── KnowledgeGraph.jsx   — D3 force graph
│   │   │   ├── Assistant.jsx        — AI chat
│   │   │   ├── Profile.jsx          — Stats + edit + PDF export
│   │   │   ├── PublicProfile.jsx
│   │   │   └── Login.jsx
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── index.css
│   ├── public/index.html
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Environment Variables

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=devtrack_db
DATABASE_URL=postgresql://postgres:postgres@db:5432/devtrack_db
SECRET_KEY=your-secret-key-here
GROQ_API_KEY=your-groq-api-key-here       # free at console.groq.com
REACT_APP_API_URL=http://localhost:8000
```

> Without `GROQ_API_KEY`: AI Assistant, Study Session summarization, and Note AI tagging will gracefully degrade (basic fallbacks, no crash).

---

## Planned / In Progress

- [ ] Auto-Tagging that evolves — AI proposes hierarchical tags for notes; suggests merging `docker-compose` + `docker-volumes` → `docker` with subtopics
- [~] Electron desktop app (.exe) — local backend + SQLite desktop mode scaffolded
- [ ] Achievements / badges system
- [ ] Export individual topic reports
- [ ] Public profile improvements
- [ ] Mobile responsive layout

---

## Desktop App (Phase B)

DevTrack now includes a **desktop shell scaffold** using Electron.

What it does today:

- Starts FastAPI locally inside the desktop app
- Uses a local **SQLite** database file instead of Docker/Postgres
- Loads your React UI in an Electron window
- Builds a Windows installer skeleton via `electron-builder`

### Desktop prerequisites

- Node.js 18+
- Python 3.11+

### Run desktop in dev mode

```bash
# from repository root
npm install
npm run frontend:install
npm run backend:install

# start frontend dev server in terminal A
npm --prefix frontend start

# start desktop shell in terminal B
npm run desktop:dev
```

### Build desktop distributable (Windows)

```bash
npm run desktop:dist
```

Output is generated in `dist/`.

If Windows blocks `electron-builder` with symlink privilege errors, use:

```bash
npm run desktop:pack
```

This creates a portable unpacked desktop app folder with `DevTrack.exe` in `dist/`.

If you see a black window in packaged mode, rebuild with:

```bash
npm run desktop:pack
```

The desktop build now uses file-protocol-safe routing and relative static asset paths.

---

## License

MIT
