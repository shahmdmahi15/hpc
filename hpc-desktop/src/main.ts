import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface DiscoveredServer {
  service?: string;
  ip: string;
  port: number;
  ssl: boolean;
  name: string;
}

interface DiscoveryProgress {
  tier: number;
  status: "searching" | "connected" | "offline";
  message: string;
  server?: DiscoveredServer;
}

// State
let currentServer: DiscoveredServer | null = null;
let selectedRole: string = "DOCTOR_CHAMBER";
let selectedRoute: string = "/doctor";
let countdownTimer: number | null = null;
let countdownRemaining: number = 3;

// Storage Keys
const STORAGE_SERVER_IP = "hpc_desktop_server_ip";
const STORAGE_SERVER_PORT = "hpc_desktop_server_port";
const STORAGE_SERVER_SSL = "hpc_desktop_server_ssl";
const STORAGE_STATION_ROLE = "hpc_desktop_station_role";
const STORAGE_STATION_ROUTE = "hpc_desktop_station_route";
const STORAGE_AUTO_LAUNCH = "hpc_desktop_auto_launch";
const STORAGE_DEVICE_ID = "hpc_desktop_device_id";

// DOM Elements
const networkBadgeEl = document.querySelector("#network-badge") as HTMLElement;
const networkStatusTextEl = document.querySelector("#network-status-text") as HTMLElement;
const latencyPillEl = document.querySelector("#latency-pill") as HTMLElement;
const serverNameEl = document.querySelector("#server-name") as HTMLElement;
const serverUrlEl = document.querySelector("#server-url") as HTMLElement;
const btnRescanEl = document.querySelector("#btn-rescan") as HTMLButtonElement;
const btnLaunchEl = document.querySelector("#btn-launch") as HTMLButtonElement;
const countdownContainerEl = document.querySelector("#countdown-container") as HTMLElement;
const countdownSecEl = document.querySelector("#countdown-sec") as HTMLElement;
const btnCancelCountdownEl = document.querySelector("#btn-cancel-countdown") as HTMLButtonElement;
const chkRememberStationEl = document.querySelector("#chk-remember-station") as HTMLInputElement;
const btnLoginPortalEl = document.querySelector("#btn-login-portal") as HTMLButtonElement | null;

// Modal Elements
const btnManualIpEl = document.querySelector("#btn-manual-ip") as HTMLButtonElement;
const modalSettingsEl = document.querySelector("#modal-settings") as HTMLElement;
const btnCloseModalEl = document.querySelector("#btn-close-modal") as HTMLButtonElement;
const inputServerIpEl = document.querySelector("#input-server-ip") as HTMLInputElement;
const inputServerPortEl = document.querySelector("#input-server-port") as HTMLInputElement;
const selectProtocolEl = document.querySelector("#select-protocol") as HTMLSelectElement;
const btnSaveManualIpEl = document.querySelector("#btn-save-manual-ip") as HTMLButtonElement;
const btnTestSweepEl = document.querySelector("#btn-test-sweep") as HTMLButtonElement;

// Helper: Get or create persistent device ID
function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(STORAGE_DEVICE_ID);
  if (!id) {
    id = "desk-" + Math.random().toString(36).substring(2, 9) + "-" + Date.now().toString(36);
    localStorage.setItem(STORAGE_DEVICE_ID, id);
  }
  return id;
}

// Update Network UI
function updateNetworkStatus(state: "searching" | "connected" | "offline", message: string, latencyMs?: number) {
  networkBadgeEl.className = `network-badge ${state}`;
  networkStatusTextEl.textContent = message;

  if (typeof latencyMs === "number" && latencyMs >= 0) {
    latencyPillEl.textContent = `${latencyMs}ms`;
    latencyPillEl.classList.remove("hidden");
  } else {
    latencyPillEl.classList.add("hidden");
  }
}

// Discovered Server handler
function onServerFound(server: DiscoveredServer, latencyMs: number = 3) {
  currentServer = server;
  const protocol = server.ssl ? "https" : "http";
  const fullUrl = `${protocol}://${server.ip}:${server.port}`;

  serverNameEl.textContent = server.name || "Health & Pain Care Center";
  serverUrlEl.textContent = `${fullUrl} (LAN)`;

  updateNetworkStatus("connected", `Connected to Clinic Server (${server.ip})`, latencyMs);
  btnLaunchEl.disabled = false;

  // Save server config to cache
  localStorage.setItem(STORAGE_SERVER_IP, server.ip);
  localStorage.setItem(STORAGE_SERVER_PORT, String(server.port));
  localStorage.setItem(STORAGE_SERVER_SSL, String(server.ssl));

  // Self-Healing Certificate Sync: Silently sync Windows Root Store if server cert rotated
  if (server.ssl) {
    invoke("sync_root_ca_from_server", {
      caUrl: `${fullUrl}/rootCA.crt`,
    }).catch((err) => {
      console.warn("Self-healing cert sync notice:", err);
    });
  }

  // Check if auto-launch is enabled
  const autoLaunch = localStorage.getItem(STORAGE_AUTO_LAUNCH) === "true";
  if (autoLaunch && !countdownTimer) {
    startAutoLaunchCountdown();
  }
}

// Trigger Multi-Tier Auto-Discovery
async function scanForServer() {
  cancelAutoLaunch();
  const cachedIp = localStorage.getItem(STORAGE_SERVER_IP) || undefined;

  updateNetworkStatus("searching", "Searching for clinic server via UDP broadcast...");
  serverNameEl.textContent = "Scanning...";
  serverUrlEl.textContent = "Scanning local clinic network...";
  btnLaunchEl.disabled = true;

  try {
    const start = performance.now();
    const server = await invoke<DiscoveredServer>("discover_server", { cachedIp });
    const ping = Math.round(performance.now() - start);
    onServerFound(server, Math.min(ping, 25));
  } catch (err) {
    console.warn("Auto-discovery exhausted:", err);

    // Try cached IP fallback if not already attempted
    const cachedIp = localStorage.getItem(STORAGE_SERVER_IP);
    if (cachedIp) {
      const cachedPort = parseInt(localStorage.getItem(STORAGE_SERVER_PORT) || "3000", 10);
      const cachedSsl = localStorage.getItem(STORAGE_SERVER_SSL) !== "false";
      onServerFound(
        {
          service: "hpc-clinic-server",
          ip: cachedIp,
          port: cachedPort,
          ssl: cachedSsl,
          name: "HPC Center (Cached)",
        },
        5
      );
      return;
    }

    updateNetworkStatus("offline", "Server Not Found on LAN");
    serverNameEl.textContent = "Offline / Waiting";
    serverUrlEl.textContent = "Click ⚙️ to enter manual IP";
  }
}

// Station Selection Logic
function setupStationSelection() {
  const cards = document.querySelectorAll(".station-card");

  // Restore saved station
  const savedRole = localStorage.getItem(STORAGE_STATION_ROLE);
  const savedRoute = localStorage.getItem(STORAGE_STATION_ROUTE);
  if (savedRole && savedRoute) {
    selectedRole = savedRole;
    selectedRoute = savedRoute;
  }

  cards.forEach((card) => {
    const role = card.getAttribute("data-role");
    const route = card.getAttribute("data-route");

    if (role === selectedRole) {
      card.classList.add("selected");
    }

    card.addEventListener("click", () => {
      cancelAutoLaunch();
      cards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      if (role && route) {
        selectedRole = role;
        selectedRoute = route;
      }
    });
  });
}

// Auto-Launch Countdown
function startAutoLaunchCountdown() {
  countdownRemaining = 3;
  countdownSecEl.textContent = String(countdownRemaining);
  countdownContainerEl.classList.remove("hidden");

  countdownTimer = window.setInterval(() => {
    countdownRemaining--;
    countdownSecEl.textContent = String(countdownRemaining);

    if (countdownRemaining <= 0) {
      cancelAutoLaunch();
      launchTerminal();
    }
  }, 1000);
}

function cancelAutoLaunch() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdownContainerEl.classList.add("hidden");
}

// Clean and parse user-entered IP, URL, or hostnames
function parseServerInput(rawInput: string, defaultPort = 3000, defaultSsl = true) {
  let cleaned = rawInput.trim();
  let ssl = defaultSsl;
  let port = defaultPort;

  if (cleaned.startsWith("https://")) {
    ssl = true;
    cleaned = cleaned.replace(/^https:\/\//i, "");
  } else if (cleaned.startsWith("http://")) {
    ssl = false;
    cleaned = cleaned.replace(/^http:\/\//i, "");
  }

  // Remove trailing slashes and paths
  cleaned = cleaned.split("/")[0];

  // Extract port if present (e.g. 192.168.2.10:3000)
  if (cleaned.includes(":")) {
    const parts = cleaned.split(":");
    cleaned = parts[0];
    const parsedPort = parseInt(parts[1], 10);
    if (!isNaN(parsedPort) && parsedPort > 0) {
      port = parsedPort;
    }
  }

  return { ip: cleaned, port, ssl };
}

// Launch Terminal
async function launchTerminal() {
  if (!currentServer) return;

  // Persist station choice
  if (chkRememberStationEl.checked) {
    localStorage.setItem(STORAGE_STATION_ROLE, selectedRole);
    localStorage.setItem(STORAGE_STATION_ROUTE, selectedRoute);
    localStorage.setItem(STORAGE_AUTO_LAUNCH, "true");
  } else {
    localStorage.removeItem(STORAGE_AUTO_LAUNCH);
  }

  const protocol = currentServer.ssl ? "https" : "http";
  const baseUrl = `${protocol}://${currentServer.ip}:${currentServer.port}`;
  const deviceId = getOrCreateDeviceId();

  btnLaunchEl.textContent = "Launching Terminal...";
  btnLaunchEl.disabled = true;

  try {
    // 1. Start background hardware telemetry heartbeat worker in Rust
    await invoke("start_telemetry", {
      baseUrl,
      deviceId,
      stationName: selectedRole,
      role: selectedRole,
      deviceName: "HPC-WORKSTATION",
    });

    // 2. Set wake lock for waiting room display
    if (selectedRole === "WAITING_ROOM") {
      try {
        await invoke("set_wake_lock", { enabled: true });
      } catch {}
    }

    // 3. Navigate native webview to the selected clinic dashboard route
    const cleanRoute = selectedRoute.startsWith("/") ? selectedRoute : `/${selectedRoute}`;
    const targetUrl = `${baseUrl.trim().replace(/\/+$/, "")}${cleanRoute}`;

    try {
      await invoke("connect_to_url", { targetUrl });
    } catch (rustErr) {
      console.warn("Rust connect_to_url notice:", rustErr);
    }

    // Direct location navigation ensures mobile/Android webview loads the URL reliably
    window.location.href = targetUrl;
  } catch (err) {
    console.error("Failed to launch station:", err);
    alert(`Could not launch station: ${err}`);
    btnLaunchEl.textContent = "Launch Terminal";
    btnLaunchEl.disabled = false;
  }
}

// Settings Modal Handlers
function setupSettingsModal() {
  btnManualIpEl.addEventListener("click", () => {
    cancelAutoLaunch();
    if (currentServer) {
      inputServerIpEl.value = currentServer.ip;
      inputServerPortEl.value = String(currentServer.port);
      selectProtocolEl.value = currentServer.ssl ? "https" : "http";
    }
    modalSettingsEl.classList.remove("hidden");
  });

  btnCloseModalEl.addEventListener("click", () => {
    modalSettingsEl.classList.add("hidden");
  });

  btnSaveManualIpEl.addEventListener("click", async () => {
    const raw = inputServerIpEl.value.trim();
    if (!raw) {
      alert("Please enter a valid IP address");
      return;
    }

    const { ip, port, ssl } = parseServerInput(
      raw,
      parseInt(inputServerPortEl.value || "3000", 10),
      selectProtocolEl.value === "https"
    );

    inputServerIpEl.value = ip;
    inputServerPortEl.value = String(port);
    selectProtocolEl.value = ssl ? "https" : "http";

    btnSaveManualIpEl.textContent = "Connecting...";
    btnSaveManualIpEl.disabled = true;

    try {
      const verified = await invoke<DiscoveredServer | null>("verify_ip", { ip, port });
      if (verified) {
        onServerFound(verified);
      } else {
        onServerFound({
          service: "hpc-clinic-server",
          ip,
          port,
          ssl,
          name: "HPC Center (Manual)",
        });
      }
      modalSettingsEl.classList.add("hidden");
    } catch {
      onServerFound({
        service: "hpc-clinic-server",
        ip,
        port,
        ssl,
        name: "HPC Center (Manual)",
      });
      modalSettingsEl.classList.add("hidden");
    } finally {
      btnSaveManualIpEl.textContent = "Save & Connect";
      btnSaveManualIpEl.disabled = false;
    }
  });

  btnTestSweepEl.addEventListener("click", async () => {
    const rawIp = inputServerIpEl.value.trim() || "192.168.2.1";
    const { ip: cleanIp, port } = parseServerInput(rawIp, parseInt(inputServerPortEl.value || "3000", 10));
    const subnet = cleanIp.split(".").slice(0, 3).join(".");
    btnTestSweepEl.textContent = `Scanning ${subnet}.1–254...`;
    btnTestSweepEl.disabled = true;

    try {
      const found = await invoke<DiscoveredServer | null>("sweep_subnet", {
        baseSubnet: subnet,
        port,
      });

      if (found) {
        onServerFound(found);
        modalSettingsEl.classList.add("hidden");
      } else {
        alert(`No server found on subnet ${subnet}.x`);
      }
    } catch (err) {
      alert(`Subnet sweep error: ${err}`);
    } finally {
      btnTestSweepEl.textContent = "🔍 Sweep Subnet";
      btnTestSweepEl.disabled = false;
    }
  });
}

// Main Setup
window.addEventListener("DOMContentLoaded", () => {
  setupStationSelection();
  setupSettingsModal();

  btnRescanEl.addEventListener("click", scanForServer);
  btnLaunchEl.addEventListener("click", launchTerminal);
  btnCancelCountdownEl.addEventListener("click", cancelAutoLaunch);

  btnLoginPortalEl?.addEventListener("click", async () => {
    cancelAutoLaunch();
    if (!currentServer) {
      alert("Please wait for server connection or click ⚙️ to configure clinic server IP.");
      return;
    }
    const protocol = currentServer.ssl ? "https" : "http";
    const baseUrl = `${protocol}://${currentServer.ip}:${currentServer.port}`;
    const targetUrl = `${baseUrl.trim().replace(/\/+$/, "")}/login`;
    try {
      await invoke("connect_to_url", { targetUrl });
    } catch (err) {
      console.warn("Rust connect_to_url notice:", err);
    }
    window.location.href = targetUrl;
  });

  // Listen for live multi-tier auto-discovery progress events
  try {
    listen<DiscoveryProgress>("discovery-progress", (event) => {
      const { status, message, server } = event.payload;
      updateNetworkStatus(status, message);
      if (server) {
        onServerFound(server);
      }
    });
  } catch (err) {
    console.warn("Failed to attach discovery-progress listener:", err);
  }

  // Initial Auto-Discovery
  scanForServer();
});
