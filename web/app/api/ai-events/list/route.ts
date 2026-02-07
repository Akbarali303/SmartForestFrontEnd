import { NextResponse } from 'next/server';
import { getAIEvents } from '@/lib/aiEventsStore';

/**
 * Xarita va monitoring panel uchun AI hodisalar ro‘yxati.
 * Har bir hodisa: id, cameraId, cameraName, timestamp, imageUrl (data URL), lat, lng.
 */
export async function GET() {
  const events = getAIEvents().map((e) => ({
    id: e.id,
    cameraId: e.cameraId,
    cameraName: e.cameraName,
    timestamp: e.timestamp,
    imageUrl: e.imageBase64 ? `data:image/jpeg;base64,${e.imageBase64}` : null,
    lat: e.lat,
    lng: e.lng,
  }));
  return NextResponse.json({ events });
}
