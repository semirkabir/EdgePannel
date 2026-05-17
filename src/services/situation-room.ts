import { SITE_VARIANT } from '@/config';
import { ConvexClient } from 'convex/browser';
import { anyApi } from 'convex/server';

export type SituationRoomId = 'world' | 'tech' | 'finance' | 'supply-chain' | 'good-news' | 'conflicts';

export interface SituationRoomViewAttachment {
  url: string;
  label: string;
}

export interface SituationRoomMessage {
  id: string;
  room: SituationRoomId;
  firebaseUid: string;
  userLabel: string;
  avatarUrl?: string;
  content: string;
  createdAt: number;
  viewUrl?: string;
  viewLabel?: string;
}

export const SITUATION_ROOMS: Array<{ id: SituationRoomId; label: string }> = [
  { id: 'world', label: 'World' },
  { id: 'tech', label: 'Tech' },
  { id: 'finance', label: 'Finance' },
  { id: 'supply-chain', label: 'Supply Chain' },
  { id: 'good-news', label: 'Good News' },
  { id: 'conflicts', label: 'Conflicts' },
];

const VARIANT_TO_ROOM: Record<string, SituationRoomId> = {
  full: 'world',
  tech: 'tech',
  finance: 'finance',
  commodity: 'supply-chain',
  happy: 'good-news',
  conflicts: 'conflicts',
};

export function getDefaultSituationRoom(): SituationRoomId {
  return VARIANT_TO_ROOM[SITE_VARIANT] ?? 'world';
}

export function getSituationRoomLabel(room: SituationRoomId): string {
  return SITUATION_ROOMS.find(entry => entry.id === room)?.label ?? 'World';
}

function normalizeMessages(payload: unknown): SituationRoomMessage[] {
  if (!payload || typeof payload !== 'object') return [];
  const messages = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message): message is SituationRoomMessage => {
      if (!message || typeof message !== 'object') return false;
      const item = message as Partial<SituationRoomMessage>;
      return typeof item.id === 'string'
        && typeof item.room === 'string'
        && typeof item.firebaseUid === 'string'
        && typeof item.userLabel === 'string'
        && typeof item.content === 'string'
        && typeof item.createdAt === 'number';
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}

function normalizeConvexMessages(payload: unknown): SituationRoomMessage[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((message) => {
      if (!message || typeof message !== 'object') return null;
      const item = message as {
        _id?: unknown;
        room?: unknown;
        firebaseUid?: unknown;
        userLabel?: unknown;
        avatarUrl?: unknown;
        content?: unknown;
        createdAt?: unknown;
        viewUrl?: unknown;
        viewLabel?: unknown;
      };
      if (typeof item._id !== 'string'
        || typeof item.room !== 'string'
        || typeof item.firebaseUid !== 'string'
        || typeof item.userLabel !== 'string'
        || typeof item.content !== 'string'
        || typeof item.createdAt !== 'number') {
        return null;
      }
      return {
        id: item._id,
        room: item.room as SituationRoomId,
        firebaseUid: item.firebaseUid,
        userLabel: item.userLabel,
        ...(typeof item.avatarUrl === 'string' ? { avatarUrl: item.avatarUrl } : {}),
        content: item.content,
        createdAt: item.createdAt,
        ...(typeof item.viewUrl === 'string' ? { viewUrl: item.viewUrl } : {}),
        ...(typeof item.viewLabel === 'string' ? { viewLabel: item.viewLabel } : {}),
      } satisfies SituationRoomMessage;
    })
    .filter((message): message is SituationRoomMessage => Boolean(message))
    .sort((a, b) => a.createdAt - b.createdAt);
}

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
let realtimeClient: ConvexClient | null = null;

function getRealtimeClient(): ConvexClient | null {
  if (!CONVEX_URL) return null;
  if (!realtimeClient) {
    realtimeClient = new ConvexClient(CONVEX_URL);
  }
  return realtimeClient;
}

export function isSituationRoomRealtimeConfigured(): boolean {
  return Boolean(CONVEX_URL);
}

export function subscribeSituationRoomMessages(
  room: SituationRoomId,
  onMessages: (messages: SituationRoomMessage[]) => void,
  onError?: (error: Error) => void,
): (() => void) | null {
  const client = getRealtimeClient();
  if (!client) return null;
  const listMessagesQuery = (anyApi as any).chat.listMessages;

  return client.onUpdate(
    listMessagesQuery,
    { room, limit: 80 },
    (messages) => onMessages(normalizeConvexMessages(messages)),
    (error) => onError?.(error instanceof Error ? error : new Error('Situation Room realtime unavailable')),
  );
}

export async function fetchSituationRoomMessages(room: SituationRoomId, limit = 80): Promise<SituationRoomMessage[]> {
  const response = await fetch(`/api/situation-room?room=${encodeURIComponent(room)}&limit=${Math.max(1, Math.min(100, limit))}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Situation Room failed (${response.status})`);
  }
  return normalizeMessages(await response.json());
}

export async function sendSituationRoomMessage(input: {
  room: SituationRoomId;
  content: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  attachment?: SituationRoomViewAttachment | null;
}): Promise<SituationRoomMessage> {
  const response = await fetch('/api/situation-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null) as { error?: string; message?: SituationRoomMessage } | null;
  if (!response.ok || !payload?.message) {
    throw new Error(payload?.error || `Situation Room send failed (${response.status})`);
  }
  return payload.message;
}

export function buildCurrentSituationRoomViewAttachment(): SituationRoomViewAttachment {
  const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') || 'global';
  const timeRange = params.get('timeRange') || '7d';
  const label = `${view[0]?.toUpperCase() ?? 'G'}${view.slice(1)} · ${timeRange}`;
  return { url, label };
}
