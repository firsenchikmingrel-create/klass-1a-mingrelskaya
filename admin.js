'use strict';

const REPO = 'firsenchikmingrel-create/klass-1a-mingrelskaya';
const BRANCH = 'main';
const API = `https://api.github.com/repos/${REPO}/contents`;
const FILES = {
  index: 'index.html',
  memo: 'materials/pamyatka-roditelyam.txt',
  photo: 'materials/pravila-fotoalboma.txt',
  schedule: 'materials/raspisanie-1a.txt'
};

let token = sessionStorage.getItem('klass1a-admin-token') || '';
let loaded = {};
let dirty = false;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const els = {
  loginBox: $('#loginBox'), editor: $('#editor'), token: $('#token'), connectBtn: $('#connectBtn'),
  logoutBtn: $('#logoutBtn'), reloadBtn: $('#reloadBtn'), publishBtn: $('#publishBtn'), loginError: $('#loginError'),
  statusDot: $('#statusDot'), statusTitle: $('#statusTitle'), statusText: $('#statusText'), publishResult: $('#publishResult'),
  announcementFields: $('#announcementFields'), scheduleFields: $('#scheduleFields'), memoText: $('#memoText'),
  photoRulesText: $('#photoRulesText'), scheduleText: $('#scheduleText'), quickTitle: $('#quickTitle'), quickSubtitle: $('#quickSubtitle')
};

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function base64ToUtf8(value) {
  const clean = value.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function setStatus(kind, title, text) {
  els.statusDot.className = `dot ${kind || ''}`;
  els.statusTitle.textContent = title;
  els.statusText.textContent = text;
}

function setResult(type, text) {
  els.publishResult.className = text ? (type === 'ok' ? 'successbox' : 'errorbox') : '';
  els.publishResult.textContent = text || '';
}

function markDirty() {
  dirty = true;
  els.publishBtn.textContent = 'Опубликовать изменения •';
}

async function api(path, options = {}) {
  const response = await fetch(`${API}/${path}${options.query || ''}`, {
    method: options.method || 'GET',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? {'Content-Type': 'application/json'} : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store'
  });
  let data = null;
  try { data = await response.json(); } catch { /* no-op */ }
  if (!response.ok) {
    const message = data?.message || `${response.status} ${response.statusText}`;
    throw new Error(`${path}: ${message}`);
  }
  return data;
}

async function readFile(path) {
  const data = await api(path, {query: `?ref=${encodeURIComponent(BRANCH)}`});
  return {path, sha: data.sha, text: base64ToUtf8(data.content), htmlUrl: data.html_url};
}

async function writeFile(file, text, message) {
  return api(file.path, {
    method: 'PUT',
    body: {message, content: utf8ToBase64(text), sha: file.sha, branch: BRANCH}
  });
}

function safeText(node, fallback = '') { return node?.textContent?.trim() || fallback; }

function parseIndex(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const notices = $$('.notice-grid .notice-card', doc).slice(0, 3).map((card, i) => ({
    label: safeText($('.notice-label', card), `Карточка ${i + 1}`),
    time: safeText($('time', card)),
    title: safeText($('h3', card)),
    text: safeText($('p', card))
  }));
  const days = $$('.week-grid .day-card', doc).slice(0, 5).map(card => ({
    name: safeText($('h3', card)),
    lessons: $$('ol li', card).map(li => safeText(li)).filter(Boolean)
  }));
  const quick = $('.quick-grid .quick-card', doc);
  return {
    notices,
    days,
    quick: {title: safeText($('strong', quick)), subtitle: safeText($('em', quick))}
  };
}

function fillForm(state) {
  els.announcementFields.innerHTML = '';
  state.notices.forEach((notice, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'note-card';
    wrap.innerHTML = `<h3>Карточка ${i + 1}</h3>
      <div class="field"><label>Метка</label><input data-notice="${i}" data-key="label"></div>
      <div class="field"><label>Дата / подпись</label><input data-notice="${i}" data-key="time"></div>
      <div class="field"><label>Заголовок</label><input data-notice="${i}" data-key="title"></div>
      <div class="field"><label>Текст</label><textarea data-notice="${i}" data-key="text"></textarea></div>`;
    for (const [key, value] of Object.entries(notice)) $(`[data-key="${key}"]`, wrap).value = value;
    els.announcementFields.appendChild(wrap);
  });

  els.scheduleFields.innerHTML = '';
  state.days.forEach((day, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'day';
    const h = document.createElement('h3');
    h.textContent = day.name || `День ${i + 1}`;
    const ta = document.createElement('textarea');
    ta.dataset.day = String(i);
    ta.value = day.lessons.join('\n');
    const hint = document.createElement('div');
    hint.className = 'hint'; hint.textContent = 'Один урок — одна строка';
    wrap.append(h, ta, hint); els.scheduleFields.appendChild(wrap);
  });

  els.quickTitle.value = state.quick.title;
  els.quickSubtitle.value = state.quick.subtitle;
  els.memoText.value = loaded.memo.text;
  els.photoRulesText.value = loaded.photo.text;
  els.scheduleText.value = loaded.schedule.text;

  $$('input, textarea', els.editor).forEach(el => el.addEventListener('input', markDirty));
}

function collectForm() {
  const notices = [0,1,2].map(i => ({
    label: $(`[data-notice="${i}"][data-key="label"]`).value.trim(),
    time: $(`[data-notice="${i}"][data-key="time"]`).value.trim(),
    title: $(`[data-notice="${i}"][data-key="title"]`).value.trim(),
    text: $(`[data-notice="${i}"][data-key="text"]`).value.trim()
  }));
  const days = $$('[data-day]').map(ta => ta.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
  return {notices, days, quick:{title:els.quickTitle.value.trim(),subtitle:els.quickSubtitle.value.trim()}};
}

function updateIndexHtml(rawHtml, state) {
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const cards = $$('.notice-grid .notice-card', doc).slice(0, 3);
  if (cards.length !== 3) throw new Error('На главной не найдены три карточки объявлений. Структура сайта изменилась.');
  cards.forEach((card, i) => {
    $('.notice-label', card).textContent = state.notices[i].label;
    $('time', card).textContent = state.notices[i].time;
    $('h3', card).textContent = state.notices[i].title;
    $('p', card).textContent = state.notices[i].text;
  });
  const dayCards = $$('.week-grid .day-card', doc).slice(0, 5);
  if (dayCards.length !== 5) throw new Error('На главной не найдено пять дней расписания. Структура сайта изменилась.');
  dayCards.forEach((card, i) => {
    const list = $('ol', card);
    list.replaceChildren();
    const lessons = state.days[i].length ? state.days[i] : ['Расписание появится', 'после утверждения'];
    lessons.forEach(lesson => { const li = doc.createElement('li'); li.textContent = lesson; list.appendChild(li); });
  });
  const quick = $('.quick-grid .quick-card', doc);
  if (quick) { $('strong', quick).textContent = state.quick.title; $('em', quick).textContent = state.quick.subtitle; }
  return '<!doctype html>\n' + doc.documentElement.outerHTML + '\n';
}

async function loadAll() {
  setResult('', '');
  setStatus('busy', 'Загрузка…', 'Читаю актуальные файлы из GitHub');
  els.reloadBtn.disabled = true; els.publishBtn.disabled = true;
  try {
    const [index, memo, photo, schedule] = await Promise.all([
      readFile(FILES.index), readFile(FILES.memo), readFile(FILES.photo), readFile(FILES.schedule)
    ]);
    loaded = {index, memo, photo, schedule};
    fillForm(parseIndex(index.text));
    dirty = false; els.publishBtn.textContent = 'Опубликовать изменения';
    setStatus('ok', 'Подключено', `Репозиторий ${REPO} · ветка ${BRANCH}`);
  } catch (err) {
    setStatus('bad', 'Ошибка загрузки', err.message);
    setResult('error', err.message);
    throw err;
  } finally {
    els.reloadBtn.disabled = false; els.publishBtn.disabled = false;
  }
}

async function connect() {
  const value = els.token.value.trim();
  if (value) token = value;
  if (!token) return;
  els.connectBtn.disabled = true; els.loginError.classList.add('hidden');
  try {
    sessionStorage.setItem('klass1a-admin-token', token);
    await readFile(FILES.index);
    els.loginBox.classList.add('hidden'); els.editor.classList.remove('hidden');
    await loadAll();
    els.token.value = '';
  } catch (err) {
    sessionStorage.removeItem('klass1a-admin-token'); token = '';
    els.loginError.textContent = 'Не удалось войти. Проверьте токен и право Contents: Read and write.\n\n' + err.message;
    els.loginError.classList.remove('hidden');
  } finally { els.connectBtn.disabled = false; }
}

async function publish() {
  if (!loaded.index) return;
  if (!dirty && !confirm('Изменений не обнаружено. Всё равно создать новую публикацию?')) return;
  els.publishBtn.disabled = true; els.reloadBtn.disabled = true; setResult('', '');
  setStatus('busy', 'Публикация…', 'Сохраняю изменения в GitHub');
  try {
    // Re-read immediately before saving to avoid silently overwriting external changes.
    const fresh = await Promise.all([readFile(FILES.index), readFile(FILES.memo), readFile(FILES.photo), readFile(FILES.schedule)]);
    const [freshIndex, freshMemo, freshPhoto, freshSchedule] = fresh;
    if (freshIndex.sha !== loaded.index.sha || freshMemo.sha !== loaded.memo.sha || freshPhoto.sha !== loaded.photo.sha || freshSchedule.sha !== loaded.schedule.sha) {
      throw new Error('Кто-то изменил сайт после последней загрузки. Нажмите «Обновить данные», проверьте изменения и повторите публикацию.');
    }

    const form = collectForm();
    const newIndex = updateIndexHtml(freshIndex.text, form);
    const operations = [
      [freshIndex, newIndex, 'Update site content from admin panel'],
      [freshMemo, els.memoText.value, 'Update parent memo from admin panel'],
      [freshPhoto, els.photoRulesText.value, 'Update photo rules from admin panel'],
      [freshSchedule, els.scheduleText.value, 'Update schedule template from admin panel']
    ];

    const changed = operations.filter(([file, text]) => file.text !== text);
    if (!changed.length) {
      dirty = false; els.publishBtn.textContent = 'Опубликовать изменения';
      setStatus('ok', 'Всё актуально', 'Файлы уже содержат эти данные');
      setResult('ok', 'Изменений для публикации нет.');
      return;
    }

    let done = 0;
    for (const [file, text, message] of changed) {
      setStatus('busy', 'Публикация…', `Файл ${done + 1} из ${changed.length}: ${file.path}`);
      await writeFile(file, text, message);
      done++;
    }
    await loadAll();
    setResult('ok', `Готово. Обновлено файлов: ${changed.length}. GitHub Pages обычно подхватывает изменения автоматически.`);
  } catch (err) {
    setStatus('bad', 'Не опубликовано', err.message);
    setResult('error', err.message);
  } finally { els.publishBtn.disabled = false; els.reloadBtn.disabled = false; }
}

function logout() {
  sessionStorage.removeItem('klass1a-admin-token'); token = ''; loaded = {}; dirty = false;
  els.editor.classList.add('hidden'); els.loginBox.classList.remove('hidden'); els.token.value = '';
}

$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.toggle('active', x === tab));
  $$('.panel').forEach(panel => panel.classList.toggle('active', panel.id === `panel-${tab.dataset.tab}`));
}));

els.connectBtn.addEventListener('click', connect);
els.token.addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });
els.logoutBtn.addEventListener('click', logout);
els.reloadBtn.addEventListener('click', () => { if (!dirty || confirm('Несохранённые изменения будут потеряны. Обновить данные?')) loadAll(); });
els.publishBtn.addEventListener('click', publish);
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

if (token) {
  els.loginBox.classList.add('hidden'); els.editor.classList.remove('hidden');
  loadAll().catch(() => { logout(); });
}
