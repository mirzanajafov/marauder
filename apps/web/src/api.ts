import { Entity, HistoryPoint, HistorySummary, Receiver, TagEntityInput } from '@marauder/shared';
import { API_URL } from './config';

export async function fetchEntities(): Promise<Entity[]> {
  const res = await fetch(`${API_URL}/entities`);
  return (await res.json()) as Entity[];
}

export async function fetchReceivers(): Promise<Receiver[]> {
  const res = await fetch(`${API_URL}/receivers`);
  return (await res.json()) as Receiver[];
}

export async function tagEntity(id: string, input: TagEntityInput): Promise<Entity> {
  const res = await fetch(`${API_URL}/entities/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await res.json()) as Entity;
}

export async function fetchHistorySummary(): Promise<HistorySummary> {
  const res = await fetch(`${API_URL}/history/summary`);
  return (await res.json()) as HistorySummary;
}

export async function fetchHistory(from: string, to: string, bucketMs: number): Promise<HistoryPoint[]> {
  const params = new URLSearchParams({ from, to, bucketMs: String(bucketMs) });
  const res = await fetch(`${API_URL}/history?${params.toString()}`);
  return (await res.json()) as HistoryPoint[];
}
