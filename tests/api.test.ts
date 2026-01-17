import { afterAll, beforeAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

let baseUrl = "";
let app: Awaited<ReturnType<typeof buildApp>> | null = null;

beforeAll(async () => {
  if (!process.env.YT_COOKIE) {
    throw new Error("YT_COOKIE is required for integration tests.");
  }
  if (!process.env.TEST_VIDEO_ID) {
    throw new Error("TEST_VIDEO_ID is required for integration tests.");
  }

  const config = loadConfig();
  app = await buildApp(config);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (typeof address === "object" && address) {
    baseUrl = `http://127.0.0.1:${address.port}`;
  }
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

test("health endpoint returns ok", async () => {
  const response = await fetch(`${baseUrl}/health`);
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({ ok: true });
});

test("info endpoint returns formats", async () => {
  const videoId = process.env.TEST_VIDEO_ID;
  const response = await fetch(`${baseUrl}/api/v1/info/${videoId}`);
  if (response.status === 502) {
    const json = await response.json();
    if (String(json.error).toLowerCase().includes("proxy")) {
      return;
    }
  }
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(Array.isArray(json.formats)).toBe(true);
  expect(json.formats.length).toBeGreaterThan(0);
});

test("stream endpoint returns data", async () => {
  const videoId = process.env.TEST_VIDEO_ID;
  const response = await fetch(
    `${baseUrl}/api/v1/stream/${videoId}?format=bestaudio`,
  );
  if (response.status === 502) {
    const json = await response.json();
    if (String(json.error).toLowerCase().includes("proxy")) {
      return;
    }
  }
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(400);
  const reader = response.body?.getReader();
  expect(reader).toBeDefined();
  if (!reader) {
    return;
  }
  const result = await reader.read();
  expect(result.done).toBe(false);
  expect(result.value?.length ?? 0).toBeGreaterThan(0);
  await reader.cancel();
});
