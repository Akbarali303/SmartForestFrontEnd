# AI Service — kamera orqali odam aniqlash va Telegram xabarnoma

Frontenddan **mustaqil** ishlaydigan servis: RTSP/HLS oqimdan kadr oladi, YOLO orqali odam aniqlaydi, aniqlanganda rasmni Telegram botga yuboradi.

## Imkoniyatlar

- RTSP yoki HLS stream ga ulanish
- YOLO (YOLOv8n) orqali odam (person) aniqlash
- Odam topilganda: kadrni kesish (person crop) va rasm yaratish
- Rasmni Telegram bot orqali yuborish
- Spam oldini olish: `THROTTLE_SECONDS` davomida faqat bitta xabar (default 60 s)

## O‘rnatish

```bash
cd ai-service
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
pip install -r requirements.txt
```

Birinchi ishga tushirishda YOLO avtomatik `yolov8n.pt` ni yuklab oladi.

## Sozlash

`.env.example` ni nusxalab `.env` yarating va to‘ldiring:

```bash
cp .env.example .env
```

**Majburiy:**

- `TELEGRAM_TOKEN` — [@BotFather](https://t.me/BotFather) dan olingan bot token (yoki `TELEGRAM_BOT_TOKEN`)
- `TELEGRAM_CHAT_ID` — xabarlar yuboriladigan chat id
- Xabar sarlavhasi: `⚠ Person detected`, Camera nomi, Time (timestamp)
- Spam: har kamera uchun max 1 xabar per `THROTTLE_SECONDS` (default 30 s)

**RTSP (bitta qator yoki alohida):**

- Variant 1: `RTSP_URL=rtsp://admin:parol@192.168.0.61:554/cam/realmonitor?channel=1&subtype=0`
- Variant 2: `RTSP_USER`, `RTSP_PASSWORD`, `RTSP_HOST`, `RTSP_PATH`

**Ixtiyoriy:**

- `CAMERA_NAME=Cam1` — xabar sarlavhasidagi kamera nomi
- `THROTTLE_SECONDS=30` — har kamera uchun max 1 xabar per 30 sekund
- `CONFIDENCE_THRESHOLD=0.5` — YOLO ishonch chegarasi (0..1)
- `FRAME_SKIP=5` — har 5-kadrni tahlil qilish (tezlik uchun)

## Test qilish

**1. Telegramni tekshirish (RTSP/YOLO siz)**  
`.env` da `TELEGRAM_TOKEN` va `TELEGRAM_CHAT_ID` to‘ldiring, keyin:

```bash
cd ai-service
venv\Scripts\activate   # Windows
python test_telegram.py
```

Agar chatda test rasm va "⚠ Person detected..." yozuvi chiqsa — Telegram ishlayapti.

**2. To‘liq servis (RTSP + YOLO + Telegram)**  
Kameraga ulanish va odam aniqlash:

```bash
python person_detector.py
```

Terminalda `[*] RTSP: ...` va `[*] Camera: Cam1` chiqadi. Kadrda odam ko‘rinsa, 30 soniyadan keyin Telegramga rasm yuboriladi. To‘xtatish: `Ctrl+C`.

## Ishga tushirish

**Windows (bir buyruq):**  
`ai-service` papkasida PowerShell yoki CMD da:
```bash
.\run.bat
```
(yoki `run.bat` ni Explorer dan ikki marta bosing)

**Qo‘lda:**
```bash
cd ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python person_detector.py
```

To‘xtatish: `Ctrl+C`.

## Telegram Chat ID olish

1. Botga `/start` yuboring.
2. Brauzerda oching:  
   `https://api.telegram.org/bot<TOKEN>/getUpdates`  
   So‘nggi xabarda `"chat":{"id": 123456789}` — bu `TELEGRAM_CHAT_ID`.

## Real vaqtda

Servis doimiy ishlashi uchun:

- **Windows:** Task Scheduler yoki `pythonw person_detector.py`
- **Linux:** `systemd` service yoki `nohup python person_detector.py &`
- **Docker:** `Dockerfile` va `docker-compose` qo‘shish mumkin

## HLS

Agar faqat HLS manzil bo‘lsa (masalan, `http://localhost:9002/streams/camera1.m3u8`), `.env` da:

```env
RTSP_URL=http://localhost:9002/streams/camera1.m3u8
```

OpenCV ba’zi HLS manbalarni ochadi (FFMPEG orqali). Agar ochilmasa, RTSP ishlatish yoki FFmpeg orqali HLS dan kadr olish kerak.
