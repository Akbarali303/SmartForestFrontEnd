import { Injectable, Logger } from '@nestjs/common';

const TELEGRAM_API = 'https://api.telegram.org';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string | undefined;
  private readonly chatId: string | undefined;
  private readonly enabled: boolean;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    this.chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    this.enabled = !!(this.token && this.chatId);
    if (this.enabled) {
      this.logger.log(`Telegram: yoqilgan, Chat ID=${this.chatId}`);
    } else {
      this.logger.warn(
        'Telegram: o\'chirilgan — .env da TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID o\'rnating (masalan TELEGRAM_CHAT_ID=247078210)',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Hodisa haqida Telegramga xabar yuboradi (medium, high, critical).
   */
  async sendAlert(params: {
    title: string;
    severity: string;
    latitude: number;
    longitude: number;
    source?: string;
    description?: string;
  }): Promise<boolean> {
    if (!this.enabled) return false;
    const severityLower = params.severity?.toLowerCase() ?? '';
    if (severityLower !== 'medium' && severityLower !== 'high' && severityLower !== 'critical') {
      return false;
    }

    const text = this.formatMessage(params);
    return this.sendMessage(text);
  }

  private formatMessage(params: {
    title: string;
    severity: string;
    latitude: number;
    longitude: number;
    source?: string;
    description?: string;
  }): string {
    const sev = params.severity?.toLowerCase();
    const emoji = sev === 'critical' ? '🚨' : sev === 'high' ? '⚠️' : '📋';
    const lines = [
      `${emoji} Smart Forest — hodisa`,
      '',
      `Hodisa: ${params.title}`,
      `Daraja: ${params.severity}`,
      `Joy: ${params.latitude.toFixed(4)}, ${params.longitude.toFixed(4)}`,
    ];
    if (params.source) lines.push(`Manba: ${params.source}`);
    if (params.description) lines.push(`Tafsilot: ${params.description}`);
    return lines.join('\n');
  }

  async sendMessage(text: string): Promise<boolean> {
    if (!this.enabled) return false;
    const url = `${TELEGRAM_API}/bot${this.token}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          disable_web_page_preview: true,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; description?: string };
      if (!data?.ok) {
        this.logger.warn(`Telegram xato: ${data?.description ?? res.statusText}`);
        return false;
      }
      this.logger.debug('Telegramga xabar yuborildi');
      return true;
    } catch (err) {
      this.logger.error(`Telegram yuborish xatosi: ${(err as Error).message}`);
      return false;
    }
  }
}
