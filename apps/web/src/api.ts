import { Entity, FloorPlan, HistoryPoint, HistorySummary, Receiver, TagEntityInput } from '@marauder/shared';
import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
}

async function send(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token !== undefined) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(res.status, await responseMessage(res));
  }
  return res;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function responseMessage(res: Response): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join(', ');
    }
  }
  return `request failed with ${res.status}`;
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const res = await send(path, options);
  return (await res.json()) as T;
}

export async function login(password: string): Promise<string> {
  const { token } = await request<{ token: string }>('/auth/login', { method: 'POST', body: { password } });
  return token;
}

export async function checkSession(token: string): Promise<void> {
  await send('/auth/me', { token });
}

export async function logout(token: string): Promise<void> {
  await send('/auth/logout', { method: 'POST', token });
}

export function fetchEntities(): Promise<Entity[]> {
  return request('/entities');
}

export function tagEntity(token: string, id: string, input: TagEntityInput): Promise<Entity> {
  return request(`/entities/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, token });
}

export function fetchReceivers(): Promise<Receiver[]> {
  return request('/receivers');
}

export function createReceiver(token: string, receiver: Receiver): Promise<Receiver> {
  return request('/receivers', { method: 'POST', body: receiver, token });
}

export function updateReceiver(token: string, id: string, changes: Omit<Receiver, 'id' | 'floor'>): Promise<Receiver> {
  return request(`/receivers/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes, token });
}

export async function deleteReceiver(token: string, id: string): Promise<void> {
  await send(`/receivers/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

export function fetchFloorPlan(): Promise<FloorPlan> {
  return request('/floorplan');
}

export function updateFloorPlan(token: string, plan: FloorPlan): Promise<FloorPlan> {
  return request('/floorplan', { method: 'PUT', body: plan, token });
}

export function fetchHistorySummary(): Promise<HistorySummary> {
  return request('/history/summary');
}

export function fetchHistory(from: string, to: string, bucketMs: number): Promise<HistoryPoint[]> {
  const query = new URLSearchParams({ from, to, bucketMs: String(bucketMs) });
  return request(`/history?${query.toString()}`);
}
