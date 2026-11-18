
const API = "http://127.0.0.1:8000";
const $ = id => document.getElementById(id);

// ==========================================
// HELPERS
// ==========================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function toast(message) {
  const el = $("toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  setTimeout(() => el.classList.remove("show"), 2400);
}

async function getJSON(path) {
  const response = await fetch(`${API}${path}`);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return response.json();
}

// ==========================================
// SIDEBAR NAVIGATION
// ==========================================

const sectionIds = [
  "overview",
  "registerVehicle",
  "wallet",
  "scanner",
  "vehicles",
  "transactions"
];

function updateActiveNavigation(sectionId) {
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach(link => {
    const active = link.getAttribute("href") === `#${sectionId}`;

    link.classList.toggle("active", active);

    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const activeLink = document.querySelector(
    `.nav-link[href="#${sectionId}"]`
  );

  const breadcrumb = document.querySelector(".breadcrumb b");

  if (activeLink && breadcrumb) {
    breadcrumb.textContent = activeLink.textContent.trim();
  }
}

function initializeNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const brand = document.querySelector(".brand");

  function activateSection(link) {
    const sectionId = link.getAttribute("href")?.substring(1);

    if (!sectionIds.includes(sectionId)) return;

    updateActiveNavigation(sectionId);

    const target = $(sectionId);

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    if (window.innerWidth <= 800) {
      $("sidebar")?.classList.remove("open");
    }

    history.replaceState(null, "", `#${sectionId}`);
  }

  navLinks.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      activateSection(link);
    });
  });

  if (brand) {
    brand.style.cursor = "pointer";

    brand.addEventListener("click", event => {
      event.preventDefault();

      const overviewLink = [...navLinks].find(
        link => link.getAttribute("href") === "#overview"
      );

      if (overviewLink) activateSection(overviewLink);
    });
  }

  const currentHash = window.location.hash;

  if (currentHash) {
    const matchingLink = [...navLinks].find(
      link => link.getAttribute("href") === currentHash
    );

    if (matchingLink) {
      updateActiveNavigation(currentHash.substring(1));
    }
  } else {
    updateActiveNavigation("overview");
  }
}

// ==========================================
// AUTOMATIC SCROLL SPY
// ==========================================

function initializeScrollSpy() {
  let ticking = false;

  function detectCurrentSection() {
    const scrollPosition = window.scrollY + 160;
    let currentSection = sectionIds[0];

    sectionIds.forEach(id => {
      const section = $(id);

      if (!section) return;

      const sectionTop =
        section.getBoundingClientRect().top + window.scrollY;

      if (scrollPosition >= sectionTop) {
        currentSection = id;
      }
    });

    // Select the last section when the page reaches its bottom.
    if (
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 5
    ) {
      currentSection = sectionIds[sectionIds.length - 1];
    }

    updateActiveNavigation(currentSection);
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(detectCurrentSection);
      ticking = true;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  detectCurrentSection();
}

// ==========================================
// DASHBOARD
// ==========================================

async function loadDashboard() {
  const data = await getJSON("/api/dashboard");

  setText("totalVehicles", data.total_vehicles ?? 0);
  setText("activeVehicles", data.active_vehicles ?? 0);
  setText("totalTransactions", data.total_transactions ?? 0);
  setText("totalCollection", money(data.total_collection));
}

// ==========================================
// VEHICLES
// ==========================================

let allVehicles = [];

async function loadVehicles() {
  allVehicles = await getJSON("/api/vehicles");

  setText("vehicleCount", `${allVehicles.length} records`);

  renderVehicles();
  populateRechargeVehicles();
}

function renderVehicles() {
  const table = $("vehicleTable");
  if (!table) return;

  const query = $("vehicleSearch")?.value.trim().toLowerCase() || "";

  const filtered = allVehicles.filter(vehicle =>
    [
      vehicle.vehicle_id,
      vehicle.owner,
      vehicle.vehicle_number
    ].some(value =>
      String(value ?? "").toLowerCase().includes(query)
    )
  );

  table.innerHTML = filtered.length
    ? filtered.map(vehicle => `
      <tr>
        <td>
          <span class="vehicle-id">
            ${escapeHTML(vehicle.vehicle_id)}
          </span><br>
          <span class="plate">
            ${escapeHTML(vehicle.vehicle_number)}
          </span>
        </td>

        <td>${escapeHTML(vehicle.owner || "—")}</td>

        <td>
          <span class="money">
            ${money(vehicle.wallet_balance)}
          </span>
        </td>

        <td>
          <span class="status-badge ${
            String(vehicle.status).trim().toUpperCase() === "ACTIVE"
              ? ""
              : "inactive"
          }">
            ${escapeHTML(vehicle.status || "UNKNOWN")}
          </span>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" class="empty">No matching vehicles found.</td></tr>`;
}

// ==========================================
// WALLET RECHARGE
// ==========================================

function populateRechargeVehicles() {
  const select = $("rechargeVehicleId");
  if (!select) return;

  const previousValue = select.value;

  select.innerHTML = `
    <option value="">Select a registered vehicle</option>
    ${allVehicles.map(vehicle => `
      <option value="${escapeHTML(vehicle.vehicle_id)}">
        ${escapeHTML(vehicle.vehicle_id)} — ${escapeHTML(vehicle.vehicle_number)}
      </option>
    `).join("")}
  `;

  if (allVehicles.some(v => v.vehicle_id === previousValue)) {
    select.value = previousValue;
  }

  updateSelectedWalletBalance();
}

function updateSelectedWalletBalance() {
  const select = $("rechargeVehicleId");
  const balance = $("currentWalletBalance");

  if (!select || !balance) return;

  const vehicle = allVehicles.find(
    v => v.vehicle_id === select.value
  );

  balance.value = vehicle
    ? money(vehicle.wallet_balance)
    : "";
}

if ($("rechargeVehicleId")) {
  $("rechargeVehicleId").addEventListener(
    "change",
    updateSelectedWalletBalance
  );
}

if ($("rechargeForm")) {
  $("rechargeForm").addEventListener("submit", async event => {
    event.preventDefault();

    const vehicleId = $("rechargeVehicleId").value;
    const amount = Number($("rechargeAmount").value);
    const button = $("rechargeBtn");
    const result = $("rechargeResult");

    if (!vehicleId) {
      toast("Please select a vehicle.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast("Enter a valid recharge amount.");
      return;
    }

    button.disabled = true;
    button.textContent = "Processing recharge...";

    if (result) result.hidden = true;

    try {
      const response = await fetch(
        `${API}/api/vehicles/${encodeURIComponent(vehicleId)}/recharge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ amount })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Wallet recharge failed.");
      }

      const newBalance =
        data.wallet_balance ??
        data.new_balance ??
        data.balance;

      setText("rechargeResultTitle", "Wallet recharged successfully!");

      setText(
        "rechargeResultDetails",
        `${vehicleId} • Added ${money(amount)} • New balance: ${
          newBalance !== undefined ? money(newBalance) : "Updated"
        }`
      );

      if (result) result.hidden = false;

      $("rechargeAmount").value = "";

      await refreshAll();
      updateSelectedWalletBalance();

      toast("Wallet balance updated successfully!");

    } catch (error) {
      console.error("Recharge error:", error);
      toast(error.message || "Unable to recharge wallet.");
    } finally {
      button.disabled = false;
      button.textContent = "+ Add Balance";
    }
  });
}

// ==========================================
// TRANSACTIONS
// ==========================================

async function loadTransactions() {
  const data = await getJSON("/api/transactions?limit=50");

  setText("transactionCount", `${data.length} records`);

  const table = $("transactionTable");
  if (!table) return;

  table.innerHTML = data.length
    ? data.map(transaction => {
        const type = String(
          transaction.type || "TOLL"
        ).toUpperCase();

        const status = String(
          transaction.status || "UNKNOWN"
        ).toUpperCase();

        return `
          <tr>
            <td title="${escapeHTML(transaction.transaction_id)}">
              ${escapeHTML(
                String(transaction.transaction_id || "").slice(0, 15)
              )}…
            </td>

            <td>
              <span class="vehicle-id">
                ${escapeHTML(transaction.vehicle_id)}
              </span>
            </td>

            <td>
              <span class="transaction-type ${
                type === "RECHARGE" ? "recharge" : "toll"
              }">
                ${escapeHTML(type)}
              </span>
            </td>

            <td>
              <span class="money">
                ${money(transaction.amount)}
              </span>
            </td>

            <td>
              <span class="status-badge ${
                status === "SUCCESS" ? "" : "inactive"
              }">
                ${escapeHTML(status)}
              </span>
            </td>

            <td>
              ${escapeHTML(
                String(transaction.timestamp || "")
                  .replace("T", " ")
                  .slice(0, 19)
              )}
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="6" class="empty">No transactions recorded yet.</td></tr>`;
}

// ==========================================
// VEHICLE REGISTRATION
// ==========================================

if ($("registerVehicleForm")) {
  $("registerVehicleForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const button = $("registerVehicleBtn");
    const result = $("registrationResult");

    const vehicleData = {
      vehicle_id: $("regVehicleId").value.trim().toUpperCase(),
      owner: $("regOwner").value.trim(),
      vehicle_number: $("regPlate").value.trim().toUpperCase(),
      wallet_balance: Number($("regBalance").value)
    };

    if (
      !Number.isFinite(vehicleData.wallet_balance) ||
      vehicleData.wallet_balance < 0
    ) {
      toast("Please enter a valid wallet balance.");
      return;
    }

    button.disabled = true;
    button.textContent = "Registering vehicle...";

    if (result) result.hidden = true;

    try {
      const response = await fetch(`${API}/api/vehicles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(vehicleData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Vehicle registration failed.");
      }

      const qrURL = new URL(data.qr_download_url, API).href;

      $("registeredVehicleQR").src = qrURL;
      $("downloadVehicleQR").href = qrURL;
      $("downloadVehicleQR").download =
        `${vehicleData.vehicle_id}.png`;

      const openQR = $("openVehicleQR");
      if (openQR) openQR.href = qrURL;

      setText(
        "registrationDetails",
        `${vehicleData.vehicle_id} • ${vehicleData.vehicle_number} • ${money(vehicleData.wallet_balance)} initial balance`
      );

      if (result) result.hidden = false;

      this.reset();

      await refreshAll();

      toast("Vehicle registered and QR generated!");

      result?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

    } catch (error) {
      console.error("Registration error:", error);
      toast(error.message || "Registration failed. Check API connection.");
    } finally {
      button.disabled = false;
      button.textContent = "+ Register Vehicle";
    }
  });
}

// ==========================================
// CAMERA AND QR SCANNER
// ==========================================

let cameraStream = null;
let animationFrameId = null;
let isProcessingScan = false;
let qrLocked = false;
let qrAbsentSince = 0;
let scanResumeAt = 0;

const video = $("cameraPreview");
const canvas = $("qrCanvas");

const canvasContext = canvas
  ? canvas.getContext("2d", { willReadFrequently: true })
  : null;

// Control the green scanning frame directly.
// It is hidden whenever the camera is stopped.

function setCameraOverlay(active) {
  const overlay = document.querySelector(".scanner-overlay");

  if (overlay) {
    overlay.style.display = active ? "flex" : "none";
    overlay.setAttribute("aria-hidden", String(!active));
  }
}

function setCameraStatus(message, active = false) {
  const badge = $("cameraStatus");

  if (badge) {
    badge.textContent = message;
    badge.hidden = !active;
  }

  // This is the important green-frame fix.
  setCameraOverlay(active);

  setText("cameraScannerStatus", message);

  const monitor = $("scannerStatus");

  if (monitor) {
    monitor.textContent = active ? "RUNNING" : "STOPPED";
    monitor.className = active
      ? "status-badge"
      : "status-badge inactive";
  }
}

function showScanMessage(message, success = false) {
  const element = $("scanMessage");
  if (!element) return;

  element.textContent = message;
  element.className = success
    ? "scan-message success"
    : "scan-message";
}

async function startCamera() {
  if (!video || !canvas || !canvasContext) {
    toast("Camera elements are missing.");
    return;
  }

  if (!window.jsQR) {
    toast("QR scanner library could not load. Check your internet.");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Camera access requires localhost or HTTPS.");
    return;
  }

  if (cameraStream) return;

  const startButton = $("startCameraBtn");
  const stopButton = $("stopCameraBtn");

  if (startButton) startButton.disabled = true;

  try {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }
        },
        audio: false
      });
    } catch {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    }

    video.srcObject = cameraStream;
    await video.play();

    if ($("cameraPlaceholder")) {
      $("cameraPlaceholder").hidden = true;
    }

    if (startButton) startButton.disabled = true;
    if (stopButton) stopButton.disabled = false;

    qrLocked = false;
    qrAbsentSince = 0;
    scanResumeAt = 0;

    setCameraStatus("CAMERA ACTIVE", true);

    showScanMessage(
      "Camera is ready. Show a vehicle QR code."
    );

    toast("Camera started successfully!");

    scanCameraFrame();

  } catch (error) {
    console.error("Camera error:", error);

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }

    if (video) video.srcObject = null;

    if (startButton) startButton.disabled = false;
    if (stopButton) stopButton.disabled = true;

    if ($("cameraPlaceholder")) {
      $("cameraPlaceholder").hidden = false;
    }

    setCameraStatus("CAMERA STOPPED", false);

    showScanMessage(
      error.name === "NotAllowedError"
        ? "Camera permission denied. Allow camera access in your browser."
        : "Unable to access camera. Check the connection and permissions."
    );

    toast("Could not start camera.");
  }
}

// ==========================================
// QR FRAME DETECTION
// ==========================================

function scanCameraFrame() {
  if (!cameraStream || !video || !canvas || !canvasContext) {
    return;
  }

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width && height) {
      canvas.width = width;
      canvas.height = height;

      canvasContext.drawImage(video, 0, 0, width, height);

      const imageData = canvasContext.getImageData(
        0, 0, width, height
      );

      const code = window.jsQR(
        imageData.data,
        width,
        height,
        { inversionAttempts: "dontInvert" }
      );

      if (code && code.data) {
        qrAbsentSince = 0;

        if (
          !qrLocked &&
          !isProcessingScan &&
          Date.now() >= scanResumeAt
        ) {
          qrLocked = true;
          handleVehicleScan(code.data.trim());
        }

      } else {
        if (!qrAbsentSince) {
          qrAbsentSince = Date.now();
        }

        if (
          qrLocked &&
          Date.now() >= scanResumeAt &&
          Date.now() - qrAbsentSince >= 1200 &&
          !isProcessingScan
        ) {
          qrLocked = false;

          showScanMessage(
            "Ready for the next vehicle QR code."
          );
        }
      }
    }
  }

  animationFrameId = requestAnimationFrame(scanCameraFrame);
}

// ==========================================
// PROCESS VEHICLE QR
// ==========================================

async function handleVehicleScan(vehicleId) {
  if (!vehicleId) {
    showScanMessage("Invalid QR code.");
    return;
  }

  isProcessingScan = true;

  setText("scanVehicleId", vehicleId);
  setText("scanPaymentStatus", "PROCESSING");
  setText("scanTollAmount", money(50));
  setText("scanRemainingBalance", "—");
  setText("scanTransactionId", "Processing...");

  showScanMessage(
    `QR detected: ${vehicleId}. Checking vehicle and wallet...`
  );

  try {
    const response = await fetch(`${API}/api/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        vehicle_id: vehicleId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Vehicle scan failed.");
    }

    const success = data.success === true;

    setText(
      "scanPaymentStatus",
      success ? "SUCCESS" : "FAILED"
    );

    setText(
      "scanTollAmount",
      money(data.toll_amount ?? data.amount ?? 50)
    );

    setText(
      "scanRemainingBalance",
      data.remaining_balance !== undefined
        ? money(data.remaining_balance)
        : "—"
    );

    setText(
      "scanTransactionId",
      data.transaction_id || "Not generated"
    );

    if (success) {
      showScanMessage(
        `Payment successful! ${money(data.toll_amount ?? 50)} deducted from ${vehicleId}.`,
        true
      );

      toast("Toll payment successful!");
    } else {
      showScanMessage(
        data.message ||
        data.detail ||
        "Payment failed. Check vehicle status and wallet balance."
      );

      toast("Toll payment unsuccessful.");
    }

    await refreshAll();

  } catch (error) {
    console.error("QR scan error:", error);

    setText("scanPaymentStatus", "ERROR");
    setText("scanTransactionId", "—");

    showScanMessage(
      error.message || "Unable to process QR scan."
    );

    toast("QR scan could not be processed.");

  } finally {
    isProcessingScan = false;
    scanResumeAt = Date.now() + 2000;
  }
}

// ==========================================
// STOP CAMERA
// ==========================================

function stopCamera() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  if ($("cameraPlaceholder")) {
    $("cameraPlaceholder").hidden = false;
  }

  if ($("startCameraBtn")) {
    $("startCameraBtn").disabled = false;
  }

  if ($("stopCameraBtn")) {
    $("stopCameraBtn").disabled = true;
  }

  qrLocked = false;
  qrAbsentSince = 0;
  scanResumeAt = 0;

  // Always hide the green scanning frame when camera stops.
  setCameraStatus("CAMERA STOPPED", false);

  showScanMessage(
    "Camera stopped. Click Start Camera to begin."
  );
}

if ($("startCameraBtn")) {
  $("startCameraBtn").addEventListener("click", startCamera);
}

if ($("stopCameraBtn")) {
  $("stopCameraBtn").addEventListener("click", stopCamera);
}

window.addEventListener("beforeunload", stopCamera);

// ==========================================
// SYSTEM MONITOR
// ==========================================

function setMonitorValue(id, value) {
  setText(id, value);
}

function setMonitorBadge(id, text, colorClass) {
  const element = $(id);
  if (!element) return;

  element.textContent = text;
  element.className = `status-badge ${colorClass}`;
}

async function loadSystemStatus() {
  try {
    const data = await getJSON("/api/system/status");

    const payment = String(
      data.last_payment_status || "WAITING"
    ).toUpperCase();

    const gate = String(
      data.gate_status || "UNKNOWN"
    ).toUpperCase();

    setCameraStatus(
      cameraStream ? "CAMERA ACTIVE" : "CAMERA STOPPED",
      Boolean(cameraStream)
    );

    setMonitorValue(
      "lastVehicle",
      data.last_vehicle || "None"
    );

    let paymentColor = "inactive";

    if (payment === "SUCCESS") paymentColor = "";
    if (payment === "PROCESSING") paymentColor = "pending";

    setMonitorBadge(
      "paymentStatus",
      payment,
      paymentColor
    );

    setMonitorValue(
      "lastTransaction",
      data.last_transaction_id || "None"
    );

    // Keep the gate caption's original styling.
    setMonitorValue(
      "gateStatus",
      gate.replaceAll("_", " ")
    );

    // Also update the separate gate status field, if present.
    setMonitorValue(
      "gateStatusText",
      gate.replaceAll("_", " ")
    );

    setMonitorValue(
      "lastUpdated",
      data.last_updated
        ? new Date(data.last_updated).toLocaleString("en-IN")
        : "Not updated yet"
    );

  } catch (error) {
    console.error("System monitor error:", error);

    setCameraStatus(
      cameraStream ? "CAMERA ACTIVE" : "CAMERA STOPPED",
      Boolean(cameraStream)
    );
  }
}

// ==========================================
// REFRESH
// ==========================================

async function refreshAll(showMessage = false) {
  try {
    await Promise.all([
      loadDashboard(),
      loadVehicles(),
      loadTransactions(),
      loadSystemStatus()
    ]);

    const status = $("systemStatus");

    if (status) {
      status.textContent = "Firebase API connected";
      status.style.color = "";
    }

    if (showMessage) toast("Dashboard refreshed");

  } catch (error) {
    console.error("Dashboard refresh error:", error);

    const status = $("systemStatus");

    if (status) {
      status.textContent = "API connection unavailable";
      status.style.color = "#f2a65a";
    }

    if (showMessage) {
      toast("Could not refresh. Check FastAPI.");
    }
  }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

if ($("vehicleSearch")) {
  $("vehicleSearch").addEventListener("input", renderVehicles);
}

if ($("refreshBtn")) {
  $("refreshBtn").addEventListener("click", () => refreshAll(true));
}

if ($("vehicleRefresh")) {
  $("vehicleRefresh").addEventListener("click", () =>
    loadVehicles()
      .then(() => toast("Vehicle list refreshed"))
      .catch(() => toast("Unable to load vehicles"))
  );
}

if ($("menuToggle")) {
  $("menuToggle").addEventListener("click", () => {
    $("sidebar")?.classList.toggle("open");
  });
}

if ($("today")) {
  $("today").textContent = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date());
}

// ==========================================
// INITIALIZE
// ==========================================

initializeNavigation();
initializeScrollSpy();

// Make sure the green scanner frame is hidden on page load.
setCameraStatus("CAMERA STOPPED", false);

if ($("stopCameraBtn")) {
  $("stopCameraBtn").disabled = true;
}

if ($("cameraPlaceholder")) {
  $("cameraPlaceholder").hidden = false;
}

refreshAll();

setInterval(refreshAll, 10000);
setInterval(loadSystemStatus, 2000);
