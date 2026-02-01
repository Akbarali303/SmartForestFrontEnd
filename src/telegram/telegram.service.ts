import { Injectable, Logger } from '@nestjs/common';

const FIRE_KEYWORDS = ['fire', 'yongin', 'yong\'in', 'smoke', 'olov', "o'lov"];
const MOCK_VIDEO_URL =
  process.env.TELEGRAM_MOCK_VIDEO_URL ||
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

export interface FireAlertPayload {
  title: string;
  severity: string;
  latitude: number;
  longitude: number;
  createdAt?: string;
}

function isFireRelated(title: string, severity: string): boolean {
  const t = (title || '').toLowerCase().replace(/'/g, '');
  const isFire = FIRE_KEYWORDS.some((k) => t.includes(k.replace(/'/g, '')));
  const isCritical = (severity || '').toLowerCase() === 'critical';
  return isFire || isCritical;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private readonly chatId = process.env.TELEGRAM_CHAT_ID;
  private readonly baseUrl = 'https://api.telegram.org/bot';

  isConfigured(): boolean {
    return Boolean(this.token && this.chatId);
  }

  async sendFireAlert(payload: FireAlertPayload): Promise<boolean> {
    if (!this.isConfigured()) return false;
    if (!isFireRelated(payload.title, payload.severity)) return false;

    try {
      const text = this.formatMessage(payload);
      const ok1 = await this.sendMessage(text);
      const ok2 = await this.sendLocation(payload.latitude, payload.longitude);
      const ok3 = await this.sendVideo(payload);
      this.logger.log(`Telegram alert sent: ${payload.title} (msg=${ok1} loc=${ok2} video=${ok3})`);
      return ok1 || ok2 || ok3;
    } catch (err) {
      this.logger.error(`Telegram send failed: ${(err as Error).message}`);
      return false;
    }
  }

  private async sendMessage(text: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      this.logger.warn(`sendMessage error: ${data.description ?? res.statusText}`);
      return false;
    }
    return true;
  }

  private async sendLocation(latitude: number, longitude: number): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}${this.token}/sendLocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        latitude,
        longitude,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      this.logger.warn(`sendLocation error: ${data.description ?? res.statusText}`);
      return false;
    }
    return true;
  }

  private async sendVideo(payload: FireAlertPayload): Promise<boolean> {
    const caption = `📍 ${this.escapeHtml(payload.title)} | ${payload.severity}\n` +
      `Hozircha mock video. Real holatda: xavf joyidagi kameraga ulanib 360° aylantirib videoga olinadi va jo'natiladi.`;
    const res = await fetch(`${this.baseUrl}${this.token}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        video: MOCK_VIDEO_URL,
        caption,
        supports_streaming: true,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      this.logger.warn(`sendVideo error: ${data.description ?? res.statusText}`);
      return false;
    }
    return true;
  }

  private formatMessage(p: FireAlertPayload): string {
    const time = p.createdAt
      ? new Date(p.createdAt).toLocaleString('uz-UZ', {
          dateStyle: 'short',
          timeStyle: 'medium',
        })
      : new Date().toLocaleString('uz-UZ', { dateStyle: 'short', timeStyle: 'medium' });
    return [
      '🔥 <b>YONG\'IN OGOHLANTIRISHI</b>',
      '',
      `<b>Hodisa:</b> ${this.escapeHtml(p.title)}`,
      `<b>Darajasi:</b> ${this.escapeHtml(p.severity)}`,
      `<b>Joylashuv:</b> xaritada yuborildi 📍`,
      `<b>Vaqt:</b> ${time}`,
      '',
      'Smart Forest monitoring tizimi',
    ].join('\n');
  }

  private escapeHtml(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
