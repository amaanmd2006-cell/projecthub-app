const API_URL = 'http://localhost:5000/api';

let token = localStorage.getItem('token') || null;
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let currentProject = null;

// ---- Elements ----
const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const authError = document.getElementById('authError');
const userNameEl = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');

const projectsView = document.getElementById('projectsView');
const newProjectPanel = document.getElementById('newProjectPanel');
const boardView = document.getElementById('boardView');

// ---- Auth tab switching ----
loginTab.addEventListener('click', () => switchAuthTab('login'));
registerTab.addEventListener('click', () => switchAuthTab('register'));

function switchAuthTab(tab) {
  loginTab.classList.toggle('active', tab === 'login');
  registerTab.classList.toggle('active', tab === 'register');
  loginForm.classList.toggle('hidden', tab !== 'login');
  registerForm.classList.toggle('hidden', tab !== 'register');
}

// ---- Auth ----
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    setSession(data.token, data.user);
    showApp();
  } catch (err) {
    showAuthError(err.message);
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    setSession(data.token, data.user);
    showApp();
  } catch (err) {
    showAuthError(err.message);
  }
});

function setSession(tok, user) {
  token = tok;
  currentUser = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(currentUser));
}

function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

logoutBtn.addEventListener('click', () => {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  appScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
});

function showApp() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  userNameEl.textContent = currentUser.name;
  showView('projects');
  loadProjects();
}

function showView(name) {
  [projectsView, newProjectPanel, boardView].forEach(v => v.classList.add('hidden'));
  if (name === 'projects') projectsView.classList.remove('hidden');
  if (name === 'newProject') newProjectPanel.classList.remove('hidden');
  if (name === 'board') boardView.classList.remove('hidden');
}

// ---- Projects list ----
async function loadProjects() {
  const res = await fetch(`${API_URL}/projects`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const projects = await res.json();

  const container = document.getElementById('projectList');
  container.innerHTML = '';

  if (projects.length === 0) {
    container.innerHTML = '<p style="color:#9a9ab0;">No projects yet. Create your first one!</p>';
    return;
  }

  projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.description)}</p>
      <div class="stats">
        <span>${p.taskCount} task${p.taskCount !== 1 ? 's' : ''}</span>
        <span>${p.members.length} member${p.members.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="avatar-row">
        ${p.members.map(m => `<div class="avatar" title="${escapeHtml(m.name)}">${initials(m.name)}</div>`).join('')}
      </div>
    `;
    card.addEventListener('click', () => openProject(p.id));
    container.appendChild(card);
  });
}

document.getElementById('newProjectBtn').addEventListener('click', () => showView('newProject'));
document.getElementById('cancelNewProject').addEventListener('click', () => showView('projects'));

document.getElementById('projectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('projectName').value;
  const description = document.getElementById('projectDesc').value;

  await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ name, description })
  });

  document.getElementById('projectForm').reset();
  showView('projects');
  loadProjects();
});

document.getElementById('backToProjectsBtn').addEventListener('click', () => {
  showView('projects');
  loadProjects();
});

// ---- Single project board ----
async function openProject(projectId) {
  const res = await fetch(`${API_URL}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const project = await res.json();
  currentProject = project;

  document.getElementById('boardProjectName').textContent = project.name;
  document.getElementById('boardProjectDesc').textContent = project.description;

  const chipsContainer = document.getElementById('memberChips');
  chipsContainer.innerHTML = project.members.map(m =>
    `<div class="chip"><div class="avatar" style="margin:0;">${initials(m.name)}</div> ${escapeHtml(m.name)}</div>`
  ).join('');

  const assigneeSelect = document.getElementById('taskAssignee');
  assigneeSelect.innerHTML = project.members.map(m =>
    `<option value="${m.id}">${escapeHtml(m.name)}</option>`
  ).join('');

  renderBoard(project.tasks, project.members);
  showView('board');
}

function renderBoard(tasks, members) {
  ['todo', 'in-progress', 'done'].forEach(status => {
    const col = document.getElementById('col-' + status);
    col.innerHTML = '';
    tasks.filter(t => t.status === status).forEach(task => {
      const assignee = members.find(m => m.id === task.assigneeId);
      const card = document.createElement('div');
      card.className = 'task-card';
      card.innerHTML = `
        <h4>${escapeHtml(task.title)}</h4>
        <div class="assignee">👤 ${assignee ? escapeHtml(assignee.name) : 'Unassigned'}</div>
        ${task.dueDate ? `<div class="due">📅 Due ${task.dueDate}</div>` : ''}
        <div class="task-actions">
          <select data-id="${task.id}" class="status-select">
            <option value="todo" ${status === 'todo' ? 'selected' : ''}>To Do</option>
            <option value="in-progress" ${status === 'in-progress' ? 'selected' : ''}>In Progress</option>
            <option value="done" ${status === 'done' ? 'selected' : ''}>Done</option>
          </select>
          <button class="delete-btn" data-id="${task.id}">Delete</button>
        </div>
      `;
      col.appendChild(card);
    });
  });

  document.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', () => updateTaskStatus(sel.dataset.id, sel.value));
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.id));
  });
}

document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('taskTitle').value;
  const assigneeId = document.getElementById('taskAssignee').value;
  const dueDate = document.getElementById('taskDueDate').value;

  await fetch(`${API_URL}/projects/${currentProject.id}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ title, assigneeId, dueDate })
  });

  document.getElementById('taskForm').reset();
  openProject(currentProject.id);
});

async function updateTaskStatus(taskId, status) {
  await fetch(`${API_URL}/tasks/${taskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });
  openProject(currentProject.id);
}

async function deleteTask(taskId) {
  await fetch(`${API_URL}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  openProject(currentProject.id);
}

document.getElementById('addMemberBtn').addEventListener('click', async () => {
  const email = prompt('Enter the email of the person to add (they must already have an account):');
  if (!email) return;

  const res = await fetch(`${API_URL}/projects/${currentProject.id}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (!res.ok) { alert(data.message); return; }

  openProject(currentProject.id);
});

// ---- Helpers ----
function initials(name) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ---- Init ----
if (token && currentUser) {
  showApp();
}
