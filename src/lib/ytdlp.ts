import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const COOKIE_FILE_NAME = "yt-cookie.txt";
const COOKIE_DOMAIN = ".youtube.com";

type SpawnResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

function sanitizeCookieValue(value: string): string {
  return value.replace(/[\r\n]/g, "");
}

export async function createCookieFile(
  cookieHeader: string,
): Promise<{ cookiePath: string; cleanup: () => Promise<void> }> {
  const cleaned = sanitizeCookieValue(cookieHeader);
  const cookieDir = await fs.mkdtemp(path.join(os.tmpdir(), "yt-api-"));
  const cookiePath = path.join(cookieDir, COOKIE_FILE_NAME);

  const pairs = cleaned
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const index = entry.indexOf("=");
      if (index === -1) {
        return null;
      }
      const name = entry.slice(0, index).trim();
      const value = entry.slice(index + 1).trim();
      if (!name) {
        return null;
      }
      return { name, value };
    })
    .filter((pair): pair is { name: string; value: string } => Boolean(pair));

  const lines = [
    "# Netscape HTTP Cookie File",
    ...pairs.map(
      ({ name, value }) =>
        `${COOKIE_DOMAIN}\tTRUE\t/\tFALSE\t0\t${name}\t${value}`,
    ),
  ];

  await fs.writeFile(cookiePath, lines.join("\n"), { mode: 0o600 });
  return {
    cookiePath,
    cleanup: async () => {
      await fs.rm(cookieDir, { recursive: true, force: true });
    },
  };
}

async function runYtDlp(
  ytdlpPath: string,
  args: string[],
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(ytdlpPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error("yt-dlp not found. Install it and set YTDLP_PATH."));
        return;
      }
      reject(error);
    });

    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
  });
}

export async function getVideoInfo(
  ytdlpPath: string,
  cookiePath: string,
  cookieHeader: string,
  url: string,
): Promise<any> {
  const args = [
    "-J",
    "--no-warnings",
    "--cookies",
    cookiePath,
    "--add-header",
    `Cookie: ${cookieHeader}`,
    url,
  ];
  const { stdout, stderr, exitCode } = await runYtDlp(ytdlpPath, args);
  if (exitCode !== 0) {
    throw new Error(stderr || "yt-dlp failed to fetch info");
  }
  return JSON.parse(stdout);
}

export async function getDirectUrls(
  ytdlpPath: string,
  cookiePath: string,
  cookieHeader: string,
  url: string,
  format: string,
): Promise<string[]> {
  const args = [
    "-g",
    "--cookies",
    cookiePath,
    "--add-header",
    `Cookie: ${cookieHeader}`,
    "-f",
    format,
    url,
  ];
  const { stdout, stderr, exitCode } = await runYtDlp(ytdlpPath, args);
  if (exitCode !== 0) {
    throw new Error(stderr || "yt-dlp failed to resolve stream URL");
  }
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function spawnDownload(
  ytdlpPath: string,
  cookiePath: string,
  cookieHeader: string,
  url: string,
  format: string,
  merge: boolean,
) {
  const args = [
    "--cookies",
    cookiePath,
    "--add-header",
    `Cookie: ${cookieHeader}`,
    "-f",
    format,
  ];

  if (merge) {
    args.push("--merge-output-format", "mp4");
  }

  args.push("-o", "-", url);
  return spawn(ytdlpPath, args, { stdio: ["ignore", "pipe", "pipe"] });
}

export function mapYtdlpError(error: string) {
  const message = error.toLowerCase();
  if (message.includes("yt-dlp not found")) {
    return { status: 500, message: "yt-dlp is not installed on the server." };
  }
  if (message.includes("private") || message.includes("sign in")) {
    return { status: 403, message: "Video is private or requires login." };
  }
  if (message.includes("unavailable")) {
    return { status: 502, message: "Video is unavailable." };
  }
  if (message.includes("proxy") || message.includes("tunnel")) {
    return { status: 502, message: "Upstream request blocked by proxy." };
  }
  return { status: 500, message: "yt-dlp request failed." };
}
