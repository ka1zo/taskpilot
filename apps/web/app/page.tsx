'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Inbox,
  ListFilter,
  Moon,
  Plus,
  Search,
  Save,
  Settings2,
  Sparkles,
  Sun,
  Target,
  TimerReset,
  Trash2,
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
  authenticateTelegram,
  createRemoteTask,
  deleteRemoteTask,
  getTelegramInitData,
  loadCurrentUser,
  loadTasks,
  setRemoteTaskCompleted,
  updateRemoteTask,
  updateRemoteUser,
  type ApiTask,
} from '@/lib/api';

type Language = 'ru' | 'en';
type Filter = 'today' | 'all' | 'completed';
type Task = {
  id: number;
  title: string;
  dueAt: string | null;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
};

const demoTasks: Task[] = [
  { id: 1, title: 'Подготовить портфолио проекта', dueAt: new Date(new Date().setHours(12, 30, 0, 0)).toISOString(), priority: 'high', completed: false },
  { id: 2, title: '30 минут английского', dueAt: new Date(new Date().setHours(16, 0, 0, 0)).toISOString(), priority: 'medium', completed: false },
  { id: 3, title: 'Спланировать следующую неделю', dueAt: null, priority: 'low', completed: true },
];

const copy = {
  ru: {
    hello: 'Добрый день', lead: 'Держим курс на главное.', today: 'Сегодня', all: 'Все', completed: 'Готово', plan: 'План дня', left: 'осталось', done: 'выполнено', add: 'Новая задача', placeholder: 'Например, позвонить Анне в 18:00', create: 'Добавить', empty: 'Здесь всё чисто', emptyHint: 'Добавьте задачу или напишите боту в Telegram.', synced: 'Telegram подключён', demo: 'Предпросмотр', connecting: 'Подключаю Telegram…', error: 'Не удалось синхронизировать', noTime: 'Без времени', focus: 'Фокус дня', focusHint: 'Одна задача. 25 минут. Без отвлечений.', start: 'Начать', pause: 'Пауза', tasks: 'Задачи', inbox: 'Входящие', settings: 'Настройки', search: 'Поиск', edit: 'Редактировать задачу', taskName: 'Название', dueDate: 'Дата', dueTime: 'Время', priority: 'Приоритет', low: 'Низкий', medium: 'Средний', high: 'Высокий', save: 'Сохранить', remove: 'Удалить', preferences: 'Персональные настройки', digest: 'Утренняя сводка', digestTime: 'Время сводки', timezone: 'Часовой пояс', close: 'Закрыть',
  },
  en: {
    hello: 'Good afternoon', lead: 'Stay on course for what matters.', today: 'Today', all: 'All', completed: 'Done', plan: 'Daily plan', left: 'remaining', done: 'completed', add: 'New task', placeholder: 'For example, call Anna at 18:00', create: 'Add', empty: 'All clear here', emptyHint: 'Add a task or message the Telegram bot.', synced: 'Telegram connected', demo: 'Preview mode', connecting: 'Connecting Telegram…', error: 'Could not sync', noTime: 'No time', focus: 'Daily focus', focusHint: 'One task. 25 minutes. No distractions.', start: 'Start', pause: 'Pause', tasks: 'Tasks', inbox: 'Inbox', settings: 'Settings', search: 'Search', edit: 'Edit task', taskName: 'Title', dueDate: 'Date', dueTime: 'Time', priority: 'Priority', low: 'Low', medium: 'Medium', high: 'High', save: 'Save', remove: 'Delete', preferences: 'Personal settings', digest: 'Morning digest', digestTime: 'Digest time', timezone: 'Time zone', close: 'Close',
  },
};

function fromApiTask(task: ApiTask): Task {
  return { id: task.id, title: task.title, dueAt: task.due_at, priority: task.priority, completed: task.status === 'completed' };
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
  const [tasks, setTasks] = useState<Task[]>(demoTasks);
  const [draft, setDraft] = useState('');
  const [profileName, setProfileName] = useState('Капитан');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'demo' | 'connecting' | 'live' | 'error'>('demo');
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPriority, setEditPriority] = useState<Task['priority']>('low');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timezoneOffset, setTimezoneOffset] = useState(180);
  const [digestHour, setDigestHour] = useState(9);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const t = copy[language];

  useEffect(() => {
    const initData = getTelegramInitData();
    if (!initData) return;
    authenticateTelegram(initData)
      .then(async (token) => {
        const [user, pendingTasks, completedTasks] = await Promise.all([
          loadCurrentUser(token),
          loadTasks(token),
          loadTasks(token, 'completed'),
        ]);
        setAccessToken(token);
        setLanguage(user.language);
        setProfileName(user.first_name || (user.language === 'ru' ? 'Капитан' : 'Captain'));
        setTasks([...pendingTasks, ...completedTasks].map(fromApiTask));
        setTimezoneOffset(user.timezone_offset_minutes);
        setDigestHour(user.daily_digest_hour);
        setDigestEnabled(user.daily_digest_enabled);
        setSyncState('live');
      })
      .catch(() => setSyncState('error'));
  }, []);

  useEffect(() => {
    if (!focusRunning) return;
    const timer = window.setInterval(() => {
      setFocusSeconds((current) => {
        if (current <= 1) {
          setFocusRunning(false);
          return 25 * 60;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning]);

  const visibleTasks = useMemo(() => {
    const byFilter = filter === 'completed'
      ? tasks.filter((task) => task.completed)
      : filter === 'today'
        ? tasks.filter((task) => isToday(task.dueAt) && !task.completed)
        : tasks.filter((task) => !task.completed);
    const normalized = query.trim().toLocaleLowerCase(language === 'ru' ? 'ru-RU' : 'en-US');
    return normalized ? byFilter.filter((task) => task.title.toLocaleLowerCase().includes(normalized)) : byFilter;
  }, [filter, language, query, tasks]);

  const todayTasks = tasks.filter((task) => isToday(task.dueAt));
  const completedToday = todayTasks.filter((task) => task.completed).length;
  const pendingToday = Math.max(todayTasks.length - completedToday, 0);
  const progress = Math.round((completedToday / Math.max(todayTasks.length, 1)) * 100);
  const focusTask = tasks.find((task) => !task.completed);

  async function addTask() {
    const title = draft.trim();
    if (!title) return;
    const optimisticId = Date.now();
    const optimistic: Task = { id: optimisticId, title, dueAt: null, priority: 'low', completed: false };
    setTasks((current) => [optimistic, ...current]);
    setDraft('');
    if (!accessToken) return;
    try {
      const saved = await createRemoteTask(accessToken, title);
      setTasks((current) => current.map((task) => task.id === optimisticId ? fromApiTask(saved) : task));
    } catch {
      setTasks((current) => current.filter((task) => task.id !== optimisticId));
      setSyncState('error');
    }
  }

  async function toggleTask(taskId: number, completed: boolean) {
    const previous = tasks.find((task) => task.id === taskId)?.completed ?? false;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, completed } : task));
    if (!accessToken) return;
    try {
      await setRemoteTaskCompleted(accessToken, taskId, completed);
    } catch {
      setTasks((current) => current.map((task) => task.id === taskId ? { ...task, completed: previous } : task));
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
  }

  async function saveTask() {
    if (!selectedTask || !editTitle.trim()) return;
    const dueAt = editDate
      ? new Date(`${editDate}T${editTime || '09:00'}:00`).toISOString()
      : null;
    const next: Task = { ...selectedTask, title: editTitle.trim(), priority: editPriority, dueAt };
    setTasks((current) => current.map((task) => task.id === next.id ? next : task));
    setSelectedTask(null);
    if (!accessToken) return;
    try {
      const saved = await updateRemoteTask(accessToken, next.id, { title: next.title, priority: next.priority, due_at: dueAt });
      setTasks((current) => current.map((task) => task.id === next.id ? fromApiTask(saved) : task));
    } catch {
      setSyncState('error');
    }
  }

  async function removeTask() {
    if (!selectedTask) return;
    const task = selectedTask;
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setSelectedTask(null);
    if (!accessToken) return;
    try {
      await deleteRemoteTask(accessToken, task.id);
    } catch {
      setTasks((current) => [task, ...current]);
      setSyncState('error');
    }
  }

  async function saveSettings(fields: {
    language?: Language;
    timezone_offset_minutes?: number;
    daily_digest_hour?: number;
    daily_digest_enabled?: boolean;
  }) {
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

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  }

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'today', label: t.today },
    { id: 'all', label: t.all },
    { id: 'completed', label: t.completed },
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
              <Button variant="ghost" size="icon" className="text-white/75 hover:bg-white/10 hover:text-white" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun /> : <Moon />}</Button>
              <Button variant="ghost" size="icon" className="relative text-white/75 hover:bg-white/10 hover:text-white" aria-label="Notifications"><Bell /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#fda4af] ring-2 ring-[#111d30]" /></Button>
            </div>
          </header>

          <div className="relative z-10 mt-10">
            <p className="text-sm text-white/58">{new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
            <h1 className="mt-1 text-[2rem] font-semibold tracking-[-0.055em] sm:text-[2.5rem]">{t.hello}, {profileName}</h1>
            <p className="mt-1 text-sm text-white/58">{t.lead}</p>
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
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-[0_18px_50px_-32px_rgba(15,23,42,.45)]">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Plus className="size-5" /></span>
            <Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void addTask()} placeholder={t.placeholder} className="h-10 min-w-0 border-0 bg-transparent px-1 text-[15px] shadow-none focus-visible:ring-0" />
            <Button onClick={() => void addTask()} className="h-10 rounded-xl px-4 shadow-sm">{t.create}</Button>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex rounded-xl bg-muted p-1">
              {filters.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${filter === item.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{item.label}</button>)}
            </div>
            <Button variant={searchOpen ? 'secondary' : 'ghost'} size="icon" aria-label={t.search} onClick={() => setSearchOpen((current) => !current)}><Search /></Button>
          </div>

          {searchOpen && (
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${t.search}…`} className="h-11 rounded-xl bg-card pl-9" />
            </div>
          )}

          <div className="mt-4 space-y-2.5">
            {visibleTasks.map((task) => (
              <article key={task.id} className="group flex items-center gap-3 rounded-2xl border border-border/75 bg-card p-3.5 shadow-[0_10px_35px_-30px_rgba(15,23,42,.55)] transition hover:-translate-y-0.5 hover:border-primary/25">
                <Checkbox checked={task.completed} onCheckedChange={(checked) => void toggleTask(task.id, Boolean(checked))} aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`} className="size-5 rounded-full" />
                <div className="min-w-0 flex-1"><p className={`truncate text-[15px] font-medium ${task.completed ? 'text-muted-foreground line-through' : ''}`}>{task.title}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3" />{formatTime(task.dueAt, language)}<span className={`ml-1 size-1.5 rounded-full ${task.priority === 'high' ? 'bg-rose-500' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}`} /></p></div>
                <button onClick={() => openEditor(task)} className="grid size-9 place-items-center rounded-xl text-muted-foreground/60 hover:bg-muted hover:text-foreground" aria-label={t.edit}><ChevronRight className="size-4" /></button>
              </article>
            ))}
            {visibleTasks.length === 0 && (
              <div className="grid place-items-center rounded-3xl border border-dashed border-border px-6 py-12 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-6" /></span><p className="mt-4 font-semibold">{t.empty}</p><p className="mt-1 max-w-[270px] text-sm leading-6 text-muted-foreground">{t.emptyHint}</p></div>
            )}
          </div>

          {focusTask && (
            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-violet-500/15 bg-[linear-gradient(135deg,rgba(124,58,237,.11),rgba(59,130,246,.06))] p-5">
              <div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300"><Sparkles className="size-3.5" />{t.focus}</p><p className="mt-2 line-clamp-2 font-semibold">{focusTask.title}</p><p className="mt-1 text-xs text-muted-foreground">{t.focusHint}</p></div><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/20"><TimerReset className="size-5" /></span></div>
              <Button onClick={() => setFocusRunning((current) => !current)} className="mt-5 w-full rounded-xl bg-violet-600 text-white hover:bg-violet-500"><TimerReset />{focusRunning ? t.pause : t.start} · {String(Math.floor(focusSeconds / 60)).padStart(2, '0')}:{String(focusSeconds % 60).padStart(2, '0')}</Button>
            </div>
          )}

          <div className={`mx-auto mt-6 flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs ${syncState === 'error' ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}><span className={`size-1.5 rounded-full ${syncState === 'connecting' ? 'animate-pulse bg-amber-400' : syncState === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`} />{syncState === 'live' ? t.synced : syncState === 'demo' ? t.demo : syncState === 'connecting' ? t.connecting : t.error}</div>
        </section>

        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[78px] max-w-[760px] items-start justify-around border-t border-border/80 bg-background/92 px-3 pt-2.5 backdrop-blur-xl" aria-label="Primary navigation">
          {[
            { icon: CalendarDays, label: t.tasks, active: !searchOpen && !settingsOpen, action: () => { setFilter('today'); setSearchOpen(false); } },
            { icon: Inbox, label: t.inbox, active: filter === 'all' && !searchOpen, action: () => { setFilter('all'); setSearchOpen(false); } },
            { icon: ListFilter, label: t.search, active: searchOpen, action: () => setSearchOpen(true) },
            { icon: Settings2, label: t.settings, active: settingsOpen, action: () => setSettingsOpen(true) },
          ].map(({ icon: NavIcon, label, active, action }) => <button key={label} onClick={action} className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium transition ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}><NavIcon className="size-5" />{label}</button>)}
        </nav>

        <Dialog open={selectedTask !== null} onOpenChange={(open) => !open && setSelectedTask(null)}>
          <DialogContent className="rounded-3xl p-5 sm:max-w-md">
            <DialogHeader><DialogTitle>{t.edit}</DialogTitle><DialogDescription>{selectedTask ? `#${selectedTask.id}` : ''}</DialogDescription></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label htmlFor="task-title">{t.taskName}</Label><Input id="task-title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="task-date">{t.dueDate}</Label><Input id="task-date" type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="task-time">{t.dueTime}</Label><Input id="task-time" type="time" value={editTime} onChange={(event) => setEditTime(event.target.value)} disabled={!editDate} /></div>
              </div>
              <div className="space-y-2"><Label>{t.priority}</Label><Select value={editPriority} onValueChange={(value) => setEditPriority(value as Task['priority'])}><SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">🟢 {t.low}</SelectItem><SelectItem value="medium">🟡 {t.medium}</SelectItem><SelectItem value="high">🔴 {t.high}</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter className="-mx-5 -mb-5 px-5">
              <Button variant="destructive" onClick={() => void removeTask()}><Trash2 />{t.remove}</Button>
              <Button onClick={() => void saveTask()}><Save />{t.save}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="rounded-3xl p-5 sm:max-w-md">
            <DialogHeader><DialogTitle>{t.preferences}</DialogTitle><DialogDescription>{t.settings}</DialogDescription></DialogHeader>
            <div className="space-y-5 py-2">
              <div className="flex items-center justify-between gap-4"><Label>{language === 'ru' ? 'Язык' : 'Language'}</Label><div className="flex rounded-xl bg-muted p-1"><button onClick={() => void saveSettings({ language: 'ru' })} className={`rounded-lg px-3 py-1.5 text-sm ${language === 'ru' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>RU</button><button onClick={() => void saveSettings({ language: 'en' })} className={`rounded-lg px-3 py-1.5 text-sm ${language === 'en' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>EN</button></div></div>
              <div className="flex items-center justify-between gap-4"><Label htmlFor="digest-switch">{t.digest}</Label><Switch id="digest-switch" checked={digestEnabled} onCheckedChange={(checked) => void saveSettings({ daily_digest_enabled: checked })} /></div>
              <div className="flex items-center justify-between gap-4"><Label>{t.digestTime}</Label><Select value={String(digestHour)} onValueChange={(value) => void saveSettings({ daily_digest_hour: Number(value) })}><SelectTrigger className="h-10 w-28"><SelectValue /></SelectTrigger><SelectContent>{[7, 8, 9, 10, 11].map((hour) => <SelectItem key={hour} value={String(hour)}>{hour}:00</SelectItem>)}</SelectContent></Select></div>
              <div className="flex items-center justify-between gap-4"><Label>{t.timezone}</Label><Select value={String(timezoneOffset)} onValueChange={(value) => void saveSettings({ timezone_offset_minutes: Number(value) })}><SelectTrigger className="h-10 w-32"><SelectValue /></SelectTrigger><SelectContent>{[-300, 0, 60, 120, 180, 240, 300, 360].map((offset) => <SelectItem key={offset} value={String(offset)}>UTC{offset >= 0 ? '+' : ''}{offset / 60}</SelectItem>)}</SelectContent></Select></div>
              <div className="flex items-center justify-between gap-4"><Label>{dark ? 'Dark' : 'Light'}</Label><Switch checked={dark} onCheckedChange={toggleTheme} /></div>
            </div>
            <DialogFooter className="-mx-5 -mb-5 px-5"><Button onClick={() => setSettingsOpen(false)}>{t.close}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
