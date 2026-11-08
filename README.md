# Hifz Tracker

A bilingual (English / Arabic) web app to track Quran memorization progress for the 1337 school club.
Students follow their own stats; admins manage weekly sessions and monitor every student's activity.

## Stack
- **Database:** Turso (libSQL)
- **Backend:** FastAPI (Python)
- **Frontend:** React + TypeScript (Vite), Tailwind CSS, react-i18next (EN/AR, RTL)

## Project structure
```
backend/    FastAPI app, migrations, scripts
frontend/   React + TypeScript app
docs/       Project specification
```

## Getting started
### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your Turso credentials
uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs

### Frontend
Coming in the next phase.

## Documentation
Full specification: [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md)
