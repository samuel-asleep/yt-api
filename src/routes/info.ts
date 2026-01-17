import { FastifyInstance } from "fastify";
import { Config } from "../config.js";
import { createCookieFile, getVideoInfo, mapYtdlpError } from "../lib/ytdlp.js";
import { validateVideoId } from "../lib/validation.js";

type FormatSummary = {
  format_id: string;
  ext?: string;
  protocol?: string;
  acodec?: string;
  vcodec?: string;
  resolution?: string;
  height?: number;
  width?: number;
  fps?: number;
  abr?: number;
  tbr?: number;
  filesize?: number;
  filesize_approx?: number;
  format_note?: string;
  quality?: number;
};

function summarizeFormats(formats: any[]): FormatSummary[] {
  return formats.map((format) => ({
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
}

function buildPresets(formats: FormatSummary[]) {
  const hasMuxed = formats.some(
    (format) => format.vcodec !== "none" && format.acodec !== "none",
  );

  return {
    best_audio: "bestaudio",
    best_video: "bestvideo",
    best_muxed: hasMuxed ? "best" : "bestvideo+bestaudio",
    targets: {
      "144p": hasMuxed
        ? "best[height<=144]"
        : "bestvideo[height<=144]+bestaudio/best[height<=144]",
      "360p": hasMuxed
        ? "best[height<=360]"
        : "bestvideo[height<=360]+bestaudio/best[height<=360]",
      "720p": hasMuxed
        ? "best[height<=720]"
        : "bestvideo[height<=720]+bestaudio/best[height<=720]",
      "1080p": hasMuxed
        ? "best[height<=1080]"
        : "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    },
  };
}

export async function infoRoutes(app: FastifyInstance, config: Config) {
  app.get("/api/v1/info/:videoId", async (request, reply) => {
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
        const formats = summarizeFormats(info.formats ?? []);

        reply.send({
          id: info.id,
          title: info.title,
          duration: info.duration,
          uploader: info.uploader,
          channel: info.channel,
          thumbnails: info.thumbnails ?? [],
          formats,
          presets: buildPresets(formats),
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
