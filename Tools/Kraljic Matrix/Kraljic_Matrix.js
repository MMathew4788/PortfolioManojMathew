const scaleLabels = {
  1: "Very Low",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "Very High"
};

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
        Number.isInteger(item.risk) &&
        Number.isInteger(item.impact) &&
        item.risk >= 1 &&
        item.risk <= 5 &&
        item.impact >= 1 &&
        item.impact <= 5
      ))
      .map(item => ({
        name: item.name.trim(),
        risk: item.risk,
        impact: item.impact
      }))
      .filter(item => item.name);
  } catch (error) {
    console.warn("Unable to load saved Kraljic Matrix data.", error);
    return [];
  }
}

let items = loadItems();

const nameInput = document.getElementById("name");
const riskInput = document.getElementById("risk");
const impactInput = document.getElementById("impact");
const riskVal = document.getElementById("riskVal");
const impactVal = document.getElementById("impactVal");
const addBtn = document.getElementById("addBtn");
const resetBtn = document.getElementById("resetBtn");
const csvBtn = document.getElementById("csvBtn");
const imgBtn = document.getElementById("imgBtn");
const tableBody = document.getElementById("table");
const matrix = document.getElementById("matrix");
const summary = document.getElementById("summary");
const searchInput = document.getElementById("searchInput");

function updateSliderLabels() {
  riskVal.textContent = scaleLabels[riskInput.value];
  impactVal.textContent = scaleLabels[impactInput.value];
}

riskInput.addEventListener("input", updateSliderLabels);
impactInput.addEventListener("input", updateSliderLabels);
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

function addItem() {
  const nameVal = nameInput.value.trim();
  const riskValNum = Number(riskInput.value);
  const impactValNum = Number(impactInput.value);

  if (!nameVal) {
    alert("Enter item name");
    return;
  }

  items.push({
    name: nameVal,
    risk: riskValNum,
    impact: impactValNum
  });

  nameInput.value = "";
  save();
  render();
}

function removeItem(index) {
  items.splice(index, 1);
  save();
  render();
}

function resetAll() {
  if (confirm("Clear all?")) {
    items = [];
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
  let csv = "Name,Risk,Impact,Category\n";

  items.forEach(item => {
    const category = classifyItem(item);
    csv += `"${item.name.replace(/"/g, '""')}",${item.risk},${item.impact},${category}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = "matrix.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportImage() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1100;
    canvas.height = 820;

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

    ctx.fillStyle = "#5b6470";
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText("Scale: 1 = Very Low, 5 = Very High", canvas.width / 2, matrixY + matrixH + 122);

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

  const riskTd = document.createElement("td");
  riskTd.textContent = scaleLabels[item.risk];

  const impactTd = document.createElement("td");
  impactTd.textContent = scaleLabels[item.impact];

  const deleteTd = document.createElement("td");
  const delBtn = document.createElement("button");
  delBtn.textContent = "X";
  delBtn.setAttribute("aria-label", `Delete ${item.name}`);
  delBtn.setAttribute("title", `Delete ${item.name}`);
  delBtn.addEventListener("click", () => removeItem(index));
  deleteTd.appendChild(delBtn);

  tr.appendChild(nameTd);
  tr.appendChild(riskTd);
  tr.appendChild(impactTd);
  tr.appendChild(deleteTd);

  return tr;
}

function render() {
  tableBody.innerHTML = "";

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

  items.forEach((item, index) => {
    tableBody.appendChild(createTableRow(item, index));

    const category = classifyItem(item);
    counts[category]++;

    const p = document.createElement("div");
    p.className = `point ${getPointClass(category)}`;

    // coordinate placement: x increases right, y increases upward
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
    p.setAttribute("title", `${item.name}: ${scaleLabels[item.risk]} supply risk, ${scaleLabels[item.impact]} profit impact`);
    p.setAttribute("aria-label", `${item.name}: ${scaleLabels[item.risk]} supply risk, ${scaleLabels[item.impact]} profit impact`);

    matrix.appendChild(p);
  });

  summary.textContent =
    `Non-critical: ${counts["non-critical"]} | Leverage: ${counts["leverage"]} | Bottleneck: ${counts["bottleneck"]} | Strategic: ${counts["strategic"]}`;
}

addBtn.addEventListener("click", addItem);
resetBtn.addEventListener("click", resetAll);
csvBtn.addEventListener("click", exportCSV);
imgBtn.addEventListener("click", exportImage);
searchInput.addEventListener("input", e => filterTable(e.target.value));

render();
