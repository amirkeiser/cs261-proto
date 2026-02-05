https://github.com/user-attachments/assets/3f0bfbbe-06db-47a8-9390-05b34b1d95b0


# Airport Simulation Prototype (UI is ass)

An airport simulation with a Python (FastAPI + SimPy) backend and a React/TypeScript frontend connected via WebSockets.

## Setup

### Backend

```bash
cd backend
pip install -e .
uvicorn app.main:app --reload
```

Runs on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` and connects to the backend automatically.
