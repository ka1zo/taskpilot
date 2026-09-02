const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export type ApiTask = {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high';
  due_at: string | null;
  remind_at: string | null;
  recurrence: string | null;
  category_id: number | null;
};

export type ApiUser = {
  first_name: string | null;
  language: 'ru' | 'en';
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    throw new Error(`TaskPilot API returned ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getTelegramInitData(): string | null {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready?.();
  webApp?.expand?.();
  return webApp?.initData || null;
}

export async function authenticateTelegram(initData: string): Promise<string> {
  const result = await request<{ access_token: string }>('/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ init_data: initData }),
  });
  return result.access_token;
}

function authorization(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function loadCurrentUser(token: string): Promise<ApiUser> {
  return request('/users/me', { headers: authorization(token) });
}

export async function loadTasks(token: string): Promise<ApiTask[]> {
  const result = await request<{ items: ApiTask[] }>('/tasks?limit=100', {
    headers: authorization(token),
  });
  return result.items;
}

export function createRemoteTask(token: string, title: string): Promise<ApiTask> {
  return request('/tasks', {
    method: 'POST',
    headers: authorization(token),
    body: JSON.stringify({ title, priority: 'low' }),
  });
}

export function setRemoteTaskCompleted(
  token: string,
  taskId: number,
  completed: boolean,
): Promise<ApiTask> {
  return request(`/tasks/${taskId}`, {
    method: 'PATCH',
    headers: authorization(token),
    body: JSON.stringify({ status: completed ? 'completed' : 'pending' }),
  });
}
