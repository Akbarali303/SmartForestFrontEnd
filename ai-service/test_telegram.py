#!/usr/bin/env python3
"""Telegram va .env ni tekshirish — test xabar yuboradi. Faqat urllib (qo'shimcha o'rnatish yo'q)."""

import json
import os
import sys
import time
import urllib.request

def _load_dotenv():
    try:
        from dotenv import load_dotenv
        load_dotenv()
        return
    except ImportError:
        pass
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.isfile(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip().split("#")[0].strip()
                if line and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
_load_dotenv()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "").strip() or os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()
CAMERA_NAME = os.getenv("CAMERA_NAME", "Cam1").strip()


def main():
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        print("XATO: .env da TELEGRAM_TOKEN va TELEGRAM_CHAT_ID to'ldiring.")
        sys.exit(1)
    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    text = (
        f"⚠ Person detected\nCamera: {CAMERA_NAME}\nTime: {ts}\n\n"
        "(Test xabar — AI servis tekshiruvi. Bot ishlayapti.)"
    )
    base = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"
    try:
        req = urllib.request.Request(f"{base}/getMe", method="GET")
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
        if not data.get("ok"):
            print(f"[XATO] Token noto'g'ri: {data}")
            sys.exit(1)
        body = json.dumps({"chat_id": TELEGRAM_CHAT_ID, "text": text}).encode()
        req = urllib.request.Request(
            f"{base}/sendMessage",
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        if data.get("ok"):
            print("[OK] Test xabar Telegramga yuborildi. Chatni tekshiring.")
            print("     Agar ko'rinmasa: Telegramda shu botni oching va /start bosing, keyin qayta ishga tushiring.")
        else:
            err = data.get("description", data)
            print(f"[XATO] Telegram: {err}")
            if "blocked" in str(err).lower() or "deactivated" in str(err).lower():
                print("     Yechim: botni bloklamang, botga /start yuboring.")
            elif "chat not found" in str(err).lower() or "have no rights" in str(err).lower():
                print("     Yechim: Telegramda botni oching va /start bosing. Keyin testni qayta ishga tushiring.")
            sys.exit(1)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"[XATO] Telegram HTTP {e.code}: {body[:400]}")
        if "403" in str(e.code) or "blocked" in body.lower() or "chat not found" in body.lower():
            print("     Yechim: Botga /start yuboring (Telegramda botni oching va 'Start' / /start bosing).")
        sys.exit(1)
    except Exception as e:
        print(f"[XATO] {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
