const students = [
    "Аникієнко Богдан", "Безпалий Андрій", "Богомаз Діана", "Боровський Ростислав",
    "Вовнянко Владислав", "Грабовський Максим", "Гиренко Олександр", "Дяченко Валерій",
    "Зав'ялов Максим", "Здоровець Анна", "Іванов Назар", "Клименко Євгеній",
    "Ляпустін Всеволод", "Омельченко Єгор", "Погорільський Данило", "Сиротенко Тимур",
    "Соловський Володимир", "Тарасов Давид", "Холопов Дмитро", "Шпак Василь"
].sort((a, b) => a.localeCompare(b, 'uk'));

const adminNames = ["Здоровець Анна", "Гиренко Олександр"];
const ADMIN_PASSWORD = "qsc123esz123";
const STUDENT_PASSWORD = "student123";

let currentUser = null, userRole = null;
let sessions = JSON.parse(localStorage.getItem('attendanceSessions')) || [];
let reasons = JSON.parse(localStorage.getItem('attendanceReasons')) || {};
let actionLog = JSON.parse(localStorage.getItem('actionLog')) || [];
let currentHistoryFilter = 'all', currentReasonStudent = null, currentReasonSession = null;
let currentHistoryPage = 1;
const SESSIONS_PER_PAGE = 6;

document.addEventListener('DOMContentLoaded', () => { checkSavedSession(); initLogin(); });

function checkSavedSession() {
    const savedUser = sessionStorage.getItem('currentUser');
    const savedRole = sessionStorage.getItem('userRole');
    if (savedUser && savedRole) { currentUser = savedUser; userRole = savedRole; showMainApp(); }
}

function initLogin() {
    const userSelect = document.getElementById('userSelect');
    students.forEach(student => {
        const option = document.createElement('option');
        option.value = student; option.textContent = student;
        userSelect.appendChild(option);
    });
    document.getElementById('scheduleDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('scheduleCustomDate').value = new Date().toISOString().split('T')[0];
}

function loginUser() {
    const userName = document.getElementById('userSelect').value;
    const password = document.getElementById('userPassword').value;
    if (!userName) { showError('Оберіть себе зі списку!'); return; }
    if (!password) { showError('Введіть пароль!'); return; }

    if (adminNames.includes(userName)) {
        if (password !== ADMIN_PASSWORD) { showError('Невірний пароль адміністратора!'); return; }
        currentUser = userName; userRole = 'admin';
    } else {
        if (password !== STUDENT_PASSWORD) { showError('Невірний пароль!'); return; }
        currentUser = userName; userRole = 'student';
    }
    sessionStorage.setItem('currentUser', currentUser);
    sessionStorage.setItem('userRole', userRole);
    logAction(`Увійшов в систему`);
    showMainApp();
}

function showError(message) {
    const form = document.getElementById('loginForm');
    let errorDiv = form.querySelector('.error-message');
    if (!errorDiv) { errorDiv = document.createElement('div'); errorDiv.className = 'error-message'; form.insertBefore(errorDiv, form.firstChild); }
    errorDiv.textContent = message; errorDiv.classList.add('show');
    setTimeout(() => errorDiv.classList.remove('show'), 3000);
}

function showMainApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('currentUser').textContent = currentUser;
    const roleElement = document.getElementById('userRole');
    roleElement.textContent = userRole === 'admin' ? 'Адмін' : 'Студент';
    roleElement.className = 'user-role ' + (userRole === 'admin' ? 'admin' : '');

    if (userRole !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.admin-only-tab').forEach(el => el.classList.add('hidden'));
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.admin-only-tab').forEach(el => el.classList.remove('hidden'));
    }

    setupEventListeners();
    updateHeaderStats();
    updatePairSuggestions();
    updateAutocompleteLists();
    setupAutocompleteListeners();
    renderSchedule();
    renderSessions();
    renderHistory();
    renderAnalytics();
    if (userRole === 'student') showPersonalReport();
}

function logout() {
    logAction(`Вийшов з системи`);
    currentUser = null; userRole = null;
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('userRole');
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('userPassword').value = '';
    document.getElementById('userSelect').value = '';
}

function setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('hidden')) return;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
            if (btn.dataset.tab === 'charts') renderCharts();
            if (btn.dataset.tab === 'backup') updateBackupInfo();
            if (btn.dataset.tab === 'actions') renderActionLog();
            if (btn.dataset.tab === 'history') { currentHistoryPage = 1; renderHistory(); }
            if (btn.dataset.tab === 'schedule') renderSchedule();
            if (btn.dataset.tab === 'sessions') renderSessions();
            if (btn.dataset.tab === 'analytics') renderAnalytics();
        });
    });
    document.getElementById('searchSessions').addEventListener('input', renderSessions);
    document.getElementById('sortBy').addEventListener('change', renderSessions);
    document.getElementById('filterDate').addEventListener('change', renderSessions);
    const dateSearchInput = document.getElementById('dateSearch');
    if (dateSearchInput) dateSearchInput.addEventListener('change', renderSessions);
}

// ===== АВТОДОПОВНЕННЯ =====
function getUniqueValues() {
    const names = [...new Set(sessions.map(s => s.name).filter(n => n))];
    const teachers = [...new Set(sessions.map(s => s.teacher).filter(t => t))];
    const rooms = [...new Set(sessions.map(s => s.room).filter(r => r))];
    const times = [...new Set(sessions.map(s => s.time).filter(t => t))];
    return { names, teachers, rooms, times };
}

function updateAutocompleteLists() {
    const { names, teachers, rooms, times } = getUniqueValues();
    const nameDatalist = document.getElementById('nameSuggestions');
    if (nameDatalist) nameDatalist.innerHTML = names.map(name => `<option value="${name}">`).join('');
    const teacherDatalist = document.getElementById('teacherSuggestions');
    if (teacherDatalist) teacherDatalist.innerHTML = teachers.map(t => `<option value="${t}">`).join('');
    const roomDatalist = document.getElementById('roomSuggestions');
    if (roomDatalist) roomDatalist.innerHTML = rooms.map(r => `<option value="${r}">`).join('');
    const timeDatalist = document.getElementById('timeSuggestions');
    if (timeDatalist) timeDatalist.innerHTML = times.map(t => `<option value="${t}">`).join('');
}

function setupAutocompleteListeners() {
    const nameInput = document.getElementById('scheduleName');
    if (nameInput) {
        nameInput.addEventListener('input', function() {
            const selectedSession = sessions.find(s => s.name === this.value);
            if (selectedSession) {
                if (selectedSession.teacher && !document.getElementById('scheduleTeacher').value) {
                    const tInput = document.getElementById('scheduleTeacher');
                    tInput.value = selectedSession.teacher;
                    tInput.classList.add('autofilled');
                    setTimeout(() => tInput.classList.remove('autofilled'), 1500);
                }
                if (selectedSession.room && !document.getElementById('scheduleRoom').value) {
                    const rInput = document.getElementById('scheduleRoom');
                    rInput.value = selectedSession.room;
                    rInput.classList.add('autofilled');
                    setTimeout(() => rInput.classList.remove('autofilled'), 1500);
                }
                if (selectedSession.time && !document.getElementById('scheduleTime').value) {
                    const tInput = document.getElementById('scheduleTime');
                    tInput.value = selectedSession.time;
                    tInput.classList.add('autofilled');
                    setTimeout(() => tInput.classList.remove('autofilled'), 1500);
                }
                if (selectedSession.type) document.getElementById('scheduleType').value = selectedSession.type;
            }
        });
    }
}

// ===== ДОДАВАННЯ ПАР =====
function addScheduleSession() {
    if (userRole !== 'admin') { alert('Тільки адміністратори можуть додавати пари!'); return; }
    const name = document.getElementById('scheduleName').value.trim();
    const teacher = document.getElementById('scheduleTeacher').value.trim();
    const room = document.getElementById('scheduleRoom').value.trim();
    const date = document.getElementById('scheduleDate').value;
    const time = document.getElementById('scheduleTime').value;
    const type = document.getElementById('scheduleType').value;
    const repeat = document.getElementById('scheduleRepeat').value;
    const repeatCount = parseInt(document.getElementById('scheduleRepeatCount').value) || 1;

    if (!name) { alert('Введіть назву пари!'); return; }
    if (!date) { alert('Оберіть дату!'); return; }

    let sessionsAdded = 0;
    const baseDate = new Date(date);
    for (let i = 0; i < repeatCount; i++) {
        let currentDate = new Date(baseDate);
        if (repeat === 'weekly') currentDate.setDate(baseDate.getDate() + (i * 7));
        else if (repeat === 'biweekly') currentDate.setDate(baseDate.getDate() + (i * 14));
        else if (repeat === 'monthly') currentDate.setMonth(baseDate.getMonth() + i);

        const session = {
            id: Date.now() + i, name: name, teacher: teacher || null, room: room || null,
            date: currentDate.toISOString().split('T')[0], time: time || null, type: type, attendance: {}
        };
        students.forEach(student => { session.attendance[student] = null; });
        sessions.unshift(session);
        sessionsAdded++;
    }

    saveData();
    logAction(`Додав ${sessionsAdded} пар "${name}" (${type}) в розклад`);
    document.getElementById('scheduleName').value = '';
    document.getElementById('scheduleTeacher').value = '';
    document.getElementById('scheduleRoom').value = '';
    document.getElementById('scheduleTime').value = '';
    document.getElementById('scheduleRepeatCount').value = '1';

    updatePairSuggestions();
    updateAutocompleteLists();
    updateHeaderStats();
    renderSessions(); renderHistory(); renderAnalytics(); renderSchedule();
    alert(`Додано ${sessionsAdded} пар в розклад!`);
}

// ===== ДОПОМІЖНІ ФУНКЦІЇ =====
function getTypeClass(type) {
    if (type === 'ЛК') return 'LK';
    if (type === 'ПЗ') return 'PZ';
    if (type === 'ЛБ') return 'LB';
    return '';
}

function getTypeFullName(type) {
    if (type === 'ЛК') return 'Лекція';
    if (type === 'ПЗ') return 'Практичне заняття';
    if (type === 'ЛБ') return 'Лабораторна робота';
    return type || '';
}

function getSessionStats(session) {
    let present = 0, absent = 0;
    Object.values(session.attendance).forEach(status => {
        if (status === true) present++;
        if (status === false) absent++;
    });
    return { present, absent, total: present + absent };
}

// ===== РЕНДЕРИНГ РОЗКЛАДУ =====
function renderSchedule() {
    const container = document.getElementById('scheduleList');
    const periodSelect = document.getElementById('schedulePeriod');
    const customDateGroup = document.getElementById('customDateGroup');
    if (periodSelect.value === 'custom') customDateGroup.style.display = 'flex';
    else customDateGroup.style.display = 'none';

    let filteredSessions = [...sessions];
    const today = new Date().toISOString().split('T')[0];
    const period = periodSelect.value;

    if (period === 'today') filteredSessions = filteredSessions.filter(s => s.date === today);
    else if (period === 'week') {
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        filteredSessions = filteredSessions.filter(s => { const d = new Date(s.date); return d >= startOfWeek && d <= endOfWeek; });
    } else if (period === 'month') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filteredSessions = filteredSessions.filter(s => { const d = new Date(s.date); return d >= startOfMonth && d <= endOfMonth; });
    } else if (period === 'custom') {
        const customDate = document.getElementById('scheduleCustomDate').value;
        if (customDate) filteredSessions = filteredSessions.filter(s => s.date === customDate);
    }

    filteredSessions.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.time || '00:00').localeCompare(b.time || '00:00');
    });

    if (filteredSessions.length === 0) {
        container.innerHTML = '<div class="no-data"><i class="fas fa-calendar"></i><p>Немає пар для обраного періоду</p></div>';
        return;
    }

    container.innerHTML = filteredSessions.map(session => {
        const typeClass = getTypeClass(session.type);
        const teacherInfo = session.teacher ? `<div><i class="fas fa-user-tie"></i> ${session.teacher}</div>` : '';
        const roomInfo = session.room ? `<div><i class="fas fa-door-open"></i> Кабінет: ${session.room}</div>` : '';
        const timeInfo = session.time ? `<div><i class="fas fa-clock"></i> ${session.time}</div>` : '';
        const typeBadge = session.type ? `<span class="type-badge ${typeClass}">${session.type}</span>` : '';
        const stats = getSessionStats(session);

        return `
            <div class="schedule-item ${typeClass}">
                <div class="schedule-item-info">
                    <div class="schedule-item-title ${typeClass}">${typeBadge}${session.name}</div>
                    <div class="schedule-item-details">
                        <div><i class="fas fa-calendar"></i> ${formatDate(session.date)}</div>
                        ${timeInfo}${teacherInfo}${roomInfo}
                        <div style="margin-top:8px; padding-top:8px; border-top:1px solid #0f3460;">
                            <span style="color:#27ae60;">✓ ${stats.present}</span> | 
                            <span style="color:#e74c3c;">✗ ${stats.absent}</span> | 
                            <span style="color:#00d4ff;">Всього: ${stats.total}</span>
                        </div>
                    </div>
                </div>
                <div class="schedule-item-actions">
                    <button class="btn-schedule mark" onclick="openSessionModal(${session.id})">
                        <i class="fas fa-check"></i> ${userRole === 'admin' ? 'Відмітити' : 'Переглянути'}
                    </button>
                    ${userRole === 'admin' ? `
                    <button class="btn-schedule edit" onclick="editScheduleSession(${session.id})"><i class="fas fa-edit"></i> Редагувати</button>
                    <button class="btn-schedule delete" onclick="deleteSession(${session.id})"><i class="fas fa-trash"></i> Видалити</button>` : ''}
                </div>
            </div>`;
    }).join('');
}

function editScheduleSession(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const newTeacher = prompt('Викладач:', session.teacher || '');
    if (newTeacher !== null) session.teacher = newTeacher.trim() || null;
    const newRoom = prompt('Кабінет:', session.room || '');
    if (newRoom !== null) session.room = newRoom.trim() || null;
    const newTime = prompt('Час (формат ЧЧ:ХХ):', session.time || '');
    if (newTime !== null) session.time = newTime.trim() || null;
    const newType = prompt('Тип пари (ЛК/ПЗ/ЛБ):', session.type || 'ЛК');
    if (newType !== null && ['ЛК', 'ПЗ', 'ЛБ'].includes(newType.toUpperCase())) session.type = newType.toUpperCase();
    saveData(); renderSchedule(); renderSessions();
    logAction(`Редагував пару "${session.name}"`);
}

// ===== ВСІ ПАРІ =====
function getFilteredSessions() {
    let filtered = [...sessions];
    const search = document.getElementById('searchSessions').value.toLowerCase();
    if (search) filtered = filtered.filter(s => s.name.toLowerCase().includes(search));
    const dateSearch = document.getElementById('dateSearch')?.value;
    if (dateSearch) filtered = filtered.filter(s => s.date === dateSearch);
    const dateFilter = document.getElementById('filterDate').value;
    const today = new Date().toISOString().split('T')[0];
    if (dateFilter === 'today') filtered = filtered.filter(s => s.date === today);
    else if (dateFilter === 'week') { const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); filtered = filtered.filter(s => new Date(s.date) >= weekAgo); }
    else if (dateFilter === 'month') { const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1); filtered = filtered.filter(s => new Date(s.date) >= monthAgo); }
    const sortBy = document.getElementById('sortBy').value;
    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'date-desc': return new Date(b.date) - new Date(a.date);
            case 'date-asc': return new Date(a.date) - new Date(b.date);
            case 'name-asc': return a.name.localeCompare(b.name);
            case 'name-desc': return b.name.localeCompare(a.name);
            default: return 0;
        }
    });
    return filtered;
}

function renderSessions() {
    const container = document.getElementById('sessionsGrid');
    const filtered = getFilteredSessions();
    if (filtered.length === 0) { container.innerHTML = `<div class="no-data" style="grid-column: 1/-1;"><i class="fas fa-inbox"></i><p>Немає пар для відображення</p></div>`; return; }
    container.innerHTML = filtered.map(session => {
        const stats = getSessionStats(session);
        const dateStr = formatDate(session.date);
        const timeStr = session.time ? ` о ${session.time}` : '';
        const typeClass = getTypeClass(session.type);
        const typeBadge = session.type ? `<span class="type-badge ${typeClass}">${session.type}</span>` : '';
        const teacherStr = session.teacher ? `<div class="session-details"><i class="fas fa-user-tie"></i> ${session.teacher}</div>` : '';
        const roomStr = session.room ? `<div class="session-details"><i class="fas fa-door-open"></i> Кабінет: ${session.room}</div>` : '';
        return `
            <div class="session-card session-type-${typeClass}">
                <div class="session-type-indicator ${typeClass}"></div>
                <div class="session-header">
                    <div class="session-info">
                        <h3>${typeBadge}${session.name}</h3>
                        <div class="session-meta"><i class="fas fa-calendar"></i> ${dateStr}${timeStr}</div>
                    </div>
                </div>
                ${teacherStr}${roomStr}
                <div class="session-stats">
                    <div class="stat-item"><div class="stat-number total">${stats.total}</div><div class="stat-label">Всього</div></div>
                    <div class="stat-item"><div class="stat-number present">${stats.present}</div><div class="stat-label">Присутніх</div></div>
                    <div class="stat-item"><div class="stat-number absent">${stats.absent}</div><div class="stat-label">Відсутніх</div></div>
                </div>
                <div class="session-actions">
                    <button class="btn-action btn-edit" onclick="event.stopPropagation(); openSessionModal(${session.id})"><i class="fas fa-edit"></i> ${userRole === 'admin' ? 'Редагувати' : 'Переглянути'}</button>
                    ${userRole === 'admin' ? `<button class="btn-action btn-delete" onclick="event.stopPropagation(); deleteSession(${session.id})"><i class="fas fa-trash"></i> Видалити</button>` : ''}
                </div>
            </div>`;
    }).join('');
}

// ===== ОСОБИСТИЙ ЗВІТ =====
function showPersonalReport() {
    if (userRole !== 'student') return;
    let totalSessions = 0, present = 0, absent = 0;
    sessions.forEach(session => {
        const status = session.attendance[currentUser];
        if (status !== null && status !== undefined) { totalSessions++; if (status === true) present++; else absent++; }
    });
    const percent = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;
    const personalStatsHTML = `
        <div class="personal-stats" style="background: linear-gradient(135deg, #16213e, #1a1a2e); padding: 25px; border-radius: 15px; border: 2px solid #00d4ff; margin-bottom: 20px;">
            <h2 style="color: #00d4ff; margin-bottom: 20px; text-align: center;"><i class="fas fa-user-graduate"></i> Ваша особиста статистика</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: rgba(0, 212, 255, 0.1); padding: 15px; border-radius: 10px; text-align: center;"><div style="color: #00d4ff; font-size: 2em; font-weight: bold;">${totalSessions}</div><div style="color: #a0a0a0;">Всього пар</div></div>
                <div style="background: rgba(39, 174, 96, 0.1); padding: 15px; border-radius: 10px; text-align: center;"><div style="color: #27ae60; font-size: 2em; font-weight: bold;">${present}</div><div style="color: #a0a0a0;">Присутніх</div></div>
                <div style="background: rgba(231, 76, 60, 0.1); padding: 15px; border-radius: 10px; text-align: center;"><div style="color: #e74c3c; font-size: 2em; font-weight: bold;">${absent}</div><div style="color: #a0a0a0;">Відсутніх</div></div>
                <div style="background: rgba(155, 89, 182, 0.1); padding: 15px; border-radius: 10px; text-align: center;"><div style="color: #9b59b6; font-size: 2em; font-weight: bold;">${percent}%</div><div style="color: #a0a0a0;">Відвідуваність</div></div>
            </div>
            <div style="background: #0f3460; padding: 15px; border-radius: 10px;">
                <div style="height: 25px; background: #1a1a2e; border-radius: 12px; overflow: hidden;">
                    <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #00d4ff, #0099cc); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold;">${percent}%</div>
                </div>
            </div>
        </div>`;
    const container = document.getElementById('sessionsGrid');
    if (container && !container.parentElement.querySelector('.personal-stats')) {
        const div = document.createElement('div'); div.className = 'personal-stats'; div.innerHTML = personalStatsHTML;
        container.parentElement.insertBefore(div, container);
    }
}

// ===== МОДАЛЬНЕ ВІКНО =====
let currentSessionId = null;
function openSessionModal(sessionId) {
    currentSessionId = sessionId;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const typeBadge = session.type ? `<span class="type-badge ${getTypeClass(session.type)}" style="margin-left:10px;">${session.type}</span>` : '';
    document.getElementById('modalTitle').innerHTML = `${session.name}${typeBadge} - ${formatDate(session.date)}`;
    document.getElementById('studentSearch').value = '';
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = students.map((student, index) => {
        const status = session.attendance[student];
        const sessionKey = `${sessionId}_${student}`;
        const reason = reasons[sessionKey];
        const reasonBadge = reason ? `<span class="reason-badge">${reason}</span>` : '';
        return `
            <div class="student-mark-row" data-student-name="${student.toLowerCase()}">
                <span>${student}${reasonBadge}</span>
                <div class="mark-buttons">
                    <button class="btn-mark present ${status === true ? 'active' : ''}" data-student="${encodeURIComponent(student)}" data-session="${sessionId}" data-status="true" onclick="handleMarkClick(this)" ${userRole !== 'admin' ? 'disabled' : ''}><i class="fas fa-check"></i></button>
                    <button class="btn-mark absent ${status === false ? 'active' : ''}" data-student="${encodeURIComponent(student)}" data-session="${sessionId}" data-status="false" onclick="handleAbsentClick(this)" ${userRole !== 'admin' ? 'disabled' : ''}><i class="fas fa-times"></i></button>
                </div>
            </div>`;
    }).join('');
    document.getElementById('sessionModal').style.display = 'block';
}

function handleMarkClick(button) {
    const student = decodeURIComponent(button.getAttribute('data-student'));
    const sessionId = parseInt(button.getAttribute('data-session'));
    const status = button.getAttribute('data-status') === 'true';
    markStudent(sessionId, student, status);
}

function handleAbsentClick(button) {
    const student = decodeURIComponent(button.getAttribute('data-student'));
    const sessionId = parseInt(button.getAttribute('data-session'));
    currentReasonStudent = student; currentReasonSession = sessionId;
    document.getElementById('reasonStudentName').textContent = `Студент: ${student}`;
    document.getElementById('reasonModal').style.display = 'block';
}

function selectReason(reason) {
    const session = sessions.find(s => s.id === currentReasonSession);
    if (!session) { closeReasonModal(); return; }
    const sessionKey = `${currentReasonSession}_${currentReasonStudent}`;
    if (session.attendance[currentReasonStudent] === false && reason === null) {
        session.attendance[currentReasonStudent] = null; delete reasons[sessionKey];
        logAction(`Зняв відмітку для ${currentReasonStudent} на парі "${session.name}"`);
    } else {
        session.attendance[currentReasonStudent] = false;
        if (reason) { reasons[sessionKey] = reason; logAction(`Відмітив відсутність ${currentReasonStudent} (${reason}) на парі "${session.name}"`); }
        else { delete reasons[sessionKey]; logAction(`Відмітив відсутність ${currentReasonStudent} на парі "${session.name}"`); }
    }
    saveData(); closeReasonModal(); openSessionModal(currentReasonSession);
}

function closeReasonModal() { document.getElementById('reasonModal').style.display = 'none'; currentReasonStudent = null; currentReasonSession = null; }

function filterStudentsInModal() {
    const search = document.getElementById('studentSearch').value.toLowerCase();
    document.querySelectorAll('.student-mark-row').forEach(row => {
        const name = row.getAttribute('data-student-name');
        if (name.includes(search)) row.classList.remove('hidden'); else row.classList.add('hidden');
    });
}

function closeModal() {
    document.getElementById('sessionModal').style.display = 'none';
    renderSessions(); renderHistory(); renderAnalytics(); updateHeaderStats(); renderSchedule();
    if (userRole === 'student') showPersonalReport();
}

function markStudent(sessionId, student, status) {
    if (userRole !== 'admin') { alert('Тільки адміністратори можуть відмічати відвідуваність!'); return; }
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const sessionKey = `${sessionId}_${student}`;
    if (session.attendance[student] === status) { session.attendance[student] = null; delete reasons[sessionKey]; logAction(`Зняв відмітку для ${student} на парі "${session.name}"`); }
    else { session.attendance[student] = status; if (status) { delete reasons[sessionKey]; logAction(`Відмітив присутність ${student} на парі "${session.name}"`); } }
    saveData(); openSessionModal(sessionId);
}

function deleteSession(sessionId) {
    if (userRole !== 'admin') { alert('Тільки адміністратори можуть видаляти пари!'); return; }
    const session = sessions.find(s => s.id === sessionId);
    if (confirm(`Видалити пару "${session?.name}"?`)) {
        Object.keys(reasons).forEach(key => { if (key.startsWith(`${sessionId}_`)) delete reasons[key]; });
        sessions = sessions.filter(s => s.id !== sessionId);
        saveData(); logAction(`Видалив пару "${session?.name}"`);
        updateHeaderStats(); renderSessions(); renderHistory(); renderAnalytics(); renderSchedule();
    }
}

// ===== ІСТОРІЯ =====
function getUniqueSubjects() { return [...new Set(sessions.map(s => s.name))].sort(); }

function renderHistory() {
    const container = document.getElementById('historyTable');
    if (sessions.length === 0) { container.innerHTML = '<div class="no-data"><i class="fas fa-table"></i><p>Історія порожня</p></div>'; return; }
    const subjects = getUniqueSubjects();
    let filterHTML = `
        <div style="margin-bottom: 20px; padding: 15px; background: #16213e; border-radius: 10px; display: flex; flex-wrap: wrap; gap: 15px; align-items: center;">
            <label style="color: #00d4ff; margin-right: 10px;"><i class="fas fa-filter"></i> Фільтр по предмету:</label>
            <select id="subjectFilter" onchange="filterHistoryBySubject()" style="padding: 8px 15px; border-radius: 5px; border: 2px solid #0f3460; background: #1a1a2e; color: #e0e0e0; min-width: 250px;">
                <option value="all" ${currentHistoryFilter === 'all' ? 'selected' : ''}>Всі предмети</option>
                ${subjects.map(subject => `<option value="${encodeURIComponent(subject)}" ${currentHistoryFilter === encodeURIComponent(subject) ? 'selected' : ''}>${subject}</option>`).join('')}
            </select>
        </div>`;
    let filteredSessions = sessions;
    if (currentHistoryFilter !== 'all') { const filterName = decodeURIComponent(currentHistoryFilter); filteredSessions = sessions.filter(s => s.name === filterName); }
    if (filteredSessions.length === 0) { container.innerHTML = filterHTML + '<div class="no-data"><i class="fas fa-table"></i><p>Немає даних для цього предмету</p></div>'; return; }
    const totalPages = Math.ceil(filteredSessions.length / SESSIONS_PER_PAGE);
    if (currentHistoryPage > totalPages) currentHistoryPage = 1;
    const startIndex = (currentHistoryPage - 1) * SESSIONS_PER_PAGE;
    const endIndex = startIndex + SESSIONS_PER_PAGE;
    const pageSessions = filteredSessions.slice(startIndex, endIndex);
    let html = filterHTML + '<table class="history-table"><thead><tr><th>Студент</th>';
    pageSessions.forEach(session => {
        const typeClass = getTypeClass(session.type);
        const typeBadge = session.type ? `<span class="type-badge ${typeClass}" style="font-size:0.7em; padding:2px 6px;">${session.type}</span><br>` : '';
        html += `<th>${typeBadge}${session.name}<br><small>${formatDate(session.date)}</small></th>`;
    });
    html += '<th>✓</th><th></th><th>%</th></tr></thead><tbody>';
    students.forEach(student => {
        let present = 0, absent = 0;
        html += `<tr><td>${student}</td>`;
        pageSessions.forEach(session => {
            const status = session.attendance[student];
            const sessionKey = `${session.id}_${student}`;
            const reason = reasons[sessionKey];
            const titleAttr = reason ? ` title="${reason}"` : '';
            if (status === true) { html += `<td class="mark-yes">✓</td>`; present++; }
            else if (status === false) { html += `<td class="mark-no"${titleAttr}>✗</td>`; absent++; }
            else { html += `<td class="mark-no" style="opacity:0.4">✗</td>`; }
        });
        const total = present + absent;
        const percent = total > 0 ? Math.round((present / total) * 100) : 0;
        html += `<td class="mark-yes">${present}</td><td class="mark-no">${absent}</td><td style="color: ${getColorForPercent(percent)}">${percent}%</td></tr>`;
    });
    html += '</tbody></table>';
    html += `
        <div class="pagination" style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; padding: 15px; flex-wrap: wrap;">
            <button onclick="changeHistoryPage(1)" ${currentHistoryPage === 1 ? 'disabled' : ''} class="pagination-btn"><i class="fas fa-angle-double-left"></i> Початок</button>
            <button onclick="changeHistoryPage(${currentHistoryPage - 1})" ${currentHistoryPage === 1 ? 'disabled' : ''} class="pagination-btn"><i class="fas fa-angle-left"></i> Назад</button>
            <div class="pagination-numbers" style="display: flex; gap: 5px;">${generatePaginationNumbers(currentHistoryPage, totalPages)}</div>
            <button onclick="changeHistoryPage(${currentHistoryPage + 1})" ${currentHistoryPage === totalPages ? 'disabled' : ''} class="pagination-btn">Далі <i class="fas fa-angle-right"></i></button>
            <button onclick="changeHistoryPage(${totalPages})" ${currentHistoryPage === totalPages ? 'disabled' : ''} class="pagination-btn">Кінець <i class="fas fa-angle-double-right"></i></button>
            <div style="margin-left: 15px; color: #00d4ff; font-weight: bold;">Сторінка ${currentHistoryPage} з ${totalPages}</div>
            <div style="margin-left: 15px; display: flex; align-items: center; gap: 5px;">
                <label style="color: #a0a0a0;">Перейти:</label>
                <input type="number" id="pageJumpInput" min="1" max="${totalPages}" value="${currentHistoryPage}" style="width: 60px; padding: 5px; border-radius: 5px; border: 2px solid #0f3460; background: #1a1a2e; color: #e0e0e0; text-align: center;">
                <button onclick="jumpToPage()" class="pagination-btn" style="padding: 5px 10px;"><i class="fas fa-arrow-right"></i></button>
            </div>
        </div>`;
    container.innerHTML = html;
}

function generatePaginationNumbers(currentPage, totalPages) {
    let pages = []; const maxVisible = 5;
    if (totalPages <= maxVisible) { for (let i = 1; i <= totalPages; i++) pages.push(createPageButton(i, currentPage)); }
    else {
        pages.push(createPageButton(1, currentPage));
        if (currentPage > 3) pages.push('<span style="padding: 8px 12px; color: #666;">...</span>');
        const start = Math.max(2, currentPage - 1), end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) pages.push(createPageButton(i, currentPage));
        if (currentPage < totalPages - 2) pages.push('<span style="padding: 8px 12px; color: #666;">...</span>');
        pages.push(createPageButton(totalPages, currentPage));
    }
    return pages.join('');
}

function createPageButton(pageNum, currentPage) {
    const isActive = pageNum === currentPage;
    return `<button onclick="changeHistoryPage(${pageNum})" class="pagination-btn ${isActive ? 'active' : ''}" ${isActive ? 'disabled' : ''} style="min-width: 40px;">${pageNum}</button>`;
}

function changeHistoryPage(page) { const totalPages = Math.ceil(sessions.length / SESSIONS_PER_PAGE); if (page < 1 || page > totalPages) return; currentHistoryPage = page; renderHistory(); }
function jumpToPage() { const input = document.getElementById('pageJumpInput'); const page = parseInt(input.value); const totalPages = Math.ceil(sessions.length / SESSIONS_PER_PAGE); if (page >= 1 && page <= totalPages) { currentHistoryPage = page; renderHistory(); } else { alert(`Введіть номер сторінки від 1 до ${totalPages}`); } }
function filterHistoryBySubject() { const select = document.getElementById('subjectFilter'); if (!select) return; currentHistoryFilter = select.value; currentHistoryPage = 1; renderHistory(); }

// ===== АНАЛІТИКА =====
function renderAnalytics() {
    const container = document.getElementById('analyticsGrid');
    if (sessions.length === 0) { container.innerHTML = '<div class="no-data"><i class="fas fa-chart-bar"></i><p>Немає даних для аналізу</p></div>'; return; }
    let totalPresent = 0, totalAbsent = 0;
    sessions.forEach(session => { Object.values(session.attendance).forEach(status => { if (status === true) totalPresent++; if (status === false) totalAbsent++; }); });
    const totalMarks = totalPresent + totalAbsent;
    const attendancePercent = totalMarks > 0 ? Math.round((totalPresent / totalMarks) * 100) : 0;
    const studentStats = students.map(student => { let present = 0, absent = 0; sessions.forEach(session => { if (session.attendance[student] === true) present++; if (session.attendance[student] === false) absent++; }); const total = present + absent; return { name: student, present, absent, percent: total > 0 ? Math.round((present / total) * 100) : 0 }; }).sort((a, b) => a.percent - b.percent);
    const bestStudents = studentStats.slice(-5).reverse(); const worstStudents = studentStats.slice(0, 5);
    const reasonStats = {}; Object.values(reasons).forEach(reason => { if (reason) reasonStats[reason] = (reasonStats[reason] || 0) + 1; });
    const typeStats = { 'ЛК': { present: 0, absent: 0 }, 'ПЗ': { present: 0, absent: 0 }, 'ЛБ': { present: 0, absent: 0 } };
    sessions.forEach(session => { const type = session.type || 'ЛК'; if (!typeStats[type]) typeStats[type] = { present: 0, absent: 0 }; students.forEach(st => { if (session.attendance[st] === true) typeStats[type].present++; if (session.attendance[st] === false) typeStats[type].absent++; }); });
    let html = `
        <div class="analytics-card"><h3><i class="fas fa-percentage"></i> Загальна відвідуваність</h3><div class="progress-bar"><div class="progress-fill" style="width: ${attendancePercent}%">${attendancePercent}%</div></div><div style="display: flex; justify-content: space-around; margin-top: 20px;"><div style="text-align: center;"><div style="color: #27ae60; font-size: 2em; font-weight: bold;">${totalPresent}</div><div style="color: #666;">Присутніх</div></div><div style="text-align: center;"><div style="color: #e74c3c; font-size: 2em; font-weight: bold;">${totalAbsent}</div><div style="color: #666;">Відсутніх</div></div></div></div>
        <div class="analytics-card"><h3><i class="fas fa-trophy"></i> Найкраща відвідуваність</h3><div class="student-analytics">${bestStudents.map((s, i) => `<div class="student-row-analytics"><span>${i + 1}. ${s.name}</span><span style="color: #27ae60; font-weight: bold;">${s.percent}%</span></div>`).join('')}</div></div>
        <div class="analytics-card"><h3><i class="fas fa-exclamation-triangle"></i> Найнижча відвідуваність</h3><div class="student-analytics">${worstStudents.map((s, i) => `<div class="student-row-analytics"><span>${i + 1}. ${s.name}</span><span style="color: ${getColorForPercent(s.percent)}; font-weight: bold;">${s.percent}%</span></div>`).join('')}</div></div>
        <div class="analytics-card"><h3><i class="fas fa-info-circle"></i> Загальна інформація</h3><div style="line-height: 2;"><div><strong>Всього пар:</strong> ${sessions.length}</div><div><strong>Студентів:</strong> ${students.length}</div><div><strong>Всього відміток:</strong> ${totalMarks}</div><div><strong>Середня відвідуваність:</strong> <span style="color: #00d4ff">${attendancePercent}%</span></div></div></div>
        <div class="analytics-card"><h3><i class="fas fa-tag"></i> Відвідуваність по типах пар</h3><div class="student-analytics">${Object.entries(typeStats).map(([type, stats]) => { const total = stats.present + stats.absent; const pct = total > 0 ? Math.round((stats.present / total) * 100) : 0; const typeClass = getTypeClass(type); return `<div class="student-row-analytics"><span><span class="type-badge ${typeClass}">${type}</span> ${getTypeFullName(type)}</span><span style="color: ${getColorForPercent(pct)}; font-weight: bold;">${pct}%</span></div>`; }).join('')}</div></div>
        <div class="analytics-card"><h3><i class="fas fa-notes-medical"></i> Причини відсутності</h3><div class="student-analytics">${Object.keys(reasonStats).length === 0 ? '<p style="color:#666;">Немає даних</p>' : Object.entries(reasonStats).sort((a,b) => b[1]-a[1]).map(([reason, count]) => `<div class="student-row-analytics"><span>${reason}</span><span style="color: #e74c3c; font-weight: bold;">${count}</span></div>`).join('')}</div></div>
        <div class="analytics-card"><h3><i class="fas fa-book"></i> Предмети</h3><div class="student-analytics">${getUniqueSubjects().map(subject => { const subjSessions = sessions.filter(s => s.name === subject); let p = 0, a = 0; subjSessions.forEach(s => { students.forEach(st => { if (s.attendance[st] === true) p++; if (s.attendance[st] === false) a++; }); }); const total = p + a; const pct = total > 0 ? Math.round((p/total)*100) : 0; return `<div class="student-row-analytics"><span>${subject}</span><span style="color: ${getColorForPercent(pct)}; font-weight: bold;">${pct}%</span></div>`; }).join('')}</div></div>`;
    container.innerHTML = html;
}

// ===== ГРАФІКИ =====
function renderCharts() {
    const container = document.getElementById('chartsGrid');
    if (sessions.length === 0) { container.innerHTML = '<div class="no-data"><i class="fas fa-chart-line"></i><p>Немає даних для графіків</p></div>'; return; }
    container.innerHTML = `
        <div class="chart-card"><h3><i class="fas fa-chart-line"></i> Динаміка відвідуваності</h3><div class="chart-container"><canvas id="attendanceChart"></canvas></div></div>
        <div class="chart-card"><h3><i class="fas fa-chart-pie"></i> Загальне співвідношення</h3><div class="chart-container"><canvas id="pieChart"></canvas></div></div>
        <div class="chart-card"><h3><i class="fas fa-chart-bar"></i> Відвідуваність по предметах</h3><div class="chart-container"><canvas id="subjectChart"></canvas></div></div>
        <div class="chart-card"><h3><i class="fas fa-tag"></i> Відвідуваність по типах пар</h3><div class="chart-container"><canvas id="typeChart"></canvas></div></div>`;
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedSessions.map(s => `${s.name} (${formatDate(s.date)})`);
    const presentData = sortedSessions.map(s => { let p = 0; students.forEach(st => { if (s.attendance[st] === true) p++; }); return p; });
    const absentData = sortedSessions.map(s => { let a = 0; students.forEach(st => { if (s.attendance[st] === false) a++; }); return a; });
    new Chart(document.getElementById('attendanceChart'), { type: 'line', data: { labels: labels, datasets: [{ label: 'Присутні', data: presentData, borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.2)', tension: 0.3 }, { label: 'Відсутні', data: absentData, borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.2)', tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e0e0e0' } } }, scales: { x: { ticks: { color: '#a0a0a0', maxRotation: 45 }, grid: { color: '#0f3460' } }, y: { ticks: { color: '#a0a0a0' }, grid: { color: '#0f3460' } } } } });
    let totalP = 0, totalA = 0; sessions.forEach(s => { students.forEach(st => { if (s.attendance[st] === true) totalP++; if (s.attendance[st] === false) totalA++; }); });
    new Chart(document.getElementById('pieChart'), { type: 'doughnut', data: { labels: ['Присутні', 'Відсутні'], datasets: [{ data: [totalP, totalA], backgroundColor: ['#27ae60', '#e74c3c'], borderColor: '#16213e', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e0e0e0', font: { size: 14 } } } } } });
    const subjects = getUniqueSubjects();
    const subjectData = subjects.map(subj => { const subjSessions = sessions.filter(s => s.name === subj); let p = 0, total = 0; subjSessions.forEach(s => { students.forEach(st => { if (s.attendance[st] === true) p++; if (s.attendance[st] !== null && s.attendance[st] !== undefined) total++; }); }); return total > 0 ? Math.round((p/total)*100) : 0; });
    new Chart(document.getElementById('subjectChart'), { type: 'bar', data: { labels: subjects, datasets: [{ label: 'Відвідуваність %', data: subjectData, backgroundColor: subjectData.map(v => v >= 75 ? '#27ae60' : v >= 50 ? '#f39c12' : '#e74c3c'), borderColor: '#16213e', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e0e0e0' } } }, scales: { x: { ticks: { color: '#a0a0a0', maxRotation: 45 }, grid: { color: '#0f3460' } }, y: { ticks: { color: '#a0a0a0' }, grid: { color: '#0f3460' }, max: 100 } } } });
    const typeStats = { 'ЛК': { present: 0, absent: 0 }, 'ПЗ': { present: 0, absent: 0 }, 'ЛБ': { present: 0, absent: 0 } };
    sessions.forEach(session => { const type = session.type || 'ЛК'; if (!typeStats[type]) typeStats[type] = { present: 0, absent: 0 }; students.forEach(st => { if (session.attendance[st] === true) typeStats[type].present++; if (session.attendance[st] === false) typeStats[type].absent++; }); });
    new Chart(document.getElementById('typeChart'), { type: 'bar', data: { labels: ['ЛК - Лекції', 'ПЗ - Практичні', 'ЛБ - Лабораторні'], datasets: [{ label: 'Присутні', data: [typeStats['ЛК'].present, typeStats['ПЗ'].present, typeStats['ЛБ'].present], backgroundColor: '#27ae60' }, { label: 'Відсутні', data: [typeStats['ЛК'].absent, typeStats['ПЗ'].absent, typeStats['ЛБ'].absent], backgroundColor: '#e74c3c' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e0e0e0' } } }, scales: { x: { ticks: { color: '#a0a0a0' }, grid: { color: '#0f3460' } }, y: { ticks: { color: '#a0a0a0' }, grid: { color: '#0f3460' } } } } });
}

// ===== ПОРІВНЯННЯ =====
function openCompareModal() { const list = document.getElementById('compareStudentsList'); list.innerHTML = students.map(s => `<label class="compare-student-item"><input type="checkbox" value="${s}" class="compare-checkbox"><span>${s}</span></label>`).join(''); document.getElementById('compareResults').innerHTML = ''; document.getElementById('compareModal').style.display = 'block'; }
function closeCompareModal() { document.getElementById('compareModal').style.display = 'none'; }
function showCompareResults() {
    const checkboxes = document.querySelectorAll('.compare-checkbox:checked'); const selected = Array.from(checkboxes).map(cb => cb.value);
    if (selected.length < 2) { alert('Оберіть хоча б 2 студентів для порівняння!'); return; }
    if (selected.length > 4) { alert('Можна порівнювати не більше 4 студентів!'); return; }
    const stats = selected.map(name => { let present = 0, absent = 0; sessions.forEach(s => { if (s.attendance[name] === true) present++; if (s.attendance[name] === false) absent++; }); const total = present + absent; return { name, present, absent, percent: total > 0 ? Math.round((present/total)*100) : 0 }; });
    const resultsDiv = document.getElementById('compareResults');
    resultsDiv.innerHTML = `<div style="margin-top: 20px;"><h3 style="color: #00d4ff; margin-bottom: 15px;">Результати порівняння</h3><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">${stats.map(s => `<div style="background: #1a1a2e; padding: 15px; border-radius: 10px; text-align: center; border: 2px solid ${s.percent >= 75 ? '#27ae60' : s.percent >= 50 ? '#f39c12' : '#e74c3c'};"><div style="color: #00d4ff; font-weight: bold; margin-bottom: 10px;">${s.name}</div><div style="font-size: 2em; font-weight: bold; color: ${s.percent >= 75 ? '#27ae60' : s.percent >= 50 ? '#f39c12' : '#e74c3c'};">${s.percent}%</div><div style="color: #27ae60;">✓ ${s.present}</div><div style="color: #e74c3c;">✗ ${s.absent}</div></div>`).join('')}</div><div class="chart-container" style="height: 300px;"><canvas id="compareChart"></canvas></div></div>`;
    new Chart(document.getElementById('compareChart'), { type: 'bar', data: { labels: stats.map(s => s.name), datasets: [{ label: 'Присутні', data: stats.map(s => s.present), backgroundColor: '#27ae60' }, { label: 'Відсутні', data: stats.map(s => s.absent), backgroundColor: '#e74c3c' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e0e0e0' } } }, scales: { x: { ticks: { color: '#a0a0a0' }, grid: { color: '#0f3460' } }, y: { ticks: { color: '#a0a0a0' }, grid: { color: '#0f3460' } } } } });
}

// ===== РЕЗЕРВНА КОПІЯ =====
function createBackup() { const backup = { sessions, reasons, actionLog, exportDate: new Date().toISOString(), version: '1.0' }; const dataStr = JSON.stringify(backup, null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup_${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url); logAction('Створив резервну копію даних'); alert('Резервна копія збережена!'); }
function restoreBackup(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(e) { try { const backup = JSON.parse(e.target.result); if (!backup.sessions) { alert('Невірний формат файлу!'); return; } if (confirm('Це замінить всі поточні дані. Продовжити?')) { sessions = backup.sessions || []; reasons = backup.reasons || {}; if (backup.actionLog) actionLog = backup.actionLog; saveData(); localStorage.setItem('attendanceReasons', JSON.stringify(reasons)); localStorage.setItem('actionLog', JSON.stringify(actionLog)); logAction('Відновив дані з резервної копії'); updateHeaderStats(); renderSessions(); renderHistory(); renderAnalytics(); renderSchedule(); updateBackupInfo(); alert('Дані успішно відновлено!'); } } catch (err) { alert('Помилка читання файлу: ' + err.message); } }; reader.readAsText(file); event.target.value = ''; }
function clearAllData() { if (confirm('УВАГА! Це видалить ВСІ дані без можливості відновлення. Продовжити?')) { if (confirm('Ви дійсно впевнені?')) { sessions = []; reasons = {}; actionLog = []; saveData(); localStorage.removeItem('attendanceReasons'); localStorage.removeItem('actionLog'); logAction('Очистив всі дані'); updateHeaderStats(); renderSessions(); renderHistory(); renderAnalytics(); renderSchedule(); updateBackupInfo(); alert('Всі дані видалено!'); } } }
function updateBackupInfo() { const info = document.getElementById('backupInfo'); const totalSize = new Blob([JSON.stringify(sessions) + JSON.stringify(reasons) + JSON.stringify(actionLog)]).size; info.innerHTML = `<div><strong>Кількість пар:</strong> ${sessions.length}</div><div><strong>Кількість студентів:</strong> ${students.length}</div><div><strong>Записів відміток:</strong> ${Object.keys(reasons).length}</div><div><strong>Записів в історії дій:</strong> ${actionLog.length}</div><div><strong>Розмір даних:</strong> ${(totalSize / 1024).toFixed(2)} KB</div><div><strong>Остання зміна:</strong> ${new Date().toLocaleString('uk-UA')}</div>`; }

// ===== ІСТОРІЯ ДІЙ =====
function logAction(action) { if (!currentUser) return; actionLog.unshift({ user: currentUser, role: userRole, action, timestamp: new Date().toISOString() }); if (actionLog.length > 500) actionLog = actionLog.slice(0, 500); localStorage.setItem('actionLog', JSON.stringify(actionLog)); }
function renderActionLog() { const container = document.getElementById('actionsList'); if (actionLog.length === 0) { container.innerHTML = '<div class="no-data"><i class="fas fa-history"></i><p>Історія дій порожня</p></div>'; return; } container.innerHTML = actionLog.map(item => { const date = new Date(item.timestamp); const formattedDate = `${date.getDate().toString().padStart(2,'0')}.${(date.getMonth()+1).toString().padStart(2,'0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`; return `<div class="action-item ${item.role}"><div class="action-info"><div class="action-user"><i class="fas fa-${item.role === 'admin' ? 'user-shield' : 'user'}"></i> ${item.user} <span style="color:#666; font-size:0.9em;">(${item.role === 'admin' ? 'Адмін' : 'Студент'})</span></div><div class="action-text">${item.action}</div></div><div class="action-time"><i class="fas fa-clock"></i> ${formattedDate}</div></div>`; }).join(''); }
function clearActionLog() { if (confirm('Очистити всю історію дій?')) { actionLog = []; localStorage.setItem('actionLog', JSON.stringify(actionLog)); renderActionLog(); } }

// ===== ЕКСПОРТ =====
function exportToCSV() { let csv = '\uFEFFStudent,Type,' + sessions.map(s => `${s.name} (${s.date})`).join(',') + ',Present,Absent,Percent\n'; students.forEach(student => { let present = 0, absent = 0; let row = student; sessions.forEach(session => { const status = session.attendance[student]; if (status === true) { row += ',Present'; present++; } else if (status === false) { row += ',Absent'; absent++; } else { row += ',None'; } }); const total = present + absent; const percent = total > 0 ? Math.round((present / total) * 100) : 0; row += `,${present},${absent},${percent}%\n`; csv += row; }); downloadFile(csv, 'attendance.csv', 'text/csv;charset=utf-8'); logAction('Експортував дані в CSV'); }
function exportToExcel() { if (typeof XLSX === 'undefined') { alert('Бібліотека Excel не завантажена!'); return; } const data = []; const header = ['Студент']; sessions.forEach(s => header.push(`${s.name} (${s.date}) [${s.type || ''}]`)); header.push('Присутні', 'Відсутні', 'Відвідуваність %'); data.push(header); students.forEach(student => { const row = [student]; let present = 0, absent = 0; sessions.forEach(session => { const status = session.attendance[student]; const sessionKey = `${session.id}_${student}`; const reason = reasons[sessionKey]; if (status === true) { row.push('✓'); present++; } else if (status === false) { row.push(reason ? `✗ (${reason})` : '✗'); absent++; } else { row.push(''); } }); const total = present + absent; const percent = total > 0 ? Math.round((present / total) * 100) : 0; row.push(present, absent, percent + '%'); data.push(row); }); const ws = XLSX.utils.aoa_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Відвідуваність'); XLSX.writeFile(wb, `attendance_${new Date().toISOString().split('T')[0]}.xlsx`); logAction('Експортував дані в Excel'); }
function exportToJSON() { const dataStr = JSON.stringify(sessions, null, 2); downloadFile(dataStr, 'attendance.json', 'application/json'); logAction('Експортував дані в JSON'); }
function downloadFile(content, filename, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
function printHistory() { window.print(); }

// ===== ДОПОМІЖНІ =====
function updateHeaderStats() { const container = document.getElementById('headerStats'); const today = new Date().toISOString().split('T')[0]; const todaySessions = sessions.filter(s => s.date === today).length; container.innerHTML = `<div class="stat-badge"><strong>${sessions.length}</strong> всього пар</div><div class="stat-badge"><strong>${todaySessions}</strong> сьогодні</div><div class="stat-badge"><strong>${students.length}</strong> студентів</div>`; }
function updatePairSuggestions() { const usedPairs = [...new Set(sessions.map(s => s.name))]; const datalist = document.getElementById('pairSuggestions'); if (datalist) datalist.innerHTML = usedPairs.map(name => `<option value="${name}">`).join(''); updateAutocompleteLists(); }
function saveData() { localStorage.setItem('attendanceSessions', JSON.stringify(sessions)); localStorage.setItem('attendanceReasons', JSON.stringify(reasons)); }
function formatDate(dateStr) { const date = new Date(dateStr); const months = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру']; return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`; }
function getColorForPercent(percent) { if (percent >= 75) return '#27ae60'; if (percent >= 50) return '#f39c12'; return '#e74c3c'; }

window.onclick = function(event) { const sessionModal = document.getElementById('sessionModal'); const reasonModal = document.getElementById('reasonModal'); const compareModal = document.getElementById('compareModal'); if (event.target === sessionModal) closeModal(); if (event.target === reasonModal) closeReasonModal(); if (event.target === compareModal) closeCompareModal(); }