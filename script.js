/* =========================================================
   KOA — Sleep Tracker
   script.js
   Organización:
     1. Estado global de la app
     2. Navegación entre pantallas
     3. Barra inferior de navegación (generación dinámica)
     4. Pantalla Home: reloj + cuenta regresiva + slide to activate
     5. Pantalla Config: cálculo de horas de sueño
     6. Modal de advertencia
     7. Pantalla Modo sueño activado
     8. Racha / días de la semana
     9. Pantalla Historial: gráfica en Canvas
    10. Pantalla Mascotas: selección de mascota
    11. Inicialización
========================================================= */

/* ---------- 1. ESTADO GLOBAL ---------- */
const state = {
  bedtime: '22:30',      // hora de dormir configurada
  wake: '06:30',         // hora de despertar configurada
  sleepHours: 8,          // horas calculadas
  streak: 2,               // racha actual en días
  completedDays: ['L', 'M'], // días de la semana ya cumplidos
  history: [               // datos de ejemplo para el historial
    { day: 'L', hours: 7.6 },
    { day: 'M', hours: 7.4 },
    { day: 'M', hours: 7.7 },
    { day: 'J', hours: 7.9 },
    { day: 'V', hours: 7.5 },
    { day: 'S', hours: 8.0 },
    { day: 'D', hours: null } // aún sin dato
  ]
};

const WEEK_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/* Historial de navegación para el botón "atrás" */
const navHistory = [];

/* ---------- 2. NAVEGACIÓN ENTRE PANTALLAS ---------- */
function showScreen(name, { record = true } = {}){
  const current = document.querySelector('.screen.active');
  const next = document.querySelector(`.screen[data-screen="${name}"]`);
  if (!next) return;

  if (current && current !== next && record){
    navHistory.push(current.dataset.screen);
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  next.classList.add('active');

  updateActiveNavIcons(name);

  // refrescos puntuales al entrar a cada pantalla
  if (name === 'home') renderStreakDays();          // pantalla principal ("¡Buenas noches!")
  if (name === 'history') drawStatsChart();
  if (name === 'sleepReminder') refreshReminderClock(); // pantalla de recordatorio/cuenta regresiva
}

function goBack(fallback){
  const prev = navHistory.pop();
  showScreen(prev || fallback || 'home', { record:false });
}

/* Delegación de eventos para cualquier elemento con data-nav / data-back */
document.addEventListener('click', (e) => {
  const navTarget = e.target.closest('[data-nav]');
  if (navTarget){
    showScreen(navTarget.dataset.nav);
    return;
  }
  const backTarget = e.target.closest('[data-back]');
  if (backTarget){
    goBack(backTarget.dataset.fallback);
  }
});

/* ---------- 3. BARRA INFERIOR DE NAVEGACIÓN (dinámica) ---------- */
const NAV_ICONS = {
  home:  '<svg viewBox="0 0 24 24"><path d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M5 19V10M12 19V5M19 19v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus:  '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  bone:  '<svg viewBox="0 0 24 24"><path d="M6 9a2.5 2.5 0 1 1 4-3l4 4a2.5 2.5 0 1 1 3 4l-4-4a2.5 2.5 0 1 1-3-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" transform="rotate(45 12 12)"/><circle cx="7" cy="7" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  user:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 20c1.4-4 4-6 7-6s5.6 2 7 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
};

function buildNavbar(container, activeKey){
  container.innerHTML = `
    <button class="nav-item ${activeKey==='home' ? 'is-active nav-item--dot' : ''}" data-nav="home" aria-label="Inicio">${NAV_ICONS.home}</button>
    <button class="nav-item ${activeKey==='history' ? 'is-active nav-item--dot' : ''}" data-nav="history" aria-label="Estadísticas">${NAV_ICONS.chart}</button>
    <button class="nav-item nav-item--fab" data-nav="config" aria-label="Nuevo objetivo de sueño">${NAV_ICONS.plus}</button>
    <button class="nav-item ${activeKey==='pets' ? 'is-active nav-item--dot' : ''}" data-nav="pets" aria-label="Mascotas">${NAV_ICONS.bone}</button>
    <button class="nav-item ${activeKey==='profile' ? 'is-active nav-item--dot' : ''}" data-nav="profile" aria-label="Perfil">${NAV_ICONS.user}</button>
  `;
}

function buildAllNavbars(){
  document.querySelectorAll('.navbar').forEach(nav => {
    buildNavbar(nav, nav.dataset.navbar);
  });
}

function updateActiveNavIcons(activeScreen){
  document.querySelectorAll('.navbar').forEach(nav => buildNavbar(nav, activeScreen));
}






/* ---------- 4. PANTALLA SLEEPREMINDER: RELOJ + CUENTA REGRESIVA + SLIDE ---------- */
function pad(n){ return n.toString().padStart(2, '0'); }

function parseTimeToMinutes(hhmm){
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function minutesToHHMM(mins){
  mins = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad(h)}:${pad(m)}`;
}

function refreshReminderClock(){
  const now = new Date();
  document.getElementById('clockText').textContent =
    `Son las ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const nowMins = now.getHours() * 60 + now.getMinutes();
  let bedMins = parseTimeToMinutes(state.bedtime);
  let diff = bedMins - nowMins;
  if (diff < 0) diff += 1440; // la hora de dormir es al día siguiente

  const countdownEl = document.getElementById('countdownText');
  if (diff <= 0){
    countdownEl.innerHTML = 'Ya es tu hora de dormir.';
  } else if (diff < 60){
    countdownEl.innerHTML = `Te quedan ${diff} minutos antes<br />de tu hora de dormir.`;
  } else {
    const h = Math.floor(diff / 60), m = diff % 60;
    countdownEl.innerHTML = `Te quedan ${h}h ${pad(m)}m antes<br />de tu hora de dormir.`;
  }
}

/* botón "Añadir 30m más": retrasa la hora de dormir configurada */
document.getElementById('addThirtyBtn').addEventListener('click', () => {
  const mins = parseTimeToMinutes(state.bedtime) + 30;
  state.bedtime = minutesToHHMM(mins);
  refreshReminderClock();
});

/* "Desliza para activar el modo sueño": clic o arrastre activan el modo sueño */
const slideEl = document.getElementById('slideActivate');
let dragStartY = null;

function activateSleepMode(){
  slideEl.classList.add('activated');
  setTimeout(() => {
    applyConfiguredTimes();
    showScreen("home"); // navega a la pantalla principal ("¡Buenas noches!")
    slideEl.classList.remove('activated');
  }, 180);
}
slideEl.addEventListener('click', activateSleepMode);
slideEl.addEventListener('pointerdown', (e) => { dragStartY = e.clientY; slideEl.classList.add('dragging'); });
window.addEventListener('pointerup', (e) => {
  if (dragStartY === null) return;
  const delta = dragStartY - e.clientY;
  slideEl.classList.remove('dragging');
  if (delta > 40){ activateSleepMode(); }
  dragStartY = null;
});

/* actualizar el reloj cada 30 segundos */
setInterval(refreshReminderClock, 30000);






/* ---------- 5. PANTALLA CONFIG: CÁLCULO DE HORAS DE SUEÑO ---------- */
const bedtimeInput = document.getElementById('bedtimeInput');
const wakeInput = document.getElementById('wakeInput');
const calcularBtn = document.getElementById('calcularBtn');

calcularBtn.addEventListener('click', () => {
  const bed = bedtimeInput.value || '00:00';
  const wake = wakeInput.value || '06:00';

  const bedMins = parseTimeToMinutes(bed);
  const wakeMins = parseTimeToMinutes(wake);
  let diffMins = wakeMins - bedMins;
  if (diffMins <= 0) diffMins += 1440; // cruza la medianoche

  const hours = diffMins / 60;

  // guardamos los valores propuestos temporalmente
  state.pendingBedtime = bed;
  state.pendingWake = wake;
  state.pendingHours = hours;

  if (hours < 7){
    document.getElementById('warningHours').textContent =
      Number.isInteger(hours) ? hours : hours.toFixed(1);
    openWarningModal();
  } else {
    applyConfiguredTimes(true);
showScreen("sleepReminder");
  }
});

function applyConfiguredTimes(usePending){
  if (usePending && state.pendingBedtime){
    state.bedtime = state.pendingBedtime;
    state.wake = state.pendingWake;
    state.sleepHours = state.pendingHours;
  }

  const sleepTimeValue = document.getElementById("sleepTimeValue");
  if (sleepTimeValue)
    sleepTimeValue.textContent = state.bedtime;

  const wakeTimeValue = document.getElementById("wakeTimeValue");
  if (wakeTimeValue)
    wakeTimeValue.textContent = state.wake;

  const alarmTimeText = document.getElementById("alarmTimeText");
  if (alarmTimeText)
    alarmTimeText.textContent = state.wake;

  const goalHoursText = document.getElementById("goalHoursText");
  if (goalHoursText)
    goalHoursText.textContent = `${Math.round(state.sleepHours)}h`;
}

/* ---------- 6. MODAL DE ADVERTENCIA ---------- */
const warningModal = document.getElementById('warningModal');
function openWarningModal(){ warningModal.classList.add('active'); }
function closeWarningModal(){ warningModal.classList.remove('active'); }

document.getElementById('cambiarBtn').addEventListener('click', () => {
  closeWarningModal();
  showScreen('config', { record:false });
});
document.getElementById('omitirBtn').addEventListener('click', () => {
  closeWarningModal();
  applyConfiguredTimes(true);
  refreshReminderClock();
  showScreen("sleepReminder");
});

/* ---------- 7. PANTALLA MODO SUEÑO ACTIVADO ---------- */
document.getElementById('demoWakeBtn').addEventListener('click', () => {
  // Simula que el usuario completó su objetivo de sueño → pantalla de recompensa
  document.getElementById('rewardHours').textContent = Math.round(state.sleepHours) || 9;
  state.streak += 1;
  showScreen('reward');
});

/* ---------- 8. RACHA / DÍAS DE LA SEMANA ---------- */
function renderStreakDays(){
  document.getElementById('streakValue').textContent = state.streak;
  const profileStreak = document.getElementById('profileStreakValue');
  if (profileStreak) profileStreak.textContent = state.streak;

  const wrap = document.getElementById('streakDays');
  wrap.innerHTML = '';
  WEEK_DAYS.forEach((label, idx) => {
    const done = idx < state.completedDays.length;
    const item = document.createElement('div');
    item.className = 'day-dot' + (done ? ' is-done' : '');
    item.innerHTML = `<span class="day-dot__circle"></span><span>${label}</span>`;
    wrap.appendChild(item);
  });
}

/* ---------- 9. PANTALLA HISTORIAL: GRÁFICA EN CANVAS ---------- */
function drawStatsChart(){
  const canvas = document.getElementById('statsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const padding = { top: 20, right: 20, bottom: 34, left: 46 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  const minH = 6, maxH = 8; // escala vertical igual al diseño (6h - 8h)

  // líneas de referencia horizontales (6h, 7h, 8h)
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 1.5;
  ctx.font = '20px "Baloo 2", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.textBaseline = 'middle';

  [8, 7, 6].forEach((h) => {
    const y = padding.top + chartH * (1 - (h - minH) / (maxH - minH));
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.stroke();
    ctx.fillText(`${h}h`, 4, y);
  });

  // etiquetas de días
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const stepX = chartW / (state.history.length - 1);
  state.history.forEach((d, i) => {
    const x = padding.left + stepX * i;
    ctx.fillText(d.day, x, H - padding.bottom + 10);
  });

  // línea de horas dormidas
  const points = state.history
    .map((d, i) => {
      if (d.hours === null) return null;
      const x = padding.left + stepX * i;
      const clamped = Math.max(minH, Math.min(maxH, d.hours));
      const y = padding.top + chartH * (1 - (clamped - minH) / (maxH - minH));
      return { x, y };
    })
    .filter(Boolean);

  // área bajo la curva
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
  ctx.lineTo(points[0].x, padding.top + chartH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  ctx.fill();

  // línea principal
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // marcador de la mejor noche (máximo)
  const best = points.reduce((a, b) => (b.y < a.y ? b : a));
  ctx.fillStyle = '#5AB39F';
  drawStar(ctx, best.x, best.y - 4, 9);
}

function drawStar(ctx, cx, cy, r){
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 8; i++){
    const angle = (Math.PI / 4) * i;
    const radius = i % 2 === 0 ? r : r * 0.4;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

window.addEventListener('resize', () => {
  const active = document.querySelector('.screen.active');
  if (active && active.dataset.screen === 'history') drawStatsChart();
});

/* ---------- 10. PANTALLA MASCOTAS: SELECCIÓN DE MASCOTA ---------- */
document.getElementById('petsGrid').addEventListener('click', (e) => {
  const petBtn = e.target.closest('.pet-avatar');
  if (!petBtn) return;
  document.getElementById('petName').textContent = petBtn.dataset.pet;
  document.getElementById('petAge').textContent = petBtn.dataset.age;
});

/* ---------- 11. INICIALIZACIÓN ---------- */
document.addEventListener('DOMContentLoaded', () => {
  buildAllNavbars();
  applyConfiguredTimes();
  renderStreakDays();
  refreshReminderClock();
});

