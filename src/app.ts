import fastify, { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { Config } from "./config.js";
import { docsRoutes } from "./routes/docs.js";
import { downloadRoutes } from "./routes/download.js";
import { formatsRoutes } from "./routes/formats.js";
import { healthRoutes } from "./routes/health.js";
import { infoRoutes } from "./routes/info.js";
import { streamRoutes } from "./routes/stream.js";

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = fastify({
    logger: true,
    bodyLimit: 1024 * 1024,
  });

  await app.register(rateLimit, {
    max: 60,
    timeWindow: "1 minute",
  });

  await app.register(healthRoutes);
  await app.register(infoRoutes, config);
  await app.register(formatsRoutes, config);
  await app.register(streamRoutes, config);
  await app.register(downloadRoutes, config);
  await app.register(docsRoutes);

  return app;
}
