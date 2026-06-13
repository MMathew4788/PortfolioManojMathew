// Module level state variables
let uploadedRawData = null;
let finalAnalysisResults = [];
let paretoChartInstance = null;

// UI Element References
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const mappingSection = document.getElementById("mapping-section");
const calcMethodSelect = document.getElementById("calc-method");
const manualTbody = document.getElementById("manual-tbody");
const resultsDashboard = document.getElementById("output-dashboard");

// Initial setup hook
window.addEventListener("DOMContentLoaded", () => {
  initializeManualInputTable();
  setupDragAndDrop();
});

// Initialize Manual Input with empty template fields
function initializeManualInputTable() {
  manualTbody.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    addManualRow();
  }
}

function addManualRow(item = "", val1 = "", val2 = "") {
  const row = document.createElement("tr");
  row.className = "hover:bg-gray-50/50 transition-colors group";

  const isMultiply = calcMethodSelect.value === "multiply";

  row.innerHTML = `
        <td class="p-2"><input type="text" value="${item}" placeholder="e.g. SKU-${Math.floor(1000 + Math.random() * 9000)}" class="w-full border border-gray-200 rounded px-2 py-1 text-sm manual-item"></td>
        <td class="p-2"><input type="number" value="${val1}" min="0" step="any" placeholder="0.00" class="w-full border border-gray-200 rounded px-2 py-1 text-sm manual-val1"></td>
        <td class="p-2 ${isMultiply ? "" : "hidden"} manual-val2-cell"><input type="number" value="${val2}" min="0" step="any" placeholder="0.00" class="w-full border border-gray-200 rounded px-2 py-1 text-sm manual-val2"></td>
        <td class="p-2 text-center"><button onclick="this.closest('tr').remove()" class="text-gray-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">✕</button></td>
    `;
  manualTbody.appendChild(row);
}

document
  .getElementById("btn-add-row")
  .addEventListener("click", () => addManualRow());

// Respond to structural formulas changing
calcMethodSelect.addEventListener("change", (e) => {
  const isMultiply = e.target.value === "multiply";

  // Adjust Manual Input Column visibility headers
  document
    .getElementById("manual-th-val2")
    .classList.toggle("hidden", !isMultiply);
  document
    .querySelectorAll(".manual-val2-cell")
    .forEach((cell) => cell.classList.toggle("hidden", !isMultiply));
  document.getElementById("manual-th-val1").innerText = isMultiply
    ? "Quantity"
    : "Value";

  // Adjust Import Parser UI mappings
  document.getElementById("formula-label-1").innerText = isMultiply
    ? "Quantity Column"
    : "Value Column";
  document
    .getElementById("mapping-val2-container")
    .classList.toggle("hidden", !isMultiply);
});

// Drag & Drop event bindings
function setupDragAndDrop() {
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) =>
    handleFileSelection(e.target.files[0]),
  );

  ["dragenter", "dragover"].forEach((name) => {
    dropZone.addEventListener(
      name,
      (e) => {
        e.preventDefault();
        dropZone.classList.add("bg-indigo-100", "border-indigo-500");
      },
      false,
    );
  });
  ["dragleave", "drop"].forEach((name) => {
    dropZone.addEventListener(
      name,
      (e) => {
        e.preventDefault();
        dropZone.classList.remove("bg-indigo-100", "border-indigo-500");
      },
      false,
    );
  });
  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    if (dt.files.length) handleFileSelection(dt.files[0]);
  });
}

// File loading extraction using SheetJS
function handleFileSelection(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Parse matrix rows into structural JSON arrays
    uploadedRawData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    if (uploadedRawData.length === 0) {
      alert("File appears to be empty!");
      return;
    }

    populateColumnMappingSelectors(Object.keys(uploadedRawData[0]));
  };
  reader.readAsArrayBuffer(file);
}

// Expose dynamic dropdown settings options maps
function populateColumnMappingSelectors(headers) {
  const selectItem = document.getElementById("map-item");
  const selectVal1 = document.getElementById("map-val1");
  const selectVal2 = document.getElementById("map-val2");

  [selectItem, selectVal1, selectVal2].forEach((sel) => {
    sel.innerHTML = "";
    headers.forEach((h) => {
      const opt = document.createElement("option");
      opt.value = h;
      opt.innerText = h;
      sel.appendChild(opt);
    });
  });

  // Fuzzy logic heuristics to set default index targets natively
  selectItem.selectedIndex = Math.max(
    headers.findIndex((h) => /name|item|sku|id/i.test(h)),
    0,
  );
  selectVal1.selectedIndex = Math.max(
    headers.findIndex((h) => /val|qty|quantity/i.test(h)),
    0,
  );
  selectVal2.selectedIndex = Math.max(
    headers.findIndex((h) => /price|cost/i.test(h)),
    0,
  );

  mappingSection.classList.remove("hidden");
}

// Processing trigger for explicit raw spreadsheets conversion
document.getElementById("btn-process-file").addEventListener("click", () => {
  if (!uploadedRawData) return;

  const itemKey = document.getElementById("map-item").value;
  const val1Key = document.getElementById("map-val1").value;
  const val2Key = document.getElementById("map-val2").value;
  const isMultiply = calcMethodSelect.value === "multiply";

  manualTbody.innerHTML = ""; // Wipe manual array context fields

  uploadedRawData.forEach((row) => {
    if (row[itemKey] !== undefined) {
      addManualRow(
        row[itemKey],
        row[val1Key] || 0,
        isMultiply ? row[val2Key] || 0 : "",
      );
    }
  });

  alert(
    `Successfully integrated ${uploadedRawData.length} records! Review configs and hit 'Calculate ABC Analysis'.`,
  );
});

// Core Mathematical Processing Engine
document.getElementById("btn-calculate").addEventListener("click", () => {
  const dataToProcess = [];
  const isMultiply = calcMethodSelect.value === "multiply";

  const items = document.querySelectorAll(".manual-item");
  const val1s = document.querySelectorAll(".manual-val1");
  const val2s = document.querySelectorAll(".manual-val2");

  // 1. Gather raw context inputs
  items.forEach((elem, index) => {
    const name = elem.value.trim();
    const v1 = parseFloat(val1s[index].value) || 0;
    const v2 = isMultiply ? parseFloat(val2s[index].value) || 0 : 0;

    if (name !== "") {
      const finalCalculatedValue = isMultiply ? v1 * v2 : v1;
      dataToProcess.push({ name, calculatedValue: finalCalculatedValue });
    }
  });

  if (dataToProcess.length === 0) {
    alert(
      "Please add at least one item with valid dataset metadata measurements.",
    );
    return;
  }

  // 2. Sorting array sequence by individual items value weights (Descending structural sort)
  dataToProcess.sort((a, b) => b.calculatedValue - a.calculatedValue);

  // 3. Mathematical aggregation metrics computations
  const totalValue = dataToProcess.reduce(
    (sum, item) => sum + item.calculatedValue,
    0,
  );

  if (totalValue <= 0) {
    alert(
      "Total cumulative sum aggregate value must be strictly greater than 0 to calculate fractional values.",
    );
    return;
  }

  // 4. Threshold parsing configurations variables maps
  const thresholdA =
    parseFloat(document.getElementById("threshold-a").value) / 100;
  const thresholdB =
    parseFloat(document.getElementById("threshold-b").value) / 100;

  let runningSum = 0;
  finalAnalysisResults = dataToProcess.map((item, index) => {
    runningSum += item.calculatedValue;
    const individualPercent = item.calculatedValue / totalValue;
    const cumulativePercent = runningSum / totalValue;

    // ABC Conditional Assignment logic blocks
    let abcClass = "C";
    if (cumulativePercent <= thresholdA) {
      abcClass = "A";
    } else if (
      cumulativePercent <= thresholdB ||
      cumulativePercent - individualPercent < thresholdB
    ) {
      // Inclusion edge logic catches cutoff bounds efficiently
      abcClass = "B";
    }

    return {
      rank: index + 1,
      name: item.name,
      value: item.calculatedValue,
      percent: individualPercent,
      cumulative: cumulativePercent,
      class: abcClass,
    };
  });

  renderDashboardOutputs(totalValue, finalAnalysisResults);
});

// Presentation Layout Handler Engine Functions
function renderDashboardOutputs(totalSum, datasets) {
  resultsDashboard.classList.remove("hidden");

  // Compute structural widget summary sets
  const countA = datasets.filter((d) => d.class === "A").length;
  const countB = datasets.filter((d) => d.class === "B").length;
  const countC = datasets.filter((d) => d.class === "C").length;

  const sumValA = datasets
    .filter((d) => d.class === "A")
    .reduce((s, i) => s + i.value, 0);
  const sumValB = datasets
    .filter((d) => d.class === "B")
    .reduce((s, i) => s + i.value, 0);
  const sumValC = datasets
    .filter((d) => d.class === "C")
    .reduce((s, i) => s + i.value, 0);

  document.getElementById("stat-total-value").innerText =
    `$${totalSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("stat-class-a").innerText =
    `${countA} (${((sumValA / totalSum) * 100).toFixed(1)}%)`;
  document.getElementById("stat-class-b").innerText =
    `${countB} (${((sumValB / totalSum) * 100).toFixed(1)}%)`;
  document.getElementById("stat-class-c").innerText =
    `${countC} (${((sumValC / totalSum) * 100).toFixed(1)}%)`;

  // Display table compilation
  const tbody = document.getElementById("results-tbody");
  tbody.innerHTML = "";

  datasets.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-gray-50 transition-colors";

    let badgeStyle = "bg-rose-100 text-rose-800 font-bold";
    if (row.class === "A")
      badgeStyle = "bg-emerald-100 text-emerald-800 font-bold";
    if (row.class === "B") badgeStyle = "bg-amber-100 text-amber-800 font-bold";

    tr.innerHTML = `
            <td class="p-4 font-medium text-gray-500">${row.rank}</td>
            <td class="p-4 font-semibold text-gray-800">${row.name}</td>
            <td class="p-4 text-right font-mono">${row.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="p-4 text-right font-mono text-gray-600">${(row.percent * 100).toFixed(2)}%</td>
            <td class="p-4 text-right font-mono text-gray-600 font-medium">${(row.cumulative * 100).toFixed(2)}%</td>
            <td class="p-4 text-center"><span class="px-3 py-1 rounded text-xs tracking-wider uppercase ${badgeStyle}">${row.class}</span></td>
        `;
    tbody.appendChild(tr);
  });

  // Rebuild interactive Pareto Multi-Axis Canvas Charts
  buildParetoChart(datasets);

  // Auto scroll down directly into view smoothly
  resultsDashboard.scrollIntoView({ behavior: "smooth" });
}

function buildParetoChart(datasets) {
  const ctx = document.getElementById("paretoChart").getContext("2d");

  if (paretoChartInstance) {
    paretoChartInstance.destroy();
  }

  // Sub-sample rendering if records exceed visual viewport boundaries safely
  const maxChartBars = 30;
  const displayData = datasets.slice(0, maxChartBars);

  const labels = displayData.map((d) => d.name);
  const absoluteValues = displayData.map((d) => d.value);
  const cumulativePercentages = displayData.map((d) =>
    (d.cumulative * 100).toFixed(1),
  );

  // Dynamic color determination for the bars based on classification type map context
  const barColors = displayData.map((d) => {
    if (d.class === "A") return "rgba(16, 185, 129, 0.75)"; // Emerald
    if (d.class === "B") return "rgba(245, 158, 11, 0.75)"; // Amber
    return "rgba(239, 68, 68, 0.6)"; // Rose
  });

  paretoChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Absolute Dollar Value ($)",
          data: absoluteValues,
          backgroundColor: barColors,
          borderColor: barColors.map((c) =>
            c.replace("0.75", "1").replace("0.6", "1"),
          ),
          borderWidth: 1.5,
          yAxisID: "yAbsolute",
          order: 2,
        },
        {
          label: "Cumulative Percent (%)",
          data: cumulativePercentages,
          type: "line",
          borderColor: "#4f46e5", // Indigo Accent Line
          borderWidth: 3,
          pointBackgroundColor: "#4f46e5",
          pointHoverRadius: 6,
          fill: false,
          tension: 0.1,
          yAxisID: "yCumulative",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { font: { weight: "bold" }, color: "#E5E7EB" },
        },
        tooltip: {
          mode: "index",
          intersect: false,
          titleColor: "#E5E7EB",
          bodyColor: "#E5E7EB",
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#E5E7EB" },
          title: { color: "#E5E7EB" },
        },
        yAbsolute: {
          type: "linear",
          position: "left",
          title: {
            display: true,
            text: "Individual Value ($)",
            font: { weight: "bold" },
            color: "#E5E7EB",
          },
          ticks: { color: "#E5E7EB" },
          grid: { borderDash: [4, 4] },
        },
        yCumulative: {
          type: "linear",
          position: "right",
          min: 0,
          max: 100,
          title: {
            display: true,
            text: "Cumulative Percent (%)",
            font: { weight: "bold" },
            color: "#E5E7EB",
          },
          ticks: { color: "#E5E7EB" },
          grid: { display: false },
        },
      },
    },
  });
}

// Data Export Utility Modules
window.exportData = function (format) {
  if (finalAnalysisResults.length === 0) return;

  // Structure data cleanly mapping programmatic attributes into human-readable export maps
  const exportRows = finalAnalysisResults.map((r) => ({
    Rank: r.rank,
    "Item/SKU Code": r.name,
    "Total Value ($)": r.value,
    "Percentage Share (%)": +(r.percent * 100).toFixed(4),
    "Cumulative Percentage (%)": +(r.cumulative * 100).toFixed(4),
    "ABC Classification": r.class,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ABC Analysis Results");

  if (format === "xlsx") {
    XLSX.writeFile(
      workbook,
      `ABC_Analysis_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  } else {
    XLSX.writeFile(
      workbook,
      `ABC_Analysis_Report_${new Date().toISOString().slice(0, 10)}.csv`,
      { bookType: "csv" },
    );
  }
};
