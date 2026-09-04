type Language = 'ru' | 'en';
type TaskStatus = 'pending' | 'completed' | 'archived';
type Priority = 'low' | 'medium' | 'high';
type TaskCategory = 'inbox' | 'work' | 'personal' | 'study' | 'health';

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
};

type TelegramMessage = {
  message_id: number;
  chat: { id: number };
  from?: TelegramUser;
  text?: string;
};

type TelegramCallback = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
};

type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: TelegramCallback;
};

type UserRow = {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  display_name: string | null;
  language: Language;
  timezone_offset_minutes: number;
  daily_digest_hour: number;
  daily_digest_enabled: number;
  last_digest_date: string | null;
  streak_count: number;
  streak_last_completed_at: string | null;
};

type TaskRow = {
  id: number;
  owner_id: number;
  title: string;
  status: TaskStatus;
  priority: Priority;
  category: TaskCategory;
  due_at: string | null;
  remind_at: string | null;
  reminder_sent: number;
  created_at: string;
  completed_at: string | null;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DAY_MS = 86_400_000;
const workerCrypto: Crypto = crypto;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isTelegramUser(value: unknown): value is TelegramUser {
  if (!isRecord(value) || !Number.isSafeInteger(value.id)) return false;
  return (value.username === undefined || isString(value.username))
    && (value.first_name === undefined || isString(value.first_name))
    && (value.language_code === undefined || isString(value.language_code));
}

function parseTelegramUpdate(value: unknown): TelegramUpdate | null {
  if (!isRecord(value)) return null;
  const update: TelegramUpdate = {};
  if (value.message !== undefined) {
    if (!isRecord(value.message) || !isRecord(value.message.chat)
      || !Number.isSafeInteger(value.message.message_id)
      || !Number.isSafeInteger(value.message.chat.id)) return null;
    const message: TelegramMessage = {
      message_id: Number(value.message.message_id),
      chat: { id: Number(value.message.chat.id) },
    };
    if (value.message.from !== undefined) {
      if (!isTelegramUser(value.message.from)) return null;
      message.from = value.message.from;
    }
    if (value.message.text !== undefined) {
      if (!isString(value.message.text)) return null;
      message.text = value.message.text;
    }
    update.message = message;
  }
  if (value.callback_query !== undefined) {
    const callback = value.callback_query;
    if (!isRecord(callback) || !isString(callback.id) || !isTelegramUser(callback.from)) return null;
    const parsed: TelegramCallback = { id: callback.id, from: callback.from };
    if (callback.data !== undefined) {
      if (!isString(callback.data)) return null;
      parsed.data = callback.data;
    }
    if (callback.message !== undefined) {
      if (!isRecord(callback.message) || !isRecord(callback.message.chat)
        || !Number.isSafeInteger(callback.message.message_id)
        || !Number.isSafeInteger(callback.message.chat.id)) return null;
      parsed.message = {
        message_id: Number(callback.message.message_id),
        chat: { id: Number(callback.message.chat.id) },
      };
    }
    update.callback_query = parsed;
  }
  return update;
}

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new HttpError(413, 'Request body is too large');
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new HttpError(413, 'Request body is too large');
  try {
    return JSON.parse(decoder.decode(bytes)) as unknown;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function htmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(key: string | Uint8Array, value: string): Promise<Uint8Array> {
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await workerCrypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await workerCrypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value)));
}

async function safeEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    workerCrypto.subtle.digest('SHA-256', encoder.encode(left)),
    workerCrypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  return workerCrypto.subtle.timingSafeEqual(leftHash, rightHash);
}

async function createSession(userId: number, secret: string): Promise<string> {
  const payload = base64Url(encoder.encode(JSON.stringify({ sub: userId, exp: Date.now() + 7 * DAY_MS })));
  return `${payload}.${base64Url(await hmac(secret, payload))}`;
}

async function readSession(request: Request, secret: string): Promise<number | null> {
  const value = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!value) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  if (!(await safeEqual(signature, base64Url(await hmac(secret, payload))))) return null;
  try {
    const decoded: unknown = JSON.parse(decoder.decode(decodeBase64Url(payload)));
    if (!isRecord(decoded) || !Number.isSafeInteger(decoded.sub) || typeof decoded.exp !== 'number') return null;
    return decoded.exp > Date.now() ? Number(decoded.sub) : null;
  } catch {
    return null;
  }
}

async function validateTelegramInitData(initData: string, token: string): Promise<TelegramUser | null> {
  const parameters = new URLSearchParams(initData);
  const receivedHash = parameters.get('hash');
  const authDate = Number(parameters.get('auth_date'));
  const rawUser = parameters.get('user');
  if (!receivedHash || !rawUser || !Number.isFinite(authDate)) return null;
  if (Math.abs(Date.now() / 1000 - authDate) > 86_400) return null;
  parameters.delete('hash');
  const checkString = [...parameters.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = await hmac('WebAppData', token);
  const calculated = [...(await hmac(secretKey, checkString))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  if (!(await safeEqual(receivedHash.toLowerCase(), calculated))) return null;
  try {
    const parsed: unknown = JSON.parse(rawUser);
    return isTelegramUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function partsAtOffset(date: Date, offsetMinutes: number): { year: number; month: number; day: number; hour: number; minute: number } {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function dateAtOffset(year: number, month: number, day: number, hour: number, minute: number, offsetMinutes: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60_000);
}

function localDateKey(date: Date, offsetMinutes: number): string {
  const parts = partsAtOffset(date, offsetMinutes);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function activeStreak(user: UserRow, now = new Date()): number {
  if (!user.streak_last_completed_at) return 0;
  const last = new Date(user.streak_last_completed_at);
  if (!Number.isFinite(last.getTime()) || now.getTime() - last.getTime() > DAY_MS) return 0;
  return Math.min(Math.max(user.streak_count, 0), 1000);
}

export function parseTaskText(text: string, now = new Date(), offsetMinutes = 180): { title: string; dueAt: string | null } {
  let normalized = text.trim();
  let dayOffset: number | null = null;
  const keyword = normalized.match(/(?:^|\s)(сегодня|today|завтра|tomorrow)(?=\s|$)/i);
  if (keyword) {
    dayOffset = /завтра|tomorrow/i.test(keyword[1]) ? 1 : 0;
    normalized = normalized.replace(keyword[0], ' ');
  }
  const isoMatch = normalized.match(/(?:^|\s)(\d{4})-(\d{2})-(\d{2})(?=\s|$)/);
  const timeMatch = normalized.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/);
  const current = partsAtOffset(now, offsetMinutes);
  let { year, month, day } = current;
  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
      return { title: text.trim(), dueAt: null };
    }
    normalized = normalized.replace(isoMatch[0], ' ');
  } else if (dayOffset !== null) {
    const selected = new Date(Date.UTC(year, month - 1, day + dayOffset));
    year = selected.getUTCFullYear();
    month = selected.getUTCMonth() + 1;
    day = selected.getUTCDate();
  }
  let dueAt: string | null = null;
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    normalized = normalized.replace(timeMatch[0], ' ').replace(/\s+(?:в|at)\s*$/i, '');
    let selected = dateAtOffset(year, month, day, hour, minute, offsetMinutes);
    if (!isoMatch && dayOffset === null && selected <= now) selected = new Date(selected.getTime() + DAY_MS);
    dueAt = selected.toISOString();
  } else if (isoMatch || dayOffset !== null) {
    dueAt = dateAtOffset(year, month, day, 9, 0, offsetMinutes).toISOString();
  }
  const title = normalized.replace(/\s{2,}/g, ' ').replace(/^[\s|,.-]+|[\s|,.-]+$/g, '');
  return { title: title || text.trim(), dueAt };
}

function formatDue(value: string | null, user: UserRow): string {
  if (!value) return user.language === 'ru' ? 'Без срока' : 'No due date';
  const date = new Date(value);
  const shifted = new Date(date.getTime() + user.timezone_offset_minutes * 60_000);
  const locale = user.language === 'ru' ? 'ru-RU' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(shifted);
}

async function telegram(env: Env, method: string, payload: unknown): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const raw: unknown = await response.json();
  if (!response.ok || !isRecord(raw) || raw.ok !== true) {
    const description = isRecord(raw) && isString(raw.description) ? raw.description : `HTTP ${response.status}`;
    throw new Error(`Telegram ${method}: ${description}`);
  }
}

async function sendMessage(env: Env, chatId: number, text: string, replyMarkup?: Record<string, unknown>): Promise<void> {
  await telegram(env, 'sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function ensureUser(env: Env, user: TelegramUser): Promise<UserRow> {
  const preferred: Language = user.language_code?.startsWith('en') ? 'en' : 'ru';
  await env.DB.prepare(
    `INSERT INTO users (telegram_id, username, first_name, language)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username, first_name = excluded.first_name`,
  ).bind(user.id, user.username ?? null, user.first_name ?? null, preferred).run();
  const row = await env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?1').bind(user.id).first<UserRow>();
  if (!row) throw new Error('Could not create Telegram user');
  return row;
}

function webAppKeyboard(language: Language, webAppUrl: string): Record<string, unknown> {
  return { inline_keyboard: [[{
    text: language === 'ru' ? '🚀 Открыть TaskPilot' : '🚀 Open TaskPilot',
    web_app: { url: webAppUrl },
  }]] };
}

function languageKeyboard(): Record<string, unknown> {
  return { inline_keyboard: [[
    { text: '🇷🇺 Русский', callback_data: 'lang:ru' },
    { text: '🇬🇧 English', callback_data: 'lang:en' },
  ]] };
}

function taskKeyboard(taskId: number, language: Language, webAppUrl: string): Record<string, unknown> {
  return { inline_keyboard: [
    [
      { text: language === 'ru' ? '✅ Готово' : '✅ Done', callback_data: `done:${taskId}` },
      { text: language === 'ru' ? '🗑 Удалить' : '🗑 Delete', callback_data: `delete:${taskId}` },
    ],
    [{ text: language === 'ru' ? 'Открыть Mini App ↗' : 'Open Mini App ↗', web_app: { url: webAppUrl } }],
  ] };
}

function settingsKeyboard(user: UserRow): Record<string, unknown> {
  const digest = user.daily_digest_enabled === 1;
  return { inline_keyboard: [
    [
      { text: user.language === 'ru' ? '🇷🇺 Русский' : '🇬🇧 English', callback_data: 'settings:language' },
      { text: digest ? '🔔 Digest ON' : '🔕 Digest OFF', callback_data: `digest:${digest ? 'off' : 'on'}` },
    ],
    [8, 9, 10].map((hour) => ({ text: `${hour === user.daily_digest_hour ? '✓ ' : ''}${hour}:00`, callback_data: `digest-hour:${hour}` })),
    [-300, 0, 180, 300].map((offset) => ({
      text: `${offset === user.timezone_offset_minutes ? '✓ ' : ''}UTC${offset >= 0 ? '+' : ''}${offset / 60}`,
      callback_data: `tz:${offset}`,
    })),
  ] };
}

async function createTask(
  env: Env,
  owner: UserRow,
  rawText: string,
  priority: Priority = 'low',
  category: TaskCategory = 'inbox',
): Promise<TaskRow> {
  const parsed = parseTaskText(rawText, new Date(), owner.timezone_offset_minutes);
  const task = await env.DB.prepare(
    `INSERT INTO tasks (owner_id, title, priority, category, due_at, remind_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5) RETURNING *`,
  ).bind(owner.telegram_id, parsed.title, priority, category, parsed.dueAt).first<TaskRow>();
  if (!task) throw new Error('Could not create task');
  return task;
}

async function sendTaskList(env: Env, chatId: number, user: UserRow, todayOnly: boolean): Promise<void> {
  let sql = `SELECT * FROM tasks WHERE owner_id = ?1 AND status = 'pending'`;
  const bindings: (string | number)[] = [user.telegram_id];
  if (todayOnly) {
    const now = partsAtOffset(new Date(), user.timezone_offset_minutes);
    bindings.push(
      dateAtOffset(now.year, now.month, now.day, 0, 0, user.timezone_offset_minutes).toISOString(),
      dateAtOffset(now.year, now.month, now.day + 1, 0, 0, user.timezone_offset_minutes).toISOString(),
    );
    sql += ' AND due_at >= ?2 AND due_at < ?3';
  }
  sql += ' ORDER BY due_at IS NULL, due_at, created_at DESC LIMIT 20';
  const { results } = await env.DB.prepare(sql).bind(...bindings).all<TaskRow>();
  if (results.length === 0) {
    await sendMessage(env, chatId,
      user.language === 'ru' ? '✨ Здесь пока пусто. Отправь мне новую задачу.' : '✨ Nothing here yet. Send me a new task.',
      webAppKeyboard(user.language, env.WEB_APP_URL));
    return;
  }
  const heading = user.language === 'ru'
    ? todayOnly ? '📅 <b>Сегодня</b>' : '📋 <b>Активные задачи</b>'
    : todayOnly ? '📅 <b>Today</b>' : '📋 <b>Active tasks</b>';
  const lines = results.map((task) => {
    const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
    return `${priority} <code>#${task.id}</code> ${htmlEscape(task.title)}\n   <i>${formatDue(task.due_at, user)}</i>`;
  });
  await sendMessage(env, chatId, `${heading}\n\n${lines.join('\n\n')}\n\n${user.language === 'ru' ? 'Завершить: /done ID' : 'Complete: /done ID'}`, webAppKeyboard(user.language, env.WEB_APP_URL));
}

async function changeTaskStatus(env: Env, ownerId: number, taskId: number, status: TaskStatus): Promise<boolean> {
  const current = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?1 AND owner_id = ?2')
    .bind(taskId, ownerId).first<TaskRow>();
  if (!current || current.status === 'archived') return false;
  const completedAt = status === 'completed' ? current.completed_at || new Date().toISOString() : null;
  if (status !== 'completed' || current.status === 'completed') {
    const result = await env.DB.prepare(
      'UPDATE tasks SET status = ?1, completed_at = ?2 WHERE id = ?3 AND owner_id = ?4',
    ).bind(status, completedAt, taskId, ownerId).run();
    return result.meta.changes > 0;
  }
  const user = await env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?1').bind(ownerId).first<UserRow>();
  if (!user) return false;
  const now = new Date(completedAt || new Date().toISOString());
  const previous = user.streak_last_completed_at ? new Date(user.streak_last_completed_at) : null;
  const stillActive = previous && Number.isFinite(previous.getTime()) && now.getTime() - previous.getTime() <= DAY_MS;
  const sameDay = previous && localDateKey(previous, user.timezone_offset_minutes) === localDateKey(now, user.timezone_offset_minutes);
  const nextStreak = sameDay ? activeStreak(user, now) : stillActive ? Math.min(activeStreak(user, now) + 1, 1000) : 1;
  const results = await env.DB.batch([
    env.DB.prepare('UPDATE tasks SET status = ?1, completed_at = ?2 WHERE id = ?3 AND owner_id = ?4')
      .bind(status, completedAt, taskId, ownerId),
    env.DB.prepare('UPDATE users SET streak_count = ?1, streak_last_completed_at = ?2 WHERE telegram_id = ?3')
      .bind(nextStreak, completedAt, ownerId),
  ]);
  return results[0].meta.changes > 0;
}

async function handleMessage(env: Env, message: TelegramMessage): Promise<void> {
  if (!message.from || !message.text) return;
  const user = await ensureUser(env, message.from);
  const text = message.text.trim();
  const [rawCommand] = text.split(/\s+/, 1);
  const command = rawCommand.split('@')[0].toLowerCase();
  const argument = text.slice(rawCommand.length).trim();

  if (command === '/start') {
    const name = htmlEscape(user.display_name || user.first_name || (user.language === 'ru' ? 'друг' : 'friend'));
    const welcome = user.language === 'ru'
      ? `Привет, <b>${name}</b>! Я TaskPilot — твой персональный менеджер задач.\n\nОтправь задачу обычным сообщением:\n<code>Подготовить презентацию завтра 14:30</code>\n\nЯ сохраню её, напомню вовремя и покажу в Mini App.`
      : `Hi, <b>${name}</b>! I am TaskPilot — your personal task manager.\n\nSend a task as a normal message:\n<code>Prepare the presentation tomorrow 14:30</code>\n\nI will save it, remind you on time, and show it in the Mini App.`;
    await sendMessage(env, message.chat.id, welcome, webAppKeyboard(user.language, env.WEB_APP_URL));
    return;
  }
  if (command === '/app') {
    await sendMessage(env, message.chat.id,
      user.language === 'ru' ? 'Управляй задачами в Mini App:' : 'Manage your tasks in the Mini App:',
      webAppKeyboard(user.language, env.WEB_APP_URL));
    return;
  }
  if (command === '/language') {
    await sendMessage(env, message.chat.id, user.language === 'ru' ? 'Выбери язык:' : 'Choose a language:', languageKeyboard());
    return;
  }
  if (command === '/today' || command === '/tasks') {
    await sendTaskList(env, message.chat.id, user, command === '/today');
    return;
  }
  if (command === '/done' || command === '/delete') {
    const taskId = Number(argument.replace(/^#/, ''));
    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      await sendMessage(env, message.chat.id, user.language === 'ru' ? `Укажи ID: <code>${command} 12</code>` : `Add an ID: <code>${command} 12</code>`);
      return;
    }
    const changed = await changeTaskStatus(env, user.telegram_id, taskId, command === '/done' ? 'completed' : 'archived');
    await sendMessage(env, message.chat.id, changed
      ? user.language === 'ru' ? command === '/done' ? '✅ Задача выполнена.' : '🗑 Задача удалена.' : command === '/done' ? '✅ Task completed.' : '🗑 Task deleted.'
      : user.language === 'ru' ? 'Не нашёл такую активную задачу.' : 'Active task not found.');
    return;
  }
  if (command === '/settings') {
    const offset = user.timezone_offset_minutes;
    const zone = `UTC${offset >= 0 ? '+' : ''}${offset / 60}`;
    await sendMessage(env, message.chat.id,
      user.language === 'ru'
        ? `⚙️ <b>Настройки</b>\n\nЧасовой пояс: ${zone}\nУтренняя сводка: ${user.daily_digest_enabled ? `${user.daily_digest_hour}:00` : 'выключена'}`
        : `⚙️ <b>Settings</b>\n\nTime zone: ${zone}\nMorning digest: ${user.daily_digest_enabled ? `${user.daily_digest_hour}:00` : 'off'}`,
      settingsKeyboard(user));
    return;
  }
  if (command === '/help') {
    await sendMessage(env, message.chat.id,
      user.language === 'ru'
        ? '🧭 <b>Команды TaskPilot</b>\n\n/new Текст — создать задачу\n/today — план на сегодня\n/tasks — все активные\n/done ID — выполнить\n/delete ID — удалить\n/app — открыть Mini App\n/language — сменить язык\n/settings — часовой пояс и сводка\n/help — эта подсказка\n\nИли просто напиши: <code>Купить билеты завтра 18:00</code>'
        : '🧭 <b>TaskPilot commands</b>\n\n/new Text — create a task\n/today — today’s plan\n/tasks — all active tasks\n/done ID — complete\n/delete ID — delete\n/app — open Mini App\n/language — change language\n/settings — time zone and digest\n/help — this guide\n\nOr simply write: <code>Buy tickets tomorrow 18:00</code>');
    return;
  }

  let taskText = text;
  if (command === '/new') {
    taskText = argument;
    if (!taskText) {
      await sendMessage(env, message.chat.id, user.language === 'ru' ? 'Напиши задачу после /new.' : 'Write a task after /new.');
      return;
    }
  } else if (text.startsWith('/')) {
    await sendMessage(env, message.chat.id, user.language === 'ru' ? 'Не знаю эту команду. Открой /help.' : 'I do not know that command. Open /help.');
    return;
  }
  if (taskText.length > 500) {
    await sendMessage(env, message.chat.id, user.language === 'ru' ? 'Задача слишком длинная — максимум 500 символов.' : 'The task is too long — 500 characters maximum.');
    return;
  }
  const task = await createTask(env, user, taskText);
  await sendMessage(env, message.chat.id,
    user.language === 'ru'
      ? `✅ <b>Задача создана</b>\n\n${htmlEscape(task.title)}\n⏰ ${formatDue(task.due_at, user)}`
      : `✅ <b>Task created</b>\n\n${htmlEscape(task.title)}\n⏰ ${formatDue(task.due_at, user)}`,
    taskKeyboard(task.id, user.language, env.WEB_APP_URL));
}

async function answerCallback(env: Env, callback: TelegramCallback, text?: string): Promise<void> {
  await telegram(env, 'answerCallbackQuery', { callback_query_id: callback.id, ...(text ? { text } : {}) });
}

async function handleCallback(env: Env, callback: TelegramCallback): Promise<void> {
  const data = callback.data || '';
  let user = await ensureUser(env, callback.from);
  if (data.startsWith('lang:')) {
    const language: Language = data.endsWith(':en') ? 'en' : 'ru';
    await env.DB.prepare('UPDATE users SET language = ?1 WHERE telegram_id = ?2').bind(language, user.telegram_id).run();
    await answerCallback(env, callback, language === 'ru' ? 'Язык сохранён' : 'Language saved');
    if (callback.message) await sendMessage(env, callback.message.chat.id, language === 'ru' ? 'Готово — теперь говорим по-русски 🇷🇺' : 'Done — we now speak English 🇬🇧', webAppKeyboard(language, env.WEB_APP_URL));
    return;
  }
  if (data === 'settings:language') {
    await answerCallback(env, callback);
    if (callback.message) await sendMessage(env, callback.message.chat.id, user.language === 'ru' ? 'Выбери язык:' : 'Choose a language:', languageKeyboard());
    return;
  }
  if (data.startsWith('done:') || data.startsWith('delete:')) {
    const taskId = Number(data.split(':')[1]);
    const status: TaskStatus = data.startsWith('done:') ? 'completed' : 'archived';
    const changed = Number.isSafeInteger(taskId) && await changeTaskStatus(env, user.telegram_id, taskId, status);
    await answerCallback(env, callback, changed
      ? user.language === 'ru' ? status === 'completed' ? 'Готово! ✨' : 'Удалено' : status === 'completed' ? 'Done! ✨' : 'Deleted'
      : user.language === 'ru' ? 'Задача не найдена' : 'Task not found');
    if (changed && callback.message) {
      await telegram(env, 'editMessageReplyMarkup', { chat_id: callback.message.chat.id, message_id: callback.message.message_id, reply_markup: { inline_keyboard: [] } });
    }
    return;
  }
  if (data.startsWith('digest:')) {
    const enabled = data.endsWith(':on') ? 1 : 0;
    await env.DB.prepare('UPDATE users SET daily_digest_enabled = ?1 WHERE telegram_id = ?2').bind(enabled, user.telegram_id).run();
    user = { ...user, daily_digest_enabled: enabled };
    await answerCallback(env, callback, enabled ? 'Digest ON' : 'Digest OFF');
  } else if (data.startsWith('digest-hour:')) {
    const hour = Number(data.split(':')[1]);
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
      await env.DB.prepare('UPDATE users SET daily_digest_hour = ?1, daily_digest_enabled = 1 WHERE telegram_id = ?2').bind(hour, user.telegram_id).run();
      user = { ...user, daily_digest_hour: hour, daily_digest_enabled: 1 };
      await answerCallback(env, callback, `${hour}:00`);
    }
  } else if (data.startsWith('tz:')) {
    const offset = Number(data.split(':')[1]);
    if (Number.isInteger(offset) && offset >= -720 && offset <= 840) {
      await env.DB.prepare('UPDATE users SET timezone_offset_minutes = ?1 WHERE telegram_id = ?2').bind(offset, user.telegram_id).run();
      user = { ...user, timezone_offset_minutes: offset };
      await answerCallback(env, callback, `UTC${offset >= 0 ? '+' : ''}${offset / 60}`);
    }
  } else {
    await answerCallback(env, callback);
    return;
  }
  if (callback.message) {
    await telegram(env, 'editMessageReplyMarkup', {
      chat_id: callback.message.chat.id,
      message_id: callback.message.message_id,
      reply_markup: settingsKeyboard(user),
    });
  }
}

async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  const provided = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!(await safeEqual(provided, env.WEBHOOK_SECRET))) return json({ ok: false }, 401);
  const update = parseTelegramUpdate(await readJson(request, 256_000));
  if (!update) throw new HttpError(400, 'Invalid Telegram update');
  if (update.message) await handleMessage(env, update.message);
  if (update.callback_query) await handleCallback(env, update.callback_query);
  return json({ ok: true });
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('origin');
  return {
    ...(origin === env.WEB_APP_URL ? { 'access-control-allow-origin': origin } : {}),
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    vary: 'Origin',
  };
}

function taskJson(task: TaskRow): Record<string, unknown> {
  return {
    id: task.id, title: task.title, description: null, status: task.status, priority: task.priority,
    category: task.category, due_at: task.due_at, remind_at: task.remind_at,
    recurrence: null, category_id: null, completed_at: task.completed_at,
  };
}

function parsePriority(value: unknown): Priority | null {
  return value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

function parseCategory(value: unknown): TaskCategory | null {
  return value === 'inbox' || value === 'work' || value === 'personal'
    || value === 'study' || value === 'health' ? value : null;
}

function parseStatus(value: unknown): TaskStatus | null {
  return value === 'pending' || value === 'completed' || value === 'archived' ? value : null;
}

function parseNullableDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (!isString(value)) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (url.pathname === '/api/v1/auth/telegram' && request.method === 'POST') {
    const body = await readJson(request, 32_000);
    const initData = isRecord(body) && isString(body.init_data) ? body.init_data : '';
    const telegramUser = initData ? await validateTelegramInitData(initData, env.BOT_TOKEN) : null;
    if (!telegramUser) return json({ detail: 'Invalid Telegram authorization' }, 401, cors);
    const user = await ensureUser(env, telegramUser);
    return json({ access_token: await createSession(user.telegram_id, env.SESSION_SECRET), token_type: 'bearer' }, 200, cors);
  }
  const userId = await readSession(request, env.SESSION_SECRET);
  if (!userId) return json({ detail: 'Not authenticated' }, 401, cors);
  const user = await env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?1').bind(userId).first<UserRow>();
  if (!user) return json({ detail: 'User not found' }, 404, cors);

  if (url.pathname === '/api/v1/users/me' && request.method === 'GET') {
    return json({
      first_name: user.first_name, display_name: user.display_name, language: user.language,
      timezone_offset_minutes: user.timezone_offset_minutes,
      daily_digest_hour: user.daily_digest_hour,
      daily_digest_enabled: user.daily_digest_enabled === 1,
      streak_count: activeStreak(user),
    }, 200, cors);
  }
  if (url.pathname === '/api/v1/users/me' && request.method === 'PATCH') {
    const body = await readJson(request, 16_000);
    if (!isRecord(body)) return json({ detail: 'Invalid settings' }, 422, cors);
    const displayName = body.display_name === undefined
      ? user.display_name
      : isString(body.display_name) && body.display_name.trim().length <= 64
        ? body.display_name.trim() || null
        : undefined;
    if (displayName === undefined) return json({ detail: 'Invalid display name' }, 422, cors);
    const language = body.language === 'ru' || body.language === 'en' ? body.language : user.language;
    const offset = Number.isInteger(body.timezone_offset_minutes) && Number(body.timezone_offset_minutes) >= -720 && Number(body.timezone_offset_minutes) <= 840
      ? Number(body.timezone_offset_minutes) : user.timezone_offset_minutes;
    const digestHour = Number.isInteger(body.daily_digest_hour) && Number(body.daily_digest_hour) >= 0 && Number(body.daily_digest_hour) <= 23
      ? Number(body.daily_digest_hour) : user.daily_digest_hour;
    const digestEnabled = typeof body.daily_digest_enabled === 'boolean' ? Number(body.daily_digest_enabled) : user.daily_digest_enabled;
    await env.DB.prepare(
      `UPDATE users SET display_name = ?1, language = ?2, timezone_offset_minutes = ?3,
       daily_digest_hour = ?4, daily_digest_enabled = ?5 WHERE telegram_id = ?6`,
    ).bind(displayName, language, offset, digestHour, digestEnabled, userId).run();
    return json({ first_name: user.first_name, display_name: displayName, language, timezone_offset_minutes: offset, daily_digest_hour: digestHour, daily_digest_enabled: digestEnabled === 1, streak_count: activeStreak(user) }, 200, cors);
  }
  if (url.pathname === '/api/v1/notifications/test' && request.method === 'POST') {
    await sendMessage(env, userId, user.language === 'ru'
      ? '🔔 <b>TaskPilot на связи</b>\nУведомления работают. Напоминания будут приходить сюда, в Telegram.'
      : '🔔 <b>TaskPilot is connected</b>\nNotifications work. Your reminders will arrive here in Telegram.');
    return json({ ok: true }, 200, cors);
  }
  if (url.pathname === '/api/v1/tasks' && request.method === 'GET') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 100);
    const status = parseStatus(url.searchParams.get('status'));
    const selectedStatus = status || 'pending';
    const { results } = await env.DB.prepare(
      `SELECT * FROM tasks WHERE owner_id = ?1 AND status = ?2
       ORDER BY due_at IS NULL, due_at, created_at DESC LIMIT ?3`,
    ).bind(userId, selectedStatus, limit).all<TaskRow>();
    return json({ items: results.map(taskJson), total: results.length }, 200, cors);
  }
  if (url.pathname === '/api/v1/tasks' && request.method === 'POST') {
    const body = await readJson(request, 32_000);
    if (!isRecord(body) || !isString(body.title)) return json({ detail: 'Invalid title' }, 422, cors);
    const title = body.title.trim();
    if (!title || title.length > 500) return json({ detail: 'Invalid title' }, 422, cors);
    const priority = parsePriority(body.priority) || 'low';
    const category = parseCategory(body.category) || 'inbox';
    const task = await createTask(env, user, title, priority, category);
    if (body.due_at !== undefined) {
      const dueAt = parseNullableDate(body.due_at);
      if (dueAt === undefined) return json({ detail: 'Invalid due date' }, 422, cors);
      await env.DB.prepare('UPDATE tasks SET due_at = ?1, remind_at = ?1, reminder_sent = 0 WHERE id = ?2 AND owner_id = ?3').bind(dueAt, task.id, userId).run();
      task.due_at = dueAt;
      task.remind_at = dueAt;
    }
    return json(taskJson(task), 201, cors);
  }
  const taskMatch = url.pathname.match(/^\/api\/v1\/tasks\/(\d+)$/);
  if (taskMatch && request.method === 'PATCH') {
    const taskId = Number(taskMatch[1]);
    const body = await readJson(request, 32_000);
    if (!isRecord(body)) return json({ detail: 'Invalid task' }, 422, cors);
    const current = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?1 AND owner_id = ?2').bind(taskId, userId).first<TaskRow>();
    if (!current) return json({ detail: 'Task not found' }, 404, cors);
    const title = body.title === undefined ? current.title : isString(body.title) ? body.title.trim() : '';
    if (!title || title.length > 500) return json({ detail: 'Invalid title' }, 422, cors);
    const status = body.status === undefined ? current.status : parseStatus(body.status);
    const priority = body.priority === undefined ? current.priority : parsePriority(body.priority);
    const category = body.category === undefined ? current.category : parseCategory(body.category);
    const dueAt = body.due_at === undefined ? current.due_at : parseNullableDate(body.due_at);
    if (!status || !priority || !category || dueAt === undefined) return json({ detail: 'Invalid task fields' }, 422, cors);
    const completedAt = status === 'completed' ? current.completed_at || new Date().toISOString() : null;
    await env.DB.prepare(
      `UPDATE tasks SET title = ?1, status = ?2, priority = ?3, category = ?4, due_at = ?5,
       remind_at = ?5, reminder_sent = 0, completed_at = ?6 WHERE id = ?7 AND owner_id = ?8`,
    ).bind(title, status, priority, category, dueAt, completedAt, taskId, userId).run();
    if (status === 'completed' && current.status !== 'completed') {
      const previous = user.streak_last_completed_at ? new Date(user.streak_last_completed_at) : null;
      const now = new Date(completedAt || new Date().toISOString());
      const stillActive = previous && Number.isFinite(previous.getTime()) && now.getTime() - previous.getTime() <= DAY_MS;
      const sameDay = previous && localDateKey(previous, user.timezone_offset_minutes) === localDateKey(now, user.timezone_offset_minutes);
      const nextStreak = sameDay ? activeStreak(user, now) : stillActive ? Math.min(activeStreak(user, now) + 1, 1000) : 1;
      await env.DB.prepare('UPDATE users SET streak_count = ?1, streak_last_completed_at = ?2 WHERE telegram_id = ?3')
        .bind(nextStreak, completedAt, userId).run();
    }
    const updated = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?1 AND owner_id = ?2').bind(taskId, userId).first<TaskRow>();
    return updated ? json(taskJson(updated), 200, cors) : json({ detail: 'Task not found' }, 404, cors);
  }
  if (taskMatch && request.method === 'DELETE') {
    const changed = await changeTaskStatus(env, userId, Number(taskMatch[1]), 'archived');
    return changed ? new Response(null, { status: 204, headers: cors }) : json({ detail: 'Task not found' }, 404, cors);
  }
  return json({ detail: 'Not found' }, 404, cors);
}

async function sendScheduledNotifications(env: Env): Promise<void> {
  const now = new Date();
  const { results: reminders } = await env.DB.prepare(
    `SELECT tasks.*, users.language, users.timezone_offset_minutes,
            users.daily_digest_hour, users.daily_digest_enabled, users.last_digest_date,
            users.username, users.first_name
     FROM tasks JOIN users ON users.telegram_id = tasks.owner_id
     WHERE tasks.status = 'pending' AND tasks.reminder_sent = 0
       AND tasks.remind_at IS NOT NULL AND tasks.remind_at <= ?1 LIMIT 50`,
  ).bind(now.toISOString()).all<TaskRow & UserRow>();
  for (const task of reminders) {
    try {
      await sendMessage(env, task.owner_id,
        task.language === 'ru' ? `⏰ <b>Время задачи</b>\n\n${htmlEscape(task.title)}` : `⏰ <b>Task reminder</b>\n\n${htmlEscape(task.title)}`,
        taskKeyboard(task.id, task.language, env.WEB_APP_URL));
      await env.DB.prepare('UPDATE tasks SET reminder_sent = 1 WHERE id = ?1').bind(task.id).run();
    } catch (error) {
      console.error(JSON.stringify({ message: 'reminder_failed', taskId: task.id, error: error instanceof Error ? error.message : String(error) }));
    }
  }
  const { results: users } = await env.DB.prepare('SELECT * FROM users WHERE daily_digest_enabled = 1').all<UserRow>();
  for (const user of users) {
    const local = partsAtOffset(now, user.timezone_offset_minutes);
    const dateKey = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
    if (local.hour !== user.daily_digest_hour || user.last_digest_date === dateKey) continue;
    const start = dateAtOffset(local.year, local.month, local.day, 0, 0, user.timezone_offset_minutes).toISOString();
    const end = dateAtOffset(local.year, local.month, local.day + 1, 0, 0, user.timezone_offset_minutes).toISOString();
    const { results: tasks } = await env.DB.prepare(
      `SELECT * FROM tasks WHERE owner_id = ?1 AND status = 'pending'
       AND due_at >= ?2 AND due_at < ?3 ORDER BY due_at LIMIT 20`,
    ).bind(user.telegram_id, start, end).all<TaskRow>();
    try {
      if (tasks.length > 0) {
        const lines = tasks.map((task, index) => `${index + 1}. ${htmlEscape(task.title)} · ${formatDue(task.due_at, user)}`);
        await sendMessage(env, user.telegram_id,
          `${user.language === 'ru' ? '☀️ <b>План на сегодня</b>' : '☀️ <b>Today’s plan</b>'}\n\n${lines.join('\n')}`,
          webAppKeyboard(user.language, env.WEB_APP_URL));
      }
      await env.DB.prepare('UPDATE users SET last_digest_date = ?1 WHERE telegram_id = ?2').bind(dateKey, user.telegram_id).run();
    } catch (error) {
      console.error(JSON.stringify({ message: 'digest_failed', userId: user.telegram_id, error: error instanceof Error ? error.message : String(error) }));
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/health') return json({ status: 'ok', service: 'TaskPilot', version: '1.0.0' });
      if (url.pathname === '/telegram/webhook' && request.method === 'POST') return await handleTelegramWebhook(request, env);
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      return Response.redirect(env.WEB_APP_URL, 302);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      console.error(JSON.stringify({ message: 'request_failed', path: url.pathname, status, error: error instanceof Error ? error.message : String(error) }));
      return json({ detail: status === 500 ? 'Internal server error' : error instanceof Error ? error.message : 'Request failed' }, status, corsHeaders(request, env));
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext): Promise<void> {
    context.waitUntil(sendScheduledNotifications(env));
  },
} satisfies ExportedHandler<Env>;
