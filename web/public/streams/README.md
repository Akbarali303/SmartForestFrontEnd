# Camera test streams

Place HLS stream files here for the camera test page (`/camera-test`).

- **cam1.m3u8** — used as default stream source by the test player.
- Add `.m3u8` manifest and associated `.ts` segments; they will be served at `/streams/...`.

## Run stream with (development only)

From the **project root**:

```bash
npm run camera:cam1
```

From the `web` directory:

```bash
npm run camera:cam1
```

This runs ffmpeg to convert RTSP → HLS and writes `cam1.m3u8` and segments here. Requires ffmpeg installed.

**Manual ffmpeg (from `web` dir):** Do not use `-rw_timeout` or `-stimeout` (not in all builds). Example:

```bash
cd web
ffmpeg -y -rtsp_transport tcp -fflags nobuffer -flags low_delay -i "rtsp://USER:PASS@IP:554/..." -map 0:v -an -c:v libx264 -preset ultrafast -tune zerolatency -f hls -hls_time 1 -hls_list_size 2 -hls_flags delete_segments+append_list+omit_endlist -hls_segment_filename public/streams/cam1_%03d.ts public/streams/cam1.m3u8
```

Isolated for dev; remove script and this note when not needed.

This folder is for testing only and can be removed with the camera-test module.
