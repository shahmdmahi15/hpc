import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

console.log("========================================================");
console.log("  HPC Local & LAN SSL Certificate Generator");
console.log("========================================================");

const projectRoot = process.cwd();
const certDir = path.join(projectRoot, "certificates");
const publicDir = path.join(projectRoot, "public");

if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

// 1. Locate OpenSSL
let openSslBin = "openssl";
try {
  execSync(`${openSslBin} version`, { stdio: "ignore" });
} catch {
  // Check common Windows paths if on Windows
  const winCandidates = [
    "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
    "C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe",
    "C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe",
    "C:\\OpenSSL\\bin\\openssl.exe",
  ];
  const found = winCandidates.find((c) => fs.existsSync(c));
  if (found) {
    openSslBin = `"${found}"`;
  } else {
    console.error("❌ OpenSSL not found! Please install OpenSSL or Git for Windows.");
    process.exit(1);
  }
}

console.log(`[INFO] Using OpenSSL binary: ${openSslBin}`);

// 2. Discover Local Network IPs
const allIps = new Set<string>();
allIps.add("127.0.0.1");

const interfaces = os.networkInterfaces();
const discoveredSubnets = new Set<string>([
  "192.168.0",
  "192.168.1",
  "192.168.2",
  "192.168.3",
  "192.168.10",
  "192.168.100",
  "10.0.0",
  "172.20.10",
]);

for (const name of Object.keys(interfaces)) {
  const ifaceList = interfaces[name];
  if (!ifaceList) continue;
  for (const net of ifaceList) {
    if (net.family === "IPv4" && !net.internal) {
      allIps.add(net.address);
      const match = net.address.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
      if (match) {
        discoveredSubnets.add(match[1]);
      }
    }
  }
}

// Expand full Class C subnets for local LAN roaming
console.log(`[INFO] Expanding SAN IPs for ${discoveredSubnets.size} subnets...`);
for (const sn of discoveredSubnets) {
  for (let i = 1; i <= 254; i++) {
    allIps.add(`${sn}.${i}`);
  }
}

console.log(`[INFO] Total Subject Alternative Name IPs configured: ${allIps.size}`);

const hostname = os.hostname() || "HPC-SERVER";

// 3. Create OpenSSL Configuration
const cnfPath = path.join(certDir, "openssl.cnf");

let cnfContent = `
[ req ]
default_bits        = 2048
default_keyfile     = server.key
distinguished_name  = req_distinguished_name
req_extensions      = req_ext
x509_extensions     = v3_ca
string_mask         = utf8only
prompt              = no

[ req_distinguished_name ]
C                   = BD
ST                  = Dhaka
L                   = Jessore
O                   = Health and Pain Care Center
OU                  = Medical IT
CN                  = localhost

[ req_ext ]
subjectAltName      = @alt_names

[ v3_ca ]
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints       = critical, CA:true
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign

[ v3_req ]
basicConstraints    = CA:FALSE
keyUsage            = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage    = serverAuth, clientAuth
subjectAltName      = @alt_names

[ alt_names ]
DNS.1   = localhost
DNS.2   = *.localhost
DNS.3   = ${hostname}
DNS.4   = ${hostname}.local
DNS.5   = hpc.local
DNS.6   = *.hpc.local
DNS.7   = *.local
DNS.8   = *.lan
DNS.9   = *.home.arpa
`;

let ipIndex = 1;
for (const ip of allIps) {
  cnfContent += `IP.${ipIndex} = ${ip}\n`;
  ipIndex++;
}

fs.writeFileSync(cnfPath, cnfContent, "utf8");

// 4. Generate Root CA Key and Certificate
const rootKeyPath = path.join(certDir, "rootCA.key");
const rootPemPath = path.join(certDir, "rootCA.pem");
const rootCrtPath = path.join(certDir, "rootCA.crt");

console.log("[INFO] Generating Root Certificate Authority (Root CA)...");
execSync(`${openSslBin} genrsa -out "${rootKeyPath}" 2048`, { stdio: "inherit" });
execSync(
  `${openSslBin} req -x509 -new -nodes -key "${rootKeyPath}" -sha256 -days 3650 -out "${rootPemPath}" -config "${cnfPath}" -extensions v3_ca -subj "/C=BD/ST=Jessore/O=Health and Pain Care Center/OU=Medical IT/CN=HPC Local Root CA"`,
  { stdio: "inherit" },
);

fs.copyFileSync(rootPemPath, rootCrtPath);
fs.copyFileSync(rootPemPath, path.join(publicDir, "rootCA.pem"));
fs.copyFileSync(rootCrtPath, path.join(publicDir, "rootCA.crt"));
console.log("[SUCCESS] Root CA generated and published to public/rootCA.crt");

// 5. Generate Server Key and Signed Certificate
const serverKeyPath = path.join(certDir, "server.key");
const serverCsrPath = path.join(certDir, "server.csr");
const serverCrtPath = path.join(certDir, "server.crt");

console.log("[INFO] Generating Server Private Key and CSR...");
execSync(`${openSslBin} genrsa -out "${serverKeyPath}" 2048`, { stdio: "inherit" });
execSync(`${openSslBin} req -new -key "${serverKeyPath}" -out "${serverCsrPath}" -config "${cnfPath}"`, {
  stdio: "inherit",
});

console.log("[INFO] Signing Server Certificate with HPC Root CA...");
execSync(
  `${openSslBin} x509 -req -in "${serverCsrPath}" -CA "${rootPemPath}" -CAkey "${rootKeyPath}" -CAcreateserial -out "${serverCrtPath}" -days 1825 -sha256 -extfile "${cnfPath}" -extensions v3_req`,
  { stdio: "inherit" },
);

// 6. Publish all public certificates to public/ directory for local LAN downloads
fs.copyFileSync(serverCrtPath, path.join(publicDir, "server.crt"));
fs.copyFileSync(serverCsrPath, path.join(publicDir, "server.csr"));
console.log("[SUCCESS] All public certificates published to public/ directory:");
console.log("  ✓ public/rootCA.crt (Root CA for Windows/Android/iOS)");
console.log("  ✓ public/rootCA.pem (Root CA PEM for Linux/Web Clients)");
console.log("  ✓ public/server.crt (Signed Server Public Certificate)");
console.log("  ✓ public/server.csr (Certificate Signing Request)");

console.log("========================================================");
console.log("  SSL Setup Complete!");
console.log(`  - Server Key:   ${serverKeyPath}`);
console.log(`  - Server Cert:  ${serverCrtPath}`);
console.log(`  - Public Files: public/rootCA.crt, public/rootCA.pem, public/server.crt`);
console.log("========================================================");

