# ProjectHub — Project Management Portal

A complete full stack project management app: create projects, add team members, assign tasks, and track progress on a kanban-style board.

## Tech stack (maps to 4 core subjects)
1. **Frontend** — HTML5, CSS3, vanilla JavaScript (`frontend/`)
2. **Backend / Server** — Node.js + Express REST API (`backend/server.js`)
3. **Database** — JSON file-based data store (`backend/data/db.json`), storing users, projects, and tasks
4. **Authentication & Security** — JWT tokens + bcrypt password hashing

## How to run

### 1. Backend
```
cd backend
npm install
npm start
```
Runs on `http://localhost:5000`

### 2. Frontend
Open `frontend/index.html` in your browser

### 3. Login
Two demo accounts are pre-seeded so you can test real multi-user collaboration:
- `demo@projecthub.com` / `demo1234`
- `riya@projecthub.com` / `demo1234`

Open the app in two separate browser tabs, log in as each user, and see them collaborate on the same project (add each other as members, assign tasks to one another, watch task status update).

## Features
- User registration & login (JWT-based auth, bcrypt password hashing)
- Create projects — you become the owner automatically
- Add team members to a project by email (real collaboration, not just personal task lists)
- Create tasks and assign them to any project member
- Kanban board: To Do / In Progress / Done — change status from a dropdown on each task
- Only the project owner can delete the project or add new members
- Any project member can create, edit, or delete tasks

## Project structure
```
projecthub/
├── backend/
│   ├── server.js       # Express app: auth, projects, members, tasks
│   ├── db.js            # simple JSON-file DB helper
│   ├── package.json
│   └── data/db.json      # "database" — users, projects, tasks
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js            # calls the API with fetch()
```

## Notes for submission
- Push this whole folder to a GitHub repo and submit that repo link.
- This project genuinely demonstrates multi-user collaboration (shared projects, task assignment between team members) — so it also fits a "Task Collaboration Tool" requirement, not just general project management.
- For a live demo link: deploy the backend on Render/Railway and the frontend on Vercel/Netlify (update `API_URL` in `app.js` to the deployed backend URL).
