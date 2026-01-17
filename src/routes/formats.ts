import { FastifyInstance } from "fastify";
import { Config } from "../config.js";
import { createCookieFile, getVideoInfo, mapYtdlpError } from "../lib/ytdlp.js";
import { validateVideoId } from "../lib/validation.js";

export async function formatsRoutes(app: FastifyInstance, config: Config) {
  app.get("/api/v1/formats/:videoId", async (request, reply) => {
    try {
      const videoId = validateVideoId(request.params.videoId);
      const { cookiePath, cleanup } = await createCookieFile(config.ytCookie);
      try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await getVideoInfo(
          config.ytdlpPath,
          cookiePath,
          config.ytCookie,
          url,
        );

        const formats = (info.formats ?? []).map((format: any) => ({
          format_id: format.format_id,
          ext: format.ext,
          protocol: format.protocol,
          acodec: format.acodec,
          vcodec: format.vcodec,
          resolution:
            format.resolution ||
            (format.width && format.height
              ? `${format.width}x${format.height}`
              : undefined),
          height: format.height,
          width: format.width,
          fps: format.fps,
          abr: format.abr,
          tbr: format.tbr,
          filesize: format.filesize,
          filesize_approx: format.filesize_approx,
          format_note: format.format_note,
          quality: format.quality,
        }));

        reply.send({
          videoId,
          formats,
          guidance: [
            "format_id is the yt-dlp format identifier.",
            "Muxed formats include both audio and video (acodec and vcodec are set).",
            "Video-only formats have acodec=none; audio-only formats have vcodec=none.",
            "Select by height (e.g., best[height<=720]) or abr for audio.",
          ],
        });
      } finally {
        await cleanup();
      }
    } catch (error: any) {
      const mapped = mapYtdlpError(error.message ?? "");
      reply.status(mapped.status).send({ error: mapped.message });
    }
  });
}
