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

// Storage Keys
const STORAGE_SERVER_IP = "hpc_desktop_server_ip";
const STORAGE_SERVER_PORT = "hpc_desktop_server_port";
const STORAGE_SERVER_SSL = "hpc_desktop_server_ssl";

// State
let currentServer: DiscoveredServer | null = null;
let isNavigating: boolean = false;

// DOM Elements
const networkBadgeEl = document.querySelector("#network-badge") as HTMLElement;
const networkStatusTextEl = document.querySelector("#network-status-text") as HTMLElement;
const latencyPillEl = document.querySelector("#latency-pill") as HTMLElement;
const progressSubtextEl = document.querySelector("#progress-subtext") as HTMLElement;
const offlineActionsEl = document.querySelector("#offline-actions") as HTMLElement;
const btnRescanEl = document.querySelector("#btn-rescan") as HTMLButtonElement;
const btnManualIpEl = document.querySelector("#btn-manual-ip") as HTMLButtonElement;
const btnManualIpAltEl = document.querySelector("#btn-manual-ip-alt") as HTMLButtonElement;

// Modal Elements
const modalSettingsEl = document.querySelector("#modal-settings") as HTMLElement;
const btnCloseModalEl = document.querySelector("#btn-close-modal") as HTMLButtonElement;
const inputServerIpEl = document.querySelector("#input-server-ip") as HTMLInputElement;
const inputServerPortEl = document.querySelector("#input-server-port") as HTMLInputElement;
const selectProtocolEl = document.querySelector("#select-protocol") as HTMLSelectElement;
const btnSaveManualIpEl = document.querySelector("#btn-save-manual-ip") as HTMLButtonElement;
const btnTestSweepEl = document.querySelector("#btn-test-sweep") as HTMLButtonElement;

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

// Discovered Server Handler -> Direct Webview Launch
function onServerFound(server: DiscoveredServer, latencyMs: number = 3) {
  if (isNavigating) return;

  currentServer = server;
  const protocol = server.ssl ? "https" : "http";
  const targetUrl = `${protocol}://${server.ip}:${server.port}/`;

  updateNetworkStatus("connected", `Connected to Clinic Server (${server.ip})`, latencyMs);
  progressSubtextEl.textContent = "Opening Clinic System...";
  offlineActionsEl.classList.add("hidden");

  // Save server config to cache
  localStorage.setItem(STORAGE_SERVER_IP, server.ip);
  localStorage.setItem(STORAGE_SERVER_PORT, String(server.port));
  localStorage.setItem(STORAGE_SERVER_SSL, String(server.ssl));

  // Silently sync Windows Root Store if server cert rotated
  if (server.ssl) {
    invoke("sync_root_ca_from_server", {
      caUrl: `${protocol}://${server.ip}:${server.port}/rootCA.crt`,
    }).catch((err) => {
      console.warn("Self-healing cert sync notice:", err);
    });
  }

  isNavigating = true;

  // Direct location replacement:
  // Replaces the splash screen in history so pressing back in the webview doesn't go back to the scanner.
  // Full browser capabilities (cookies, localStorage, session, redirections) are maintained natively.
  setTimeout(() => {
    window.location.replace(targetUrl);
  }, 200);
}

// Trigger Multi-Tier Auto-Discovery
async function scanForServer() {
  if (isNavigating) return;

  const cachedIp = localStorage.getItem(STORAGE_SERVER_IP) || undefined;

  updateNetworkStatus("searching", "Scanning Clinic Network...");
  progressSubtextEl.textContent = "Searching via UDP broadcast & local subnet sweep...";
  offlineActionsEl.classList.add("hidden");

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
    progressSubtextEl.textContent = "Could not find clinic server on the local network.";
    offlineActionsEl.classList.remove("hidden");
  }
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

  // Extract port if present (e.g. 192.168.x.x:3000)
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

// Settings Modal Handlers
function setupSettingsModal() {
  const openModal = () => {
    if (currentServer) {
      inputServerIpEl.value = currentServer.ip;
      inputServerPortEl.value = String(currentServer.port);
      selectProtocolEl.value = currentServer.ssl ? "https" : "http";
    } else {
      const cachedIp = localStorage.getItem(STORAGE_SERVER_IP) || "";
      inputServerIpEl.value = cachedIp;
    }
    modalSettingsEl.classList.remove("hidden");
  };

  btnManualIpEl?.addEventListener("click", openModal);
  btnManualIpAltEl?.addEventListener("click", openModal);

  btnCloseModalEl?.addEventListener("click", () => {
    modalSettingsEl.classList.add("hidden");
  });

  btnSaveManualIpEl?.addEventListener("click", async () => {
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

  btnTestSweepEl?.addEventListener("click", async () => {
    const rawIp = inputServerIpEl.value.trim() || "192.168.1.1";
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
      btnTestSweepEl.textContent = "🔍 Sweep Local Subnet";
      btnTestSweepEl.disabled = false;
    }
  });
}

// Main Setup
window.addEventListener("DOMContentLoaded", () => {
  setupSettingsModal();

  btnRescanEl?.addEventListener("click", scanForServer);

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
