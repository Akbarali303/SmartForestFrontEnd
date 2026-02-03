#!/usr/bin/env node
/**
 * Development-only: run RTSP → HLS stream for cam1.
 * Watchdog: restart ffmpeg if stream freezes or input disconnects.
 * Writes to public/streams/cam1.m3u8. Old segments deleted continuously via FFmpeg flags.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RTSP_URL = 'rtsp://admin:L24B0580@192.168.0.61:554/cam/realmonitor?channel=1&subtype=0';

const RESTART_DELAY_MS = 3000;
const WATCHDOG_INTERVAL_MS = 10000;
const WATCHDOG_STALE_MS = 15000;

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
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const STREAMS_DIR = path.join(APP_DIR, 'public', 'streams');
const M3U8_PATH = path.join(STREAMS_DIR, 'cam1.m3u8');
const SEGMENT_PATTERN = path.join(STREAMS_DIR, 'cam1_%03d.ts');

fs.mkdirSync(STREAMS_DIR, { recursive: true });

const MINIMAL_M3U8 = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-TARGETDURATION:1',
  '#EXT-X-MEDIA-SEQUENCE:0',
  '',
].join('\n');

function writePlaceholderM3u8() {
  try {
    fs.writeFileSync(M3U8_PATH, MINIMAL_M3U8, 'utf8');
  } catch (e) {}
}

writePlaceholderM3u8();
console.log('[camera:cam1] public dir:', PUBLIC_DIR);
console.log('[camera:cam1] HLS output:', M3U8_PATH);
console.log('[camera:cam1] URL: /streams/cam1.m3u8');
console.log('[camera:cam1] Watchdog: restart if no update for', WATCHDOG_STALE_MS / 1000, 's');

let ffProcess = null;
let watchdogTimer = null;

function clearOldSegments() {
  try {
    const files = fs.readdirSync(STREAMS_DIR);
    files.forEach((f) => {
      if (f.startsWith('cam1') && (f.endsWith('.ts') || f.endsWith('.m3u8'))) {
        try {
          fs.unlinkSync(path.join(STREAMS_DIR, f));
        } catch (e) {}
      }
    });
  } catch (e) {}
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

function startWatchdog() {
  stopWatchdog();
  watchdogTimer = setInterval(() => {
    if (!ffProcess) return;
    try {
      const stat = fs.statSync(M3U8_PATH);
      const age = Date.now() - stat.mtimeMs;
      if (age > WATCHDOG_STALE_MS) {
        console.error('[camera:cam1] Stream stale (no update in ' + Math.round(age / 1000) + 's), restarting ffmpeg...');
        ffProcess.kill('SIGKILL');
      }
    } catch (e) {
      if (ffProcess) {
        console.error('[camera:cam1] Playlist missing or unreadable, restarting ffmpeg...');
        ffProcess.kill('SIGKILL');
      }
    }
  }, WATCHDOG_INTERVAL_MS);
}

const args = [
  '-y',
  '-rtsp_transport', 'tcp',
  '-fflags', 'nobuffer',
  '-flags', 'low_delay',
  '-use_wallclock_as_timestamps', '1',
  '-i', RTSP_URL,
  '-map', '0:v',
  '-an',
  '-c:v', 'libx264',
  '-preset', 'ultrafast',
  '-tune', 'zerolatency',
  '-f', 'hls',
  '-hls_time', '1',
  '-hls_list_size', '2',
  '-hls_flags', 'delete_segments+append_list+omit_endlist',
  '-hls_segment_filename', SEGMENT_PATTERN,
  M3U8_PATH,
];

function runStream() {
  clearOldSegments();
  writePlaceholderM3u8();
  ffProcess = spawn('ffmpeg', args, {
    cwd: APP_DIR,
    stdio: 'inherit',
  });

  ffProcess.on('error', (err) => {
    console.error('[camera:cam1] ffmpeg error:', err.message);
    ffProcess = null;
    stopWatchdog();
    setTimeout(runStream, RESTART_DELAY_MS);
  });

  ffProcess.on('close', (code, signal) => {
    ffProcess = null;
    stopWatchdog();
    if (code !== 0 && code !== null) {
      console.error('[camera:cam1] ffmpeg exited code=' + code + (signal ? ' signal=' + signal : '') + ', restarting in ' + RESTART_DELAY_MS / 1000 + 's...');
    }
    setTimeout(runStream, RESTART_DELAY_MS);
  });

  startWatchdog();
}

runStream();
