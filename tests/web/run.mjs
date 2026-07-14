import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { accessSync, constants, createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dist = resolve(root, "dist");
const chrome = findChrome();
const profile = await mkdtemp(join(tmpdir(), "mai-kit-web-smoke-"));
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const path = resolve(dist, pathname === "/" ? "index.html" : `.${pathname}`);
    if (!path.startsWith(`${dist}/`) && path !== join(dist, "index.html")) {
      response.writeHead(403).end();
      return;
    }
    const info = await stat(path);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "Content-Type": contentType(path) });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

await listen(server);
const address = server.address();
assert.ok(address && typeof address === "object", "browser smoke server did not bind a port");

let chromeStderr = "";
const chromeProcess = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-features=LocalNetworkAccessChecks",
    "--disable-gpu",
    "--disable-sync",
    "--no-default-browser-check",
    "--no-first-run",
    "--no-sandbox",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
chromeProcess.stderr?.on("data", (chunk) => {
  chromeStderr = `${chromeStderr}${String(chunk)}`.slice(-4_000);
});

let socket;
try {
  const devtoolsFile = join(profile, "DevToolsActivePort");
  await waitForFile(devtoolsFile, chromeProcess, 10_000);
  const [debugPort] = (await readFile(devtoolsFile, "utf8")).trim().split("\n");
  assert.ok(debugPort, "Chrome did not expose a DevTools port");

  const pageURL = `http://127.0.0.1:${address.port}`;
  const targetResponse = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(pageURL)}`,
    { method: "PUT" },
  );
  assert.equal(targetResponse.ok, true, `Chrome target creation failed: ${targetResponse.status}`);
  const target = await targetResponse.json();
  assert.equal(typeof target.webSocketDebuggerUrl, "string");

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await waitForWebSocket(socket);
  const send = createCdpSender(socket);
  await send("Runtime.enable");

  const result = await waitForSmokeResult(send, 60_000);
  assert.equal(result.status, "ok", result.message);
  assert.ok(result.badgeLength > 100);
  assert.ok(result.fontBytes > 1_000_000);
  assert.ok(result.wasmBytes > 1_000_000);
  assert.ok(result.chartTagCount > 0);
  assert.ok(result.pngBytes > 1_000);
  assert.equal(result.solverRemaining, 3);
  assert.equal(result.solverTargetCount, 23);
  assert.equal(result.solverMixedSatisfied, true);
  assert.equal(result.inferenceAchievement, 90);
  assert.equal(result.inferenceDxScore, 20);
  assert.equal(result.proberRating, 15_000);
  assert.equal(result.proberScoreCount, 1);
  assert.equal(result.proberUtageType, "utage");
  console.log(result);
} catch (error) {
  if (chromeStderr) console.error(chromeStderr);
  throw error;
} finally {
  socket?.close();
  await stopProcess(chromeProcess);
  await closeServer(server);
  await rm(profile, { recursive: true, force: true });
}

function createCdpSender(devtoolsSocket) {
  let nextId = 0;
  const pending = new Map();
  devtoolsSocket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (typeof message.id !== "number") return;
    const handlers = pending.get(message.id);
    if (!handlers) return;
    pending.delete(message.id);
    if (message.error) handlers.reject(new Error(message.error.message));
    else handlers.resolve(message.result);
  });
  return async (method, params = {}) =>
    await new Promise((resolveSend, rejectSend) => {
      nextId += 1;
      pending.set(nextId, { resolve: resolveSend, reject: rejectSend });
      devtoolsSocket.send(JSON.stringify({ id: nextId, method, params }));
    });
}

async function waitForSmokeResult(send, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- poll until the browser test publishes its result
    const response = await send("Runtime.evaluate", {
      expression: "window.maiKitSmoke",
      returnByValue: true,
    });
    const result = response.result?.value;
    if (result?.status === "ok" || result?.status === "error") return result;
    // oxlint-disable-next-line eslint/no-await-in-loop -- bounded polling interval
    await delay(250);
  }
  throw new Error(`browser smoke timed out after ${timeoutMs}ms`);
}

async function waitForFile(path, process, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      accessSync(path, constants.R_OK);
      return;
    } catch {
      if (process.exitCode !== null) {
        throw new Error(`Chrome exited before DevTools was ready: ${process.exitCode}`);
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- bounded readiness polling
      await delay(50);
    }
  }
  throw new Error(`Chrome DevTools port was not ready after ${timeoutMs}ms`);
}

async function waitForWebSocket(devtoolsSocket) {
  await new Promise((resolveOpen, rejectOpen) => {
    devtoolsSocket.addEventListener("open", resolveOpen, { once: true });
    devtoolsSocket.addEventListener(
      "error",
      () => rejectOpen(new Error("DevTools socket failed")),
      {
        once: true,
      },
    );
  });
}

async function listen(httpServer) {
  await new Promise((resolveListen, rejectListen) => {
    httpServer.once("error", rejectListen);
    httpServer.listen(0, "127.0.0.1", () => {
      httpServer.off("error", rejectListen);
      resolveListen();
    });
  });
}

async function closeServer(httpServer) {
  await new Promise((resolveClose, rejectClose) => {
    httpServer.close((error) => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });
}

async function stopProcess(process) {
  if (process.exitCode !== null) return;
  process.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => process.once("exit", resolveExit)),
    delay(2_000).then(() => {
      if (process.exitCode === null) process.kill("SIGKILL");
      return undefined;
    }),
  ]);
}

async function delay(ms) {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("/")) {
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        continue;
      }
    }
    try {
      return execFileSync("which", [candidate], { encoding: "utf8" }).trim();
    } catch {
      continue;
    }
  }
  throw new Error("Chrome executable was not found; set CHROME_PATH");
}

function contentType(path) {
  return (
    {
      ".css": "text/css",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript",
      ".json": "application/json",
      ".otf": "font/otf",
      ".png": "image/png",
      ".ttf": "font/ttf",
      ".wasm": "application/wasm",
    }[extname(path)] ?? "application/octet-stream"
  );
}
