# Reimagined Disco Jobs

Background jobs runner for the Reimagined Disco platform. Runs as a Kubernetes CronJob: on each invocation it claims the first eligible pending job from the queue, executes it, and exits.

## How it works

1. On startup, calls `POST /api/jobs/claim` on the API — atomically claims the oldest pending job whose type is not already running.
2. Dispatches to the appropriate handler.
3. On completion, updates the job status to `done` or `error` via `PATCH /api/jobs/:id`.
4. Exits.

If there are no pending jobs, it exits immediately.

The pod does **not** access the database directly — all data operations go through the API using a bearer token.

## Job types

| Name | Description |
|------|-------------|
| `filescan` | Scans the music folder, syncs new/changed/removed files with the library |
| `fullscan` | Same as `filescan` but re-reads ID3 tags for every file regardless of changes |
| `id3write` | Writes user-edited ID3 tags to audio files; processes all pending rows from `user_id3`; NULL fields are skipped |

## Stack

- **Runtime**: Node.js (built-in `fetch`, no extra HTTP client needed)
- **ID3 parsing**: node-id3
- **Logging**: pino

## Environment Variables

| Variable | Description |
|----------|-------------|
| `API_URL` | Base URL of the API (e.g. `http://api-svc.reimagined-disco.svc.cluster.local:80`) |
| `API_TOKEN` | Bearer token for internal API authentication |
| `LOG_LEVEL` | Log verbosity (`trace`, `debug`, `info`, `warn`, `error`) |

## Build

```bash
docker build -t reimagined-disco-jobs:v0.0.1 -f .docker/Dockerfile .
```

## Run locally

```bash
npm start
```

## Triggering a job manually

Insert a row in the `jobs` table — the next CronJob invocation (every 5 minutes) will pick it up:

```sql
INSERT INTO jobs (name, "when", status) VALUES ('filescan', NOW(), 'pending');
```
