use serde::{Deserialize, Serialize};
use std::time::Instant;
use tokio::time::{sleep, Duration};

#[derive(Serialize, Deserialize)]
#[allow(non_snake_case)]
pub struct HeartbeatPayload {
    pub deviceId: String,
    pub deviceName: String,
    pub role: String,
    pub station: String,
    pub deviceType: String,
    pub browser: String,
    pub userAgent: String,
    pub latencyMs: u64,
    pub clientTimestamp: u64,
}

pub struct TelemetryService;

impl TelemetryService {
    pub fn spawn_heartbeat_worker(
        base_url: String,
        device_id: String,
        station_name: String,
        role: String,
        device_name: String,
    ) {
        tokio::spawn(async move {
            let client = match reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .timeout(Duration::from_secs(5))
                .build()
            {
                Ok(c) => c,
                Err(_) => return,
            };

            let heartbeat_url = format!("{}/api/network/heartbeat", base_url.trim_end_matches('/'));

            let mut last_latency = 0u64;

            loop {
                let start = Instant::now();
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;

                let payload = HeartbeatPayload {
                    deviceId: device_id.clone(),
                    deviceName: device_name.clone(),
                    role: role.clone(),
                    station: station_name.clone(),
                    deviceType: "DESKTOP".into(),
                    browser: "Tauri v2 (Windows)".into(),
                    userAgent: "HPC Center Windows Workstation".into(),
                    latencyMs: last_latency,
                    clientTimestamp: now_ms,
                };

                match client.post(&heartbeat_url).json(&payload).send().await {
                    Ok(resp) => {
                        if resp.status().is_success() {
                            last_latency = start.elapsed().as_millis() as u64;
                        }
                    }
                    Err(_) => {
                        last_latency = 999;
                    }
                }

                sleep(Duration::from_secs(10)).await;
            }
        });
    }
}
