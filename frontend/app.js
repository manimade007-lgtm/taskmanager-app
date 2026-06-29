const API = 'http://localhost:5001/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let allTasks = [];
let socket = null;

// ── Socket.io Real-time ───────────────────────────────────────
function initSocket() {
  socket = io('http://localhost:5001');
  socket.on('connect', () => console.log('Real-time connected ✅'));
  if (currentUser) socket.emit('join', currentUser.id);

  socket.on('taskCreated', (task) => {
    if (shouldShowTask(task)) {
      allTasks.unshift(task);
      renderDashboard();
      if (document.getElementById('page-tasks').classList.contains('active')) renderTasksList();
      toast('New task created in real-time! 🔔', 'info');
    }
  });

  socket.on('taskUpdated', (task) => {
    const idx = allTasks.findIndex(t => t._id === task._id);
    if (idx !== -1) { allTasks[idx] = task; renderDashboard(); renderTasksList(); }
  });

  socket.on('taskDeleted', ({ id }) => {
    allTasks = allTasks.filter(t => t._id !== id);
    renderDashboard(); renderTasksList();
  });
}

function shouldShowTask(task) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  return task.user === currentUser.id || task.user?._id === currentUser.id;
}

// ── Navigation ────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  if (name === 'dashboard') { loadStats(); loadAllTasks(); }
  if (name === 'tasks') { loadTasks(); }
  if (name === 'admin') { loadAdminTasks(); }
}

function updateNav() {
  const loggedIn = !!token;
  document.getElementById('nav-login').style.display = loggedIn ? 'none' : '';
  document.getElementById('nav-logout').style.display = loggedIn ? '' : 'none';
  document.getElementById('nav-tasks').style.display = loggedIn ? '' : 'none';
  document.getElementById('nav-dashboard').style.display = loggedIn ? '' : 'none';
  document.getElementById('nav-admin').style.display = (currentUser?.role === 'admin') ? '' : 'none';
  document.getElementById('nav-user').textContent = currentUser ? `👤 ${currentUser.name}` : '';
  if (currentUser) document.getElementById('welcome-msg').textContent = `Welcome, ${currentUser.name}! 👋`;
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  if (socket) socket.disconnect();
  updateNav(); showPage('auth');
}

// ── API Helper ────────────────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = type === 'success' ? '#38a169' : type === 'error' ? '#e53e3e' : type === 'info' ? '#3182ce' : '#2d3748';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Auth ──────────────────────────────────────────────────────
function authMode(mode) {
  document.getElementById('login-form').style.display = mode === 'login' ? '' : 'none';
  document.getElementById('register-form').style.display = mode === 'register' ? '' : 'none';
  document.querySelectorAll('.auth-toggle .tab-btn').forEach((b, i) =>
    b.classList.toggle('active', (i === 0) === (mode === 'login')));
  document.getElementById('auth-msg').textContent = '';
}

async function login(e) {
  e.preventDefault();
  try {
    const data = await apiFetch('/auth/login', 'POST', {
      email: document.getElementById('l-email').value,
      password: document.getElementById('l-password').value
    });
    token = data.token; currentUser = data.user;
    localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(currentUser));
    updateNav(); initSocket(); showPage('dashboard');
    toast(`Welcome back, ${currentUser.name}! 🎉`, 'success');
  } catch (err) { document.getElementById('auth-msg').textContent = err.message; }
}

async function register(e) {
  e.preventDefault();
  try {
    const data = await apiFetch('/auth/register', 'POST', {
      name: document.getElementById('r-name').value,
      email: document.getElementById('r-email').value,
      password: document.getElementById('r-password').value,
      role: document.getElementById('r-role').value
    });
    token = data.token; currentUser = data.user;
    localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(currentUser));
    updateNav(); initSocket(); showPage('dashboard');
    toast(`Welcome, ${currentUser.name}! 🎉`, 'success');
  } catch (err) { document.getElementById('auth-msg').textContent = err.message; }
}

// ── Stats ─────────────────────────────────────────────────────
async function loadStats() {
  if (!token) return;
  try {
    const s = await apiFetch('/tasks/stats');
    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card total"><div class="stat-num" style="color:#667eea">${s.total}</div><div class="stat-label">Total Tasks</div></div>
      <div class="stat-card todo"><div class="stat-num" style="color:#d69e2e">${s.todo}</div><div class="stat-label">To Do</div></div>
      <div class="stat-card inprogress"><div class="stat-num" style="color:#3182ce">${s.inProgress}</div><div class="stat-label">In Progress</div></div>
      <div class="stat-card completed"><div class="stat-num" style="color:#38a169">${s.completed}</div><div class="stat-label">Completed</div></div>
    `;
  } catch {}
}

// ── Tasks ─────────────────────────────────────────────────────
async function loadAllTasks() {
  if (!token) return;
  try {
    allTasks = await apiFetch('/tasks');
    renderDashboard();
  } catch { toast('Failed to load tasks', 'error'); }
}

function renderDashboard() {
  const todo = allTasks.filter(t => t.status === 'todo');
  const inprog = allTasks.filter(t => t.status === 'in-progress');
  const done = allTasks.filter(t => t.status === 'completed');

  document.getElementById('count-todo').textContent = todo.length;
  document.getElementById('count-inprogress').textContent = inprog.length;
  document.getElementById('count-completed').textContent = done.length;

  document.getElementById('list-todo').innerHTML = todo.length ? todo.map(taskCard).join('') : '<div class="empty-state">No tasks</div>';
  document.getElementById('list-inprogress').innerHTML = inprog.length ? inprog.map(taskCard).join('') : '<div class="empty-state">No tasks</div>';
  document.getElementById('list-completed').innerHTML = done.length ? done.map(taskCard).join('') : '<div class="empty-state">No tasks</div>';

  loadStats();
}

function taskCard(t) {
  const due = t.dueDate ? new Date(t.dueDate) : null;
  const isOverdue = due && due < new Date() && t.status !== 'completed';
  const dueStr = due ? due.toLocaleDateString() : '';
  return `<div class="task-card ${t.priority}" onclick="openTaskModal('${t._id}')">
    <h4>${t.title}</h4>
    ${t.description ? `<div style="font-size:0.82rem;color:#718096;margin-top:0.2rem">${t.description.substring(0, 60)}${t.description.length > 60 ? '...' : ''}</div>` : ''}
    <div class="task-meta">
      <span class="badge badge-${t.priority}">${t.priority}</span>
      <span class="badge badge-category">${t.category}</span>
      ${dueStr ? `<span class="badge badge-due ${isOverdue ? 'overdue' : ''}">📅 ${dueStr}</span>` : ''}
    </div>
    <div class="task-actions" onclick="event.stopPropagation()">
      ${t.status !== 'completed' ? `<button class="btn-status" onclick="quickStatus('${t._id}','${t.status === 'todo' ? 'in-progress' : 'completed'}')">
        ${t.status === 'todo' ? '▶ Start' : '✓ Done'}
      </button>` : ''}
      <button class="btn-edit" onclick="openTaskModal('${t._id}')">✏️ Edit</button>
      <button class="btn-delete" onclick="deleteTask('${t._id}')">🗑️</button>
    </div>
  </div>`;
}

function taskRow(t) {
  const due = t.dueDate ? new Date(t.dueDate) : null;
  const isOverdue = due && due < new Date() && t.status !== 'completed';
  const dueStr = due ? due.toLocaleDateString() : '';
  const statusLabel = { 'todo': '📋 To Do', 'in-progress': '🔄 In Progress', 'completed': '✅ Done' };
  return `<div class="task-row ${t.priority}">
    <div class="task-info">
      <h4>${t.title}</h4>
      <div class="task-meta">
        <span class="badge badge-${t.priority}">${t.priority}</span>
        <span class="badge badge-category">${t.category}</span>
        <span class="badge" style="background:#e2e8f0;color:#4a5568">${statusLabel[t.status]}</span>
        ${dueStr ? `<span class="badge badge-due ${isOverdue ? 'overdue' : ''}">📅 ${dueStr}</span>` : ''}
        ${t.user?.name ? `<span class="badge" style="background:#e9d8fd;color:#553c9a">👤 ${t.user.name}</span>` : ''}
      </div>
    </div>
    <div class="task-controls">
      ${t.status !== 'completed' ? `<button class="btn-status" onclick="quickStatus('${t._id}','${t.status === 'todo' ? 'in-progress' : 'completed'}')">
        ${t.status === 'todo' ? '▶ Start' : '✓ Done'}
      </button>` : ''}
      <button class="btn-edit" onclick="openTaskModal('${t._id}')">✏️</button>
      <button class="btn-delete" onclick="deleteTask('${t._id}')">🗑️</button>
    </div>
  </div>`;
}

async function loadTasks() {
  if (!token) return;
  const search = document.getElementById('search-input')?.value || '';
  const status = document.getElementById('filter-status')?.value || '';
  const priority = document.getElementById('filter-priority')?.value || '';
  const category = document.getElementById('filter-category')?.value || '';
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  if (priority) query.set('priority', priority);
  if (category) query.set('category', category);
  try {
    const tasks = await apiFetch('/tasks?' + query);
    renderTasksListData(tasks);
  } catch { toast('Failed to load tasks', 'error'); }
}

function renderTasksList() {
  const search = document.getElementById('search-input')?.value?.toLowerCase() || '';
  const status = document.getElementById('filter-status')?.value || '';
  const priority = document.getElementById('filter-priority')?.value || '';
  let filtered = allTasks;
  if (search) filtered = filtered.filter(t => t.title.toLowerCase().includes(search));
  if (status) filtered = filtered.filter(t => t.status === status);
  if (priority) filtered = filtered.filter(t => t.priority === priority);
  renderTasksListData(filtered);
}

function renderTasksListData(tasks) {
  const el = document.getElementById('tasks-list');
  if (!el) return;
  el.innerHTML = tasks.length ? tasks.map(taskRow).join('') : '<div class="empty-state">No tasks found. Create one!</div>';
}

// ── Task Modal ────────────────────────────────────────────────
function openTaskModal(id = null) {
  if (!token) { toast('Please login first', 'error'); showPage('auth'); return; }
  const modal = document.getElementById('task-modal');
  document.getElementById('task-form').reset();
  document.getElementById('task-id').value = '';

  if (id) {
    const task = allTasks.find(t => t._id === id);
    if (task) {
      document.getElementById('modal-title').textContent = 'Edit Task';
      document.getElementById('task-submit-btn').textContent = 'Update Task';
      document.getElementById('task-id').value = task._id;
      document.getElementById('t-title').value = task.title;
      document.getElementById('t-desc').value = task.description || '';
      document.getElementById('t-status').value = task.status;
      document.getElementById('t-priority').value = task.priority;
      document.getElementById('t-category').value = task.category || 'General';
      if (task.dueDate) document.getElementById('t-due').value = task.dueDate.split('T')[0];
    }
  } else {
    document.getElementById('modal-title').textContent = 'New Task';
    document.getElementById('task-submit-btn').textContent = 'Create Task';
  }
  modal.style.display = 'flex';
}

function closeModal(e) {
  if (e.target.id === 'task-modal') document.getElementById('task-modal').style.display = 'none';
}

async function saveTask(e) {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const body = {
    title: document.getElementById('t-title').value,
    description: document.getElementById('t-desc').value,
    status: document.getElementById('t-status').value,
    priority: document.getElementById('t-priority').value,
    category: document.getElementById('t-category').value,
    dueDate: document.getElementById('t-due').value || null
  };
  try {
    await apiFetch(id ? `/tasks/${id}` : '/tasks', id ? 'PUT' : 'POST', body);
    document.getElementById('task-modal').style.display = 'none';
    toast(id ? 'Task updated! ✅' : 'Task created! 🎉', 'success');
    if (!id) { await loadAllTasks(); }
  } catch (err) { toast(err.message, 'error'); }
}

async function quickStatus(id, newStatus) {
  try {
    await apiFetch(`/tasks/${id}`, 'PUT', { status: newStatus });
    toast(newStatus === 'completed' ? 'Task completed! 🎉' : 'Task started! ▶', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await apiFetch(`/tasks/${id}`, 'DELETE');
    toast('Task deleted', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

// ── Admin ─────────────────────────────────────────────────────
function adminTab(tab) {
  document.getElementById('admin-tasks-panel').style.display = tab === 'tasks' ? '' : 'none';
  document.getElementById('admin-users-panel').style.display = tab === 'users' ? '' : 'none';
  document.querySelectorAll('.admin-tabs .tab-btn').forEach((b, i) =>
    b.classList.toggle('active', (i === 0) === (tab === 'tasks')));
  if (tab === 'users') loadAdminUsers();
}

async function loadAdminTasks() {
  try {
    const tasks = await apiFetch('/tasks');
    document.getElementById('admin-tasks-list').innerHTML = tasks.length
      ? tasks.map(taskRow).join('') : '<div class="empty-state">No tasks</div>';
  } catch { toast('Failed to load tasks', 'error'); }
}

async function loadAdminUsers() {
  try {
    const users = await apiFetch('/users');
    document.getElementById('admin-users-list').innerHTML = users.map(u => `
      <div class="user-card">
        <div class="user-info">
          <strong>${u.name}</strong>
          <span style="font-size:0.85rem;color:#718096">${u.email}</span>
        </div>
        <div style="display:flex;align-items:center;gap:0.8rem">
          <span class="user-role role-${u.role}">${u.role}</span>
          <button class="btn-delete" onclick="deleteUser('${u._id}')">🗑️</button>
        </div>
      </div>`).join('');
  } catch { toast('Failed to load users', 'error'); }
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  try { await apiFetch(`/users/${id}`, 'DELETE'); toast('User deleted'); loadAdminUsers(); }
  catch (err) { toast(err.message, 'error'); }
}

// ── Init ──────────────────────────────────────────────────────
updateNav();
if (token) { initSocket(); showPage('dashboard'); }
else showPage('auth');
