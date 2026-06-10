import http from "node:http";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const outputDir = path.join(__dirname, "output");
const docPath = path.join(outputDir, "编号记录.doc");
const recordsPath = path.join(outputDir, "records.json");
const configPath = path.join(__dirname, "config.json");
const port = Number(process.env.PORT || 3000);
const ntfyBaseUrl = process.env.NTFY_BASE_URL || "https://ntfy.sh";

let wordOpenRequested = false;
let ntfyConfig = null;
const handledNtfyIds = new Set();
const ntfyStartedAt = Math.floor(Date.now() / 1000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .replace(/[^0-9a-z]/gi, "")
    .toUpperCase();
}

function getLocalAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const items of Object.values(interfaces)) {
    for (const item of items || []) {
      if (item.family === "IPv4" && !item.internal) {
        addresses.push(item.address);
      }
    }
  }

  return addresses;
}

async function getConfig() {
  if (ntfyConfig) {
    return ntfyConfig;
  }

  try {
    const raw = await fs.readFile(configPath, "utf8");
    ntfyConfig = JSON.parse(raw);
  } catch {
    ntfyConfig = {
      ntfyTopic: `ocr-word-${randomBytes(18).toString("hex")}`,
      ntfyBaseUrl
    };
    await fs.writeFile(configPath, JSON.stringify(ntfyConfig, null, 2), "utf8");
  }

  ntfyConfig.ntfyBaseUrl ||= ntfyBaseUrl;
  return ntfyConfig;
}

async function readRecords() {
  try {
    const raw = await fs.readFile(recordsPath, "utf8");
    const records = JSON.parse(raw);
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

async function saveRecords(records) {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(recordsPath, JSON.stringify(records, null, 2), "utf8");
  await writeWordDoc(records);
}

async function writeWordDoc(records) {
  await fs.mkdir(outputDir, { recursive: true });

  const rows = records
    .map((record, index) => {
      return `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(record.code)}</td>
        <td>${escapeHtml(record.createdAt)}</td>
      </tr>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="mobile-ocr-to-word">
  <title>编号记录</title>
  <style>
    body { font-family: Arial, "Microsoft YaHei", sans-serif; font-size: 12pt; }
    h1 { font-size: 20pt; margin: 0 0 16pt; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #444; padding: 8px 10px; text-align: left; }
    th { background: #f0f0f0; }
    td:nth-child(1) { width: 50px; text-align: center; }
    td:nth-child(2) { font-family: Consolas, monospace; font-size: 15pt; font-weight: bold; }
  </style>
</head>
<body>
  <h1>编号记录</h1>
  <table>
    <thead>
      <tr><th>序号</th><th>编号</th><th>写入时间</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

  await fs.writeFile(docPath, html, "utf8");
}

async function appendCode(codeValue, source = "local") {
  const code = normalizeCode(codeValue);

  if (!code) {
    throw new Error("没有可写入的编号");
  }

  const records = await readRecords();
  const record = {
    code,
    source,
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false })
  };

  records.push(record);
  await saveRecords(records);

  openWordDoc();
  wordOpenRequested = true;

  return {
    code,
    count: records.length
  };
}

function openWordDoc() {
  if (process.platform === "darwin") {
    execFile("open", [docPath], (error) => {
      if (error) {
        console.warn(`无法自动打开 Word 文档：${error.message}`);
      }
    });
    return;
  }

  if (process.platform === "win32") {
    execFile("cmd", ["/c", "start", "", docPath], (error) => {
      if (error) {
        console.warn(`无法自动打开 Word 文档：${error.message}`);
      }
    });
    return;
  }

  execFile("xdg-open", [docPath], (error) => {
    if (error) {
      console.warn(`无法自动打开 Word 文档：${error.message}`);
    }
  });
}

function withRecordIds(records) {
  return records.map((record, index) => ({
    id: index + 1,
    code: record.code,
    source: record.source || "local",
    createdAt: record.createdAt || ""
  }));
}

async function handleDeleteRecord(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const id = Number(requestUrl.pathname.split("/").pop());

  if (!Number.isInteger(id) || id < 1) {
    sendJson(res, 400, { ok: false, error: "无效的记录序号" });
    return;
  }

  const records = await readRecords();

  if (id > records.length) {
    sendJson(res, 404, { ok: false, error: "记录不存在" });
    return;
  }

  const [deleted] = records.splice(id - 1, 1);
  await saveRecords(records);

  sendJson(res, 200, {
    ok: true,
    deleted,
    count: records.length,
    records: withRecordIds(records)
  });
}

async function handleClearRecords(res) {
  await saveRecords([]);
  sendJson(res, 200, {
    ok: true,
    count: 0,
    records: []
  });
}

async function handleUpload(req, res) {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1024 * 1024) {
      req.destroy();
    }
  });

  req.on("end", async () => {
    try {
      const payload = JSON.parse(body || "{}");
      const result = await appendCode(payload.code, "local");

      sendJson(res, 200, {
        ok: true,
        code: result.code,
        count: result.count,
        docPath,
        wordOpenRequested
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
  });
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "content-type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/records") {
    await handleUpload(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/records") {
    const records = await readRecords();
    sendJson(res, 200, {
      ok: true,
      count: records.length,
      records: withRecordIds(records)
    });
    return;
  }

  if (req.method === "DELETE" && req.url === "/api/records") {
    await handleClearRecords(res);
    return;
  }

  if (req.method === "DELETE" && req.url.startsWith("/api/records/")) {
    await handleDeleteRecord(req, res);
    return;
  }

  if (req.method === "GET" && req.url === "/api/status") {
    const records = await readRecords();
    const config = await getConfig();
    sendJson(res, 200, {
      ok: true,
      count: records.length,
      docPath,
      ntfyTopic: config.ntfyTopic,
      ntfyPublishUrl: `${config.ntfyBaseUrl}/${config.ntfyTopic}`,
      addresses: getLocalAddresses().map((address) => `http://${address}:${port}`)
    });
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

async function handleNtfyMessage(message) {
  if (message.event !== "message" || !message.message) {
    return;
  }

  if (message.time && message.time < ntfyStartedAt) {
    return;
  }

  if (message.id && handledNtfyIds.has(message.id)) {
    return;
  }

  const code = normalizeCode(message.message);
  if (!code) {
    return;
  }

  if (message.id) {
    handledNtfyIds.add(message.id);
  }

  const result = await appendCode(code, "ntfy");
  console.log(`收到 ntfy 编号：${result.code}，已写入 Word，共 ${result.count} 条`);
}

async function subscribeNtfy() {
  const config = await getConfig();
  const streamUrl = `${config.ntfyBaseUrl}/${config.ntfyTopic}/json`;

  while (true) {
    try {
      console.log(`正在订阅 ntfy：${streamUrl}`);
      const response = await fetch(streamUrl);

      if (!response.ok || !response.body) {
        throw new Error(`ntfy 连接失败：HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          throw new Error("ntfy 连接已断开");
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }
          await handleNtfyMessage(JSON.parse(trimmed));
        }
      }
    } catch (error) {
      console.warn(`ntfy 订阅异常：${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

server.listen(port, "0.0.0.0", async () => {
  const config = await getConfig();
  const urls = getLocalAddresses().map((address) => `http://${address}:${port}`);
  console.log(`电脑端服务已启动：http://localhost:${port}`);
  if (urls.length) {
    console.log("备用局域网地址：");
    for (const url of urls) {
      console.log(`  ${url}`);
    }
  }
  console.log("不使用局域网时：");
  console.log(`  ntfy topic：${config.ntfyTopic}`);
  console.log(`  手机端发布地址：${config.ntfyBaseUrl}/${config.ntfyTopic}`);
  console.log(`Word 文档路径：${docPath}`);
  subscribeNtfy();
});
