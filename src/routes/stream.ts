import { FastifyInstance } from "fastify";
import { Readable } from "node:stream";
import { Config } from "../config.js";
import { createCookieFile, getDirectUrls, mapYtdlpError } from "../lib/ytdlp.js";
import { validateFormat, validateVideoId } from "../lib/validation.js";

export async function streamRoutes(app: FastifyInstance, config: Config) {
  app.get("/api/v1/stream/:videoId", async (request, reply) => {
    try {
      const videoId = validateVideoId(request.params.videoId);
      const formatQuery = request.query.format ?? "best";
      const format = validateFormat(String(formatQuery));
      const { cookiePath, cleanup } = await createCookieFile(config.ytCookie);
      try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const urls = await getDirectUrls(
          config.ytdlpPath,
          cookiePath,
          config.ytCookie,
          url,
          format,
        );

        if (urls.length > 1) {
          reply.status(400).send({
            error:
              "Selected format resolves to multiple streams. Use /download to merge.",
          });
          return;
        }

        const streamUrl = urls[0];
        const range = request.headers.range;
        const upstream = await fetch(streamUrl, {
          headers: range ? { range } : {},
        });

        reply.status(upstream.status);
        for (const [key, value] of upstream.headers.entries()) {
          if (key.toLowerCase() === "set-cookie") {
            continue;
          }
          reply.header(key, value);
        }

        const body = upstream.body;
        if (!body) {
          reply.send();
          return;
        }

        reply.send(Readable.fromWeb(body));
      } finally {
        await cleanup();
      }
    } catch (error: any) {
      const mapped = mapYtdlpError(error.message ?? "");
      reply.status(mapped.status).send({ error: mapped.message });
    }
  });
}
