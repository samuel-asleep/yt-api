You are Codex. Build a production-ready Node.js (TypeScript) REST API service that uses **yt-dlp** (not ytdl-core) to fetch YouTube video/audio info and provide streaming/download options. The API must send a YouTube cookie string as an HTTP `Cookie` header, loaded from `.env`. The cookie MUST NOT be hardcoded and MUST NOT be logged.

Core requirements
- Use yt-dlp as the backend extractor.
- Cookies are provided via `.env` as a single header string and must be used for yt-dlp requests.
- Provide an API docs endpoint explaining how to download/stream YouTube video/audio in different qualities.
- Include automated tests that verify at least one real request works (using env-provided TEST_VIDEO_ID).
- Must run on Linux easily (assume Ubuntu). Provide install notes for yt-dlp.

Tech stack
- Node.js + TypeScript
- Framework: Fastify or Express (choose one and implement cleanly)
- Prefer spawning `yt-dlp` via child_process (execa is OK) and parsing JSON output.
- Config via `.env`:
  - YT_COOKIE=  (full cookie header string: "a=b; c=d; ...")
  - PORT=3000
  - TEST_VIDEO_ID=
  - YTDLP_PATH= optional, default "yt-dlp"

How to pass cookies to yt-dlp
- Convert the `YT_COOKIE` header string into a Netscape cookies.txt file at runtime (temp file), OR generate it in a stable cache directory.
- Then call yt-dlp with `--cookies <path>` (preferred).
- Additionally add `--add-header "Cookie: <YT_COOKIE>"` as a fallback if needed, but still implement cookies file support as the primary method.
- Ensure the temp cookie file permissions are restrictive (0600), and delete it when done if it’s truly temp.

API routes
1) GET /health
  - returns { ok: true }

2) GET /api/v1/info/:videoId
  - Use yt-dlp JSON:
    - `yt-dlp -J --no-warnings --cookies <cookiefile> <url>`
  - Return sanitized info:
    - id, title, duration, uploader, channel, thumbnails
    - formats: list with fields:
      - format_id, ext, protocol, acodec, vcodec, resolution/height/width, fps,
        abr/tbr, filesize/filesize_approx, format_note, quality, url (DO NOT RETURN raw direct URLs unless explicitly requested)
  - Also return “presets” to make quality selection easy:
    - best_audio (audio-only best)
    - best_video (video-only best)
    - best_muxed (combined best)
    - common targets if available: 144p, 360p, 720p, 1080p (muxed if possible else video-only+audio-only recommendation)

3) GET /api/v1/formats/:videoId
  - Returns only the formats list (no direct URLs by default), plus guidance on choosing:
    - audio-only vs video-only vs muxed
    - what format_id means
    - how to pick by height/abr

4) GET /api/v1/stream/:videoId
  - Query parameters:
    - format=<yt-dlp format selector OR a specific format_id>
      Examples:
        - "best"
        - "bestaudio"
        - "bestvideo"
        - "bestvideo[height<=720]+bestaudio/best[height<=720]"
        - "137+140" (video+audio)
        - "22" (a muxed format_id if available)
    - kind=video|audio (optional hint, default auto)
  - Implementation approach (choose safest + simplest):
    Option A (Preferred): use yt-dlp to print the final direct URL and then proxy it:
      - `yt-dlp -g --cookies <cookiefile> -f "<format>" <url>`
      - If multiple URLs returned (video+audio), either:
        - return 400 with message “This selection is separate streams; use /download to merge”, OR
        - proxy only the first URL and document the limitation.
    Option B (Better UX): provide /download that merges with ffmpeg (optional).
  - /stream must NOT expose cookies. It should proxy the selected URL to the client.
  - Support Range requests if feasible (at minimum, don’t break clients).

5) GET /api/v1/download/:videoId  (optional but strongly preferred)
  - Query: format=<selector>, merge=1|0
  - If merge=1 and selection yields separate streams, use yt-dlp with ffmpeg to merge and stream the resulting file:
    - `yt-dlp --cookies <cookiefile> -f "<format>" --merge-output-format mp4 -o - <url>`
    - If streaming to stdout is unreliable, download to temp then stream file and delete.
  - If ffmpeg is missing, return a helpful error explaining how to install it.

6) GET /api-docs
  - Serve a human-readable docs page (Markdown->HTML or plain HTML) including:
    - How to set YT_COOKIE in .env (sensitive; don’t share)
    - How to call /info and /formats
    - Examples showing different qualities using yt-dlp selectors:
      - 360p muxed: `best[height<=360]`
      - 720p: `bestvideo[height<=720]+bestaudio/best[height<=720]`
      - 1080p: `bestvideo[height<=1080]+bestaudio/best[height<=1080]`
      - audio mp3/m4a examples (note: conversion needs ffmpeg)
    - curl examples:
      - list formats
      - stream bestaudio
      - stream 720p selection
      - download merged mp4 (if /download implemented)

Validation & safety
- Validate `videoId` with a conservative regex (YouTube IDs are usually 11 chars: [A-Za-z0-9_-]{11}). If a full URL is passed, reject (or extract ID safely).
- Validate `format` length and characters to avoid command injection (never pass user input through shell; use spawn/execFile with args array).
- Add basic rate limiting and request size limits.
- Error handling:
  - invalid id -> 400
  - yt-dlp not installed -> 500 with clear message
  - unavailable/private/age-restricted -> 502/403 with clear message
  - cookie missing -> 500 at startup (fail fast)

Project structure
- package.json scripts: dev, build, start, test
- tsconfig
- src/config.ts (env loading + validation)
- src/lib/ytdlp.ts (all yt-dlp process execution + cookie file creation)
- src/routes/*.ts
- src/server.ts
- tests/* (Vitest or Jest)
- README.md with:
  - prerequisites: yt-dlp (and ffmpeg optional)
  - .env setup
  - run commands
  - example calls
- .env.example with placeholders only (no real cookie)

Testing (must run)
- Use Vitest or Jest.
- Start server on ephemeral port in tests.
- Tests:
  1) /health returns ok
  2) /api/v1/info/:TEST_VIDEO_ID returns 200 and includes formats array length > 0
  3) /api/v1/stream/:TEST_VIDEO_ID?format=bestaudio returns 200 or 302/206 and returns a non-empty response (read first chunk then abort)
- Tests must fail with a clear message if YT_COOKIE or TEST_VIDEO_ID missing.

Finally
- Ensure implementation actually calls yt-dlp with the cookie file created from YT_COOKIE.
- Make sure nothing prints the cookie.
- Run tests locally and fix until passing.
