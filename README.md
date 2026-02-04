# SolarEPC Pro

Commercial & utility-scale solar EPC operating system.

## Project Structure

```
solarepc-pro/
├── backend/          # FastAPI backend
│   ├── app/
│   │   ├── api/      # Route handlers
│   │   ├── core/     # Config, security, deps
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # Business logic
│   │   └── main.py
│   ├── tests/
│   ├── alembic/      # DB migrations
│   └── requirements.txt
├── frontend/         # Next.js frontend
│   ├── src/
│   │   ├── app/      # App router pages
│   │   ├── components/
│   │   ├── lib/      # API client, utils
│   │   └── types/
│   └── package.json
└── docker-compose.yml
```

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: FastAPI, SQLAlchemy, Pydantic
- **Database**: PostgreSQL
- **Auth**: Firebase Authentication
- **Workers**: Celery + Redis
