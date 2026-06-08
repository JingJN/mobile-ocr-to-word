const photoInput = document.querySelector("#photoInput");
const previewWrap = document.querySelector("#previewWrap");
const preview = document.querySelector("#preview");
const cropBox = document.querySelector("#cropBox");
const cropTools = document.querySelector("#cropTools");
const resetCropBtn = document.querySelector("#resetCropBtn");
const fullImageBtn = document.querySelector("#fullImageBtn");
const recognizeBtn = document.querySelector("#recognizeBtn");
const submitBtn = document.querySelector("#submitBtn");
const codeInput = document.querySelector("#codeInput");
const cloudMode = document.querySelector("#cloudMode");
const topicInput = document.querySelector("#topicInput");
const sendHint = document.querySelector("#sendHint");
const hint = document.querySelector("#hint");
const progressBar = document.querySelector("#progressBar");
const progressText = document.querySelector("#progressText");
const serverState = document.querySelector("#serverState");
const historyList = document.querySelector("#historyList");
const clearLocalBtn = document.querySelector("#clearLocalBtn");

let currentImage = null;
let crop = { x: 0.08, y: 0.32, width: 0.84, height: 0.28 };
let cropMode = "crop";
let isBusy = false;
let cropDrag = null;
let ntfyBaseUrl = "https://ntfy.sh";

function setStatus(text, progress = 0) {
  progressText.textContent = text;
  progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function setHint(text, isError = false) {
  hint.textContent = text;
  hint.classList.toggle("error", isError);
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .replace(/[^0-9a-z]/gi, "")
    .toUpperCase();
}

function normalizeTopic(value) {
  return String(value || "")
    .trim()
    .replace(/^https:\/\/ntfy\.sh\//i, "")
    .replace(/[^0-9a-z_-]/gi, "");
}

function setBusy(nextBusy) {
  isBusy = nextBusy;
  photoInput.disabled = nextBusy;
  recognizeBtn.disabled = nextBusy || !currentImage;
  submitBtn.disabled = nextBusy || !normalizeCode(codeInput.value);
}

function syncSendMode() {
  const useCloud = cloudMode.checked;
  topicInput.disabled = !useCloud;
  sendHint.textContent = useCloud
    ? "云上传模式：手机和电脑不需要同一 Wi-Fi。"
    : "备用局域网模式：手机必须能访问电脑本地服务。";
  localStorage.setItem("ocrUseCloud", useCloud ? "1" : "0");
  localStorage.setItem("ocrNtfyTopic", normalizeTopic(topicInput.value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPreviewRect() {
  const rect = preview.getBoundingClientRect();
  const wrapRect = previewWrap.getBoundingClientRect();

  return {
    left: rect.left - wrapRect.left,
    top: rect.top - wrapRect.top,
    width: rect.width,
    height: rect.height
  };
}

function applyCropBox() {
  if (!currentImage || cropMode === "full") {
    cropBox.hidden = true;
    return;
  }

  const rect = getPreviewRect();
  cropBox.hidden = false;
  cropBox.style.left = `${rect.left + rect.width * crop.x}px`;
  cropBox.style.top = `${rect.top + rect.height * crop.y}px`;
  cropBox.style.width = `${rect.width * crop.width}px`;
  cropBox.style.height = `${rect.height * crop.height}px`;
}

function resetCrop() {
  cropMode = "crop";
  crop = { x: 0.08, y: 0.32, width: 0.84, height: 0.28 };
  applyCropBox();
  recognizeBtn.textContent = "识别裁剪区域";
  setStatus("请裁剪编号区域后识别", 0);
  setHint("拖动裁剪框，右下角圆点可缩放。");
}

function useFullImage() {
  cropMode = "full";
  cropBox.hidden = true;
  recognizeBtn.textContent = "识别整张照片";
  setStatus("将识别整张照片", 0);
  setHint("如果编号占画面较小，建议使用裁剪区域识别。");
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem("ocrHistory") || "[]");
  } catch {
    return [];
  }
}

function saveHistory(records) {
  localStorage.setItem("ocrHistory", JSON.stringify(records.slice(0, 20)));
}

function renderHistory() {
  const records = loadHistory();
  historyList.innerHTML = "";

  for (const record of records) {
    const item = document.createElement("li");
    item.textContent = record;
    historyList.append(item);
  }
}

function rememberCode(code) {
  const records = loadHistory();
  records.unshift(code);
  saveHistory([...new Set(records)]);
  renderHistory();
}

function waitForImage(img) {
  if (img.complete && img.naturalWidth) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    img.addEventListener("load", resolve, { once: true });
    img.addEventListener("error", reject, { once: true });
  });
}

async function makeOcrCanvas(imageUrl) {
  const img = new Image();
  img.src = imageUrl;
  await waitForImage(img);

  const source = cropMode === "full"
    ? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }
    : {
        x: Math.round(img.naturalWidth * crop.x),
        y: Math.round(img.naturalHeight * crop.y),
        width: Math.round(img.naturalWidth * crop.width),
        height: Math.round(img.naturalHeight * crop.height)
      };

  source.width = clamp(source.width, 1, img.naturalWidth - source.x);
  source.height = clamp(source.height, 1, img.naturalHeight - source.y);

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, source.x, source.y, source.width, source.height, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const boosted = gray > 150 ? 255 : gray < 95 ? 0 : gray * 1.25;
    data[i] = boosted;
    data[i + 1] = boosted;
    data[i + 2] = boosted;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function pickBestCode(text) {
  const candidates = String(text || "")
    .toUpperCase()
    .match(/[A-Z0-9]{2,}/g);

  if (!candidates?.length) {
    return "";
  }

  return candidates
    .sort((a, b) => b.length - a.length || a.localeCompare(b))[0];
}

async function recognizeImage() {
  if (!currentImage || isBusy) {
    return;
  }

  if (!window.Tesseract) {
    setHint("OCR 库还没有加载完成，或手机当前无法访问 CDN。", true);
    return;
  }

  setBusy(true);
  serverState.textContent = "识别中";
  setHint("正在识别，请保持页面打开。");
  setStatus("准备图片", 8);

  try {
    const canvas = await makeOcrCanvas(currentImage);
    const worker = await Tesseract.createWorker("eng", 1, {
      logger(message) {
        if (message.status === "recognizing text") {
          setStatus("正在识别", 20 + Math.round((message.progress || 0) * 75));
        }
      }
    });

    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    });

    const result = await worker.recognize(canvas);
    await worker.terminate();

    const code = normalizeCode(pickBestCode(result.data.text));
    codeInput.value = code;

    if (code) {
      setStatus("识别完成，请确认编号", 100);
      setHint("请核对编号，必要时手动修改后再上传。");
      serverState.textContent = "待确认";
    } else {
      setStatus("未识别到编号", 100);
      setHint("没有识别到清晰编号，可以重新拍照或手动输入。", true);
      serverState.textContent = "需重拍";
    }
  } catch (error) {
    console.error(error);
    setStatus("识别失败", 100);
    setHint(`识别失败：${error.message}`, true);
    serverState.textContent = "失败";
  } finally {
    setBusy(false);
  }
}

async function submitCode() {
  const code = normalizeCode(codeInput.value);

  if (!code || isBusy) {
    setHint("请先确认一个有效编号。", true);
    return;
  }

  setBusy(true);
  serverState.textContent = "上传中";
  setStatus(cloudMode.checked ? "正在通过 ntfy 上传" : "正在上传到电脑", 40);
  setHint("电脑会写入 Word 文档并自动打开。");

  try {
    let payload = null;

    if (cloudMode.checked) {
      const topic = normalizeTopic(topicInput.value);

      if (!topic) {
        throw new Error("请先输入电脑端显示的 ntfy topic");
      }

      topicInput.value = topic;
      localStorage.setItem("ocrNtfyTopic", topic);

      const response = await fetch(`${ntfyBaseUrl}/${topic}`, {
        method: "POST",
        headers: {
          "Cache": "no"
        },
        body: code
      });

      if (!response.ok) {
        throw new Error(`ntfy 上传失败：HTTP ${response.status}`);
      }

      payload = {
        code,
        count: "云端"
      };
    } else {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ code })
      });

      payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "上传失败");
      }
    }

    codeInput.value = payload.code;
    rememberCode(payload.code);
    setStatus(cloudMode.checked ? "已发送，等待电脑接收" : `已写入电脑 Word，共 ${payload.count} 条`, 100);
    setHint("上传成功。可以继续拍下一张。");
    serverState.textContent = "已写入";
  } catch (error) {
    console.error(error);
    setStatus("上传失败", 100);
    setHint(`上传失败：请确认手机和电脑在同一 Wi-Fi，电脑服务仍在运行。${error.message}`, true);
    serverState.textContent = "失败";
  } finally {
    setBusy(false);
  }
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];

  if (!file) {
    return;
  }

  if (currentImage) {
    URL.revokeObjectURL(currentImage);
  }

  currentImage = URL.createObjectURL(file);
  preview.src = currentImage;
  previewWrap.hidden = false;
  cropTools.hidden = false;
  cropBox.hidden = true;
  codeInput.value = "";
  setBusy(false);
  waitForImage(preview)
    .then(() => {
      resetCrop();
      recognizeBtn.disabled = false;
      serverState.textContent = "待裁剪";
    })
    .catch((error) => {
      setStatus("照片加载失败", 100);
      setHint(`照片加载失败：${error.message}`, true);
      serverState.textContent = "失败";
    });
});

recognizeBtn.addEventListener("click", recognizeImage);
submitBtn.addEventListener("click", submitCode);
resetCropBtn.addEventListener("click", resetCrop);
fullImageBtn.addEventListener("click", useFullImage);
cloudMode.addEventListener("change", syncSendMode);
topicInput.addEventListener("input", syncSendMode);
codeInput.addEventListener("input", () => {
  const normalized = normalizeCode(codeInput.value);
  submitBtn.disabled = isBusy || !normalized;
  setHint(normalized ? "请核对编号，必要时手动修改后再上传。" : "请输入数字和英文字母。", !normalized);
});

clearLocalBtn.addEventListener("click", () => {
  localStorage.removeItem("ocrHistory");
  renderHistory();
});

const urlTopic = normalizeTopic(new URLSearchParams(location.search).get("topic"));
const savedTopic = normalizeTopic(localStorage.getItem("ocrNtfyTopic"));
const savedUseCloud = localStorage.getItem("ocrUseCloud");

if (urlTopic || savedTopic) {
  topicInput.value = urlTopic || savedTopic;
}

cloudMode.checked = savedUseCloud === null ? true : savedUseCloud === "1";
syncSendMode();

fetch("/api/status")
  .then((response) => response.json())
  .then((payload) => {
    if (payload.ntfyTopic && !topicInput.value) {
      topicInput.value = payload.ntfyTopic;
      syncSendMode();
    }
    serverState.textContent = "已连接";
  })
  .catch(() => {
    serverState.textContent = cloudMode.checked ? "云上传" : "离线";
  });

renderHistory();

cropBox.addEventListener("pointerdown", (event) => {
  if (isBusy || !currentImage || cropMode === "full") {
    return;
  }

  const rect = getPreviewRect();
  const mode = event.target.classList.contains("cropHandle") ? "resize" : "move";
  cropDrag = {
    mode,
    startX: event.clientX,
    startY: event.clientY,
    startCrop: { ...crop },
    rect
  };
  cropBox.setPointerCapture(event.pointerId);
  event.preventDefault();
});

cropBox.addEventListener("pointermove", (event) => {
  if (!cropDrag) {
    return;
  }

  const dx = (event.clientX - cropDrag.startX) / cropDrag.rect.width;
  const dy = (event.clientY - cropDrag.startY) / cropDrag.rect.height;
  const minSize = 0.12;

  if (cropDrag.mode === "move") {
    crop.x = clamp(cropDrag.startCrop.x + dx, 0, 1 - cropDrag.startCrop.width);
    crop.y = clamp(cropDrag.startCrop.y + dy, 0, 1 - cropDrag.startCrop.height);
  } else {
    crop.width = clamp(cropDrag.startCrop.width + dx, minSize, 1 - cropDrag.startCrop.x);
    crop.height = clamp(cropDrag.startCrop.height + dy, minSize, 1 - cropDrag.startCrop.y);
  }

  applyCropBox();
});

cropBox.addEventListener("pointerup", () => {
  cropDrag = null;
});

cropBox.addEventListener("pointercancel", () => {
  cropDrag = null;
});

window.addEventListener("resize", applyCropBox);
