# Health & Pain Care Center (HPC) - SSL & Root CA Certificate Generator
# Generates local LAN trusted certificates for localhost and 192.168.x.x addresses

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\package.json")) {
    $projectRoot = $PSScriptRoot
}

$certDir = Join-Path $projectRoot "certificates"
$publicDir = Join-Path $projectRoot "public"

if (-not (Test-Path $certDir)) { New-Item -ItemType Directory -Force -Path $certDir | Out-Null }
if (-not (Test-Path $publicDir)) { New-Item -ItemType Directory -Force -Path $publicDir | Out-Null }

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  HPC Local & LAN SSL Certificate Generator" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Locate OpenSSL
$openSslPath = $null
$candidatePaths = @(
    "C:\Program Files\Git\usr\bin\openssl.exe",
    "C:\Program Files (x86)\Git\usr\bin\openssl.exe",
    "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
    "C:\OpenSSL\bin\openssl.exe",
    (Get-Command "openssl.exe" -ErrorAction SilentlyContinue).Source
)

foreach ($cand in $candidatePaths) {
    if ($cand -and (Test-Path $cand)) {
        $openSslPath = $cand
        break
    }
}

if (-not $openSslPath) {
    Write-Host "[ERROR] OpenSSL executable was not found. Please install Git for Windows or OpenSSL." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Using OpenSSL binary: $openSslPath" -ForegroundColor Green

# 2. Collect Host IPv4 addresses and all requested subnets for SANs
$allIps = [System.Collections.Generic.HashSet[string]]::new()
$null = $allIps.Add("127.0.0.1")

# Discover active network adapter IPs
try {
    $discovered = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | 
        Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } | 
        Select-Object -ExpandProperty IPAddress
    if ($discovered) {
        foreach ($d in $discovered) {
            $null = $allIps.Add($d)
        }
    }
} catch {}

# Common Subnets requested (192.168.0.*, 192.168.1.*, 192.168.2.*, 192.168.3.*, 192.168.10.*, 192.168.100.*, 10.0.0.*, 172.20.10.*)
$subnets = @(
    "192.168.0",
    "192.168.1",
    "192.168.2",
    "192.168.3",
    "192.168.10",
    "192.168.100",
    "10.0.0",
    "172.20.10"
)

# If any active network adapter is on an additional subnet, include its full subnet too!
if ($discovered) {
    foreach ($d in $discovered) {
        if ($d -match '^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$') {
            $currentSubnet = $matches[1]
            if ($currentSubnet -notin $subnets) {
                $subnets += $currentSubnet
            }
        }
    }
}

Write-Host "[INFO] Expanding SAN IPs for $($subnets.Count) subnets (including 192.168.0.*, 192.168.1.*, 192.168.2.*, 192.168.3.*, 192.168.10.*, 192.168.100.*, 10.0.0.*)..." -ForegroundColor Cyan
foreach ($sn in $subnets) {
    for ($i = 1; $i -le 254; $i++) {
        $null = $allIps.Add("$sn.$i")
    }
}

Write-Host "[INFO] Total Subject Alternative Name IPs configured: $($allIps.Count)" -ForegroundColor Green

$compName = $env:COMPUTERNAME
if (-not $compName) { $compName = "HPC-SERVER" }

# 3. Create OpenSSL configuration for Server SANs & Root CA
$cnfPath = Join-Path $certDir "openssl.cnf"
$sb = [System.Text.StringBuilder]::new()
$null = $sb.AppendLine(@"
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
L                   = Dhaka
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
DNS.3   = $compName
DNS.4   = $compName.local
DNS.5   = hpc.local
DNS.6   = *.hpc.local
DNS.7   = *.local
DNS.8   = *.lan
DNS.9   = *.home.arpa
"@)

$ipIndex = 1
foreach ($ip in $allIps) {
    $null = $sb.AppendLine("IP.$ipIndex = $ip")
    $ipIndex++
}

[System.IO.File]::WriteAllText($cnfPath, $sb.ToString(), [System.Text.Encoding]::ASCII)

# Override any corrupted system OPENSSL_CONF environment variable
$env:OPENSSL_CONF = $cnfPath

# 4. Generate Root CA Key and Certificate (Valid for 10 years)
$rootKeyPath = Join-Path $certDir "rootCA.key"
$rootPemPath = Join-Path $certDir "rootCA.pem"
$rootCrtPath = Join-Path $certDir "rootCA.crt"

if (-not (Test-Path $rootKeyPath) -or -not (Test-Path $rootPemPath)) {
    Write-Host "[INFO] Generating Root Certificate Authority (Root CA)..." -ForegroundColor Cyan
    
    # Generate private key for Root CA
    & $openSslPath genrsa -out $rootKeyPath 2048
    
    # Generate Root CA self-signed certificate using our config
    & $openSslPath req -x509 -new -nodes -key $rootKeyPath -sha256 -days 3650 -out $rootPemPath `
        -config $cnfPath -extensions v3_ca `
        -subj "/C=BD/ST=Dhaka/O=Health and Pain Care Center/OU=Medical IT/CN=HPC Local Root CA"
    
    # Copy to .crt format for Windows/Android installer
    Copy-Item -Path $rootPemPath -Destination $rootCrtPath -Force
    Write-Host "[SUCCESS] Root CA generated successfully." -ForegroundColor Green
} else {
    Write-Host "[INFO] Existing Root CA found, reusing." -ForegroundColor Green
    Copy-Item -Path $rootPemPath -Destination $rootCrtPath -Force
}

# 5. Copy Root CA to public/ for client downloads (tablets, mobiles, other PCs)
Copy-Item -Path $rootPemPath -Destination (Join-Path $publicDir "rootCA.pem") -Force
Copy-Item -Path $rootCrtPath -Destination (Join-Path $publicDir "rootCA.crt") -Force
Write-Host "[SUCCESS] Root CA published to public/rootCA.pem and public/rootCA.crt" -ForegroundColor Green

# 6. Generate Server Key and Certificate (Signed by Root CA)
$serverKeyPath = Join-Path $certDir "server.key"
$serverCsrPath = Join-Path $certDir "server.csr"
$serverCrtPath = Join-Path $certDir "server.crt"

Write-Host "[INFO] Generating Server Private Key and CSR..." -ForegroundColor Cyan
& $openSslPath genrsa -out $serverKeyPath 2048

& $openSslPath req -new -key $serverKeyPath -out $serverCsrPath -config $cnfPath

Write-Host "[INFO] Signing Server Certificate with HPC Root CA..." -ForegroundColor Cyan
& $openSslPath x509 -req -in $serverCsrPath -CA $rootPemPath -CAkey $rootKeyPath -CAcreateserial `
    -out $serverCrtPath -days 1825 -sha256 -extfile $cnfPath -extensions v3_req

Write-Host "[SUCCESS] Server Certificate (server.crt) created successfully!" -ForegroundColor Green

# 7. Check / Register Root CA into Current User's Windows Trusted Root store
$isInstalled = Get-ChildItem Cert:\CurrentUser\Root -ErrorAction SilentlyContinue | Where-Object { $_.Subject -like "*HPC Local Root CA*" }
if (-not $isInstalled) {
    Write-Host "[INFO] To trust https://localhost without browser warnings on this PC, run Install-RootCA.bat" -ForegroundColor Cyan
} else {
    Write-Host "[SUCCESS] Root CA is already trusted on this machine." -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  SSL Setup Complete!" -ForegroundColor Green
Write-Host "  - Server Key:  $serverKeyPath" -ForegroundColor DarkGray
Write-Host "  - Server Cert: $serverCrtPath" -ForegroundColor DarkGray
Write-Host "  - Public Root: public/rootCA.pem & public/rootCA.crt" -ForegroundColor DarkGray
Write-Host "========================================================" -ForegroundColor Cyan
