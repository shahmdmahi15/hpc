use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4};
use std::time::Duration;
use tokio::net::UdpSocket;
use tokio::time::timeout;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveredServer {
    pub url: String,
    pub ip: String,
    pub port: u16,
    pub ssl: bool,
    pub name: String,
}

#[derive(Debug, Deserialize)]
struct UdpServerPayload {
    pub service: Option<String>,
    pub ip: String,
    pub port: Option<u16>,
    pub ssl: Option<bool>,
    pub name: Option<String>,
}

pub struct DiscoveryManager;

impl DiscoveryManager {
    const UDP_PORT: u16 = 8888;
    const DISCOVERY_PROBE: &'static [u8] = b"HPC_DISCOVER_SERVER";

    /// Broadcasts UDP discovery packets to 255.255.255.255 and listens for responder.
    pub async fn discover(timeout_secs: u64) -> Result<DiscoveredServer, String> {
        let bind_addr = SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, 0);
        let socket = UdpSocket::bind(bind_addr)
            .await
            .map_err(|e| format!("Failed to bind UDP socket: {}", e))?;

        socket
            .set_broadcast(true)
            .map_err(|e| format!("Failed to set UDP broadcast: {}", e))?;

        // 1. Send to universal broadcast 255.255.255.255
        let global_target = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::BROADCAST, Self::UDP_PORT));
        let _ = socket.send_to(Self::DISCOVERY_PROBE, global_target).await;

        // 2. Also send to common clinic router subnet broadcast targets (including 192.168.2.255)
        let common_broadcasts = [
            Ipv4Addr::new(192, 168, 2, 255),
            Ipv4Addr::new(192, 168, 10, 255),
            Ipv4Addr::new(192, 168, 1, 255),
            Ipv4Addr::new(192, 168, 0, 255),
            Ipv4Addr::new(192, 168, 3, 255),
            Ipv4Addr::new(192, 168, 4, 255),
            Ipv4Addr::new(192, 168, 8, 255),
            Ipv4Addr::new(192, 168, 100, 255),
            Ipv4Addr::new(172, 20, 10, 255),
            Ipv4Addr::new(10, 0, 0, 255),
        ];
        for bcast in common_broadcasts {
            let target = SocketAddr::V4(SocketAddrV4::new(bcast, Self::UDP_PORT));
            let _ = socket.send_to(Self::DISCOVERY_PROBE, target).await;
        }

        // 3. Receive response with timeout
        let mut buf = [0u8; 2048];
        let listen_duration = Duration::from_secs(timeout_secs);

        match timeout(listen_duration, socket.recv_from(&mut buf)).await {
            Ok(Ok((len, _addr))) => {
                let raw_json = std::str::from_utf8(&buf[..len])
                    .map_err(|e| format!("Invalid UTF-8 in response: {}", e))?;

                let payload: UdpServerPayload = serde_json::from_str(raw_json)
                    .map_err(|e| format!("Failed to parse server payload: {}", e))?;

                let port = payload.port.unwrap_or(3000);
                let ssl = payload.ssl.unwrap_or(true);
                let scheme = if ssl { "https" } else { "http" };
                let url = format!("{}://{}:{}", scheme, payload.ip, port);
                let name = payload.name.unwrap_or_else(|| "HPC Center".into());

                Ok(DiscoveredServer {
                    url,
                    ip: payload.ip,
                    port,
                    ssl,
                    name,
                })
            }
            Ok(Err(e)) => Err(format!("Socket receive error: {}", e)),
            Err(_) => Err("UDP discovery timed out".into()),
        }
    }

    /// Concurrent HTTP probe across a specific subnet (e.g. "192.168.10")
    pub async fn sweep_subnet(base_subnet: &str, port: u16) -> Option<DiscoveredServer> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(400))
            .danger_accept_invalid_certs(true)
            .build()
            .ok()?;

        let clean_subnet = base_subnet.trim_end_matches('.');
        let mut handles = Vec::with_capacity(254);

        for i in 1..=254 {
            let ip = format!("{}.{}", clean_subnet, i);
            let url = format!("https://{}:{}/api/v1/tv/discovery", ip, port);
            let http = client.clone();

            handles.push(tokio::spawn(async move {
                if let Ok(res) = http.get(&url).send().await {
                    if let Ok(payload) = res.json::<UdpServerPayload>().await {
                        let server_port = payload.port.unwrap_or(port);
                        let ssl = payload.ssl.unwrap_or(true);
                        let scheme = if ssl { "https" } else { "http" };
                        let full_url = format!("{}://{}:{}", scheme, payload.ip, server_port);
                        let name = payload.name.unwrap_or_else(|| "HPC Center".into());

                        return Some(DiscoveredServer {
                            url: full_url,
                            ip: payload.ip,
                            port: server_port,
                            ssl,
                            name,
                        });
                    }
                }
                None
            }));
        }

        for handle in handles {
            if let Ok(Some(server)) = handle.await {
                return Some(server);
            }
        }

        None
    }

    /// High-resilience automatic discovery combining targeted UDP broadcast and parallel HTTP subnet sweeping
    pub async fn auto_discover() -> Result<DiscoveredServer, String> {
        // 1. Try UDP first with 2s timeout
        if let Ok(server) = Self::discover(2).await {
            return Ok(server);
        }

        // 2. If UDP is filtered/blocked by Wi-Fi router (common between 2.4G and 5G bands),
        // sweep common clinic subnets concurrently over HTTP/HTTPS (port 3000)
        let subnets = [
            "192.168.2",
            "192.168.10",
            "192.168.1",
            "192.168.0",
            "192.168.3",
            "192.168.4",
            "172.20.10",
            "10.0.0",
        ];

        for subnet in subnets {
            if let Some(server) = Self::sweep_subnet(subnet, 3000).await {
                return Ok(server);
            }
        }

        Err("No clinic server found on LAN via UDP or subnet sweep".into())
    }
}

