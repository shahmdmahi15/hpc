mod cert;
mod discovery;
mod telemetry;
mod wake_lock;

use discovery::{DiscoveredServer, DiscoveryManager};
use tauri::{AppHandle, Manager, Url};

#[tauri::command]
async fn discover_server() -> Result<DiscoveredServer, String> {
    DiscoveryManager::discover(4).await
}

#[tauri::command]
async fn sweep_subnet(base_subnet: String, port: u16) -> Result<Option<DiscoveredServer>, String> {
    Ok(DiscoveryManager::sweep_subnet(&base_subnet, port).await)
}

#[tauri::command]
fn start_telemetry(
    base_url: String,
    device_id: String,
    station_name: String,
    role: String,
    device_name: String,
) {
    telemetry::TelemetryService::spawn_heartbeat_worker(
        base_url,
        device_id,
        station_name,
        role,
        device_name,
    );
}

#[tauri::command]
fn set_wake_lock(enabled: bool) {
    wake_lock::keep_screen_on(enabled);
}

#[tauri::command]
async fn connect_to_url(app: AppHandle, target_url: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let parsed: Url = target_url.parse().map_err(|e| format!("Invalid URL: {}", e))?;
        window.navigate(parsed).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn sync_root_ca_from_server(ca_url: String) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    let res = client.get(&ca_url).send().await.map_err(|e| e.to_string())?;
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;

    cert::install_root_ca_bytes(&bytes)?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 1. Register clinic root CA in Windows CurrentUser certificate store silently
    let _ = cert::install_clinic_root_ca();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            discover_server,
            sweep_subnet,
            start_telemetry,
            set_wake_lock,
            connect_to_url,
            sync_root_ca_from_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running HPC Center desktop application");
}
