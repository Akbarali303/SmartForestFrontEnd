/**
 * AI detection hodisalari — xotira (in-memory) saqlash.
 * Ingest API qo‘shadi, list API o‘qiydi.
 */

export type StoredAIEvent = {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: string; // ISO
  imageBase64: string;
  lat: number;
  lng: number;
};

const MAX_EVENTS = 100;
const events: StoredAIEvent[] = [];
let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `ai-${Date.now()}-${idCounter}`;
}

export function addAIEvent(event: Omit<StoredAIEvent, 'id'>): StoredAIEvent {
  const withId = { ...event, id: nextId() };
  events.unshift(withId);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  return withId;
}

export function getAIEvents(): StoredAIEvent[] {
  return [...events];
}
