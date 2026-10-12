use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::{TcpStream, UdpSocket};
use tokio::sync::mpsc::{channel, UnboundedSender};
use tokio::sync::Semaphore;
use tokio::time::timeout;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveredServer {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service: Option<String>,
    pub url: String,
    pub ip: String,
    pub port: u16,
    pub ssl: bool,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveryProgress {
    pub tier: u8,
    pub status: String, // "searching" | "connected" | "offline"
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server: Option<DiscoveredServer>,
}

#[derive(Debug, Deserialize)]
struct UdpServerPayload {
    pub service: Option<String>,
    pub ip: Option<String>,
    pub port: Option<u16>,
    pub ssl: Option<bool>,
    pub name: Option<String>,
}

pub struct DiscoveryManager;

impl DiscoveryManager {
    const UDP_PORT: u16 = 8888;
    const DISCOVERY_PROBE: &'static [u8] = b"HPC_DISCOVER_SERVER";

    /// Dynamically detects all active IPv4 subnet prefixes on this workstation,
    /// placing the active interface subnet first.
    pub fn get_local_subnet_prefixes() -> Vec<String> {
        let mut prefixes: Vec<String> = Vec::new();

        // 1. Probe active outgoing interface via dummy UDP socket routing
        if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
            if socket.connect("8.8.8.8:80").is_ok() {
                if let Ok(local_addr) = socket.local_addr() {
                    if let std::net::IpAddr::V4(ipv4) = local_addr.ip() {
                        let octets = ipv4.octets();
                        if !ipv4.is_loopback() {
                            let sub = format!("{}.{}.{}", octets[0], octets[1], octets[2]);
                            if !prefixes.contains(&sub) {
                                prefixes.push(sub);
                            }
                        }
                    }
                }
            }
        }

        // 2. Also query local_ip_address crate
        if let Ok(ip) = local_ip_address::local_ip() {
            if let std::net::IpAddr::V4(ipv4) = ip {
                let octets = ipv4.octets();
                if !ipv4.is_loopback() {
                    let sub = format!("{}.{}.{}", octets[0], octets[1], octets[2]);
                    if !prefixes.contains(&sub) {
                        prefixes.push(sub);
                    }
                }
            }
        }

        // 3. Fallback standard clinic subnets
        let fallback = [
            "192.168.2",
            "192.168.10",
            "192.168.1",
            "192.168.0",
            "192.168.3",
            "192.168.4",
            "192.168.8",
            "192.168.100",
            "172.20.10",
            "10.0.0",
        ];
        for sub in fallback {
            let s = sub.to_string();
            if !prefixes.contains(&s) {
                prefixes.push(s);
            }
        }

        prefixes
    }

    /// Tier 1: Broadcasts UDP discovery packets to 255.255.255.255, multicast, and subnet broadcasts.
    pub async fn discover_via_udp(timeout_ms: u64) -> Result<DiscoveredServer, String> {
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

        // 2. Send to multicast discovery group 239.255.255.250
        let mcast_target = SocketAddr::V4(SocketAddrV4::new(
            Ipv4Addr::new(239, 255, 255, 250),
            Self::UDP_PORT,
        ));
        let _ = socket.send_to(Self::DISCOVERY_PROBE, mcast_target).await;

        // 3. Send to all detected subnet broadcasts
        for prefix in Self::get_local_subnet_prefixes() {
            let parts: Vec<&str> = prefix.split('.').collect();
            if parts.len() == 3 {
                if let (Ok(a), Ok(b), Ok(c)) = (
                    parts[0].parse::<u8>(),
                    parts[1].parse::<u8>(),
                    parts[2].parse::<u8>(),
                ) {
                    let bcast_addr = SocketAddr::V4(SocketAddrV4::new(
                        Ipv4Addr::new(a, b, c, 255),
                        Self::UDP_PORT,
                    ));
                    let _ = socket.send_to(Self::DISCOVERY_PROBE, bcast_addr).await;
                }
            }
        }

        // 4. Receive response with timeout
        let mut buf = [0u8; 2048];
        let listen_duration = Duration::from_millis(timeout_ms);

        match timeout(listen_duration, socket.recv_from(&mut buf)).await {
            Ok(Ok((len, sender_addr))) => {
                let raw_json = std::str::from_utf8(&buf[..len])
                    .map_err(|e| format!("Invalid UTF-8 in response: {}", e))?;

                let payload: UdpServerPayload = serde_json::from_str(raw_json)
                    .map_err(|e| format!("Failed to parse server payload: {}", e))?;

                let sender_ip = sender_addr.ip().to_string();
                let ip = payload.ip.unwrap_or(sender_ip);
                let port = payload.port.unwrap_or(3000);
                let ssl = payload.ssl.unwrap_or(true);
                let scheme = if ssl { "https" } else { "http" };
                let url = format!("{}://{}:{}", scheme, ip, port);
                let name = payload
                    .name
                    .unwrap_or_else(|| "Health & Pain Care Center".into());

                Ok(DiscoveredServer {
                    service: payload.service.or(Some("hpc-clinic-server".into())),
                    url,
                    ip,
                    port,
                    ssl,
                    name,
                })
            }
            Ok(Err(e)) => Err(format!("Socket receive error: {}", e)),
            Err(_) => Err("UDP discovery timed out".into()),
        }
    }

    /// Tier 2: Verifies if a specific IP/port is running the HPC clinic server.
    pub async fn verify_server_at_ip(ip: &str, port: u16) -> Option<DiscoveredServer> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(400))
            .danger_accept_invalid_certs(true)
            .build()
            .ok()?;

        // 1. Try HTTPS first on /_hpc_health
        let https_url = format!("https://{}:{}/_hpc_health", ip, port);
        if let Some(srv) = Self::probe_http_endpoint(&https_url, ip, port, true, &client).await {
            return Some(srv);
        }

        // 2. Try HTTP fallback on /_hpc_health
        let http_url = format!("http://{}:{}/_hpc_health", ip, port);
        if let Some(srv) = Self::probe_http_endpoint(&http_url, ip, port, false, &client).await {
            return Some(srv);
        }

        // 3. Fallback: /api/v1/tv/discovery
        let tv_discovery_url = format!("https://{}:{}/api/v1/tv/discovery", ip, port);
        if let Some(srv) = Self::probe_http_endpoint(&tv_discovery_url, ip, port, true, &client).await
        {
            return Some(srv);
        }

        None
    }

    async fn probe_http_endpoint(
        url: &str,
        ip: &str,
        port: u16,
        ssl: bool,
        client: &reqwest::Client,
    ) -> Option<DiscoveredServer> {
        let res = client.get(url).send().await.ok()?;
        if !res.status().is_success() {
            return None;
        }

        let body = res.text().await.ok()?;
        if body.contains("hpc-clinic-server")
            || body.contains("\"app\":\"hpc\"")
            || body.contains("Health And Pain Care Center")
            || body.contains("Health & Pain Care Center")
            || body.contains("Health Peak Center")
        {
            let scheme = if ssl { "https" } else { "http" };
            Some(DiscoveredServer {
                service: Some("hpc-clinic-server".into()),
                url: format!("{}://{}:{}", scheme, ip, port),
                ip: ip.to_string(),
                port,
                ssl,
                name: "Health & Pain Care Center".into(),
            })
        } else {
            None
        }
    }

    /// Tier 3 & 4: Ultra-fast parallel subnet sweep across a /24 subnet (e.g. "192.168.2" or "192.168.10").
    /// Uses lightweight TCP socket connect test (180ms timeout) with 64 concurrency before HTTP verification.
    /// Sweeps all 254 hosts concurrently in ~1 second, returning immediately when server is found.
    pub async fn sweep_subnet(base_subnet: &str, port: u16) -> Option<DiscoveredServer> {
        let clean_subnet = base_subnet.trim_end_matches('.');
        // Prioritized host list: test common DHCP / server assignments first, then remaining hosts
        let priority_hosts: [u8; 17] = [
            2, 10, 100, 105, 124, 46, 50, 1, 20, 30, 40, 60, 70, 80, 90, 150, 200,
        ];
        let mut all_hosts: Vec<u8> = Vec::with_capacity(254);
        for &h in &priority_hosts {
            all_hosts.push(h);
        }
        for h in 1..=254 {
            if !priority_hosts.contains(&h) {
                all_hosts.push(h);
            }
        }

        let (tx, mut rx) = channel::<DiscoveredServer>(1);
        let stop_flag = Arc::new(AtomicBool::new(false));
        let semaphore = Arc::new(Semaphore::new(64));

        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(500))
            .danger_accept_invalid_certs(true)
            .build()
            .ok()?;

        let mut handles = Vec::with_capacity(all_hosts.len());

        for host in all_hosts {
            let tx = tx.clone();
            let stop = stop_flag.clone();
            let sem = semaphore.clone();
            let client = client.clone();
            let ip_str = format!("{}.{}", clean_subnet, host);

            let handle = tokio::spawn(async move {
                if stop.load(Ordering::Relaxed) {
                    return;
                }

                let Ok(_permit) = sem.acquire().await else {
                    return;
                };

                if stop.load(Ordering::Relaxed) {
                    return;
                }

                let Ok(ip_addr) = ip_str.parse::<Ipv4Addr>() else {
                    return;
                };
                let sock_addr = SocketAddr::V4(SocketAddrV4::new(ip_addr, port));

                // 1. Fast raw TCP connect test (180ms timeout)
                let connect_res =
                    timeout(Duration::from_millis(180), TcpStream::connect(sock_addr)).await;

                if let Ok(Ok(stream)) = connect_res {
                    drop(stream);
                    if stop.load(Ordering::Relaxed) {
                        return;
                    }

                    // 2. TCP port is open! Verify health endpoint
                    let https_url = format!("https://{}:{}/_hpc_health", ip_str, port);
                    if let Some(server) =
                        Self::probe_http_endpoint(&https_url, &ip_str, port, true, &client).await
                    {
                        stop.store(true, Ordering::Relaxed);
                        let _ = tx.send(server).await;
                        return;
                    }

                    let http_url = format!("http://{}:{}/_hpc_health", ip_str, port);
                    if let Some(server) =
                        Self::probe_http_endpoint(&http_url, &ip_str, port, false, &client).await
                    {
                        stop.store(true, Ordering::Relaxed);
                        let _ = tx.send(server).await;
                        return;
                    }

                    let tv_url = format!("https://{}:{}/api/v1/tv/discovery", ip_str, port);
                    if let Some(server) =
                        Self::probe_http_endpoint(&tv_url, &ip_str, port, true, &client).await
                    {
                        stop.store(true, Ordering::Relaxed);
                        let _ = tx.send(server).await;
                    }
                }
            });
            handles.push(handle);
        }
        drop(tx); // drop master sender

        let found = match timeout(Duration::from_millis(2500), rx.recv()).await {
            Ok(Some(server)) => Some(server),
            _ => None,
        };

        if found.is_some() {
            stop_flag.store(true, Ordering::Relaxed);
            for h in handles {
                h.abort();
            }
        }

        found
    }

    /// High-resilience automatic discovery combining UDP broadcast, cached IP check, and parallel subnet sweeping.
    pub async fn auto_discover(
        cached_ip: Option<String>,
        progress_tx: Option<UnboundedSender<DiscoveryProgress>>,
    ) -> Result<DiscoveredServer, String> {
        let emit = |tier: u8, status: &str, message: &str, server: Option<DiscoveredServer>| {
            if let Some(ref tx) = progress_tx {
                let _ = tx.send(DiscoveryProgress {
                    tier,
                    status: status.to_string(),
                    message: message.to_string(),
                    server,
                });
            }
        };

        // -------------------------------------------------------------
        // TIER 1: UDP Broadcast Probe (Fastest, ~300ms)
        // -------------------------------------------------------------
        emit(
            1,
            "searching",
            "Searching for clinic server via UDP broadcast...",
            None,
        );
        if let Ok(server) = Self::discover_via_udp(1200).await {
            emit(
                1,
                "connected",
                &format!(
                    "Found clinic server via UDP at {}:{}",
                    server.ip, server.port
                ),
                Some(server.clone()),
            );
            return Ok(server);
        }

        // -------------------------------------------------------------
        // TIER 2: Check Yesterday's Cached IP (~250ms)
        // -------------------------------------------------------------
        if let Some(ref ip) = cached_ip {
            let clean_ip = ip.trim();
            if !clean_ip.is_empty() {
                emit(
                    2,
                    "searching",
                    &format!("Checking previous server address ({})...", clean_ip),
                    None,
                );
                if let Some(server) = Self::verify_server_at_ip(clean_ip, 3000).await {
                    emit(
                        2,
                        "connected",
                        &format!(
                            "Connected to clinic server at {}:{}",
                            server.ip, server.port
                        ),
                        Some(server.clone()),
                    );
                    return Ok(server);
                }
            }
        }

        // -------------------------------------------------------------
        // TIER 3 & 4: Parallel Subnet Sweep for Dynamic Rotating IP
        // -------------------------------------------------------------
        let candidate_subnets = Self::get_local_subnet_prefixes();
        for (idx, subnet) in candidate_subnets.iter().enumerate() {
            let tier = if idx == 0 { 3 } else { 4 };
            let label = if idx == 0 {
                "local subnet"
            } else {
                "fallback subnet"
            };
            emit(
                tier,
                "searching",
                &format!(
                    "Scanning {} ({}.1 - 254) for rotating server IP...",
                    label, subnet
                ),
                None,
            );

            if let Some(server) = Self::sweep_subnet(subnet, 3000).await {
                emit(
                    tier,
                    "connected",
                    &format!("Found clinic server at {}:{}", server.ip, server.port),
                    Some(server.clone()),
                );
                return Ok(server);
            }
        }

        emit(
            4,
            "offline",
            "No clinic server found on LAN via UDP or subnet sweep",
            None,
        );
        Err("No clinic server found on LAN via UDP or subnet sweep".into())
    }
}
