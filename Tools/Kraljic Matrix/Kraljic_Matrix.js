const scaleLabels = {
  1: "Very Low",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "Very High"
};

const sampleSpendRows = [
  { Category: "Item-1", Supplier: "Supplier-1", "Annual Spend": "250,000" },
  { Category: "Item-2", Supplier: "Supplier-2", "Annual Spend": "4,500,000" },
  { Category: "Item-3", Supplier: "Supplier-3", "Annual Spend": "1,800,000" },
  { Category: "Item-4", Supplier: "Supplier-4", "Annual Spend": "25,000" }
];

let uploadedRawData = null;

function loadItems() {
  try {
    const savedItems = JSON.parse(localStorage.getItem("kraljic"));

    if (!Array.isArray(savedItems)) {
      return [];
    }

    return savedItems
      .filter(item => (
        item &&
        typeof item.name === "string" &&
        (item.risk === null || Number.isInteger(item.risk)) &&
        Number.isInteger(item.impact) &&
        (item.risk === null || (item.risk >= 1 && item.risk <= 5)) &&
        item.impact >= 1 &&
        item.impact <= 5
      ))
      .map(item => ({
        name: item.name.trim(),
        risk: item.risk,
        impact: item.impact,
        annualSpend: Number(item.annualSpend) || 0,
        suppliers: Array.isArray(item.suppliers) ? item.suppliers.filter(Boolean) : []
      }))
      .filter(item => item.name);
  } catch (error) {
    console.warn("Unable to load saved Kraljic Matrix data.", error);
    return [];
  }
}

let items = loadItems();

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const sampleBtn = document.getElementById("sampleBtn");
const mappingSection = document.getElementById("mapping-section");
const categoryColumn = document.getElementById("categoryColumn");
const supplierColumn = document.getElementById("supplierColumn");
const spendColumn = document.getElementById("spendColumn");
const processBtn = document.getElementById("processBtn");
const riskEntry = document.getElementById("risk-entry");
const categorySelect = document.getElementById("categorySelect");
const riskInput = document.getElementById("risk");
const riskVal = document.getElementById("riskVal");
const addBtn = document.getElementById("addBtn");
const updateMatrixBtn = document.getElementById("updateMatrixBtn");
const resetBtn = document.getElementById("resetBtn");
const csvBtn = document.getElementById("csvBtn");
const imgBtn = document.getElementById("imgBtn");
const tableBody = document.getElementById("table");
const matrix = document.getElementById("matrix");
const summary = document.getElementById("summary");
const searchInput = document.getElementById("searchInput");

function updateSliderLabels() {
  riskVal.textContent = scaleLabels[riskInput.value];
}

riskInput.addEventListener("input", updateSliderLabels);
updateSliderLabels();

function save() {
  localStorage.setItem("kraljic", JSON.stringify(items));
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function classifyItem(item) {
  if (!Number.isInteger(item.risk)) return null;
  if (item.impact > 2 && item.risk > 2) return "strategic";
  if (item.impact <= 2 && item.risk > 2) return "bottleneck";
  if (item.impact > 2 && item.risk <= 2) return "leverage";
  return "non-critical";
}

function getPointClass(category) {
  switch (category) {
    case "strategic": return "strategic-point";
    case "bottleneck": return "bottleneck-point";
    case "leverage": return "leverage-point";
    default: return "non-critical-point";
  }
}

function getPointColor(category) {
  switch (category) {
    case "strategic": return "#e11d48";
    case "bottleneck": return "#d97706";
    case "leverage": return "#2dba4e";
    default: return "#0078d4";
  }
}

function getPointOffset(index) {
  const offsetPattern = [
    [0, 0],
    [12, -12],
    [-12, 12],
    [12, 12],
    [-12, -12],
    [0, -18],
    [18, 0],
    [0, 18],
    [-18, 0]
  ];

  return offsetPattern[index % offsetPattern.length];
}

function parseSpend(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const cleaned = String(value || "")
    .replace(/[^0-9.-]/g, "")
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function calculateImpactScores(aggregatedItems) {
  const spends = aggregatedItems.map(item => item.annualSpend);
  const minSpend = Math.min(...spends);
  const maxSpend = Math.max(...spends);

  return aggregatedItems.map(item => {
    if (maxSpend === minSpend) {
      return { ...item, impact: 3 };
    }

    const normalized = (item.annualSpend - minSpend) / (maxSpend - minSpend);
    return {
      ...item,
      impact: Math.min(5, Math.max(1, Math.round(normalized * 4) + 1))
    };
  });
}

function populateColumnSelectors(headers) {
  [categoryColumn, supplierColumn, spendColumn].forEach(select => {
    select.innerHTML = "";
    headers.forEach(header => {
      const option = document.createElement("option");
      option.value = header;
      option.textContent = header;
      select.appendChild(option);
    });
  });

  selectLikelyColumn(categoryColumn, headers, ["category", "commodity", "group"]);
  selectLikelyColumn(supplierColumn, headers, ["supplier", "vendor"]);
  selectLikelyColumn(spendColumn, headers, ["annual spend", "spend", "value", "cost"]);
  mappingSection.classList.remove("hidden");
}

function selectLikelyColumn(select, headers, keywords) {
  const match = headers.find(header => {
    const normalized = header.toLowerCase();
    return keywords.some(keyword => normalized.includes(keyword));
  });

  if (match) {
    select.value = match;
  }
}

function setUploadedData(rows, showMapping = true) {
  uploadedRawData = rows;
  const headers = Object.keys(rows[0] || {});

  if (!headers.length) {
    alert("No usable columns were found. Please use a file with a header row.");
    return;
  }

  if (showMapping) {
    populateColumnSelectors(headers);
  }
}

function loadSampleData() {
  mappingSection.classList.add("hidden");
  uploadedRawData = sampleSpendRows;
  aggregateRows("Category", "Supplier", "Annual Spend");
}

function handleFile(file) {
  if (!file) {
    return;
  }

  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const allowedExtensions = [".csv", ".xlsx", ".xls"];

  if (!allowedExtensions.includes(extension)) {
    alert("Please upload a valid CSV, XLS, or XLSX file.");
    fileInput.value = "";
    return;
  }

  if (typeof XLSX === "undefined") {
    alert("The spreadsheet parser is not available. Please check your connection and reload the page.");
    return;
  }

  const reader = new FileReader();

  reader.onload = event => {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames && workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("Workbook does not contain any sheets.");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        header: 1
      });
      const headerRow = rawRows.find(row => row.some(cell => String(cell).trim()));

      if (!headerRow) {
        throw new Error("No header row found.");
      }

      const parsedRows = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        range: rawRows.indexOf(headerRow)
      });

      if (!parsedRows.length) {
        throw new Error("No data rows found.");
      }

      setUploadedData(parsedRows, true);
    } catch (error) {
      console.error("Unable to read file.", error);
      uploadedRawData = null;
      mappingSection.classList.add("hidden");
      fileInput.value = "";
      alert("We could not read this file. Please upload a CSV, XLS, or XLSX file with a header row and data rows.");
    }
  };

  reader.onerror = () => {
    uploadedRawData = null;
    mappingSection.classList.add("hidden");
    fileInput.value = "";
    alert("We could not read this file. Please try again.");
  };

  reader.readAsArrayBuffer(file);
}

function aggregateMappedData() {
  if (!uploadedRawData || !uploadedRawData.length) {
    alert("Upload a file or load sample data first.");
    return;
  }

  aggregateRows(categoryColumn.value, supplierColumn.value, spendColumn.value);
}

function aggregateRows(categoryKey, supplierKey, spendKey) {
  const previousRiskByName = new Map(items.map(item => [item.name, item.risk]));
  const groups = new Map();

  uploadedRawData.forEach(row => {
    const category = String(row[categoryKey] || "").trim();
    const supplier = String(row[supplierKey] || "").trim();
    const annualSpend = parseSpend(row[spendKey]);

    if (!category || annualSpend <= 0) {
      return;
    }

    if (!groups.has(category)) {
      groups.set(category, {
        name: category,
        annualSpend: 0,
        suppliers: new Set(),
        risk: previousRiskByName.has(category) ? previousRiskByName.get(category) : null,
        impact: 3
      });
    }

    const group = groups.get(category);
    group.annualSpend += annualSpend;
    if (supplier) {
      group.suppliers.add(supplier);
    }
  });

  const aggregatedItems = Array.from(groups.values())
    .map(item => ({
      ...item,
      suppliers: Array.from(item.suppliers).sort()
    }))
    .sort((a, b) => b.annualSpend - a.annualSpend);

  if (!aggregatedItems.length) {
    alert("No valid category and annual spend rows were found.");
    return;
  }

  items = calculateImpactScores(aggregatedItems);
  save();
  populateCategoryRiskSelector();
  riskEntry.classList.remove("hidden");
  renderTable();
  clearMatrix();
}

function populateCategoryRiskSelector() {
  categorySelect.innerHTML = "";

  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item.name;
    option.textContent = `${item.name} (${formatCurrency(item.annualSpend)})`;
    categorySelect.appendChild(option);
  });

  syncRiskInputToSelectedCategory();
}

function syncRiskInputToSelectedCategory() {
  const selectedItem = items.find(item => item.name === categorySelect.value);

  if (!selectedItem) {
    return;
  }

  riskInput.value = Number.isInteger(selectedItem.risk) ? selectedItem.risk : 3;
  updateSliderLabels();
}

function updateSelectedRisk() {
  const selectedItem = items.find(item => item.name === categorySelect.value);

  if (!selectedItem) {
    alert("Select a category first.");
    return;
  }

  selectedItem.risk = Number(riskInput.value);
  save();
  renderTable();
}

function removeItem(index) {
  items.splice(index, 1);
  save();
  populateCategoryRiskSelector();
  if (!items.length) {
    riskEntry.classList.add("hidden");
  }
  render();
}

function resetAll() {
  if (confirm("Clear all?")) {
    items = [];
    uploadedRawData = null;
    fileInput.value = "";
    mappingSection.classList.add("hidden");
    riskEntry.classList.add("hidden");
    save();
    render();
  }
}

function filterTable(text) {
  const rows = tableBody.querySelectorAll("tr");
  rows.forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(text.toLowerCase()) ? "" : "none";
  });
}

function exportCSV() {
  let csv = "Category,Suppliers,Annual Spend,Risk,Impact,Matrix Category\n";

  items.forEach(item => {
    const category = classifyItem(item);
    const suppliers = (item.suppliers || []).join("; ");
    csv += `"${item.name.replace(/"/g, '""')}","${suppliers.replace(/"/g, '""')}",${item.annualSpend || 0},${item.risk},${item.impact},${category}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = "kraljic_matrix.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportImage() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1100;
    canvas.height = 780;

    const ctx = canvas.getContext("2d");
    const matrixX = 190;
    const matrixY = 125;
    const matrixW = 760;
    const matrixH = 520;
    const pointPadding = 76;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#24292e";
    ctx.font = "700 34px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Kraljic Matrix", canvas.width / 2, 62);

    drawQuadrant(ctx, matrixX, matrixY, matrixW / 2, matrixH / 2, "#f0ec7e", "Bottleneck");
    drawQuadrant(ctx, matrixX + matrixW / 2, matrixY, matrixW / 2, matrixH / 2, "#ff9aa5", "Strategic");
    drawQuadrant(ctx, matrixX, matrixY + matrixH / 2, matrixW / 2, matrixH / 2, "#8fd3ff", "Non-Critical");
    drawQuadrant(ctx, matrixX + matrixW / 2, matrixY + matrixH / 2, matrixW / 2, matrixH / 2, "#9ee6a8", "Leverage");

    ctx.strokeStyle = "#2b3137";
    ctx.lineWidth = 3;
    ctx.strokeRect(matrixX, matrixY, matrixW, matrixH);

    ctx.fillStyle = "#2b3137";
    ctx.font = "700 20px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Profit Impact ->", matrixX + matrixW / 2, matrixY + matrixH + 45);

    ctx.save();
    ctx.translate(matrixX - 92, matrixY + matrixH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Supply Risk ->", 0, 0);
    ctx.restore();

    const coordinateCounts = {};

    items.forEach(item => {
      const category = classifyItem(item);
      const coordinateKey = `${item.impact}-${item.risk}`;
      const duplicateIndex = coordinateCounts[coordinateKey] || 0;
      coordinateCounts[coordinateKey] = duplicateIndex + 1;

      const offset = getPointOffset(duplicateIndex);
      const x = matrixX + pointPadding + ((item.impact - 1) / 4) * (matrixW - pointPadding * 2) + offset[0];
      const y = matrixY + matrixH - pointPadding - ((item.risk - 1) / 4) * (matrixH - pointPadding * 2) + offset[1];

      drawPoint(ctx, x, y, item, category);
    });

    ctx.fillStyle = "#2b3137";
    ctx.font = "700 18px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(summary.textContent, canvas.width / 2, matrixY + matrixH + 92);

    const a = document.createElement("a");
    a.download = "kraljic_matrix.png";
    a.href = canvas.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (error) {
    console.error("Unable to export image.", error);
    alert("Unable to export image. Please try again.");
  }
}

function drawQuadrant(ctx, x, y, width, height, color, label) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(36, 41, 46, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = "#24292e";
  ctx.font = "700 22px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + width / 2, y + height / 2);
  ctx.textBaseline = "alphabetic";
}

function drawPoint(ctx, x, y, item, category) {
  const width = 124;
  const height = 58;
  const radius = 8;

  ctx.fillStyle = getPointColor(category);
  drawRoundedRect(ctx, x - width / 2, y - height / 2, width, height, radius);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "700 12px Arial, sans-serif";
  ctx.fillText(truncateText(ctx, item.name, width - 16), x, y - 13);
  ctx.font = "11px Arial, sans-serif";
  ctx.fillText(`R: ${scaleLabels[item.risk]}`, x, y + 5);
  ctx.fillText(`I: ${scaleLabels[item.impact]}`, x, y + 21);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated}...`;
}

function createTableRow(item, index) {
  const tr = document.createElement("tr");

  const nameTd = document.createElement("td");
  nameTd.textContent = item.name;

  const suppliersTd = document.createElement("td");
  suppliersTd.textContent = item.suppliers && item.suppliers.length
    ? item.suppliers.join(", ")
    : "-";

  const spendTd = document.createElement("td");
  spendTd.textContent = formatCurrency(item.annualSpend);

  const riskTd = document.createElement("td");
  riskTd.textContent = Number.isInteger(item.risk) ? scaleLabels[item.risk] : "Not set";

  const impactTd = document.createElement("td");
  impactTd.textContent = `${scaleLabels[item.impact]} (${formatCurrency(item.annualSpend)})`;

  const deleteTd = document.createElement("td");
  const delBtn = document.createElement("button");
  delBtn.textContent = "X";
  delBtn.setAttribute("aria-label", `Delete ${item.name}`);
  delBtn.setAttribute("title", `Delete ${item.name}`);
  delBtn.addEventListener("click", () => removeItem(index));
  deleteTd.appendChild(delBtn);

  tr.appendChild(nameTd);
  tr.appendChild(suppliersTd);
  tr.appendChild(spendTd);
  tr.appendChild(riskTd);
  tr.appendChild(impactTd);
  tr.appendChild(deleteTd);

  return tr;
}

function render() {
  renderTable();
  renderMatrix();
}

function clearMatrix() {
  matrix.querySelectorAll(".point").forEach(p => p.remove());
  summary.textContent = "Set supply risk, then click Update Matrix.";
}

function renderTable() {
  tableBody.innerHTML = "";

  items.forEach((item, index) => {
    tableBody.appendChild(createTableRow(item, index));
  });
}

function renderMatrix() {
  matrix.querySelectorAll(".point").forEach(p => p.remove());

  const rect = matrix.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  const counts = {
    "non-critical": 0,
    "leverage": 0,
    "bottleneck": 0,
    "strategic": 0
  };
  const coordinateCounts = {};

  items
    .filter(item => Number.isInteger(item.risk))
    .forEach(item => {
    const category = classifyItem(item);
    if (!category) {
      return;
    }
    counts[category]++;

    const p = document.createElement("div");
    p.className = `point ${getPointClass(category)}`;

    const coordinateKey = `${item.impact}-${item.risk}`;
    const duplicateIndex = coordinateCounts[coordinateKey] || 0;
    coordinateCounts[coordinateKey] = duplicateIndex + 1;

    const offset = getPointOffset(duplicateIndex);
    const x = ((item.impact - 1) / 4) * (w - 120) + 60 + offset[0];
    const y = h - ((item.risk - 1) / 4) * (h - 120) - 60 + offset[1];

    p.style.left = x + "px";
    p.style.top = y + "px";

    p.innerHTML = `
      <strong>${escapeHtml(item.name)}</strong><br>
      R: ${scaleLabels[item.risk]}<br>
      I: ${scaleLabels[item.impact]}
    `;
    p.setAttribute("title", `${item.name}: ${scaleLabels[item.risk]} supply risk, ${scaleLabels[item.impact]} profit impact from ${formatCurrency(item.annualSpend)} annual spend`);
    p.setAttribute("aria-label", `${item.name}: ${scaleLabels[item.risk]} supply risk, ${scaleLabels[item.impact]} profit impact from annual spend`);

    matrix.appendChild(p);
  });

  summary.textContent =
    `Non-critical: ${counts["non-critical"]} | Leverage: ${counts["leverage"]} | Bottleneck: ${counts["bottleneck"]} | Strategic: ${counts["strategic"]}`;
}

function updateMatrix() {
  if (!items.length) {
    alert("Load or upload data first.");
    return;
  }

  const missingRiskItems = items.filter(item => !Number.isInteger(item.risk));

  if (missingRiskItems.length) {
    alert("Please set supply risk for each category first, then click Update Matrix.");
    return;
  }

  renderMatrix();
}

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});
dropZone.addEventListener("dragover", event => {
  event.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});
dropZone.addEventListener("drop", event => {
  event.preventDefault();
  dropZone.classList.remove("drag-over");
  handleFile(event.dataTransfer.files[0]);
});

fileInput.addEventListener("change", event => handleFile(event.target.files[0]));
sampleBtn.addEventListener("click", loadSampleData);
processBtn.addEventListener("click", aggregateMappedData);
categorySelect.addEventListener("change", syncRiskInputToSelectedCategory);
addBtn.addEventListener("click", updateSelectedRisk);
updateMatrixBtn.addEventListener("click", updateMatrix);
resetBtn.addEventListener("click", resetAll);
csvBtn.addEventListener("click", exportCSV);
imgBtn.addEventListener("click", exportImage);
searchInput.addEventListener("input", event => filterTable(event.target.value));

if (items.length) {
  populateCategoryRiskSelector();
  riskEntry.classList.remove("hidden");
}

render();
