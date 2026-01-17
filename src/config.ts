import dotenv from "dotenv";

dotenv.config();

const REQUIRED_ENV = ["YT_COOKIE"] as const;

export type Config = {
  ytCookie: string;
  port: number;
  testVideoId?: string;
  ytdlpPath: string;
};

function requireEnv(key: typeof REQUIRED_ENV[number]): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfig(): Config {
  const ytCookie = requireEnv("YT_COOKIE");
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isFinite(port)) {
    throw new Error("PORT must be a number");
  }

  return {
    ytCookie,
    port,
    testVideoId: process.env.TEST_VIDEO_ID,
    ytdlpPath: process.env.YTDLP_PATH ?? "yt-dlp",
  };
}
