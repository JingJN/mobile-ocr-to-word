const recordBody = document.querySelector("#recordBody");
const countText = document.querySelector("#countText");
const message = document.querySelector("#message");
const refreshBtn = document.querySelector("#refreshBtn");
const clearBtn = document.querySelector("#clearBtn");

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function setBusy(isBusy) {
  refreshBtn.disabled = isBusy;
  clearBtn.disabled = isBusy;
}

function renderRecords(records) {
  countText.textContent = `共 ${records.length} 条`;
  recordBody.innerHTML = "";

  if (!records.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "empty";
    cell.colSpan = 5;
    cell.textContent = "暂无记录";
    row.append(cell);
    recordBody.append(row);
    return;
  }

  for (const record of records) {
    const row = document.createElement("tr");
    const idCell = document.createElement("td");
    const codeCell = document.createElement("td");
    const sourceCell = document.createElement("td");
    const timeCell = document.createElement("td");
    const actionCell = document.createElement("td");
    const deleteBtn = document.createElement("button");

    idCell.textContent = record.id;
    codeCell.textContent = record.code;
    sourceCell.textContent = record.source === "ntfy" ? "云上传" : "本地";
    timeCell.textContent = record.createdAt;
    deleteBtn.type = "button";
    deleteBtn.textContent = "删除";
    deleteBtn.addEventListener("click", () => deleteRecord(record));

    actionCell.append(deleteBtn);
    row.append(idCell, codeCell, sourceCell, timeCell, actionCell);
    recordBody.append(row);
  }
}

async function loadRecords() {
  setBusy(true);
  setMessage("正在读取记录...");

  try {
    const response = await fetch("/api/records");
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "读取失败");
    }

    renderRecords(payload.records);
    setMessage("记录已同步。删除后会自动更新 Word 文档。");
  } catch (error) {
    setMessage(`读取失败：${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function deleteRecord(record) {
  const confirmed = confirm(`确定删除第 ${record.id} 条编号 ${record.code} 吗？`);

  if (!confirmed) {
    return;
  }

  setBusy(true);
  setMessage("正在删除...");

  try {
    const response = await fetch(`/api/records/${record.id}`, {
      method: "DELETE"
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "删除失败");
    }

    renderRecords(payload.records);
    setMessage(`已删除 ${record.code}，Word 文档已更新。`);
  } catch (error) {
    setMessage(`删除失败：${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function clearRecords() {
  const confirmed = confirm("确定清空全部编号记录吗？这个操作会同步清空 Word 文档。");

  if (!confirmed) {
    return;
  }

  setBusy(true);
  setMessage("正在清空...");

  try {
    const response = await fetch("/api/records", {
      method: "DELETE"
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "清空失败");
    }

    renderRecords([]);
    setMessage("全部记录已清空，Word 文档已更新。");
  } catch (error) {
    setMessage(`清空失败：${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

refreshBtn.addEventListener("click", loadRecords);
clearBtn.addEventListener("click", clearRecords);

loadRecords();
