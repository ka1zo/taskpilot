'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Plus,
  Search,
  Save,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Target,
  TimerReset,
  Trash2,
  UserRound,
  RotateCcw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  authenticateTelegram,
  createRemoteTask,
  deleteRemoteTask,
  getTelegramInitData,
  loadCurrentUser,
  loadTasks,
  sendTestNotification,
  setRemoteTaskCompleted,
  updateRemoteTask,
  updateRemoteUser,
  type ApiTask,
} from '@/lib/api';

type Language = 'ru' | 'en';
type Filter = 'today' | 'all';
type TaskCategory = 'inbox' | 'work' | 'personal' | 'study' | 'health';
type Task = {
  id: number;
  title: string;
  dueAt: string | null;
  priority: 'high' | 'medium' | 'low';
  category: TaskCategory;
  completed: boolean;
  completedAt: string | null;
};

type LocalSnapshot = {
  tasks: Task[];
  language: Language;
  profileName: string;
  timezoneOffset: number;
  digestHour: number;
  digestEnabled: boolean;
  streak: number;
  dark: boolean;
  focusSeconds: number;
  focusTaskId: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStoredTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  return typeof value.id === 'number'
    && typeof value.title === 'string'
    && (value.dueAt === null || typeof value.dueAt === 'string')
    && (value.priority === 'low' || value.priority === 'medium' || value.priority === 'high')
    && (value.category === 'inbox' || value.category === 'work' || value.category === 'personal' || value.category === 'study' || value.category === 'health')
    && typeof value.completed === 'boolean'
    && (value.completedAt === null || typeof value.completedAt === 'string');
}

function cacheKeyFor(initData: string | null): string {
  if (!initData) return 'taskpilot:browser:v1';
  try {
    const rawUser = new URLSearchParams(initData).get('user');
    const user: unknown = rawUser ? JSON.parse(rawUser) : null;
    if (isRecord(user) && typeof user.id === 'number') return `taskpilot:telegram:${user.id}:v1`;
  } catch {
    // Fall back to a device-only cache when Telegram data cannot be decoded.
  }
  return 'taskpilot:telegram:v1';
}

function readSnapshot(key: string): LocalSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) || 'null');
    if (!isRecord(parsed) || !Array.isArray(parsed.tasks)) return null;
    return {
      tasks: parsed.tasks.filter(isStoredTask),
      language: parsed.language === 'en' ? 'en' : 'ru',
      profileName: typeof parsed.profileName === 'string' ? parsed.profileName : 'Капитан',
      timezoneOffset: typeof parsed.timezoneOffset === 'number' ? parsed.timezoneOffset : 180,
      digestHour: typeof parsed.digestHour === 'number' ? parsed.digestHour : 9,
      digestEnabled: typeof parsed.digestEnabled === 'boolean' ? parsed.digestEnabled : true,
      streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
      dark: parsed.dark === true,
      focusSeconds: typeof parsed.focusSeconds === 'number' ? Math.min(Math.max(parsed.focusSeconds, 0), 25 * 60) : 25 * 60,
      focusTaskId: typeof parsed.focusTaskId === 'number' ? parsed.focusTaskId : null,
    };
  } catch {
    return null;
  }
}

const copy = {
  ru: {
    hello: 'Добрый день', lead: 'Держим курс на главное.', today: 'Сегодня', all: 'Все', completed: 'Готово', plan: 'План дня', left: 'осталось', done: 'выполнено', add: 'Новая задача', placeholder: 'Например, позвонить Анне в 18:00', create: 'Добавить', empty: 'Здесь всё чисто', emptyHint: 'Добавьте задачу или напишите боту в Telegram.', synced: 'Telegram подключён', local: 'Сохранено на устройстве', connecting: 'Подключаю Telegram…', error: 'Не удалось синхронизировать', noTime: 'Без времени', upcoming: 'Ближайшие задачи', noUpcoming: 'Нет задач с будущим временем', focus: 'Фокус-сессия', focusHint: 'Выберите одну задачу: таймер даст 25 минут непрерывной работы, затем её можно сразу завершить или выбрать следующую.', start: 'Начать фокус', pause: 'Пауза', reset: 'Сбросить', finishTask: 'Отметить выполненной', focusDone: 'Сессия завершена — отличная работа!', tasks: 'Обзор', inbox: 'Все задачи', settings: 'Настройки', search: 'Поиск', filters: 'Фильтры', resetFilters: 'Сбросить фильтры', edit: 'Редактировать задачу', taskName: 'Название', dueDate: 'Дата', dueTime: 'Время', priority: 'Приоритет', category: 'Цвет и категория', low: 'Низкий', medium: 'Средний', high: 'Высокий', save: 'Сохранить', remove: 'Удалить', removeTitle: 'Удалить задачу?', removeHint: 'Задача будет удалена из активного списка.', cancel: 'Отмена', profile: 'Профиль', profileHint: 'Имя, серия и ваша статистика TaskPilot.', preferences: 'Персональные настройки', yourName: 'Имя для приветствия', digest: 'Утренняя сводка', digestTime: 'Время сводки', timezone: 'Часовой пояс', close: 'Закрыть', notifications: 'Уведомления', notificationsHint: 'Здесь настраиваются утренняя сводка и напоминания о задачах. Все сообщения приходят в чат с ботом в Telegram.', testNotification: 'Отправить тест', testSent: 'Тест отправлен в Telegram', streak: 'дней серии', recentCompleted: 'Недавно выполнено', restore: 'Вернуть',
  },
  en: {
    hello: 'Good afternoon', lead: 'Stay on course for what matters.', today: 'Today', all: 'All', completed: 'Done', plan: 'Daily plan', left: 'remaining', done: 'completed', add: 'New task', placeholder: 'For example, call Anna at 18:00', create: 'Add', empty: 'All clear here', emptyHint: 'Add a task or message the Telegram bot.', synced: 'Telegram connected', local: 'Saved on this device', connecting: 'Connecting Telegram…', error: 'Could not sync', noTime: 'No time', upcoming: 'Upcoming tasks', noUpcoming: 'No tasks with a future time', focus: 'Focus session', focusHint: 'Choose one task: the timer gives you 25 uninterrupted minutes, then you can complete it or pick the next one.', start: 'Start focus', pause: 'Pause', reset: 'Reset', finishTask: 'Mark task complete', focusDone: 'Session complete — great work!', tasks: 'Overview', inbox: 'All tasks', settings: 'Settings', search: 'Search', filters: 'Filters', resetFilters: 'Reset filters', edit: 'Edit task', taskName: 'Title', dueDate: 'Date', dueTime: 'Time', priority: 'Priority', category: 'Color and category', low: 'Low', medium: 'Medium', high: 'High', save: 'Save', remove: 'Delete', removeTitle: 'Delete this task?', removeHint: 'The task will be removed from your active list.', cancel: 'Cancel', profile: 'Profile', profileHint: 'Your name, streak and TaskPilot stats.', preferences: 'Personal settings', yourName: 'Greeting name', digest: 'Morning digest', digestTime: 'Digest time', timezone: 'Time zone', close: 'Close', notifications: 'Notifications', notificationsHint: 'Configure task reminders and the morning digest here. Messages are delivered to your Telegram chat with the bot.', testNotification: 'Send a test', testSent: 'Test sent to Telegram', streak: 'day streak', recentCompleted: 'Recently completed', restore: 'Restore',
  },
};

function fromApiTask(task: ApiTask): Task {
  return { id: task.id, title: task.title, dueAt: task.due_at, priority: task.priority, category: task.category, completed: task.status === 'completed', completedAt: task.completed_at };
}

const categories: TaskCategory[] = ['inbox', 'work', 'personal', 'study', 'health'];

function categoryLabel(category: TaskCategory, language: Language): string {
  const labels = language === 'ru'
    ? { inbox: 'Входящие', work: 'Работа', personal: 'Личное', study: 'Учёба', health: 'Здоровье' }
    : { inbox: 'Inbox', work: 'Work', personal: 'Personal', study: 'Study', health: 'Health' };
  return labels[category];
}

function categoryColor(category: TaskCategory): string {
  return { inbox: 'bg-sky-500', work: 'bg-indigo-500', personal: 'bg-rose-500', study: 'bg-amber-400', health: 'bg-emerald-500' }[category];
}


function isToday(value: string | null): boolean {
  return value ? new Date(value).toDateString() === new Date().toDateString() : true;
}

function formatTime(value: string | null, language: Language): string {
  if (!value) return copy[language].noTime;
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function Home() {
  const [language, setLanguage] = useState<Language>('ru');
  const [filter, setFilter] = useState<Filter>('today');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState('');
  const [profileName, setProfileName] = useState('Капитан');
  const [nameDraft, setNameDraft] = useState('Капитан');
  const [quickCategory, setQuickCategory] = useState<TaskCategory>('inbox');
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newPriority, setNewPriority] = useState<Task['priority']>('low');
  const [newCategory, setNewCategory] = useState<TaskCategory>('inbox');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'local' | 'connecting' | 'live' | 'error'>('connecting');
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPriority, setEditPriority] = useState<Task['priority']>('low');
  const [editCategory, setEditCategory] = useState<TaskCategory>('inbox');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Task['priority'] | 'all'>('all');
  const [timezoneOffset, setTimezoneOffset] = useState(180);
  const [digestHour, setDigestHour] = useState(9);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusFinished, setFocusFinished] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [notificationTestState, setNotificationTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [streak, setStreak] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const t = copy[language];

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const initData = getTelegramInitData();
      const key = cacheKeyFor(initData);
      const cached = readSnapshot(key);
      if (cached) {
        setTasks(cached.tasks);
        setLanguage(cached.language);
        setProfileName(cached.profileName);
        setNameDraft(cached.profileName);
        setTimezoneOffset(cached.timezoneOffset);
        setDigestHour(cached.digestHour);
        setDigestEnabled(cached.digestEnabled);
        setStreak(cached.streak);
        setDark(cached.dark);
        setFocusSeconds(cached.focusSeconds);
        setFocusTaskId(cached.focusTaskId);
        document.documentElement.classList.toggle('dark', cached.dark);
      }
      setStorageKey(key);
      setCacheReady(true);
      if (!initData) {
        setSyncState('local');
        return;
      }
      setSyncState('connecting');
      authenticateTelegram(initData)
        .then(async (token) => {
          const [user, pendingTasks, completedTasks] = await Promise.all([
            loadCurrentUser(token),
            loadTasks(token),
            loadTasks(token, 'completed'),
          ]);
          if (cancelled) return;
          setAccessToken(token);
          setLanguage(user.language);
          const resolvedName = user.display_name || user.first_name || (user.language === 'ru' ? 'Капитан' : 'Captain');
          setProfileName(resolvedName);
          setNameDraft(resolvedName);
          setTasks([...pendingTasks, ...completedTasks].map(fromApiTask));
          setTimezoneOffset(user.timezone_offset_minutes);
          setDigestHour(user.daily_digest_hour);
          setDigestEnabled(user.daily_digest_enabled);
          setStreak(user.streak_count);
          setSyncState('live');
        })
        .catch(() => {
          if (!cancelled) setSyncState(cached ? 'local' : 'error');
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!storageKey || !cacheReady) return;
    const snapshot: LocalSnapshot = {
      tasks,
      language,
      profileName,
      timezoneOffset,
      digestHour,
      digestEnabled,
      streak,
      dark,
      focusSeconds,
      focusTaskId,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch {
      // Server synchronization remains the source of truth when device storage is unavailable.
    }
  }, [cacheReady, dark, digestEnabled, digestHour, focusSeconds, focusTaskId, language, profileName, storageKey, streak, tasks, timezoneOffset]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!focusRunning) return;
    const timer = window.setInterval(() => {
      setFocusSeconds((current) => {
        if (current <= 1) {
          setFocusRunning(false);
          setFocusFinished(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning]);

  const visibleTasks = useMemo(() => {
    const byFilter = filter === 'today'
      ? tasks.filter((task) => !task.completed && (!task.dueAt || (isToday(task.dueAt) && new Date(task.dueAt).getTime() >= now)))
      : tasks.filter((task) => !task.completed);
    const normalized = query.trim().toLocaleLowerCase(language === 'ru' ? 'ru-RU' : 'en-US');
    const byCategory = categoryFilter === 'all' ? byFilter : byFilter.filter((task) => task.category === categoryFilter);
    const byPriority = priorityFilter === 'all' ? byCategory : byCategory.filter((task) => task.priority === priorityFilter);
    return normalized ? byPriority.filter((task) => task.title.toLocaleLowerCase().includes(normalized)) : byPriority;
  }, [categoryFilter, filter, language, now, priorityFilter, query, tasks]);

  const completedToday = tasks.filter((task) => task.completed && task.completedAt && isToday(task.completedAt)).length;
  const pendingToday = tasks.filter((task) => !task.completed && (!task.dueAt || isToday(task.dueAt))).length;
  const plannedToday = completedToday + pendingToday;
  const progress = plannedToday === 0 ? 0 : Math.round((completedToday / plannedToday) * 100);
  const pendingTasks = tasks.filter((task) => !task.completed);
  const recentCompletedTasks = tasks
    .filter((task) => task.completed)
    .sort((left, right) => new Date(right.completedAt || 0).getTime() - new Date(left.completedAt || 0).getTime())
    .slice(0, 3);
  const focusTask = pendingTasks.find((task) => task.id === focusTaskId) || pendingTasks[0];
  const upcomingTasks = pendingTasks
    .filter((task) => task.dueAt && new Date(task.dueAt).getTime() >= now)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
    .slice(0, 3);

  async function addTask() {
    const title = draft.trim();
    if (!title) return;
    const optimisticId = Date.now();
    const optimistic: Task = { id: optimisticId, title, dueAt: null, priority: 'low', category: quickCategory, completed: false, completedAt: null };
    setTasks((current) => [optimistic, ...current]);
    setDraft('');
    if (!accessToken) return;
    try {
      const saved = await createRemoteTask(accessToken, title, 'low', quickCategory);
      setTasks((current) => current.map((task) => task.id === optimisticId ? fromApiTask(saved) : task));
    } catch {
      setTasks((current) => current.filter((task) => task.id !== optimisticId));
      setSyncState('error');
    }
  }

  async function createDetailedTask() {
    const title = newTitle.trim();
    if (!title) return;
    const dueAt = newDate
      ? new Date(`${newDate}T${newTime || '09:00'}:00`).toISOString()
      : null;
    const optimisticId = Date.now();
    const optimistic: Task = {
      id: optimisticId,
      title,
      dueAt,
      priority: newPriority,
      category: newCategory,
      completed: false,
      completedAt: null,
    };
    setTasks((current) => [optimistic, ...current]);
    setCreateTaskOpen(false);
    setNewTitle('');
    setNewDate('');
    setNewTime('');
    setNewPriority('low');
    setNewCategory('inbox');
    if (!accessToken) return;
    try {
      const saved = await createRemoteTask(accessToken, title, newPriority, newCategory, dueAt);
      setTasks((current) => current.map((task) => task.id === optimisticId ? fromApiTask(saved) : task));
    } catch {
      setTasks((current) => current.filter((task) => task.id !== optimisticId));
      setSyncState('error');
    }
  }

  async function toggleTask(taskId: number, completed: boolean) {
    const previousTask = tasks.find((task) => task.id === taskId);
    const previous = previousTask?.completed ?? false;
    const completedAt = completed ? new Date().toISOString() : null;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, completed, completedAt } : task));
    if (!accessToken) return;
    try {
      await setRemoteTaskCompleted(accessToken, taskId, completed);
      const user = await loadCurrentUser(accessToken);
      setStreak(user.streak_count);
    } catch {
      setTasks((current) => current.map((task) => task.id === taskId ? { ...task, completed: previous, completedAt: previousTask?.completedAt ?? null } : task));
      setSyncState('error');
    }
  }

  function openEditor(task: Task) {
    const due = task.dueAt ? new Date(task.dueAt) : null;
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDate(due ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}` : '');
    setEditTime(due ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}` : '');
    setEditPriority(task.priority);
    setEditCategory(task.category);
  }

  async function saveTask() {
    if (!selectedTask || !editTitle.trim()) return;
    const dueAt = editDate
      ? new Date(`${editDate}T${editTime || '09:00'}:00`).toISOString()
      : null;
    const next: Task = { ...selectedTask, title: editTitle.trim(), priority: editPriority, category: editCategory, dueAt };
    setTasks((current) => current.map((task) => task.id === next.id ? next : task));
    setSelectedTask(null);
    if (!accessToken) return;
    try {
      const saved = await updateRemoteTask(accessToken, next.id, { title: next.title, priority: next.priority, category: next.category, due_at: dueAt });
      setTasks((current) => current.map((task) => task.id === next.id ? fromApiTask(saved) : task));
    } catch {
      setSyncState('error');
    }
  }

  async function removeTask(task: Task) {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setSelectedTask(null);
    setDeleteTarget(null);
    if (!accessToken) return;
    try {
      await deleteRemoteTask(accessToken, task.id);
    } catch {
      setTasks((current) => [task, ...current]);
      setSyncState('error');
    }
  }

  async function saveSettings(fields: {
    display_name?: string;
    language?: Language;
    timezone_offset_minutes?: number;
    daily_digest_hour?: number;
    daily_digest_enabled?: boolean;
  }) {
    if (fields.display_name !== undefined) {
      setProfileName(fields.display_name);
      setNameDraft(fields.display_name);
    }
    if (fields.language) setLanguage(fields.language);
    if (fields.timezone_offset_minutes !== undefined) setTimezoneOffset(fields.timezone_offset_minutes);
    if (fields.daily_digest_hour !== undefined) setDigestHour(fields.daily_digest_hour);
    if (fields.daily_digest_enabled !== undefined) setDigestEnabled(fields.daily_digest_enabled);
    if (!accessToken) return;
    try {
      await updateRemoteUser(accessToken, fields);
    } catch {
      setSyncState('error');
    }
  }

  function resetFocus() {
    setFocusRunning(false);
    setFocusFinished(false);
    setFocusSeconds(25 * 60);
  }

  async function testNotification() {
    if (!accessToken) {
      setNotificationTestState('error');
      return;
    }
    setNotificationTestState('sending');
    try {
      await sendTestNotification(accessToken);
      setNotificationTestState('sent');
    } catch {
      setNotificationTestState('error');
    }
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  }

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'today', label: t.today },
    { id: 'all', label: t.all },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto min-h-screen max-w-[760px] overflow-hidden bg-background pb-28 shadow-[0_0_80px_rgba(11,22,37,.08)]">
        <section className="pilot-hero relative overflow-hidden px-5 pb-8 pt-5 text-white sm:px-8 sm:pt-7">
          <div className="pilot-orbit" aria-hidden="true" />
          <header className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/15 backdrop-blur"><Check className="size-5 stroke-[2.6] text-[#8df3c7]" /></span>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">TaskPilot</p><p className="text-sm font-semibold">{t.plan}</p></div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')} className="h-9 rounded-xl px-3 text-xs font-bold text-white/75 transition hover:bg-white/10" aria-label="Change language">{language.toUpperCase()}</button>
              <Button variant="ghost" size="icon" className="text-white/75 hover:bg-white/10 hover:text-white" onClick={() => setProfileOpen(true)} aria-label={t.profile}><UserRound /></Button>
              <Button variant="ghost" size="icon" className="relative text-white/75 hover:bg-white/10 hover:text-white" aria-label={t.notifications} onClick={() => setNotificationsOpen(true)}><Bell />{digestEnabled && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#8df3c7] ring-2 ring-[#111d30]" />}</Button>
            </div>
          </header>

          <div className="relative z-10 mt-10">
            <p className="text-sm text-white/58">{new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
            <h1 className="mt-1 text-[2rem] font-semibold tracking-[-0.055em] sm:text-[2.5rem]">{t.hello}, {profileName}</h1>
            <div className="mt-2 flex items-center gap-3"><p className="text-sm text-white/58">{t.lead}</p><span className="flex items-center gap-1 rounded-full bg-orange-400/12 px-2 py-1 text-xs font-semibold text-orange-200"><Flame className="size-3.5" />{streak} {t.streak}</span></div>
          </div>

          <div className="relative z-10 mt-8 grid grid-cols-[1fr_auto] items-center gap-5 rounded-[1.6rem] border border-white/10 bg-white/[.075] p-4 backdrop-blur-xl">
            <div>
              <div className="flex items-baseline gap-2"><span className="text-4xl font-semibold tracking-[-0.06em]">{progress}%</span><span className="text-xs text-white/55">{t.done}</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[linear-gradient(90deg,#7ce8bd,#a7f3d0)] transition-all" style={{ width: `${progress}%` }} /></div>
              <p className="mt-2 text-xs text-white/55">{pendingToday} {t.left}</p>
            </div>
            <div className="grid size-[78px] place-items-center rounded-full border border-white/10 bg-[#0c1727]/45"><Target className="size-7 text-[#8df3c7]" /></div>
          </div>
        </section>

        <section className="relative z-10 -mt-3 rounded-t-[1.75rem] bg-background px-4 pt-6 sm:px-7">
          <div className="rounded-2xl border border-border bg-card p-2 shadow-[0_18px_50px_-32px_rgba(15,23,42,.45)]">
            <div className="flex items-center gap-2">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Plus className="size-5" /></span>
              <Input id="new-task-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void addTask()} placeholder={t.placeholder} className="h-10 min-w-0 border-0 bg-transparent px-1 text-[15px] shadow-none focus-visible:ring-0" />
              <Button onClick={() => void addTask()} className="h-10 rounded-xl px-4 shadow-sm">{t.create}</Button>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto border-t border-border/60 px-1 pt-2">
              {categories.map((category) => <button key={category} onClick={() => setQuickCategory(category)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${quickCategory === category ? `${categoryColor(category)} text-white shadow-sm` : 'bg-muted text-muted-foreground hover:text-foreground'}`}><span className={`size-2 rounded-full ${quickCategory === category ? 'bg-white/80' : categoryColor(category)}`} />{categoryLabel(category, language)}</button>)}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex rounded-xl bg-muted p-1">
              {filters.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${filter === item.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{item.label}</button>)}
            </div>
            <div className="flex gap-1"><Button variant={filtersOpen ? 'secondary' : 'ghost'} size="icon" aria-label={t.filters} onClick={() => setFiltersOpen(true)} className="relative"><SlidersHorizontal />{(categoryFilter !== 'all' || priorityFilter !== 'all') && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />}</Button><Button variant={searchOpen ? 'secondary' : 'ghost'} size="icon" aria-label={t.search} onClick={() => setSearchOpen((current) => !current)}><Search /></Button></div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setCategoryFilter('all')} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${categoryFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{language === 'ru' ? 'Все категории' : 'All categories'}</button>
            {categories.map((category) => <button key={category} onClick={() => setCategoryFilter(category)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${categoryFilter === category ? `${categoryColor(category)} text-white shadow-sm` : 'bg-muted text-muted-foreground'}`}><span className={`size-2 rounded-full ${categoryFilter === category ? 'bg-white/80' : categoryColor(category)}`} />{categoryLabel(category, language)}</button>)}
          </div>

          {searchOpen && (
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${t.search}…`} className="h-11 rounded-xl bg-card pl-9" />
            </div>
          )}

          {filter === 'today' && !searchOpen && (
            <div className="mt-5 rounded-2xl border border-sky-500/15 bg-sky-500/[.055] p-4">
              <div className="flex items-center gap-2"><Clock3 className="size-4 text-sky-600" /><h2 className="text-sm font-semibold">{t.upcoming}</h2></div>
              <div className="mt-3 space-y-2">
                {upcomingTasks.map((task) => <button key={task.id} onClick={() => openEditor(task)} className="flex w-full items-center gap-3 rounded-xl bg-background/80 p-3 text-left transition hover:bg-background"><span className={`size-2.5 shrink-0 rounded-full ${categoryColor(task.category)}`} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span><span className="text-xs text-muted-foreground">{formatTime(task.dueAt, language)}</span><ChevronRight className="size-4 text-muted-foreground" /></button>)}
                {upcomingTasks.length === 0 && <p className="py-2 text-sm text-muted-foreground">{t.noUpcoming}</p>}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2.5">
            {visibleTasks.map((task) => (
              <article key={task.id} className="group flex items-center gap-3 overflow-hidden rounded-2xl border border-border/75 bg-card p-3.5 shadow-[0_10px_35px_-30px_rgba(15,23,42,.55)] transition hover:-translate-y-0.5 hover:border-primary/25">
                <span className={`-ml-3.5 h-11 w-1 shrink-0 rounded-r-full ${categoryColor(task.category)}`} />
                <Checkbox checked={task.completed} onCheckedChange={(checked) => void toggleTask(task.id, Boolean(checked))} aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`} className="size-5 rounded-full" />
                <div className="min-w-0 flex-1"><p className={`truncate text-[15px] font-medium ${task.completed ? 'text-muted-foreground line-through' : ''}`}>{task.title}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3" />{formatTime(task.dueAt, language)}<span>·</span><span>{categoryLabel(task.category, language)}</span>{task.priority !== 'low' && <><span>·</span><span>{task.priority === 'high' ? t.high : t.medium}</span></>}</p></div>
                <button onClick={() => setDeleteTarget(task)} className="grid size-9 place-items-center rounded-xl text-muted-foreground/50 hover:bg-rose-500/10 hover:text-rose-600" aria-label={t.remove}><Trash2 className="size-4" /></button>
                <button onClick={() => openEditor(task)} className="grid size-9 place-items-center rounded-xl text-muted-foreground/60 hover:bg-muted hover:text-foreground" aria-label={t.edit}><ChevronRight className="size-4" /></button>
              </article>
            ))}
            {visibleTasks.length === 0 && (
              <div className="grid place-items-center rounded-3xl border border-dashed border-border px-6 py-12 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-6" /></span><p className="mt-4 font-semibold">{t.empty}</p><p className="mt-1 max-w-[270px] text-sm leading-6 text-muted-foreground">{t.emptyHint}</p></div>
            )}
          </div>

          {recentCompletedTasks.length > 0 && (
            <div className="mt-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/[.045] p-4">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" /><h2 className="text-sm font-semibold">{t.recentCompleted}</h2></div>
              <div className="mt-3 space-y-2">
                {recentCompletedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 rounded-xl bg-background/80 p-3">
                    <span className={`size-2.5 shrink-0 rounded-full ${categoryColor(task.category)}`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through">{task.title}</span>
                    <Button variant="ghost" size="sm" onClick={() => void toggleTask(task.id, false)} className="shrink-0 rounded-lg text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-300"><RotateCcw />{t.restore}</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`mx-auto mt-6 flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs ${syncState === 'error' ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}><span className={`size-1.5 rounded-full ${syncState === 'connecting' ? 'animate-pulse bg-amber-400' : syncState === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`} />{syncState === 'live' ? t.synced : syncState === 'local' ? t.local : syncState === 'connecting' ? t.connecting : t.error}</div>
        </section>

        <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto flex h-16 max-w-[420px] items-center justify-around rounded-[1.35rem] border border-border/80 bg-background/94 px-3 shadow-[0_18px_50px_-18px_rgba(15,23,42,.45)] backdrop-blur-xl" aria-label="Quick actions">
          {[
            { icon: Plus, label: t.add, action: () => setCreateTaskOpen(true) },
            { icon: TimerReset, label: t.focus, action: () => setFocusOpen(true) },
            { icon: Settings2, label: t.settings, action: () => setSettingsOpen(true) },
          ].map(({ icon: NavIcon, label, action }) => <button key={label} onClick={action} className="flex min-w-24 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"><NavIcon className="size-4.5" />{label}</button>)}
        </nav>

        <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
          <DialogContent className="rounded-3xl p-5 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Plus className="size-5" /></span>{t.add}</DialogTitle>
              <DialogDescription>{language === 'ru' ? 'Добавьте детали сейчас — потом их всегда можно изменить.' : 'Add the details now — you can edit them anytime.'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label htmlFor="new-task-title">{t.taskName}</Label><Input id="new-task-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && newTitle.trim() && void createDetailedTask()} placeholder={t.placeholder} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="new-task-date">{t.dueDate}</Label><Input id="new-task-date" type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="new-task-time">{t.dueTime}</Label><Input id="new-task-time" type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} disabled={!newDate} /></div>
              </div>
              <div className="space-y-2"><Label>{t.category}</Label><div className="grid grid-cols-2 gap-2">{categories.map((category) => <button key={category} type="button" onClick={() => setNewCategory(category)} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${newCategory === category ? `${categoryColor(category)} border-transparent text-white shadow-sm` : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}><span className={`size-2.5 rounded-full ${newCategory === category ? 'bg-white/80' : categoryColor(category)}`} />{categoryLabel(category, language)}</button>)}</div></div>
              <div className="space-y-2"><Label>{t.priority}</Label><Select value={newPriority} onValueChange={(value) => setNewPriority(value as Task['priority'])}><SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">{t.low}</SelectItem><SelectItem value="medium">{t.medium}</SelectItem><SelectItem value="high">{t.high}</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter className="-mx-5 -mb-5 px-5"><Button variant="outline" onClick={() => setCreateTaskOpen(false)}>{t.cancel}</Button><Button onClick={() => void createDetailedTask()} disabled={!newTitle.trim()}><Plus />{t.create}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={focusOpen} onOpenChange={(open) => { setFocusOpen(open); if (!open) setFocusRunning(false); }}>
          <DialogContent className="overflow-hidden rounded-3xl border-violet-500/20 p-0 sm:max-w-md">
            <div className="bg-[linear-gradient(135deg,rgba(124,58,237,.14),rgba(59,130,246,.07))] p-5">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-300"><span className="grid size-10 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/20"><TimerReset className="size-5" /></span>{t.focus}</DialogTitle>
                <DialogDescription>{t.focusHint}</DialogDescription>
              </DialogHeader>
              {focusTask ? (
                <div className="mt-5">
                  <Select value={String(focusTask.id)} onValueChange={(value) => { setFocusTaskId(Number(value)); resetFocus(); }}><SelectTrigger className="h-11 w-full rounded-xl bg-background/80"><SelectValue /></SelectTrigger><SelectContent>{pendingTasks.map((task) => <SelectItem key={task.id} value={String(task.id)}>{task.title}</SelectItem>)}</SelectContent></Select>
                  <div className="my-6 text-center"><p className="text-5xl font-semibold tracking-[-0.06em] tabular-nums">{String(Math.floor(focusSeconds / 60)).padStart(2, '0')}:{String(focusSeconds % 60).padStart(2, '0')}</p><p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{focusRunning ? (language === 'ru' ? 'Сосредоточьтесь на задаче' : 'Stay with the task') : (language === 'ru' ? '25 минут без отвлечений' : '25 distraction-free minutes')}</p></div>
                  {focusFinished && <p className="mb-3 text-center text-sm font-medium text-emerald-600">{t.focusDone}</p>}
                  <div className="grid grid-cols-[1fr_auto] gap-2"><Button onClick={() => { if (focusSeconds === 0) resetFocus(); setFocusRunning((current) => !current); }} className="h-11 rounded-xl bg-violet-600 text-white hover:bg-violet-500"><TimerReset />{focusRunning ? t.pause : t.start}</Button><Button variant="outline" size="icon" onClick={resetFocus} className="size-11 rounded-xl" aria-label={t.reset}><RotateCcw /></Button></div>
                  {focusFinished && <Button variant="outline" onClick={() => { void toggleTask(focusTask.id, true); setFocusOpen(false); }} className="mt-2 w-full rounded-xl"><CheckCircle2 />{t.finishTask}</Button>}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-violet-500/25 bg-background/60 p-6 text-center"><Sparkles className="mx-auto size-7 text-violet-500" /><p className="mt-3 font-semibold">{language === 'ru' ? 'Сначала добавьте задачу' : 'Add a task first'}</p><p className="mt-1 text-sm text-muted-foreground">{language === 'ru' ? 'Фокус-сессии работают с одной выбранной задачей.' : 'Focus sessions work with one selected task.'}</p><Button onClick={() => { setFocusOpen(false); setCreateTaskOpen(true); }} className="mt-4 rounded-xl"><Plus />{t.add}</Button></div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={selectedTask !== null} onOpenChange={(open) => !open && setSelectedTask(null)}>
          <DialogContent className="rounded-3xl p-5 sm:max-w-md">
            <DialogHeader><DialogTitle>{t.edit}</DialogTitle><DialogDescription>{selectedTask ? `#${selectedTask.id}` : ''}</DialogDescription></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label htmlFor="task-title">{t.taskName}</Label><Input id="task-title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="task-date">{t.dueDate}</Label><Input id="task-date" type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="task-time">{t.dueTime}</Label><Input id="task-time" type="time" value={editTime} onChange={(event) => setEditTime(event.target.value)} disabled={!editDate} /></div>
              </div>
              <div className="space-y-2"><Label>{t.category}</Label><div className="grid grid-cols-2 gap-2">{categories.map((category) => <button key={category} onClick={() => setEditCategory(category)} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${editCategory === category ? `${categoryColor(category)} border-transparent text-white shadow-sm` : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}><span className={`size-2.5 rounded-full ${editCategory === category ? 'bg-white/80' : categoryColor(category)}`} />{categoryLabel(category, language)}</button>)}</div></div>
              <div className="space-y-2"><Label>{t.priority}</Label><Select value={editPriority} onValueChange={(value) => setEditPriority(value as Task['priority'])}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">{t.low}</SelectItem><SelectItem value="medium">{t.medium}</SelectItem><SelectItem value="high">{t.high}</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter className="-mx-5 -mb-5 px-5">
              <Button variant="destructive" onClick={() => { if (selectedTask) { setDeleteTarget(selectedTask); setSelectedTask(null); } }}><Trash2 />{t.remove}</Button>
              <Button onClick={() => void saveTask()}><Save />{t.save}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="rounded-3xl p-5 sm:max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><UserRound className="size-5" />{t.profile}</DialogTitle><DialogDescription>{t.profileHint}</DialogDescription></DialogHeader>
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-orange-500/10 p-3 text-center"><Flame className="mx-auto size-5 text-orange-500" /><p className="mt-2 text-xl font-semibold">{streak}</p><p className="text-[11px] text-muted-foreground">{t.streak}</p></div>
                <div className="rounded-2xl bg-emerald-500/10 p-3 text-center"><CheckCircle2 className="mx-auto size-5 text-emerald-500" /><p className="mt-2 text-xl font-semibold">{tasks.filter((task) => task.completed).length}</p><p className="text-[11px] text-muted-foreground">{t.completed}</p></div>
                <div className="rounded-2xl bg-sky-500/10 p-3 text-center"><Target className="mx-auto size-5 text-sky-500" /><p className="mt-2 text-xl font-semibold">{pendingTasks.length}</p><p className="text-[11px] text-muted-foreground">{t.left}</p></div>
              </div>
              <p className="rounded-xl bg-muted/70 px-3 py-2 text-xs leading-5 text-muted-foreground">{language === 'ru' ? 'Серия начинается с 0. Выполните хотя бы одну задачу за 24 часа, чтобы увеличить её на один день. Максимум — 1000.' : 'Your streak starts at 0. Complete at least one task within 24 hours to add one day. The maximum is 1000.'}</p>
              <div className="space-y-2"><Label htmlFor="profile-dialog-name">{t.yourName}</Label><div className="flex gap-2"><Input id="profile-dialog-name" value={nameDraft} maxLength={64} onChange={(event) => setNameDraft(event.target.value)} /><Button onClick={() => void saveSettings({ display_name: nameDraft.trim() || (language === 'ru' ? 'Капитан' : 'Captain') })}><Save />{t.save}</Button></div></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><Settings2 />{t.settings}</Button><Button onClick={() => setProfileOpen(false)}>{t.close}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="rounded-3xl p-5 sm:max-w-md">
            <DialogHeader><DialogTitle>{t.preferences}</DialogTitle><DialogDescription>{t.settings}</DialogDescription></DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-2"><Label htmlFor="profile-name">{t.yourName}</Label><div className="flex gap-2"><div className="relative flex-1"><UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="profile-name" value={nameDraft} maxLength={64} onChange={(event) => setNameDraft(event.target.value)} className="pl-9" /></div><Button variant="outline" onClick={() => void saveSettings({ display_name: nameDraft.trim() || (language === 'ru' ? 'Капитан' : 'Captain') })}><Save />{t.save}</Button></div></div>
              <div className="flex items-center justify-between gap-4"><Label>{language === 'ru' ? 'Язык' : 'Language'}</Label><div className="flex rounded-xl bg-muted p-1"><button onClick={() => void saveSettings({ language: 'ru' })} className={`rounded-lg px-3 py-1.5 text-sm ${language === 'ru' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>RU</button><button onClick={() => void saveSettings({ language: 'en' })} className={`rounded-lg px-3 py-1.5 text-sm ${language === 'en' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>EN</button></div></div>
              <div className="flex items-center justify-between gap-4"><Label htmlFor="digest-switch">{t.digest}</Label><Switch id="digest-switch" checked={digestEnabled} onCheckedChange={(checked) => void saveSettings({ daily_digest_enabled: checked })} /></div>
              <div className="flex items-center justify-between gap-4"><Label>{t.digestTime}</Label><Select value={String(digestHour)} onValueChange={(value) => void saveSettings({ daily_digest_hour: Number(value) })}><SelectTrigger className="h-10 w-28"><SelectValue /></SelectTrigger><SelectContent>{[7, 8, 9, 10, 11].map((hour) => <SelectItem key={hour} value={String(hour)}>{hour}:00</SelectItem>)}</SelectContent></Select></div>
              <div className="flex items-center justify-between gap-4"><Label>{t.timezone}</Label><Select value={String(timezoneOffset)} onValueChange={(value) => void saveSettings({ timezone_offset_minutes: Number(value) })}><SelectTrigger className="h-10 w-32"><SelectValue /></SelectTrigger><SelectContent>{[-300, 0, 60, 120, 180, 240, 300, 360].map((offset) => <SelectItem key={offset} value={String(offset)}>UTC{offset >= 0 ? '+' : ''}{offset / 60}</SelectItem>)}</SelectContent></Select></div>
              <div className="flex items-center justify-between gap-4"><Label>{dark ? 'Dark' : 'Light'}</Label><Switch checked={dark} onCheckedChange={toggleTheme} /></div>
            </div>
            <DialogFooter className="-mx-5 -mb-5 px-5"><Button onClick={() => setSettingsOpen(false)}>{t.close}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogContent className="rounded-3xl p-5 sm:max-w-md">
            <DialogHeader><DialogTitle>{t.filters}</DialogTitle><DialogDescription>{language === 'ru' ? 'Показывайте только нужные задачи.' : 'Show only the tasks you need.'}</DialogDescription></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>{t.category}</Label><Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as TaskCategory | 'all')}><SelectTrigger className="h-11 w-full"><SlidersHorizontal className="size-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'ru' ? 'Все категории' : 'All categories'}</SelectItem>{categories.map((category) => <SelectItem key={category} value={category}>{categoryLabel(category, language)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>{t.priority}</Label><Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as Task['priority'] | 'all')}><SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'ru' ? 'Любой приоритет' : 'Any priority'}</SelectItem><SelectItem value="low">{t.low}</SelectItem><SelectItem value="medium">{t.medium}</SelectItem><SelectItem value="high">{t.high}</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => { setCategoryFilter('all'); setPriorityFilter('all'); }}>{t.resetFilters}</Button><Button onClick={() => setFiltersOpen(false)}>{t.close}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DialogContent className="rounded-3xl p-5 sm:max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Bell className="size-5" />{t.notifications}</DialogTitle><DialogDescription>{t.notificationsHint}</DialogDescription></DialogHeader>
            <div className="space-y-5 py-2">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/70 p-4"><div><Label htmlFor="notification-digest">{t.digest}</Label><p className="mt-1 text-xs text-muted-foreground">{digestHour}:00 · UTC{timezoneOffset >= 0 ? '+' : ''}{timezoneOffset / 60}</p></div><Switch id="notification-digest" checked={digestEnabled} onCheckedChange={(checked) => void saveSettings({ daily_digest_enabled: checked })} /></div>
              <div className="flex items-center justify-between gap-4"><Label>{t.digestTime}</Label><Select value={String(digestHour)} onValueChange={(value) => void saveSettings({ daily_digest_hour: Number(value) })}><SelectTrigger className="h-10 w-28"><SelectValue /></SelectTrigger><SelectContent>{[7, 8, 9, 10, 11].map((hour) => <SelectItem key={hour} value={String(hour)}>{hour}:00</SelectItem>)}</SelectContent></Select></div>
              <Button variant="outline" onClick={() => void testNotification()} disabled={notificationTestState === 'sending'} className="w-full rounded-xl"><Send />{notificationTestState === 'sent' ? t.testSent : notificationTestState === 'sending' ? '…' : t.testNotification}</Button>
              {notificationTestState === 'error' && <p className="text-center text-xs text-rose-600">{language === 'ru' ? 'Откройте Mini App из Telegram и попробуйте снова.' : 'Open the Mini App from Telegram and try again.'}</p>}
            </div>
            <DialogFooter><Button onClick={() => setNotificationsOpen(false)}>{t.close}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="rounded-3xl sm:max-w-md">
            <AlertDialogHeader><AlertDialogTitle>{t.removeTitle}</AlertDialogTitle><AlertDialogDescription>{deleteTarget?.title}<br />{t.removeHint}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>{t.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => deleteTarget && void removeTask(deleteTarget)} className="bg-destructive text-white hover:bg-destructive/90"><Trash2 />{t.remove}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
}
