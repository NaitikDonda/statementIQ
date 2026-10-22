# StatementIQ

Project workspace for analyzing financial statements.

## Project Structure

This is a monorepo with separate frontend and backend applications:

- `frontend/` — React, TypeScript, and Vite application (deployed to Vercel)
- `backend/` — FastAPI Python backend (deployed to Render)
- `notebooks/` — analysis notebook
- `data/` — sample statement files (legacy)

## Application

StatementIQ is a React, TypeScript, and Vite financial research interface backed by
FastAPI and SQLite. The API retrieves passages from indexed financial statements,
asks a locally configured Ollama model to answer from that evidence, checks source
citation IDs, and asks the same local model to review factual claims. Analyses,
evidence, and citation-check results are stored in SQLite.

## Local Development

Requirements: Python 3.9+, Node.js 18+, npm, and an Ollama-compatible server with
the configured language and embedding models available.

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Copy `.env.example` to `.env` and adjust the backend model settings if needed:
   ```bash
   cp .env.example .env
   ```

3. Install Python dependencies:
   ```bash
   python -m pip install -r requirements.txt
   ```

4. Start the FastAPI backend:
   ```bash
   python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Install dependencies:
   ```bash
   npm ci
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```

5. Open the local URL printed by Vite. Its `/api` requests are proxied to
   FastAPI on port 8000. The backend health endpoint is `/api/health`.

## Deployment

### Frontend (Vercel)

The frontend is configured for Vercel deployment:

1. Connect your GitHub repository to Vercel
2. Import the `frontend/` directory as a Vercel project
3. Set the environment variable `VITE_API_URL` to your deployed backend URL
4. Deploy

### Backend (Render)

The backend is configured for Render deployment:

1. Connect your GitHub repository to Render
2. Create a new web service from the `backend/` directory
3. Use the existing `render.yaml` configuration
4. Set the required environment variables (especially `OLLAMA_BASE_URL`)
5. Deploy

## Environment Variables

### Backend (.env)

- `OLLAMA_BASE_URL` — Ollama server URL (default: http://localhost:11434)
- `LLM_MODEL` — Language model name (default: gemma4:e4b)
- `EMBED_MODEL` — Embedding model name (default: nomic-embed-text)
- `DATABASE_PATH` — SQLite database path
- `UPLOAD_DIR` — Upload directory for PDFs
- `LEGACY_INDEX_PATH` — Path to legacy embeddings CSV
- `MAX_UPLOAD_MB` — Maximum upload size in MB (default: 100)

### Frontend (.env)

- `VITE_API_URL` — Backend API URL (default: http://localhost:8000)

## Ollama Configuration

The default Ollama address is `http://localhost:11434`; the configured models
default to `gemma4:e4b` and `nomic-embed-text`. Install those models in Ollama
before uploading or asking questions. The UI reports model connection failures;
it does not fall back to a hosted model or produce placeholder answers.

## API Routes

- `GET /api/health`
- `GET /api/documents` and `GET /api/documents/{document_id}`
- `POST /api/documents/upload` and `DELETE /api/documents/{document_id}`
- `POST /api/query`
- `GET /api/history` and `GET /api/history/{analysis_id}`
- `DELETE /api/history/{analysis_id}`
