const DEFAULT_STATE = {
  datasetInfo: {
    name: "",
    version: "",
    description: "",
  },
  records: [],
  draftRecord: {
    meta: {
      asset: "",
      timestamp: "",
    },
    features: {},
    labels: {},
    tags: [],
  },
};

const DRAFT_STORAGE_KEY = "dataset-builder-draft";

const appState = structuredClone(DEFAULT_STATE);

let featureRows = [{ name: "", type: "float", value: "" }];
let labelRows = [{ name: "", type: "string", value: "" }];
let currentTagInput = "";
let customMetaRows = [];
let formError = "";

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

const api = {
  async postRecord(record) {
    try {
      const response = await fetch("/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      showToast("Record saved", "success");
      return await response.json().catch(() => record);
    } catch (error) {
      showToast("API unavailable; saved locally", "error");
      return record;
    }
  },
  async deleteRecord(id) {
    try {
      const response = await fetch(`/records/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      showToast("Record deleted", "success");
    } catch (error) {
      showToast("API unavailable; deleted locally", "error");
    }
  },
  async exportDataset(format) {
    try {
      const response = await fetch(`/export?format=${format}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      triggerDownload(blob, `dataset.${format}`);
      showToast(`Exported ${format.toUpperCase()}`, "success");
    } catch (error) {
      const payload = format === "json"
        ? JSON.stringify(appState.records, null, 2)
        : appState.records.map((record) => JSON.stringify(record)).join("\n");
      const blob = new Blob([payload], { type: "application/octet-stream" });
      triggerDownload(blob, `dataset.${format}`);
      showToast(`Offline ${format.toUpperCase()} export created`, "error");
    }
  },
};

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseByType(type, value) {
  if (type === "float") return Number.parseFloat(value);
  if (type === "int") return Number.parseInt(value, 10);
  if (type === "boolean") return value === true || value === "true" || value === "1";
  return String(value);
}

function loadDraftOnStart() {
  const serialized = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (!serialized) return;
  try {
    const parsed = JSON.parse(serialized);
    appState.draftRecord = {
      meta: parsed.meta || { asset: "", timestamp: "" },
      features: parsed.features || {},
      labels: parsed.labels || {},
      tags: parsed.tags || [],
    };
    const [asset, timestamp, ...rest] = Object.entries(appState.draftRecord.meta);
    appState.draftRecord.meta.asset = asset?.[1] || "";
    appState.draftRecord.meta.timestamp = timestamp?.[1] || "";
    customMetaRows = rest.map(([key, value]) => ({ key, value }));
  } catch {
    showToast("Could not restore draft", "error");
  }
}

function autoSaveDraft() {
  setInterval(() => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(appState.draftRecord));
  }, 2000);
}

function updateDatasetInfo(field, value) {
  appState.datasetInfo[field] = value;
  render();
}

function addMetaField() {
  customMetaRows.push({ key: "", value: "" });
  render();
}

function removeMetaField(index) {
  customMetaRows.splice(index, 1);
  syncMetaRowsToDraft();
  render();
}

function syncMetaRowsToDraft() {
  const meta = {
    asset: appState.draftRecord.meta.asset,
    timestamp: appState.draftRecord.meta.timestamp,
  };
  for (const row of customMetaRows) {
    if (!row.key) continue;
    if (!Object.hasOwn(meta, row.key)) {
      meta[row.key] = row.value;
    }
  }
  appState.draftRecord.meta = meta;
}

function validateMeta() {
  if (!appState.draftRecord.meta.asset) return "Meta asset is required.";
  if (!appState.draftRecord.meta.timestamp) return "Meta timestamp is required.";
  const keys = customMetaRows.map((row) => row.key).filter(Boolean);
  if (new Set(keys).size !== keys.length) return "Meta keys must be unique.";
  return "";
}

function addFeatureRow(kind) {
  if (kind === "feature") featureRows.push({ name: "", type: "float", value: "" });
  if (kind === "label") labelRows.push({ name: "", type: "string", value: "" });
  render();
}

function removeBuilderRow(kind, index) {
  if (kind === "feature") featureRows.splice(index, 1);
  if (kind === "label") labelRows.splice(index, 1);
  render();
}

function validateRows(rows, title) {
  const names = rows.map((row) => row.name.trim()).filter(Boolean);
  if (names.length === 0) return `${title} must contain at least one row.`;
  if (names.length !== new Set(names).size) return `${title} names must be unique.`;
  for (const row of rows) {
    if (!row.name.trim()) return `${title} name cannot be empty.`;
    const parsed = parseByType(row.type, row.value);
    if ((row.type === "float" || row.type === "int") && Number.isNaN(parsed)) {
      return `${title} value for ${row.name} must match ${row.type}.`;
    }
  }
  return "";
}

function commitRowsToDraft(kind, rows) {
  const target = {};
  rows.forEach((row) => {
    target[row.name.trim()] = parseByType(row.type, row.value);
  });
  appState.draftRecord[kind] = target;
}

function addTagFromInput() {
  const value = currentTagInput.trim();
  if (!value) return;
  appState.draftRecord.tags = [...appState.draftRecord.tags, value];
  currentTagInput = "";
  render();
}

function removeTag(index) {
  appState.draftRecord.tags.splice(index, 1);
  render();
}

function validateDraft() {
  if (!appState.datasetInfo.name.trim()) return "Dataset name is required.";
  const metaError = validateMeta();
  if (metaError) return metaError;
  const featureError = validateRows(featureRows, "Features");
  if (featureError) return featureError;
  const labelError = validateRows(labelRows, "Labels");
  if (labelError) return labelError;
  return "";
}

async function saveRecord() {
  syncMetaRowsToDraft();
  commitRowsToDraft("features", featureRows);
  commitRowsToDraft("labels", labelRows);

  const validationError = validateDraft();
  if (validationError) {
    formError = validationError;
    render();
    showToast(validationError, "error");
    return;
  }

  formError = "";
  const newRecord = {
    id: crypto.randomUUID(),
    meta: structuredClone(appState.draftRecord.meta),
    features: structuredClone(appState.draftRecord.features),
    labels: structuredClone(appState.draftRecord.labels),
    tags: [...appState.draftRecord.tags],
  };

  const saved = await api.postRecord(newRecord);
  appState.records.push(saved);
  appState.draftRecord = structuredClone(DEFAULT_STATE.draftRecord);
  featureRows = [{ name: "", type: "float", value: "" }];
  labelRows = [{ name: "", type: "string", value: "" }];
  customMetaRows = [];
  currentTagInput = "";
  render();
}

async function deleteRecord(id) {
  await api.deleteRecord(id);
  appState.records = appState.records.filter((record) => record.id !== id);
  render();
}

function updateBuilderRow(kind, index, field, value) {
  const rows = kind === "feature" ? featureRows : labelRows;
  rows[index][field] = value;
}

function render() {
  const app = document.getElementById("app");

  const recordsRows = appState.records
    .map(
      (record) => `
      <tr>
        <td>${record.id}</td>
        <td>${record.meta.asset || "-"}</td>
        <td>${record.meta.timestamp || "-"}</td>
        <td>${Object.keys(record.features).length}</td>
        <td>${Object.keys(record.labels).length}</td>
        <td><button class="danger" onclick="deleteRecord('${record.id}')">Delete</button></td>
      </tr>
    `,
    )
    .join("");

  const buildRows = (kind, rows) =>
    rows
      .map(
        (row, index) => `
      <div class="row cols-3">
        <input placeholder="name" value="${row.name}" oninput="updateBuilderRow('${kind}', ${index}, 'name', this.value)" />
        <select onchange="updateBuilderRow('${kind}', ${index}, 'type', this.value)">
          ${["float", "int", "string", "boolean"]
            .map((type) => `<option value="${type}" ${row.type === type ? "selected" : ""}>${type}</option>`)
            .join("")}
        </select>
        <div style="display:flex; gap:0.5rem;">
          <input style="flex:1" placeholder="value" value="${row.value}" oninput="updateBuilderRow('${kind}', ${index}, 'value', this.value)" />
          <button class="danger" onclick="removeBuilderRow('${kind}', ${index})">✕</button>
        </div>
      </div>
    `,
      )
      .join("");

  const customMetaHtml = customMetaRows
    .map(
      (row, index) => `
      <div class="row cols-3">
        <input placeholder="custom key" value="${row.key}" oninput="customMetaRows[${index}].key=this.value; syncMetaRowsToDraft();" />
        <input placeholder="custom value" value="${row.value}" oninput="customMetaRows[${index}].value=this.value; syncMetaRowsToDraft();" />
        <button class="danger" onclick="removeMetaField(${index})">Remove</button>
      </div>
    `,
    )
    .join("");

  app.innerHTML = `
    <section>
      <div class="panel">
        <h1>Frontend Dataset Builder Dashboard</h1>
        <div class="row cols-2">
          <label>Dataset name
            <input value="${appState.datasetInfo.name}" oninput="updateDatasetInfo('name', this.value)" />
          </label>
          <label>Version
            <input value="${appState.datasetInfo.version}" oninput="updateDatasetInfo('version', this.value)" />
          </label>
        </div>
        <label>Description
          <textarea oninput="updateDatasetInfo('description', this.value)">${appState.datasetInfo.description}</textarea>
        </label>
      </div>

      <div class="panel">
        <h2>Meta Section</h2>
        <div class="row cols-2">
          <label>Asset
            <select onchange="appState.draftRecord.meta.asset=this.value;syncMetaRowsToDraft();">
              ${["", "image", "video", "audio", "text"]
                .map((v) => `<option value="${v}" ${appState.draftRecord.meta.asset === v ? "selected" : ""}>${v || 'Select asset'}</option>`)
                .join("")}
            </select>
          </label>
          <label>Timestamp
            <input type="datetime-local" value="${appState.draftRecord.meta.timestamp}" oninput="appState.draftRecord.meta.timestamp=this.value;syncMetaRowsToDraft();" />
          </label>
        </div>
        ${customMetaHtml}
        <button onclick="addMetaField()">Add meta field</button>
        <p class="muted">No duplicate custom keys allowed.</p>
      </div>

      <div class="panel">
        <h2>Feature Builder</h2>
        ${buildRows("feature", featureRows)}
        <button onclick="addFeatureRow('feature')">Add feature</button>
      </div>

      <div class="panel">
        <h2>Label Builder</h2>
        ${buildRows("label", labelRows)}
        <button onclick="addFeatureRow('label')">Add label</button>
      </div>

      <div class="panel">
        <h2>Tag Input</h2>
        <div class="row cols-2">
          <input placeholder="Type tag and press Enter" value="${currentTagInput}" oninput="currentTagInput=this.value" onkeydown="if(event.key==='Enter'){event.preventDefault();addTagFromInput();}" />
          <button onclick="addTagFromInput()">Add tag</button>
        </div>
        <div>${appState.draftRecord.tags.map((tag, index) => `<span class='badge'>${tag}<button onclick='removeTag(${index})'>×</button></span>`).join("")}</div>
      </div>

      <div class="panel">
        <h2>Save Record</h2>
        ${formError ? `<div class="error">${formError}</div>` : ""}
        <button class="primary" onclick="saveRecord()">Save Record</button>
      </div>

      <div class="panel">
        <h2>Export Panel</h2>
        <button onclick="api.exportDataset('json')">Export JSON</button>
        <button onclick="api.exportDataset('jsonl')">Export JSONL</button>
      </div>
    </section>

    <aside class="panel">
      <h2>Records Table</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Asset</th>
              <th>Timestamp</th>
              <th>Feature Count</th>
              <th>Label Count</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${recordsRows || `<tr><td colspan="6" class="muted">No records yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </aside>
  `;
}

loadDraftOnStart();
autoSaveDraft();
render();
