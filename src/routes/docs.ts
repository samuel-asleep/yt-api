import { FastifyInstance } from "fastify";

const docsHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>YT API Docs</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; line-height: 1.6; }
      code, pre { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
      pre { padding: 12px; overflow-x: auto; }
    </style>
  </head>
  <body>
    <h1>YT API Documentation</h1>
    <p>
      This API wraps <code>yt-dlp</code>. Provide a YouTube cookie header in
      <code>.env</code> as <code>YT_COOKIE</code>. Never share this value.
    </p>
    <h2>Endpoints</h2>
    <ul>
      <li><code>GET /health</code> - basic health check.</li>
      <li><code>GET /api/v1/info/:videoId</code> - sanitized video metadata.</li>
      <li><code>GET /api/v1/formats/:videoId</code> - formats list + guidance.</li>
      <li><code>GET /api/v1/stream/:videoId?format=...</code> - proxy a stream.</li>
      <li><code>GET /api/v1/download/:videoId?format=...&amp;merge=1</code> - download/merge.</li>
    </ul>

    <h2>Format selectors</h2>
    <ul>
      <li>360p muxed: <code>best[height&lt;=360]</code></li>
      <li>720p: <code>bestvideo[height&lt;=720]+bestaudio/best[height&lt;=720]</code></li>
      <li>1080p: <code>bestvideo[height&lt;=1080]+bestaudio/best[height&lt;=1080]</code></li>
      <li>Best audio: <code>bestaudio</code></li>
    </ul>

    <h2>Examples</h2>
    <pre><code>curl http://localhost:3000/api/v1/formats/VIDEO_ID</code></pre>
    <pre><code>curl http://localhost:3000/api/v1/stream/VIDEO_ID?format=bestaudio</code></pre>
    <pre><code>curl http://localhost:3000/api/v1/stream/VIDEO_ID?format=bestvideo[height&lt;=720]+bestaudio/best[height&lt;=720]</code></pre>
    <pre><code>curl -o video.mp4 "http://localhost:3000/api/v1/download/VIDEO_ID?format=bestvideo[height&lt;=720]+bestaudio/best[height&lt;=720]&amp;merge=1"</code></pre>
  </body>
</html>`;

export async function docsRoutes(app: FastifyInstance) {
  app.get("/api-docs", async (_request, reply) => {
    reply.type("text/html").send(docsHtml);
  });
}
