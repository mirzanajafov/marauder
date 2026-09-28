import { Entity, Receiver, TagEntityInput } from '@marauder/shared';
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
