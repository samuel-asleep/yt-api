import { FastifyInstance } from "fastify";
import { PassThrough } from "node:stream";
import { Config } from "../config.js";
import { createCookieFile, spawnDownload } from "../lib/ytdlp.js";
import { validateFormat, validateVideoId } from "../lib/validation.js";

export async function downloadRoutes(app: FastifyInstance, config: Config) {
  app.get("/api/v1/download/:videoId", async (request, reply) => {
    try {
      const videoId = validateVideoId(request.params.videoId);
      const formatQuery = request.query.format ?? "best";
      const format = validateFormat(String(formatQuery));
      const merge = String(request.query.merge ?? "0") === "1";
      const { cookiePath, cleanup } = await createCookieFile(config.ytCookie);
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const child = spawnDownload(
        config.ytdlpPath,
        cookiePath,
        config.ytCookie,
        url,
        format,
        merge,
      );

      const stream = new PassThrough();
      let started = false;
      let stderr = "";

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.stdout.on("data", (chunk) => {
        if (!started) {
          started = true;
          reply.header(
            "Content-Disposition",
            `attachment; filename="${videoId}.mp4"`,
          );
          reply.header("Content-Type", "application/octet-stream");
          reply.send(stream);
        }
        stream.write(chunk);
      });

      child.stdout.on("end", () => {
        stream.end();
      });

      child.on("close", (code) => {
        cleanup().catch(() => undefined);
        if (!started) {
          const message = stderr.toLowerCase().includes("ffmpeg")
            ? "ffmpeg is required to merge streams. Install ffmpeg and retry."
            : stderr || "yt-dlp failed to download the video.";
          reply.status(500).send({ error: message });
          return;
        }
        if (code !== 0) {
          stream.destroy(
            new Error("Download interrupted. Please retry your request."),
          );
        }
      });
    } catch (error: any) {
      reply.status(400).send({ error: error.message });
    }
  });
}
