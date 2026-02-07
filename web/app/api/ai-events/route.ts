import { NextRequest, NextResponse } from 'next/server';

/**
 * AI hodisa API — Monitoring markazida kameraga bog‘liq hodisalarni qaytaradi.
 * Hozir: mock (tasodifiy). Real qilish: backendda oqimni tahlil qiluvchi model (YOLO, fire/smoke detector)
 * ishlatib, natijani shu endpoint orqali yoki WebSocket orqali yuboring.
 */

const EVENT_TYPES = [
  { id: 'fire', label: "O't aniqlandi", color: 'bg-red-600', icon: '🔥' },
  { id: 'smoke', label: 'Tutun aniqlandi', color: 'bg-amber-600', icon: '💨' },
  { id: 'illegal', label: 'Noqonuniy harakat', color: 'bg-red-700', icon: '⚠️' },
  { id: 'movement', label: 'Harakat signali', color: 'bg-amber-500', icon: '👤' },
] as const;

export type AIEventType = (typeof EVENT_TYPES)[number]['id'];

export interface AIEventResponse {
  event: {
    type: AIEventType;
    typeLabel: string;
    color: string;
    icon: string;
    timestamp: string; // ISO
    cameraId: string;
    confidence?: number; // real AI da: 0..1
  } | null;
}

export async function GET(request: NextRequest) {
  const cameraId = request.nextUrl.searchParams.get('cameraId') || '';
  // Real AI: bu yerda kamera oqimini tahlil qiluvchi servisga so‘rov yuboriladi,
  // yangi hodisa bo‘lsa qaytariladi. Hozir: har so‘rovda bitta mock hodisa (real ulashga tayyor).
  const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  const event: AIEventResponse['event'] = {
    type: eventType.id,
    typeLabel: eventType.label,
    color: eventType.color,
    icon: eventType.icon,
    timestamp: new Date().toISOString(),
    cameraId,
    confidence: 0.85 + Math.random() * 0.15,
  };

  return NextResponse.json({ event } satisfies AIEventResponse);
}
