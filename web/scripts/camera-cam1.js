#!/usr/bin/env node
/**
 * Backend: RTSP → HLS (FFmpeg). Stream doimiy ishlaydi, /streams/cam1.m3u8 orqali beriladi.
 * Ilova aynan cam1.m3u8 ni ochadi — skript ham cam1.m3u8 yozishi kerak.
 * Kamera uzilsa/FFmpeg tugasa: skript 3s dan keyin avtomatik qayta ishga tushiradi.
 * Tok uzilsa: kompyuter qaytib yonganda skriptni qayta ishga tushiring (yoki pm2: pm2 start scripts/camera-cam1.js --name cam1).
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RESTART_DELAY_MS = 3000;

// .env dan RTSP login/parol o‘qish (web/.env — RTSP_USER=admin, RTSP_PASSWORD=...)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    if (!fs.existsSync(envPath)) {
      console.warn('[streams] .env topilmadi:', envPath);
      return;
    }
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.replace(/#.*/, '').trim().replace(/\r$/, '');
      if (!trimmed || !trimmed.startsWith('RTSP_')) return;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) return;
      const key = trimmed.slice(0, eq).trim().replace(/\r$/, '');
      let val = trimmed.slice(eq + 1).trim().replace(/\r$/, '');
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (key === 'RTSP_USER' || key === 'RTSP_PASSWORD') process.env[key] = val;
    });
  } catch (e) {
    console.warn('[streams] .env o\'qish xatosi:', e.message);
  }
}
loadEnv();

const RTSP_USER = (process.env.RTSP_USER || '').trim();
const RTSP_PASSWORD = (process.env.RTSP_PASSWORD || '').trim();

// FFmpeg uchun rtsp://user:pass@host/... — Node URL ba’zan credentials ni chiqarmaydi, shuning uchun qo‘lda
function buildRtspUrl(hostPath) {
  const base = hostPath.startsWith('rtsp://') ? hostPath : 'rtsp://' + hostPath;
  if (!RTSP_USER && !RTSP_PASSWORD) return base;
  const withoutScheme = base.replace(/^rtsp:\/\//, '');
  const encodedUser = encodeURIComponent(RTSP_USER);
  const encodedPass = encodeURIComponent(RTSP_PASSWORD);
  return 'rtsp://' + encodedUser + ':' + encodedPass + '@' + withoutScheme;
}

const CAMERAS = [
  {
    id: 'cam1',
    rtsp: buildRtspUrl('192.168.0.61:554/cam/realmonitor?channel=1&subtype=0'),
  },
];

function findNextAppDir() {
  let dir = __dirname;
  const root = path.parse(dir).root;
  while (dir !== root) {
    const configPath = path.join(dir, 'next.config.js');
    const hasNextConfig = fs.existsSync(configPath) || fs.existsSync(path.join(dir, 'next.config.mjs'));
    if (hasNextConfig) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(__dirname, '..');
}

const APP_DIR = findNextAppDir();
const STREAMS_DIR = path.join(APP_DIR, 'public', 'streams');

fs.mkdirSync(STREAMS_DIR, { recursive: true });

const MINIMAL_M3U8 = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-TARGETDURATION:1',
  '#EXT-X-MEDIA-SEQUENCE:0',
  '',
].join('\n');

function getPaths(cameraId) {
  return {
    m3u8: path.join(STREAMS_DIR, cameraId + '.m3u8'),
    segmentPattern: path.join(STREAMS_DIR, cameraId + '_%03d.ts'),
  };
}

function writePlaceholderM3u8(m3u8Path) {
  try {
    fs.writeFileSync(m3u8Path, MINIMAL_M3U8, 'utf8');
  } catch (e) {}
}

function clearOldSegments(cameraId) {
  try {
    const files = fs.readdirSync(STREAMS_DIR);
    files.forEach((f) => {
      if (f.startsWith(cameraId) && f.endsWith('.ts')) {
        try {
          fs.unlinkSync(path.join(STREAMS_DIR, f));
        } catch (e) {}
      }
    });
  } catch (e) {}
}

const processes = new Map();

function runStreamForCamera(cam) {
  const { id: cameraId, rtsp: rtspUrl } = cam;
  const { m3u8: m3u8Path, segmentPattern } = getPaths(cameraId);
  writePlaceholderM3u8(m3u8Path);
  clearOldSegments(cameraId);

  const args = [
    '-y',
    '-rtsp_transport', 'tcp',
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-use_wallclock_as_timestamps', '1',
    '-i', rtspUrl,
    '-map', '0:v',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-f', 'hls',
    '-hls_time', '1',
    '-hls_list_size', '2',
    '-hls_flags', 'delete_segments+append_list+omit_endlist',
    '-hls_segment_filename', segmentPattern,
    m3u8Path,
  ];

  const ffProcess = spawn('ffmpeg', args, { cwd: APP_DIR, stdio: 'inherit' });
  processes.set(cameraId, ffProcess);

  ffProcess.on('error', (err) => {
    console.error('[camera:' + cameraId + '] ffmpeg error:', err.message);
    processes.delete(cameraId);
    setTimeout(() => runStreamForCamera(cam), RESTART_DELAY_MS);
  });

  ffProcess.on('close', (code, signal) => {
    processes.delete(cameraId);
    if (code !== 0 && code !== null) {
      console.error('[camera:' + cameraId + '] exited code=' + code + ', restarting in ' + RESTART_DELAY_MS / 1000 + 's...');
    }
    setTimeout(() => runStreamForCamera(cam), RESTART_DELAY_MS);
  });
}

CAMERAS.forEach((cam) => {
  writePlaceholderM3u8(getPaths(cam.id).m3u8);
});
console.log('[streams] App dir:', APP_DIR);
console.log('[streams] Endpoint: /streams/cam1.m3u8 (ilova shu manbani ochadi)');
console.log('[streams] Kameralar:', CAMERAS.map((c) => c.id).join(', '));
if (RTSP_USER || RTSP_PASSWORD) {
  const firstCam = CAMERAS[0];
  const url = firstCam ? firstCam.rtsp : '';
  const safeUrl = url.replace(/:([^@]+)@/, ':***@');
  console.log('[streams] RTSP avtorizatsiya: ishlatilmoqda, URL:', safeUrl);
} else {
  console.warn('[streams] RTSP_USER / RTSP_PASSWORD yo\'q — 401 bo\'ladi. web/.env yarating: RTSP_USER=admin, RTSP_PASSWORD=...');
}
CAMERAS.forEach(runStreamForCamera);
