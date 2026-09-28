import { Entity, FloorPlan, HistoryPoint, HistorySummary, Receiver, TagEntityInput } from '@marauder/shared';
import { API_URL } from './config';

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function login(password: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await readJson<{ token: string }>(res);
  return data.token;
}

export async function fetchEntities(): Promise<Entity[]> {
  const res = await fetch(`${API_URL}/entities`);
  return readJson<Entity[]>(res);
}

export async function fetchReceivers(): Promise<Receiver[]> {
  const res = await fetch(`${API_URL}/receivers`);
  return readJson<Receiver[]>(res);
}

export async function tagEntity(id: string, input: TagEntityInput): Promise<Entity> {
  const res = await fetch(`${API_URL}/entities/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  return readJson<Entity>(res);
}

export async function fetchHistorySummary(): Promise<HistorySummary> {
  const res = await fetch(`${API_URL}/history/summary`);
  return readJson<HistorySummary>(res);
}

export async function fetchHistory(from: string, to: string, bucketMs: number): Promise<HistoryPoint[]> {
  const params = new URLSearchParams({ from, to, bucketMs: String(bucketMs) });
  const res = await fetch(`${API_URL}/history?${params.toString()}`);
  return readJson<HistoryPoint[]>(res);
}

export async function fetchFloorPlan(): Promise<FloorPlan> {
  const res = await fetch(`${API_URL}/floorplan`);
  return readJson<FloorPlan>(res);
}

export async function updateFloorPlan(input: FloorPlan): Promise<FloorPlan> {
  const res = await fetch(`${API_URL}/floorplan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  return readJson<FloorPlan>(res);
}

export async function createReceiver(input: Receiver): Promise<Receiver> {
  const res = await fetch(`${API_URL}/receivers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  return readJson<Receiver>(res);
}

export async function updateReceiver(id: string, input: Partial<Receiver>): Promise<Receiver> {
  const res = await fetch(`${API_URL}/receivers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  return readJson<Receiver>(res);
}

export async function deleteReceiver(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/receivers/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    throw new Error(`request failed: ${res.status}`);
  }
}
