# Freelancer Project & Client Management System

A beginner-friendly full-stack app for managing freelancer clients, projects, tasks, invoices, and payments. It uses React, Express, and SQLite.

## Requirements

- Node.js 20.19 or newer, or 22.12 or newer
- npm

## Run locally

Open a terminal in the project folder and run:

```sh
npm install
npm run install:all
```

Copy `backend/.env.example` to `backend/.env`. The example values work for local development; replace `JWT_SECRET` with a long random value before deployment.

```sh
npm run dev
```

The React app runs at `http://localhost:5173` and the API at `http://localhost:4000`. On the first API start, SQLite creates `backend/data/freelancer.sqlite` and adds demo users and sample data. The database file is ignored by Git so local data is not accidentally committed.

To create a production frontend build, run `npm run build`. To run the API without watch mode, run `npm start`.

Run the backend workflow test with `npm test --prefix backend`. It uses a temporary SQLite database and does not change the app's demo data.

## Demo accounts

All demo accounts use the password `demo123`.

| Role | Email |
| --- | --- |
| Freelancer | `freelancer@demo.com` |
| Client | `client@demo.com` |
| Admin | `admin@demo.com` |

## Features

- Client profiles can be created, viewed, and edited.
- Projects have a client, budget, deadline, status, description, and optional URL or uploaded deliverable.
- Project titles are unique per client (case-insensitive).
- Tasks move between To Do, In Progress, and Completed.
- Invoices can be created after a project has completed work; invoice totals cannot exceed the project budget.
- Payments update invoice status to Pending, Partially Paid, or Paid; overpayments are rejected.
- Dashboard summarizes earnings, active projects, outstanding invoices, and task progress.
- Project history records project, task, invoice, and payment changes.
- Client access is limited to the linked client profile and its related projects, tasks, invoices, and payments. Clients have read-only access.

## Database

SQLite is created automatically at `backend/data/freelancer.sqlite`. No separate database server is needed. To inspect tables, open that file with **DB Browser for SQLite** and choose **Database Structure** or **Browse Data**.

The database tables are `users`, `clients`, `projects`, `tasks`, `invoices`, `payments`, and `project_history`. Applied schema versions are recorded in `schema_migrations`; the initial schema is in [001_initial_schema.sql](./backend/migrations/001_initial_schema.sql).

## Environment variables

Set these in `backend/.env`:

| Variable | Purpose | Local default |
| --- | --- | --- |
| `PORT` | Express server port | `4000` |
| `JWT_SECRET` | Signs authentication tokens | Set a private random value |
| `DATABASE_FILE` | SQLite file location, relative to `backend/` unless absolute | `./data/freelancer.sqlite` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `UPLOAD_DIRECTORY` | Uploaded project attachment folder, relative to `backend/` unless absolute | `./uploads` |

For a separately hosted frontend, set `VITE_API_URL` to the full API base URL ending in `/api` before building the frontend and set `CORS_ORIGIN` to the frontend's deployed origin. Use persistent storage for the SQLite database and uploaded attachments when deploying; the API will not start in production without `JWT_SECRET`.

## API endpoints

All endpoints except `GET /api/health` and `POST /api/auth/login` require a Bearer token returned by login.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Check API status |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Get the signed-in user |
| GET | `/api/dashboard/summary` | Dashboard totals |
| GET, POST | `/api/clients` | List and create clients |
| PUT | `/api/clients/:id` | Edit a client |
| GET, POST | `/api/projects` | List and create projects |
| PATCH | `/api/projects/:id/status` | Change project status |
| GET | `/api/projects/:id/attachment` | Access an uploaded project deliverable |
| GET, POST | `/api/tasks` | List and create tasks |
| PUT | `/api/tasks/:id/status` | Change task status |
| GET, POST | `/api/invoices` | List and create invoices |
| GET, POST | `/api/payments` | List and record payments |
| GET | `/api/history?project_id=:id` | Get project history |

## Screenshots and submission links

Add screenshots of the running application here before submission. The deployment URL, GitHub repository URL, and video recording URL should be added here once those are created.
