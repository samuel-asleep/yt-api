# YT API

Production-ready Node.js (TypeScript) REST API service powered by `yt-dlp`.

## Prerequisites

- **Node.js** 18+
- **yt-dlp** installed on the host (Ubuntu example):
  ```bash
  sudo apt-get update
  sudo apt-get install -y yt-dlp
  ```
- **ffmpeg** (optional, required for merged downloads):
  ```bash
  sudo apt-get install -y ffmpeg
  ```

## Setup

1. Copy `.env.example` to `.env` and fill in the values:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run dev
   ```

## Build and run

```bash
npm run build
npm start
```

## Endpoints

- `GET /health`
- `GET /api/v1/info/:videoId`
- `GET /api/v1/formats/:videoId`
- `GET /api/v1/stream/:videoId?format=...`
- `GET /api/v1/download/:videoId?format=...&merge=1`
- `GET /api-docs`

## Examples

```bash
curl http://localhost:3000/api/v1/info/VIDEO_ID
curl http://localhost:3000/api/v1/formats/VIDEO_ID
curl http://localhost:3000/api/v1/stream/VIDEO_ID?format=bestaudio
curl http://localhost:3000/api/v1/stream/VIDEO_ID?format=bestvideo[height<=720]+bestaudio/best[height<=720]
curl -o video.mp4 "http://localhost:3000/api/v1/download/VIDEO_ID?format=bestvideo[height<=720]+bestaudio/best[height<=720]&merge=1"
```
