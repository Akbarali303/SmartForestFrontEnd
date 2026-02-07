import { NextRequest, NextResponse } from 'next/server';
import { addAIEvent } from '@/lib/aiEventsStore';
import { CAMERA_COORDINATES } from '@/lib/cameraCoordinates';

/**
 * AI service (person_detector) hodisa yuboradi: cameraId, cameraName, timestamp, imageBase64.
 * Koordinata kamera joylashuvidan olinadi.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cameraId = String(body?.cameraId ?? 'cam1').trim();
    const cameraName = String(body?.cameraName ?? '').trim() || CAMERA_COORDINATES[cameraId]?.name ?? cameraId;
    const timestamp = typeof body?.timestamp === 'string' ? body.timestamp : new Date().toISOString();
    const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64 : '';

    const coords = CAMERA_COORDINATES[cameraId] ?? CAMERA_COORDINATES['cam1'];
    const event = addAIEvent({
      cameraId,
      cameraName: cameraName || coords.name,
      timestamp,
      imageBase64,
      lat: coords.lat,
      lng: coords.lng,
    });

    return NextResponse.json({ ok: true, id: event.id });
  } catch (e) {
    console.error('[ai-events/ingest]', e);
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }
}
