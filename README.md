# DevTrack — Developer Learning Tracker

A full-stack web application for developers to track their learning journey. Log daily progress, manage topics, save useful resources, and visualize your growth over time.

---

## Screenshots

> Add screenshots of your app here after deployment.

---

## Features

- **Authentication** — Register, login, and JWT-protected routes
- **Topics** — Create and manage learning topics with difficulty levels and status tracking
- **Daily Logs** — Write daily learning entries with time tracking per topic
- **Resources** — Save useful links, videos, articles, and docs linked to topics
- **Dashboard** — Visual overview of hours spent, topics in progress, and weekly activity chart
- **Dark / Light mode** — Persistent theme toggle

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| FastAPI | REST API framework |
| PostgreSQL | Relational database |
| SQLAlchemy | ORM |
| Pydantic v2 | Data validation and schemas |
| PyJWT + Passlib | Authentication and password hashing |
| Uvicorn | ASGI server |

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| React Router v6 | Client-side routing |
| Axios | HTTP client with JWT interceptor |
| Recharts | Dashboard charts |
| TailwindCSS | Utility-first styling |

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
│   │   └── dashboard.py
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
│   │   │   └── ConfirmDialog.jsx
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Topics.jsx
│   │   │   ├── Logs.jsx
│   │   │   └── Resources.jsx
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
| PUT | `/topics/{id}` | Update a topic |
| DELETE | `/topics/{id}` | Delete a topic |

### Logs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/logs/` | List all logs |
| POST | `/logs/` | Create a log entry |
| GET | `/logs/{id}` | Get a log |
| PUT | `/logs/{id}` | Update a log |
| DELETE | `/logs/{id}` | Delete a log |

### Resources
| Method | Endpoint | Description |
|---|---|---|
| GET | `/resources/` | List all resources |
| POST | `/resources/` | Save a resource |
| GET | `/resources/{id}` | Get a resource |
| PUT | `/resources/{id}` | Update a resource |
| DELETE | `/resources/{id}` | Delete a resource |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/stats` | Get learning statistics |

---

## Development

To stop the application:
```bash
docker compose down
```

To stop and remove all data (including the database):
```bash
docker compose down -v
```

To view logs:
```bash
docker compose logs backend
docker compose logs frontend
```

---

## License

MIT