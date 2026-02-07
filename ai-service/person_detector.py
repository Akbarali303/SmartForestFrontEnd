#!/usr/bin/env python3
"""
AI service: RTSP/HLS dan kadr olish, YOLO orqali odam aniqlash.
Xabar faqat "odam paydo bo'ldi" (no person -> person) o'tishida yuboriladi.
Odam ko'rinib turganida takroriy xabar yuborilmaydi.
Odam 5–10 s yo'qolsa holat qayta tiklanishi mumkin (keyingi paydo bo'lishda yana 1 xabar).

Ishga tushirish: python person_detector.py
Frontenddan mustaqil ishlaydi.
"""

import os
import sys
import time
import tempfile
from urllib.parse import quote_plus

import cv2
import requests
from dotenv import load_dotenv

# YOLO — ultralytics dan (person = COCO class 0)
try:
    from ultralytics import YOLO
except ImportError:
    print("ultralytics o'rnatilmagan: pip install ultralytics")
    sys.exit(1)

load_dotenv()

# Telegram: TELEGRAM_TOKEN yoki TELEGRAM_BOT_TOKEN
TELEGRAM_TOKEN = (
    os.getenv("TELEGRAM_TOKEN", "").strip()
    or os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
)
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()
# Odam yo'qolganidan keyin qancha sekund kutib yangi "paydo bo'ldi" hisoblansin (5–15 s). Periodik yuborish YO'Q.
NO_PERSON_RESET_SECONDS = max(5, min(15, int(os.getenv("NO_PERSON_RESET_SECONDS", "7"))))
CONFIDENCE_THRESHOLD = max(0.1, min(1.0, float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))))
# Faqat shu confidence dan yuqori bo'lgan detections hisobga olinadi (false positive kamaytirish)
MIN_CONFIDENCE = max(0.5, min(1.0, float(os.getenv("MIN_CONFIDENCE", "0.85"))))
# Past confidence yoki juda kichik bbox (refleksiya/ob'ekt) hisobga olinmaydi
MIN_BOX_WIDTH = max(10, int(os.getenv("MIN_BOX_WIDTH", "25")))   # detection kadrida min kenglik (px)
MIN_BOX_HEIGHT = max(10, int(os.getenv("MIN_BOX_HEIGHT", "50")))  # detection kadrida min balandlik (px)
FRAME_SKIP = max(1, int(os.getenv("FRAME_SKIP", "5")))
CAMERA_NAME = os.getenv("CAMERA_NAME", "Cam1").strip()
# AI detection uchun past rezolyutsiya: kadr kengligi shuncha pikseldan oshmasin
DETECTION_MAX_WIDTH = max(320, min(1280, int(os.getenv("DETECTION_MAX_WIDTH", "640"))))
# Telegram snapshot: JPEG sifati 95–100, to‘liq kamera rezolyutsiyasi, resize yo‘q
JPEG_QUALITY = max(95, min(100, int(os.getenv("JPEG_QUALITY", "95"))))
# Crop atrofidagi padding (0.10–0.20), yaxshi kadrlash uchun
CROP_PADDING = max(0.10, min(0.20, float(os.getenv("CROP_PADDING", "0.15"))))

# COCO: person = 0 (YOLO person class)
PERSON_CLASS_ID = 0

# Face detection (OpenCV Haar) — person box ichida yuzni topish uchun
_FACE_CASCADE = None


def _get_face_cascade():
    global _FACE_CASCADE
    if _FACE_CASCADE is None:
        path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
        _FACE_CASCADE = cv2.CascadeClassifier(path)
    return _FACE_CASCADE


def build_stream_url(for_detection: bool = True):
    """
    RTSP: for_detection=True -> subtype=1 (past rez, faqat AI uchun).
    for_detection=False -> subtype=0 (to‘liq rez, faqat Telegram snapshot uchun).
    """
    url = os.getenv("RTSP_URL", "").strip()
    if url:
        if for_detection and os.getenv("RTSP_SUBTYPE", "1") != "0":
            url = url.replace("subtype=0", "subtype=1")
        elif not for_detection:
            url = url.replace("subtype=1", "subtype=0")
        return url
    user = os.getenv("RTSP_USER", "").strip()
    password = os.getenv("RTSP_PASSWORD", "").strip()
    host = os.getenv("RTSP_HOST", "192.168.0.61:554").strip()
    path = os.getenv("RTSP_PATH", "/cam/realmonitor?channel=1&subtype=0").strip()
    if for_detection and os.getenv("RTSP_SUBTYPE", "1") != "0":
        path = path.replace("subtype=0", "subtype=1")
    elif not for_detection:
        path = path.replace("subtype=1", "subtype=0")
    if user or password:
        cred = quote_plus(user) + ":" + quote_plus(password)
        return f"rtsp://{cred}@{host}{path}"
    return f"rtsp://{host}{path}"


def resize_for_detection(frame):
    """Kadrni detection uchun max DETECTION_MAX_WIDTH ga qisqartiradi (tezroq YOLO)."""
    h, w = frame.shape[:2]
    if w <= DETECTION_MAX_WIDTH:
        return frame
    scale = DETECTION_MAX_WIDTH / w
    new_w = DETECTION_MAX_WIDTH
    new_h = max(1, int(h * scale))
    return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)


def send_telegram_photo(image_path: str, caption: str) -> bool:
    """POST https://api.telegram.org/bot<TOKEN>/sendPhoto — rasm yuboradi, keyin temp faylni o‘chiradi."""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        print("[WARN] TELEGRAM_TOKEN yoki TELEGRAM_CHAT_ID berilmagan, xabar yuborilmaydi")
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
    try:
        with open(image_path, "rb") as f:
            files = {"photo": f}
            data = {"chat_id": TELEGRAM_CHAT_ID, "caption": caption}
            r = requests.post(url, data=data, files=files, timeout=30)
        if r.ok:
            print("[OK] Telegramga yuborildi")
            return True
        print(f"[ERR] Telegram: {r.status_code} {r.text[:200]}")
    except Exception as e:
        print(f"[ERR] Telegram: {e}")
    return False


def build_caption(camera_name: str) -> str:
    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    return f"⚠ Person detected\nCamera: {camera_name}\nTime: {ts}"


def crop_with_padding(frame, box, padding: float):
    """Bbox atrofida padding (10–20%) qo'shib kadrni kesadi; rasm yaxshi ko'rinadi."""
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = map(int, box)
    bw, bh = x2 - x1, y2 - y1
    mw = int(bw * padding)
    mh = int(bh * padding)
    x1 = max(0, x1 - mw)
    y1 = max(0, y1 - mh)
    x2 = min(w, x2 + mw)
    y2 = min(h, y2 + mh)
    return frame[y1:y2, x1:x2]


def _crop_face_or_person(frame, person_box, padding: float):
    """
    Person bbox ichida yuz qidiriladi; topilsa yuz crop (padding bilan), aks holda person crop.
    Barcha crop original (to'liq rez) kadrdan, resize yo'q.
    """
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = map(int, person_box)
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    if x2 <= x1 or y2 <= y1:
        return crop_with_padding(frame, person_box, padding)
    roi = frame[y1:y2, x1:x2]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    cascade = _get_face_cascade()
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    if len(faces) == 0:
        return crop_with_padding(frame, person_box, padding)
    # Eng katta yuzni tanlash
    best = max(faces, key=lambda r: r[2] * r[3])
    fx, fy, fw, fh = best
    # To'liq kadr koordinatalariga o'tkazish
    face_box = (x1 + fx, y1 + fy, x1 + fx + fw, y1 + fy + fh)
    return crop_with_padding(frame, face_box, padding)


def run_detector_for_camera(camera_id: str, camera_name: str, stream_url_det: str, stream_url_full: str):
    """
    Detection: faqat resized kadrda (past rez oqim). Snapshot: to‘liq rez oqimdan, resize yo‘q.
    """
    cap = cv2.VideoCapture(stream_url_det)
    if not cap.isOpened():
        print(f"[ERR] [{camera_id}] Oqim ochilmedi: {stream_url_det[:50]}...")
        return
    model = YOLO("yolov8n.pt")
    person_present = False
    last_seen_time = 0.0
    frame_index = 0
    skip_frames = 0
    try:
        while True:
            if skip_frames > 0:
                for _ in range(skip_frames):
                    cap.grab()
                skip_frames = 0
            ret, frame = cap.read()
            if not ret or frame is None:
                print(f"[WARN] [{camera_id}] Kadr o'qilmadi, qayta ulanish...")
                cap.release()
                time.sleep(5)
                cap = cv2.VideoCapture(stream_url_det)
                continue
            frame_index += 1
            if frame_index % FRAME_SKIP != 0:
                continue
            # Faqat AI detection uchun resized kadr; asl kadr alohida saqlanmaydi (detection past rez)
            frame_det = resize_for_detection(frame)
            t0 = time.time()
            results = model.predict(
                frame_det,
                classes=[PERSON_CLASS_ID],
                conf=CONFIDENCE_THRESHOLD,
                verbose=False,
            )
            elapsed = time.time() - t0
            if elapsed > 0.25:
                skip_frames = min(8, FRAME_SKIP * 2)
            persons = []
            for r in results:
                if r.boxes is None:
                    continue
                for box in r.boxes:
                    if int(box.cls) != PERSON_CLASS_ID:
                        continue
                    conf = float(box.conf)
                    if conf < MIN_CONFIDENCE:
                        continue
                    xyxy = box.xyxy[0].cpu().numpy()
                    bw = xyxy[2] - xyxy[0]
                    bh = xyxy[3] - xyxy[1]
                    if bw < MIN_BOX_WIDTH or bh < MIN_BOX_HEIGHT:
                        continue
                    persons.append((xyxy, conf))
            now = time.time()
            if len(persons) > 0:
                best = max(persons, key=lambda p: p[1])
                box_small, conf = best[0], best[1]
                print(f"[DETECT] [{camera_id}] person confidence={conf:.2f} count={len(persons)}")
                last_seen_time = now
                if not person_present:
                    person_present = True
                    # Bbox: frame_det -> frame (past rez) koordinatalari
                    h_det, w_det = frame_det.shape[:2]
                    h_cur, w_cur = frame.shape[:2]
                    sx_cur = w_cur / max(1, w_det)
                    sy_cur = h_cur / max(1, h_det)
                    box_lowres = (box_small[0] * sx_cur, box_small[1] * sy_cur, box_small[2] * sx_cur, box_small[3] * sy_cur)
                    # Snapshot: to‘liq rez oqimdan bitta kadr, resize yo‘q, JPEG 95–100
                    cap_full = None
                    try:
                        cap_full = cv2.VideoCapture(stream_url_full)
                        if cap_full.isOpened():
                            ret_full, frame_original = cap_full.read()
                            if ret_full and frame_original is not None:
                                H, W = frame_original.shape[:2]
                                sx_full = W / max(1, w_cur)
                                sy_full = H / max(1, h_cur)
                                box_full = (
                                    box_lowres[0] * sx_full, box_lowres[1] * sy_full,
                                    box_lowres[2] * sx_full, box_lowres[3] * sy_full,
                                )
                                # Yuz topilsa face crop, yo‘q bo‘lsa person crop; padding 10–20%
                                out_frame = _crop_face_or_person(frame_original, box_full, CROP_PADDING)
                                if out_frame.size == 0:
                                    out_frame = crop_with_padding(frame_original, box_full, CROP_PADDING)
                                if out_frame.size == 0:
                                    out_frame = frame_original
                            else:
                                out_frame = _crop_face_or_person(frame, box_lowres, CROP_PADDING)
                                if out_frame.size == 0:
                                    out_frame = crop_with_padding(frame, box_lowres, CROP_PADDING)
                                if out_frame.size == 0:
                                    out_frame = frame
                        else:
                            out_frame = _crop_face_or_person(frame, box_lowres, CROP_PADDING)
                            if out_frame.size == 0:
                                out_frame = crop_with_padding(frame, box_lowres, CROP_PADDING)
                            if out_frame.size == 0:
                                out_frame = frame
                    finally:
                        if cap_full is not None:
                            cap_full.release()
                    caption = build_caption(camera_name)
                    tmp_path = None
                    try:
                        fd, tmp_path = tempfile.mkstemp(suffix=".jpg")
                        os.close(fd)
                        cv2.imwrite(tmp_path, out_frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                        send_telegram_photo(tmp_path, caption=caption)
                    finally:
                        if tmp_path and os.path.isfile(tmp_path):
                            try:
                                os.unlink(tmp_path)
                            except Exception:
                                pass
            else:
                if (now - last_seen_time) >= NO_PERSON_RESET_SECONDS:
                    person_present = False
    except KeyboardInterrupt:
        print(f"\n[*] [{camera_id}] To'xtatildi")
    finally:
        cap.release()


def main():
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        print("TELEGRAM_TOKEN va TELEGRAM_CHAT_ID .env da to'ldiring.")
        sys.exit(1)
    stream_url_det = build_stream_url(for_detection=True)
    stream_url_full = build_stream_url(for_detection=False)
    print(f"[*] RTSP (detection): {stream_url_det[:50]}...")
    print(f"[*] RTSP (snapshot):  {stream_url_full[:50]}...")
    print(f"[*] Camera: {CAMERA_NAME}, entry-only alert, reset after {NO_PERSON_RESET_SECONDS}s no person")
    run_detector_for_camera("cam1", CAMERA_NAME, stream_url_det, stream_url_full)


if __name__ == "__main__":
    main()
