# Tixora V1 — Local Development & Docker Deployment Guide

## Option 1: Instant Local Development (Zero External Setup Required)

1. Install dependencies from the monorepo root:
   ```bash
   npm install
   ```
2. Start the backend API (`http://localhost:8080`) and frontend (`http://localhost:3000`):
   ```bash
   npm run dev:api
   npm run dev:web
   ```
   *Note*: If `DATABASE_URL` is not set in `.env`, the API automatically boots with an embedded PostgreSQL 16 engine (`PGlite`), runs `V1__init_schema.sql`, and seeds all demo accounts, movies, cinemas, screens, and showtimes.

## Option 2: Connect to Local or External PostgreSQL 16/17

Set `DATABASE_URL` in `.env` (copied from `.env.example`):
```env
DATABASE_URL=postgresql://tixora:tixora_secret_dev_password@localhost:5432/tixora
```
The API will automatically run `V1__init_schema.sql` and seed demo data on startup.

## Option 3: Full Docker Compose Stack

```bash
cp .env.example .env
docker compose up --build -d
```
- **Web App**: `http://localhost:3000`
- **REST API**: `http://localhost:8080/api/v1`
- **Swagger / OpenAPI UI**: `http://localhost:8080/api-docs`
- **Health Check**: `http://localhost:8080/api/v1/health`

