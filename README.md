# DevTrack — Developer Learning Tracker

A full-stack web application for developers to track their learning journey. Log daily progress, manage topics, save resources, write notes, build roadmaps, and get AI-powered learning advice — all in one place.

---

## Features

### 📚 Learning Management
- **Topics** — Kanban board with drag & drop across To Learn / Learning / Mastered columns. Set goal hours and track progress with a live progress bar.
- **Daily Logs** — Rich markdown editor with write/preview toggle and built-in Pomodoro timer that auto-fills time spent.
- **Resources** — Save links, videos, articles, and docs linked to topics. Filter by type and topic.
- **Roadmaps** — Build curated learning paths with ordered steps. Check off steps, link them to topics, track completion with an animated progress ring.

### 📝 Notes
- Full markdown wiki with folder organization
- Two-panel layout — note list on left, full editor on right
- Auto-save with 1 second debounce
- Right-click context menu — move to folder, duplicate, delete
- Ctrl+E toggles between preview and edit mode
- Pin important notes to the top

### 📊 Dashboard
- Stats cards — total hours, topics in progress, mastered, weekly activity
- Weekly activity area chart
- Quick log button directly from the dashboard

### 🤖 AI Learning Assistant
- Powered by Groq (Llama 3.3 70B) — free tier available
- Reads your actual topics, logs, and notes for personalized advice
- Streaming responses with typing effect
- Ask for study plans, quizzes, summaries, next steps

### 🔍 Global Search
- Ctrl+K shortcut from anywhere in the app
- Searches across topics, logs, resources, and notes simultaneously

### 👤 Public Profile
- Shareable profile page at `/u/username`
- Shows topics, total hours, and learning stats — no login required

### 🎨 Design
- Dark / Light theme toggle with persistent preference
- Amber / orange accent color system
- Syne + DM Sans typography
- Smooth animations and transitions throughout

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| FastAPI | REST API framework |
| PostgreSQL | Relational database |
| SQLAlchemy 2.x | ORM |
| Pydantic v2 | Data validation |
| PyJWT + Passlib/bcrypt | Authentication |
| Groq SDK | AI assistant |
| Uvicorn | ASGI server |

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| React Router v6 | Client-side routing |
| React Beautiful DnD | Kanban drag & drop |
| Axios | HTTP client with JWT interceptor |
| Recharts | Dashboard charts |
| React Markdown + remark-gfm | Markdown rendering |

### DevOps
| Technology | Purpose |
|---|---|
| Docker | Containerization |
| Docker Compose | Multi-service orchestration |
| PostgreSQL 17 | Database container |

---

## Project Structure

```
devtrack-fastapi-react/
│
├── backend/
│   ├── routers/
│   │   ├── auth.py
│   │   ├── topics.py
│   │   ├── logs.py
│   │   ├── resources.py
│   │   ├── notes.py
│   │   ├── folders.py
│   │   ├── roadmaps.py
│   │   ├── dashboard.py
│   │   ├── search.py
│   │   ├── profile.py
│   │   └── assistant.py
│   ├── main.py
│   ├── models.py
│   ├── schemas.py
│   ├── security.py
│   ├── database.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── api/axios.js
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── ConfirmDialog.jsx
│   │   │   └── PomodoroTimer.jsx
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Topics.jsx
│   │   │   ├── TopicDetail.jsx
│   │   │   ├── Logs.jsx
│   │   │   ├── Resources.jsx
│   │   │   ├── Notes.jsx
│   │   │   ├── Roadmaps.jsx
│   │   │   └── Assistant.jsx
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── index.css
│   ├── public/index.html
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Git](https://git-scm.com/)
- A free [Groq API key](https://console.groq.com) for the AI assistant (optional)

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/Zakaria-Raddaoui/devtrack-fastapi-react.git
cd devtrack-fastapi-react
```

**2. Set up environment variables**
```bash
cp .env.example .env
```

Open `.env` and fill in your values:
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=devtrack_db
DATABASE_URL=postgresql://postgres:postgres@db:5432/devtrack_db
SECRET_KEY=your-very-long-random-secret-key
GROQ_API_KEY=your-groq-api-key
REACT_APP_API_URL=http://localhost:8000
```

**3. Start the application**
```bash
docker compose up --build
```

**4. Open in browser**

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and receive JWT token |
| GET | `/auth/me` | Get current user profile |

### Topics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/topics/` | List all topics |
| POST | `/topics/` | Create a topic |
| GET | `/topics/{id}` | Get a topic |
| GET | `/topics/{id}/detail` | Get topic with logs, resources and stats |
| PUT | `/topics/{id}` | Update a topic |
| DELETE | `/topics/{id}` | Delete a topic |

### Logs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/logs/` | List all logs |
| POST | `/logs/` | Create a log entry |
| PUT | `/logs/{id}` | Update a log |
| DELETE | `/logs/{id}` | Delete a log |

### Resources
| Method | Endpoint | Description |
|---|---|---|
| GET | `/resources/` | List all resources |
| POST | `/resources/` | Save a resource |
| PUT | `/resources/{id}` | Update a resource |
| DELETE | `/resources/{id}` | Delete a resource |

### Notes & Folders
| Method | Endpoint | Description |
|---|---|---|
| GET | `/notes/` | List all notes |
| POST | `/notes/` | Create a note |
| PUT | `/notes/{id}` | Update a note |
| DELETE | `/notes/{id}` | Delete a note |
| GET | `/folders/` | List all folders |
| POST | `/folders/` | Create a folder |
| PUT | `/folders/{id}` | Rename a folder |
| DELETE | `/folders/{id}` | Delete a folder |

### Roadmaps
| Method | Endpoint | Description |
|---|---|---|
| GET | `/roadmaps/` | List all roadmaps |
| POST | `/roadmaps/` | Create a roadmap |
| PUT | `/roadmaps/{id}` | Update a roadmap |
| DELETE | `/roadmaps/{id}` | Delete a roadmap |
| POST | `/roadmaps/{id}/steps` | Add a step |
| PUT | `/roadmaps/{id}/steps/{step_id}` | Update a step |
| DELETE | `/roadmaps/{id}/steps/{step_id}` | Delete a step |

### Other
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/stats` | Get learning statistics |
| GET | `/search/?q=query` | Search across all content |
| GET | `/u/{username}` | Get public profile |
| POST | `/assistant/chat` | Chat with AI assistant |

---

## Development

```bash
# Stop containers
docker compose down

# Stop and wipe database
docker compose down -v

# View logs
docker compose logs backend
docker compose logs frontend

# Rebuild after dependency changes
docker compose up --build
```

---

## License

MIT