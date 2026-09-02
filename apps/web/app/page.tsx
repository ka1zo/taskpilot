'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell, CalendarDays, Check, CheckCircle2, ChevronDown, Circle, Clock3,
  Command, LayoutDashboard, ListTodo, Menu, Moon, MoreHorizontal, Plus,
  Search, Settings, Sparkles, Sun, Tag, TimerReset, X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  authenticateTelegram,
  createRemoteTask,
  getTelegramInitData,
  loadCurrentUser,
  loadTasks,
  setRemoteTaskCompleted,
  type ApiTask,
} from '@/lib/api';

type Language = 'ru' | 'en';
type Filter = 'today' | 'all' | 'upcoming' | 'completed';
type Task = {
  id: number;
  title: { ru: string; en: string };
  project: { ru: string; en: string };
  due: string;
  time: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
};

const initialTasks: Task[] = [
  { id: 1, title: { ru: 'Подготовить презентацию проекта', en: 'Prepare project presentation' }, project: { ru: 'Работа', en: 'Work' }, due: 'today', time: '10:00', priority: 'high', completed: false },
  { id: 2, title: { ru: '30 минут английского', en: '30 minutes of English' }, project: { ru: 'Развитие', en: 'Growth' }, due: 'today', time: '14:30', priority: 'medium', completed: false },
  { id: 3, title: { ru: 'Забронировать тренировку', en: 'Book a workout' }, project: { ru: 'Личное', en: 'Personal' }, due: 'today', time: '18:00', priority: 'low', completed: false },
  { id: 4, title: { ru: 'Ответить на важные письма', en: 'Reply to important emails' }, project: { ru: 'Работа', en: 'Work' }, due: 'today', time: '09:15', priority: 'medium', completed: true },
  { id: 5, title: { ru: 'Спланировать неделю', en: 'Plan the week' }, project: { ru: 'Развитие', en: 'Growth' }, due: 'tomorrow', time: '09:00', priority: 'medium', completed: false },
];

const copy = {
  ru: { greeting: 'Доброе утро', subtitle: 'Сегодня отличный день, чтобы закончить важное.', search: 'Найти задачу…', quick: 'Что нужно сделать?', add: 'Добавить', today: 'Сегодня', all: 'Все задачи', upcoming: 'Предстоящие', completed: 'Выполненные', labels: 'Категории', work: 'Работа', personal: 'Личное', growth: 'Развитие', settings: 'Настройки', overview: 'Обзор', progress: 'Прогресс дня', focus: 'В фокусе', remaining: 'осталось', streak: 'Серия', days: 'дней подряд', synced: 'Синхронизировано с Telegram', demo: 'Демонстрационный режим', syncing: 'Подключение к Telegram…', syncError: 'Нет связи с сервером', empty: 'Здесь пока нет задач', hint: 'Добавьте задачу выше или напишите боту.', filters: 'Фильтры', noTime: 'Без времени', start: 'Начать фокус' },
  en: { greeting: 'Good morning', subtitle: 'A great day to finish what matters.', search: 'Find a task…', quick: 'What needs to be done?', add: 'Add task', today: 'Today', all: 'All tasks', upcoming: 'Upcoming', completed: 'Completed', labels: 'Categories', work: 'Work', personal: 'Personal', growth: 'Growth', settings: 'Settings', overview: 'Overview', progress: 'Today’s progress', focus: 'Focus', remaining: 'remaining', streak: 'Streak', days: 'days in a row', synced: 'Synced with Telegram', demo: 'Demo mode', syncing: 'Connecting to Telegram…', syncError: 'Server unavailable', empty: 'Nothing here yet', hint: 'Add a task above or message the bot.', filters: 'Filters', noTime: 'No time', start: 'Start focus' },
};

const priorityStyles = { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-sky-400' };

function fromApiTask(task: ApiTask, language: Language): Task {
  const dueDate = task.due_at ? new Date(task.due_at) : null;
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const dateKey = dueDate?.toDateString();
  const due = dateKey === today.toDateString() ? 'today' : dateKey === tomorrow.toDateString() ? 'tomorrow' : 'later';
  return {
    id: task.id,
    title: { ru: task.title, en: task.title },
    project: { ru: 'Входящие', en: 'Inbox' },
    due,
    time: dueDate ? new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(dueDate) : language === 'ru' ? 'Без времени' : 'No time',
    priority: task.priority,
    completed: task.status === 'completed',
  };
}

export default function Home() {
  const [language, setLanguage] = useState<Language>('ru');
  const [filter, setFilter] = useState<Filter>('today');
  const [tasks, setTasks] = useState(initialTasks);
  const [draft, setDraft] = useState('');
  const [dark, setDark] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [profileName, setProfileName] = useState('Алексей');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'demo' | 'syncing' | 'live' | 'error'>('demo');
  const t = copy[language];

  useEffect(() => {
    const initData = getTelegramInitData();
    if (!initData) return;
    authenticateTelegram(initData).then(async (token) => {
      const [user, remoteTasks] = await Promise.all([loadCurrentUser(token), loadTasks(token)]);
      setAccessToken(token);
      setLanguage(user.language);
      setProfileName(user.first_name || (user.language === 'ru' ? 'друг' : 'friend'));
      setTasks(remoteTasks.map((task) => fromApiTask(task, user.language)));
      setSyncState('live');
    }).catch(() => setSyncState('error'));
  }, []);

  const visibleTasks = useMemo(() => {
    if (filter === 'completed') return tasks.filter((task) => task.completed);
    if (filter === 'upcoming') return tasks.filter((task) => task.due === 'tomorrow');
    if (filter === 'today') return tasks.filter((task) => task.due === 'today');
    return tasks;
  }, [filter, tasks]);

  const completed = tasks.filter((task) => task.completed && task.due === 'today').length;
  const todayCount = tasks.filter((task) => task.due === 'today').length;
  const progress = Math.round((completed / Math.max(todayCount, 1)) * 100);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  }

  async function addTask() {
    const title = draft.trim();
    if (!title) return;
    const optimisticId = Date.now();
    setTasks((current) => [{ id: optimisticId, title: { ru: title, en: title }, project: { ru: 'Входящие', en: 'Inbox' }, due: 'today', time: t.noTime, priority: 'low', completed: false }, ...current]);
    setDraft('');
    if (accessToken) {
      try {
        const saved = await createRemoteTask(accessToken, title);
        setTasks((current) => current.map((task) => task.id === optimisticId ? fromApiTask(saved, language) : task));
      } catch {
        setTasks((current) => current.filter((task) => task.id !== optimisticId));
        setSyncState('error');
      }
    }
  }

  async function toggleTask(taskId: number, checked: boolean) {
    const previous = tasks.find((task) => task.id === taskId)?.completed ?? false;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, completed: checked } : task));
    if (!accessToken) return;
    try {
      await setRemoteTaskCompleted(accessToken, taskId, checked);
    } catch {
      setTasks((current) => current.map((task) => task.id === taskId ? { ...task, completed: previous } : task));
      setSyncState('error');
    }
  }

  const navigation: Array<{ id: Filter; label: string; icon: typeof CalendarDays; count?: number }> = [
    { id: 'today', label: t.today, icon: CalendarDays, count: todayCount },
    { id: 'all', label: t.all, icon: ListTodo, count: tasks.length },
    { id: 'upcoming', label: t.upcoming, icon: TimerReset },
    { id: 'completed', label: t.completed, icon: CheckCircle2, count: completed },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className={`${mobileNav ? 'flex' : 'hidden'} fixed inset-0 z-40 flex-col border-r border-border bg-sidebar px-4 py-5 lg:static lg:flex lg:min-h-screen`}>
          <div className="mb-8 flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_24px_-10px_var(--primary)]"><Check className="size-5 stroke-[2.5]" /></span>
              <span className="text-lg font-semibold tracking-[-0.03em]">TaskPilot</span>
            </div>
            <Button className="lg:hidden" variant="ghost" size="icon" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X /></Button>
          </div>

          <nav className="space-y-1" aria-label="Main navigation">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t.overview}</p>
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => { setFilter(item.id); setMobileNav(false); }} className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors ${filter === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                  <Icon className="size-[17px]" /><span className="flex-1 text-left">{item.label}</span>
                  {item.count !== undefined && <span className={`text-xs ${filter === item.id ? 'text-primary-foreground/75' : ''}`}>{item.count}</span>}
                </button>
              );
            })}
          </nav>

          <div className="mt-8">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t.labels}</p>
            {[['bg-violet-500', t.work], ['bg-emerald-500', t.personal], ['bg-sky-500', t.growth]].map(([color, label]) => (
              <button key={label} className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><span className={`size-2 rounded-full ${color}`} />{label}</button>
            ))}
          </div>

          <div className="mt-auto space-y-3 pt-8">
            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium"><Sparkles className="size-3.5 text-amber-500" />{t.streak}</div>
              <p className="text-2xl font-semibold tracking-tight">12 <span className="text-xs font-normal text-muted-foreground">{t.days}</span></p>
            </div>
            <button className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><Settings className="size-[17px]" /> {t.settings}</button>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl sm:px-8">
            <Button className="lg:hidden" variant="ghost" size="icon" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></Button>
            <div className="relative hidden max-w-sm flex-1 sm:block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 border-0 bg-muted/70 pl-9 shadow-none focus-visible:ring-2" placeholder={t.search} />
              <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground md:flex"><Command className="size-2.5" />K</kbd>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted" aria-label="Change language">{language === 'ru' ? 'RU' : 'EN'}</button>
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun /> : <Moon />}</Button>
              <Button variant="ghost" size="icon" aria-label="Notifications" className="relative"><Bell /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-rose-500 ring-2 ring-background" /></Button>
              <div className="ml-1 grid size-8 place-items-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#22c55e)] text-xs font-semibold text-white">A</div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-10">
            <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-1 text-sm capitalize text-muted-foreground">{new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
                <h1 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{t.greeting}, {profileName}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">{t.subtitle}</p>
              </div>
              <Badge variant="outline" className="w-fit gap-1.5 border-emerald-500/25 bg-emerald-500/8 py-1 text-emerald-700 dark:text-emerald-300"><span className={`size-1.5 rounded-full ${syncState === 'error' ? 'bg-rose-500' : syncState === 'syncing' ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'}`} /> {syncState === 'live' ? t.synced : syncState === 'demo' ? t.demo : syncState === 'error' ? t.syncError : t.syncing}</Badge>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-border bg-card p-2 shadow-[0_10px_40px_-28px_rgba(15,23,42,.35)]">
                  <div className="flex gap-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary"><Plus className="size-5" /></span>
                    <Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTask()} placeholder={t.quick} className="h-10 border-0 px-1 shadow-none focus-visible:ring-0" />
                    <Button onClick={addTask} className="h-10 rounded-xl px-4">{t.add}</Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card shadow-[0_16px_50px_-36px_rgba(15,23,42,.35)]">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div className="flex items-center gap-2"><h2 className="font-semibold">{navigation.find((item) => item.id === filter)?.label}</h2><Badge variant="secondary">{visibleTasks.length}</Badge></div>
                    <Button variant="ghost" size="sm"><Tag className="size-3.5" /> {t.filters} <ChevronDown className="size-3.5" /></Button>
                  </div>
                  <div className="divide-y divide-border">
                    {visibleTasks.map((task) => (
                      <article key={task.id} className="group flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/45 sm:px-5">
                        <Checkbox checked={task.completed} onCheckedChange={(checked) => void toggleTask(task.id, Boolean(checked))} aria-label={`Complete ${task.title[language]}`} className="mt-0.5 size-[18px] rounded-full" />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${task.completed ? 'text-muted-foreground line-through' : ''}`}>{task.title[language]}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{task.time}</span><span>·</span><span>{task.project[language]}</span></div>
                        </div>
                        <span className={`mt-1.5 size-2 rounded-full ${priorityStyles[task.priority]}`} title={`${task.priority} priority`} />
                        <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100" aria-label="Task actions"><MoreHorizontal /></Button>
                      </article>
                    ))}
                    {visibleTasks.length === 0 && <div className="grid place-items-center px-6 py-16 text-center"><span className="mb-3 grid size-11 place-items-center rounded-full bg-muted"><Circle className="size-5 text-muted-foreground" /></span><p className="font-medium">{t.empty}</p><p className="mt-1 text-sm text-muted-foreground">{t.hint}</p></div>}
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="overflow-hidden rounded-2xl bg-[#14281f] p-5 text-white shadow-[0_18px_45px_-24px_rgba(20,40,31,.8)] dark:bg-emerald-950">
                  <div className="mb-7 flex items-center justify-between"><p className="text-sm font-medium text-white/80">{t.progress}</p><LayoutDashboard className="size-4 text-emerald-300" /></div>
                  <div className="flex items-end justify-between">
                    <div><p className="text-4xl font-semibold tracking-[-0.05em]">{Math.min(progress, 100)}%</p><p className="mt-1 text-xs text-white/55">{todayCount - completed} {t.remaining}</p></div>
                    <div className="relative grid size-[76px] place-items-center rounded-full" style={{ background: `conic-gradient(#6ee7b7 ${Math.min(progress, 100)}%, rgba(255,255,255,.12) 0)` }}><div className="grid size-[62px] place-items-center rounded-full bg-[#14281f] text-xs font-semibold dark:bg-emerald-950">{completed}/{todayCount}</div></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold">{t.focus}</p><TimerReset className="size-4 text-violet-500" /></div>
                  <div className="rounded-xl bg-violet-500/8 p-4"><p className="text-xs font-medium text-violet-700 dark:text-violet-300">25:00</p><p className="mt-1 line-clamp-2 text-sm font-medium">{tasks.find((task) => !task.completed)?.title[language]}</p><Button size="sm" className="mt-4 w-full bg-violet-600 text-white hover:bg-violet-500"><Clock3 /> {t.start}</Button></div>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
