const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readDB, writeDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'projecthub_super_secret_key_change_me';

app.use(cors());
app.use(bodyParser.json());

// ---- Seed demo users with real bcrypt hashes on first boot ----
function ensureSeed() {
  const db = readDB();
  let changed = false;
  db.users.forEach(u => {
    if (!u.password.startsWith('$2a$')) {
      u.password = bcrypt.hashSync('demo1234', 10);
      changed = true;
    }
  });
  if (changed) writeDB(db);
}
ensureSeed();

// ---- Auth middleware ----
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ message: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email };
}

// ---- AUTH ROUTES ----

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  const db = readDB();
  const exists = db.users.find(u => u.email === email);
  if (exists) return res.status(400).json({ message: 'Email already registered' });

  const hashed = bcrypt.hashSync(password, 10);
  const newUser = { id: 'u' + Date.now(), name, email, password: hashed };
  db.users.push(newUser);
  writeDB(db);

  const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: publicUser(newUser) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(400).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: publicUser(user) });
});

// Find a user by email (used to add a member to a project)
app.get('/api/users/lookup', authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.email === req.query.email);
  if (!user) return res.status(404).json({ message: 'No user found with that email' });
  res.json(publicUser(user));
});

// ---- PROJECT ROUTES ----

// Get all projects the logged-in user is a member of
app.get('/api/projects', authMiddleware, (req, res) => {
  const db = readDB();
  const myProjects = db.projects.filter(p => p.memberIds.includes(req.userId));
  const enriched = myProjects.map(p => ({
    ...p,
    members: p.memberIds.map(id => db.users.find(u => u.id === id)).filter(Boolean).map(publicUser),
    taskCount: db.tasks.filter(t => t.projectId === p.id).length
  }));
  res.json(enriched);
});

// Get single project detail (with tasks + members)
app.get('/api/projects/:id', authMiddleware, (req, res) => {
  const db = readDB();
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (!project.memberIds.includes(req.userId)) return res.status(403).json({ message: 'Not a member of this project' });

  const members = project.memberIds.map(id => db.users.find(u => u.id === id)).filter(Boolean).map(publicUser);
  const tasks = db.tasks.filter(t => t.projectId === project.id);

  res.json({ ...project, members, tasks });
});

// Create project (creator becomes owner + first member)
app.post('/api/projects', authMiddleware, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Project name is required' });

  const db = readDB();
  const newProject = {
    id: 'p' + Date.now(),
    name,
    description: description || '',
    ownerId: req.userId,
    memberIds: [req.userId],
    createdAt: new Date().toISOString()
  };
  db.projects.push(newProject);
  writeDB(db);
  res.status(201).json(newProject);
});

// Add a member to a project (by email) — only owner can do this
app.post('/api/projects/:id/members', authMiddleware, (req, res) => {
  const { email } = req.body;
  const db = readDB();
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (project.ownerId !== req.userId) return res.status(403).json({ message: 'Only the project owner can add members' });

  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ message: 'No user found with that email. They need to register first.' });
  if (project.memberIds.includes(user.id)) return res.status(400).json({ message: 'User is already a member' });

  project.memberIds.push(user.id);
  writeDB(db);
  res.json({ message: 'Member added', member: publicUser(user) });
});

// Delete project — only owner
app.delete('/api/projects/:id', authMiddleware, (req, res) => {
  const db = readDB();
  const index = db.projects.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Project not found' });
  if (db.projects[index].ownerId !== req.userId) return res.status(403).json({ message: 'Only the owner can delete this project' });

  db.projects.splice(index, 1);
  db.tasks = db.tasks.filter(t => t.projectId !== req.params.id);
  writeDB(db);
  res.json({ message: 'Project deleted' });
});

// ---- TASK ROUTES ----

// Create a task in a project (any member can create + assign to any member)
app.post('/api/projects/:id/tasks', authMiddleware, (req, res) => {
  const { title, description, assigneeId, dueDate } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });

  const db = readDB();
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (!project.memberIds.includes(req.userId)) return res.status(403).json({ message: 'Not a member of this project' });

  const newTask = {
    id: 't' + Date.now(),
    projectId: req.params.id,
    title,
    description: description || '',
    status: 'todo',
    assigneeId: assigneeId || req.userId,
    dueDate: dueDate || null,
    createdAt: new Date().toISOString()
  };
  db.tasks.push(newTask);
  writeDB(db);
  res.status(201).json(newTask);
});

// Update task (status change, reassignment, edits) — any project member
app.put('/api/tasks/:id', authMiddleware, (req, res) => {
  const db = readDB();
  const task = db.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });

  const project = db.projects.find(p => p.id === task.projectId);
  if (!project || !project.memberIds.includes(req.userId)) {
    return res.status(403).json({ message: 'Not a member of this project' });
  }

  const { title, description, status, assigneeId, dueDate } = req.body;
  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (status !== undefined) task.status = status;
  if (assigneeId !== undefined) task.assigneeId = assigneeId;
  if (dueDate !== undefined) task.dueDate = dueDate;

  writeDB(db);
  res.json(task);
});

// Delete task — any project member
app.delete('/api/tasks/:id', authMiddleware, (req, res) => {
  const db = readDB();
  const task = db.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });

  const project = db.projects.find(p => p.id === task.projectId);
  if (!project || !project.memberIds.includes(req.userId)) {
    return res.status(403).json({ message: 'Not a member of this project' });
  }

  db.tasks = db.tasks.filter(t => t.id !== req.params.id);
  writeDB(db);
  res.json({ message: 'Task deleted' });
});

app.get('/', (req, res) => {
  res.send('ProjectHub API is running');
});

app.listen(PORT, () => {
  console.log(`ProjectHub backend running on http://localhost:${PORT}`);
});
