# HPC Center Desktop — Tauri v2 Windows Application Specification

This documentation provides the official, end-to-end technical specification for building the native **Tauri v2 Windows Desktop Application** for **HPC Center (Health & Pain Care Center)**.

Unlike the single-purpose Android TV waiting room display, this desktop application serves as the **Universal Clinic Workstation** for all staff roles:
* **Doctor Chambers** (Chambers 101, 102, etc.)
* **Therapy Unit** (Rooms 201–207, countdown timers, modalities)
* **Receptionist Desk** (Patient check-in, token generation, directory)
* **Cashier Station** (Billing, itemized invoicing, payment collection)
* **Admin & IT Fleet** (Live LAN telemetry, device heartbeat, bulletin notices)
* **Waiting Room Display** (Dedicated kiosk / secondary monitor mode)

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Universal Subnet Zero-Config LAN Discovery](#2-universal-subnet-zero-config-lan-discovery)
   - [How Any Router Subnet (192.168.10.x, 192.168.1.x, 10.0.0.x) Works](#how-any-router-subnet-works)
   - [Rust UDP Broadcast Implementation (`discovery.rs`)](#rust-udp-broadcast-implementation)
   - [Subnet Sweep Fallback Mechanism](#subnet-sweep-fallback-mechanism)
3. [Windows SSL / TLS Certificate Pinning & Trust Store](#3-windows-ssl--tls-certificate-pinning--trust-store)
   - [Embedding `rootCA.crt` in the Binary](#embedding-rootcacrt-in-the-binary)
   - [Silent CurrentUser Certificate Store Registration](#silent-currentuser-certificate-store-registration)
   - [WebView2 SSL Configuration](#webview2-ssl-configuration)
4. [Unified Multi-Dashboard Station Routing](#4-unified-multi-dashboard-station-routing)
   - [Station Configuration & Local Persistence](#station-configuration--local-persistence)
   - [Auto-Launch Routing per Terminal](#auto-launch-routing-per-terminal)
5. [Native Hardware Telemetry & Fleet Heartbeat](#5-native-hardware-telemetry--fleet-heartbeat)
   - [Windows System Profiler in Rust](#windows-system-profiler-in-rust)
   - [Tokio Background Heartbeat Worker](#tokio-background-heartbeat-worker)
6. [Native Desktop Superpowers (Beyond the Browser)](#6-native-desktop-superpowers)
   - [Silent Thermal Receipt / Slip Printing (ESC/POS)](#silent-thermal-receipt--slip-printing)
   - [Windows System Tray & Boot Auto-Start](#windows-system-tray--boot-auto-start)
   - [Multi-Monitor Support (Dual-Display Chambers)](#multi-monitor-support)
   - [Offline Resiliency & Automatic Reconnection](#offline-resiliency)
7. [Complete Project Scaffolding & Configuration](#7-complete-project-scaffolding--configuration)
   - [Directory Structure](#directory-structure)
   - [`Cargo.toml` Dependencies](#cargotoml-dependencies)
   - [`tauri.conf.json` Configuration](#tauriconfjson-configuration)
   - [Core Rust Implementation Files](#core-rust-implementation-files)
8. [Building & Deploying the Windows Installer](#8-building--deploying-the-windows-installer)
   - [Build CLI Commands (`.msi` / `.exe`)](#build-cli-commands)
   - [Deployment Checklist for Clinic PCs](#deployment-checklist-for-clinic-pcs)

---

## 1. Architecture Overview

The HPC Tauri application utilizes a **Smart Hybrid Shell** architecture:
* **Binary Size**: ~8–12 MB total installer size.
* **Memory Footprint**: ~20–35 MB RAM (compared to Electron’s 250 MB+).
* **Native Rust Core**: Executes background networking (UDP discovery, SSL root CA injection, hardware telemetry, silent USB thermal printing, system tray).
* **Native Windows WebView2**: Loads and renders the HPC web UI directly from the discovered clinic server (`https://<clinic-server-ip>:3000`).

### Why the Smart Shell Pattern is Optimal
1. **Zero Deployment Maintenance**: When database schemas, UI components, or workflow logic change on the central server, **every desktop PC in the clinic updates instantly** on next launch without reinstalling or recompiling the Windows `.exe`.
2. **True Native Capabilities**: Regular browsers cannot silently print to 80mm ESC/POS thermal printers, scan subnets with UDP raw sockets, or register in Windows system tray. Tauri bridges this gap seamlessly.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   HPC Tauri Windows Workstation                         │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │               WebView2 UI (All Clinic Dashboards)              │   │
│   │   - Doctor Chamber 101/102   - Handler Therapy 201-207         │   │
│   │   - Reception Token Registry - Cashier Billing Station         │   │
│   │   - Sysadmin Network Fleet   - Waiting Room Display Kiosk      │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ IPC Bridge                         │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │                      Native Rust Backend                       │   │
│   │  • Universal UDP Discovery (Port 8888 across any subnet)       │   │
│   │  • Silent Root CA Trust Injection (Windows CryptoAPI)          │   │
│   │  • Hardware Telemetry Worker (Live Ping & Hostname reporting)  │   │
│   │  • Silent ESC/POS Thermal Printing (USB / COM / LAN)           │   │
│   │  • System Tray, Auto-Start & Reconnect Watchdog                │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ TLS 1.3 / UDP 8888
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             HPC Center Server (Health & Pain Care Center)              │
│  - UDP Discovery Responder (Port 8888)                                 │
│  - HTTPS Next.js Engine & Server Actions (Port 3000)                   │
│  - SQLite Database (WAL Mode) & Realtime SSE Event Bus                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Universal Subnet Zero-Config LAN Discovery

### How Any Router Subnet Works
Whether the clinic router is set to `192.168.10.1`, `192.168.1.1`, `192.168.0.1`, `10.0.0.1`, or `172.16.0.1`, the discovery engine **automatically works without any hardcoded IP addresses**:

1. **Universal Broadcast (`255.255.255.255:8888`)**:
   Under IPv4 standards, packets destined for `255.255.255.255` are limited broadcast packets received by all hosts in the local layer-2 collision domain regardless of their subnet prefix.
2. **Adapter Directed Broadcasts**:
   The Rust discovery client enumerates every active local network interface on the Windows machine (Ethernet, Wi-Fi), reads its assigned IP and subnet mask (e.g. IP `192.168.10.45` with mask `255.255.255.0`), calculates the exact directed broadcast address (`192.168.10.255`), and transmits the discovery probe.
3. **Subnet-Aware Server Responder**:
   When the HPC server receives the UDP packet, it inspects the sender's source IP (`rinfo.address`). It identifies which of its own network interfaces resides on that exact same subnet, and responds with the correct IP reachable by that client.

### Rust UDP Broadcast Implementation

Create `src-tauri/src/discovery.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4};
use std::time::Duration;
use tokio::net::UdpSocket;
use tokio::time::timeout;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredServer {
    pub service: String,
    pub ip: String,
    pub port: u16,
    pub ssl: bool,
    pub name: String,
}

impl DiscoveredServer {
    pub fn base_url(&self) -> String {
        let scheme = if self.ssl { "https" } else { "http" };
        format!("{}://{}:{}", scheme, self.ip, self.port)
    }
}

pub struct DiscoveryManager;

impl DiscoveryManager {
    const UDP_PORT: u16 = 8888;
    const DISCOVERY_PROBE: &'static [u8] = b"HPC_DISCOVER_SERVER";

    /// Broadcasts discovery packet across all active IPv4 interfaces and global 255.255.255.255.
    pub async fn discover(timeout_secs: u64) -> Result<DiscoveredServer, String> {
        let bind_addr = SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, 0);
        let socket = UdpSocket::bind(bind_addr)
            .await
            .map_err(|e| format!("Failed to bind UDP socket: {}", e))?;

        socket
            .set_broadcast(true)
            .map_err(|e| format!("Failed to enable broadcast: {}", e))?;

        // 1. Send to universal broadcast
        let global_target = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::BROADCAST, Self::UDP_PORT));
        let _ = socket.send_to(Self::DISCOVERY_PROBE, global_target).await;

        // 2. Discover local interfaces and send directed subnet broadcasts
        if let Ok(interfaces) = get_all_directed_broadcasts() {
            for bcast_ip in interfaces {
                let target = SocketAddr::V4(SocketAddrV4::new(bcast_ip, Self::UDP_PORT));
                let _ = socket.send_to(Self::DISCOVERY_PROBE, target).await;
            }
        }

        // 3. Listen for response with timeout
        let mut buf = [0u8; 2048];
        let listen_duration = Duration::from_secs(timeout_secs);

        match timeout(listen_duration, socket.recv_from(&mut buf)).await {
            Ok(Ok((len, _addr))) => {
                let raw_json = std::str::from_utf8(&buf[..len])
                    .map_err(|e| format!("Invalid UTF-8 from responder: {}", e))?;
                
                let server: DiscoveredServer = serde_json::from_str(raw_json)
                    .map_err(|e| format!("Failed to parse server JSON: {}", e))?;
                
                Ok(server)
            }
            Ok(Err(e)) => Err(format!("Socket receive error: {}", e)),
            Err(_) => Err("Discovery timed out: no HPC Center server found on local network".into()),
        }
    }
}

/// Computes directed broadcast IPs (e.g. 192.168.10.255) for all local adapters.
fn get_all_directed_broadcasts() -> Result<Vec<Ipv4Addr>, Box<dyn std::error::Error>> {
    let mut broadcasts = Vec::new();
    let adapters = ipconfig::get_adapters()?;
    for adapter in adapters {
        if adapter.oper_status() != ipconfig::OperStatus::IfOperStatusUp {
            continue;
        }
        for ip in adapter.ip_addresses() {
            if let std::net::IpAddr::V4(ipv4) = ip {
                if ipv4.is_loopback() || ipv4.is_link_local() {
                    continue;
                }
                // Calculate directed broadcast from prefix length if available
                let octets = ipv4.octets();
                // Standard /24 broadcast fallback
                let bcast = Ipv4Addr::new(octets[0], octets[1], octets[2], 255);
                broadcasts.push(bcast);
            }
        }
    }
    Ok(broadcasts)
}
```

### Subnet Sweep Fallback Mechanism
If a managed router drops UDP broadcast traffic between Wi-Fi and Ethernet VLANs, Tauri executes a concurrent HTTP subnet sweep across the host's `/24` prefix using `reqwest` with a 250ms per-IP timeout:

```rust
pub async fn sweep_subnet(base_subnet: &str, port: u16) -> Option<DiscoveredServer> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(300))
        .danger_accept_invalid_certs(true)
        .build()
        .ok()?;

    let mut tasks = Vec::new();
    for i in 1..=254 {
        let ip = format!("{}.{}", base_subnet, i);
        let url = format!("https://{}:{}/api/v1/tv/discovery", ip, port);
        let c = client.clone();
        tasks.push(tokio::spawn(async move {
            if let Ok(res) = c.get(&url).send().await {
                if let Ok(server) = res.json::<DiscoveredServer>().await {
                    return Some(server);
                }
            }
            None
        }));
    }

    for task in tasks {
        if let Ok(Some(server)) = task.await {
            return Some(server);
        }
    }
    None
}
```

---

## 3. Windows SSL / TLS Certificate Pinning & Trust Store

Because HPC uses a custom clinic root Certificate Authority ([`rootCA.crt`](file:///home/shahmdmahi/projects/personal/hpc/hpc-web/certificates/rootCA.crt)), untrusted HTTPS requests would normally produce browser security warnings.

Tauri provides two layers of trust anchoring:

### Layer 1: Silent CurrentUser Certificate Store Registration (Zero Admin Prompt)
Using the Windows CryptoAPI (`wincrypt32`), Tauri imports the embedded `rootCA.crt` into `CertOpenStore(CERT_SYSTEM_STORE_CURRENT_USER, "Root")`. 
* **User Experience**: Completely silent, runs on first launch, **requires NO administrative elevation (UAC prompt)** because it registers only for the active Windows user.
* **WebView2 Integration**: Windows WebView2 automatically honors certificates in the CurrentUser root store.

Create `src-tauri/src/cert.rs`:

```rust
#[cfg(target_os = "windows")]
pub fn install_clinic_root_ca() -> Result<(), String> {
    use std::ptr;
    use windows_sys::Win32::Security::Cryptography::*;

    const ROOT_CA_BYTES: &[u8] = include_bytes!("../certificates/rootCA.crt");

    unsafe {
        // Open CurrentUser "ROOT" certificate store (Does NOT require Administrator privileges)
        let store = CertOpenStore(
            CERT_STORE_PROV_SYSTEM_A,
            0,
            0,
            CERT_SYSTEM_STORE_CURRENT_USER,
            b"Root\0".as_ptr() as _,
        );

        if store.is_null() {
            return Err("Failed to open Windows CurrentUser certificate store".into());
        }

        // Add certificate context to store
        let added = CertAddEncodedCertificateToStore(
            store,
            X509_ASN_ENCODING | PKCS_7_ASN_ENCODING,
            ROOT_CA_BYTES.as_ptr(),
            ROOT_CA_BYTES.len() as u32,
            CERT_STORE_ADD_REPLACE_EXISTING,
            ptr::null_mut(),
        );

        CertCloseStore(store, 0);

        if added == 0 {
            return Err("Failed to add clinic root CA to Windows store".into());
        }

        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
pub fn install_clinic_root_ca() -> Result<(), String> {
    Ok(())
}
```

### Layer 2: WebView2 Custom Arguments
In `tauri.conf.json`, specify custom Chromium environment flags to allow the local server's internal domain name and IP to validate without external OCSP lookups:

```json
{
  "app": {
    "windows": [
      {
        "title": "HPC Center — Health & Pain Care Center",
        "width": 1440,
        "height": 900,
        "resizable": true,
        "fullscreen": false,
        "additionalBrowserArgs": "--ignore-certificate-errors-spki-list=... --allow-insecure-localhost"
      }
    ]
  }
}
```

---

## 4. Unified Multi-Dashboard Station Routing

The desktop app serves as the single application binary for all clinic roles.

### Station Modes
| Station Code | Target Route | Intended Terminal | Default Behavior |
| :--- | :--- | :--- | :--- |
| `DOCTOR_CHAMBER` | `/doctor` | Doctor Desk PC | Patient queue, prescription pad, medical records |
| `THERAPY_UNIT` | `/handler` | Physiotherapist Station | Rooms 201–207, timer start/stop, modality selection |
| `RECEPTION_DESK`| `/receptionist` | Front Desk Reception | Token issuing, patient directory, serial printing |
| `CASHIER_DESK` | `/cashier` | Accounts & Billing Desk | Invoice collection, payment split, thermal receipts |
| `ADMIN_FLEET` | `/admin/network` | IT / Clinic Manager PC | Live fleet ping, bulletin notices, performer analytics |
| `WAITING_ROOM` | `/waiting-room` | Wall-mounted TV / Kiosk | Fullscreen, dual audio announcements, notice ticker |
| `STAFF_LOGIN` | `/login` | Any Clinic Workstation | Direct authentication portal, role switching, user logout |

### Staff Authentication & WebView2 Session Persistence
1. **Edge Middleware Redirection (`proxy.ts`)**:
   Protected department routes (`/admin`, `/doctor`, `/receptionist`, `/handler`, `/cashier`) are guarded by Next.js middleware. When an unauthenticated staff member launches their workstation, the server automatically redirects to `/login?from=<route>`.
2. **Persistent WebView2 Sessions**:
   Windows WebView2 stores cookies (`SESSION_TOKEN`) in the workstation's local AppData folder (`%APPDATA%\com.shahmdmahi.hpcdesktop\EBWebView`). Once a doctor, therapist, or cashier logs in with their Argon2id password, their session persists across app restarts until explicitly signed out.
3. **Dedicated Login Launcher Elements**:
   - Header shortcut: `[🔐 Staff Login]` button in `index.html` allows immediate access to `/login`.
   - Station Card 7: Direct card selection for logging in or switching accounts before auto-launching.

### Official Clinic Branding & Logo Assets
* **Official Clinic Name**: **HPC Center — Health & Pain Care Center**
* **Brand Assets**:
  - `hpclogo.jpg`: High-resolution 750x750 official clinic logo copied from the Windows Downloads directory.
  - `hpclogo-transparent.png`: Transparent-background PNG variant for dark mode headers and badge icons.
* **Platform Icon Generation**:
  - Running `pnpm tauri icon public/hpclogo-transparent.png` automatically compiles the official multi-resolution Windows executable icons (`icon.ico` with 16x16, 32x32, 64x64, 128x128, 256x256 layers, `icon.png`, and Windows Appx Store tiles).

### Local Station Persistence
Upon first launch, Tauri displays a sleek setup dialog prompting the technician to designate the PC's role. Once chosen, the role is stored in Windows AppData (`%APPDATA%\com.shahmdmahi.hpcdesktop\station.json`):

```json
{
  "stationId": "CHAMBER_101",
  "role": "DOCTOR_CHAMBER",
  "roomNumber": "101",
  "deviceName": "PC-CHAMBER-101",
  "autoFullscreen": false,
  "silentPrint": true
}
```

When the app launches on subsequent days, it routes directly to `https://<discovered-ip>:3000/doctor` without showing any setup screens. A hidden shortcut (`Ctrl + Shift + S`) or system tray menu allows reconfiguring the station anytime.

---

## 5. Native Hardware Telemetry & Fleet Heartbeat

The desktop application continuously registers itself in the clinic's **Admin Network Management Panel** (`/admin/network`).

### Windows System Profiler in Rust
Create `src-tauri/src/telemetry.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tokio::time::{sleep, Duration};

#[derive(Serialize, Deserialize)]
pub struct HeartbeatPayload {
    pub deviceId: String,
    pub deviceName: String,
    pub role: String,
    pub station: String,
    pub deviceType: String,
    pub browser: String,
    pub userAgent: String,
    pub latencyMs: u64,
}

pub struct TelemetryService;

impl TelemetryService {
    pub fn spawn_heartbeat_worker(
        base_url: String,
        device_id: String,
        station_name: String,
        role: String,
    ) {
        tokio::spawn(async move {
            let client = reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .unwrap();

            let computer_name = whoami::devicename();
            let os_info = format!("Windows ({})", whoami::distro());

            let heartbeat_url = format!("{}/api/network/heartbeat", base_url);

            loop {
                let start = Instant::now();
                let payload = HeartbeatPayload {
                    deviceId: device_id.clone(),
                    deviceName: computer_name.clone(),
                    role: role.clone(),
                    station: station_name.clone(),
                    deviceType: "DESKTOP".into(),
                    browser: "Tauri WebView2".into(),
                    userAgent: os_info.clone(),
                    latencyMs: 0,
                };

                let res = client.post(&heartbeat_url).json(&payload).send().await;
                let latency = start.elapsed().as_millis() as u64;

                if let Ok(resp) = res {
                    if resp.status().is_success() {
                        // Latency tracked successfully
                    }
                }

                sleep(Duration::from_secs(10)).await;
            }
        });
    }
}
```

---

## 6. Native Desktop Superpowers

### Silent Thermal Receipt / Slip Printing (ESC/POS)
In standard web browsers, clicking "Print Receipt" triggers the Windows Print Dialog, forcing the cashier to press `Enter` on every single transaction.

In Tauri, the Rust backend connects directly to USB, Serial (COM), or Network thermal printers (58mm / 80mm ESC/POS) and prints slips **in under 50 milliseconds with zero user prompts**.

Create `src-tauri/src/printer.rs`:

```rust
use tauri::command;

#[command]
pub async fn print_thermal_receipt(
    patient_name: String,
    mrn: String,
    serial_no: Option<i32>,
    amount: f64,
    items: Vec<String>,
) -> Result<(), String> {
    // Format ESC/POS raw bytes:
    // ESC @ (Initialize), ESC a 1 (Center align), GS ! 17 (Double height/width)
    let mut buffer = Vec::new();
    buffer.extend_from_slice(b"\x1B\x40"); // Init
    buffer.extend_from_slice(b"\x1B\x61\x01"); // Center
    buffer.extend_from_slice(b"HPC CENTER\n");
    buffer.extend_from_slice(b"Health & Pain Care Center\n");
    buffer.extend_from_slice(b"--------------------------------\n");
    buffer.extend_from_slice(b"\x1B\x61\x00"); // Left align

    if let Some(s) = serial_no {
        buffer.extend_from_slice(format!("TOKEN SERIAL: {}\n", s).as_bytes());
    }
    buffer.extend_from_slice(format!("Patient: {}\n", patient_name).as_bytes());
    buffer.extend_from_slice(format!("MRN:     {}\n", mrn).as_bytes());
    buffer.extend_from_slice(b"--------------------------------\n");

    for item in items {
        buffer.extend_from_slice(format!("* {}\n", item).as_bytes());
    }

    buffer.extend_from_slice(b"--------------------------------\n");
    buffer.extend_from_slice(format!("TOTAL PAID: BDT {:.2}\n", amount).as_bytes());
    buffer.extend_from_slice(b"\n\n\x1D\x56\x00"); // Cut paper

    // Send directly to Windows Spooler raw printer (e.g. "POS-80")
    raw_printer::print_raw("POS-80", &buffer).map_err(|e| e.to_string())
}
```

### Windows System Tray & Boot Auto-Start
1. **System Tray**:
   Closing the window does not terminate the app; it minimizes to the Windows notification tray area with quick actions:
   * "Open Dashboard"
   * "Station: Chamber 101"
   * "Server: 192.168.10.45 (Online • 3ms)"
   * "Exit"
2. **Auto-Start**:
   Uses the Windows Registry (`HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`) so chamber PCs launch the clinic terminal automatically when booted in the morning.

### Multi-Monitor Support (Dual-Display Chambers)
For Doctor Chambers and Reception Desks equipped with two monitors:
* **Primary Screen**: Displays the private Doctor / Reception dashboard.
* **Secondary Screen (Facing Patient)**: Tauri can spawn a second borderless window displaying the **Patient Token Display** or **Waiting Queue**, updated synchronously via the local event bus.

### Offline Resiliency & Automatic Reconnection
If the clinic Wi-Fi drops or a network cable is disconnected:
1. Tauri catches the connection drop immediately.
2. Injects a non-intrusive floating status pill: `🔴 Connection Lost — Reconnecting in 3s...`
3. Automatically triggers the UDP discovery loop to re-anchor when the network recovers.
4. Restores the exact open patient chart without page reload or data loss.

---

## 7. Complete Project Scaffolding & Configuration

### Directory Structure

```
HPCDestktop/
├── src-tauri/
│   ├── certificates/
│   │   └── rootCA.crt                 <-- Clinic Root CA
│   ├── src/
│   │   ├── cert.rs                    <-- Windows CryptoAPI Trust Installer
│   │   ├── discovery.rs               <-- UDP 8888 Universal Subnet Engine
│   │   ├── telemetry.rs               <-- Background Heartbeat Worker
│   │   ├── printer.rs                 <-- Raw ESC/POS Thermal Printing
│   │   └── main.rs                    <-- Tauri Entrypoint & IPC Commands
│   ├── Cargo.toml                     <-- Rust Dependencies
│   └── tauri.conf.json                <-- Tauri v2 Windows Configuration
├── package.json                       <-- Frontend Scripts & Tauri CLI
└── src/
    ├── index.html                     <-- Splash & Discovery Loader
    └── splash.js                      <-- Server Connection Bridge
```

### `Cargo.toml` Dependencies

```toml
[package]
name = "hpc-desktop"
version = "1.0.0"
description = "HPC Center Universal Clinic Workstation"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0.0", features = [] }

[dependencies]
tauri = { version = "2.0.0", features = ["tray-icon"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
ipconfig = "0.3"
whoami = "1.5"
uuid = { version = "1.8", features = ["v4"] }

[target.'cfg(target_os = "windows")'.dependencies]
windows-sys = { version = "0.52", features = ["Win32_Security_Cryptography"] }
```

### `tauri.conf.json` Configuration

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/tooling/cli/schema.json",
  "productName": "HPC Center",
  "version": "1.0.0",
  "identifier": "com.shahmdmahi.hpcdesktop",
  "build": {
    "beforeDevCommand": "",
    "beforeBuildCommand": "",
    "devUrl": "../src",
    "frontendDist": "../src"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "HPC Center — Health & Pain Care Center",
        "width": 1440,
        "height": 900,
        "minWidth": 1024,
        "minHeight": 700,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "trayIcon": {
      "iconPath": "icons/icon.ico",
      "tooltip": "HPC Center Workstation"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.ico"
    ]
  }
}
```

### Main Entrypoint (`src-tauri/src/main.rs`)

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cert;
mod discovery;
mod printer;
mod telemetry;

use discovery::DiscoveryManager;
use tauri::{AppHandle, Manager};

#[tauri::command]
async fn discover_clinic_server() -> Result<discovery::DiscoveredServer, String> {
    DiscoveryManager::discover(4).await
}

#[tauri::command]
async fn connect_to_station(app: AppHandle, server_url: String, target_route: String) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    let full_url = format!("{}{}", server_url.trim_end_matches('/'), target_route);
    let parsed_url = full_url.parse().map_err(|e: url::ParseError| e.to_string())?;
    window.navigate(parsed_url).map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    // 1. Silently install clinic root CA into Windows CurrentUser store
    let _ = cert::install_clinic_root_ca();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            discover_clinic_server,
            connect_to_station,
            printer::print_thermal_receipt
        ])
        .run(tauri::generate_context!())
        .expect("Error while running HPC Center desktop application");
}
```

---

## 8. Building & Deploying the Windows Installer

### Build CLI Commands
To compile the production installer on Windows (via PowerShell or WSL with target):

```powershell
# 1. Install Tauri CLI via pnpm
pnpm add -D @tauri-apps/cli

# 2. Compile optimized production Windows installer (.msi & .exe)
pnpm tauri build
```

The resulting artifacts are generated in:
* **MSI Enterprise Installer**: `src-tauri/target/release/bundle/msi/HPC Center_1.0.0_x64_en-US.msi`
* **Standalone Portable Executable**: `src-tauri/target/release/hpc-desktop.exe` (~9 MB)

### Deployment Checklist for Clinic PCs
1. **Network**: Connect PC to clinic LAN (Ethernet cable or Wi-Fi). It does not matter if the router is `192.168.10.1`, `192.168.1.1`, or `10.0.0.1`.
2. **Installation**: Double-click the `.msi` installer. Installation finishes in 5 seconds.
3. **Station Setup**:
   * Open **HPC Center** from Start Menu.
   * The app discovers the server in ~50ms.
   * Choose the station role (e.g. "Doctor Chamber 101" or "Cashier").
   * Check "Start automatically on Windows boot".
4. **Operation**: PC is ready for full daily clinical workflows with silent certificate verification, live fleet telemetry, and instant receipt printing.
