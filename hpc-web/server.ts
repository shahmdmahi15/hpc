import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import next from "next";
import fs from "fs";
import path from "path";
import os from "os";
import tls from "tls";

// Check if launched in development or production mode
const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");
if (!isDev && process.env.NODE_ENV !== "production") {
  (process.env as Record<string, string | undefined>)["NODE_ENV"] = "production";
}

// Support command-line arguments (-p, -H) or environment variables
const args = process.argv.slice(2);
const getArg = (shortFlag: string, longFlag: string): string | undefined => {
  const shortIdx = args.indexOf(shortFlag);
  if (shortIdx !== -1 && args[shortIdx + 1]) return args[shortIdx + 1];
  const longIdx = args.indexOf(longFlag);
  if (longIdx !== -1 && args[longIdx + 1]) return args[longIdx + 1];
  return undefined;
};

const port = parseInt(getArg("-p", "--port") || process.env.PORT || "3000", 10);
const hostname = getArg("-H", "--hostname") || process.env.HOSTNAME || "0.0.0.0";

const pidFile = path.resolve(process.cwd(), ".hpc.pid");

const cleanupPid = () => {
  try {
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
  } catch {
    // Ignore cleanup error
  }
};

process.on("exit", cleanupPid);
process.on("SIGINT", () => {
  cleanupPid();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanupPid();
  process.exit(0);
});

// SSL certificate paths
const certDir = path.resolve(process.cwd(), "certificates");
const serverKeyPath = path.join(certDir, "server.key");
const serverCrtPath = path.join(certDir, "server.crt");
const rootPemPath = path.join(certDir, "rootCA.pem");
const rootCrtPath = path.join(certDir, "rootCA.crt");

const hasSsl = fs.existsSync(serverKeyPath) && fs.existsSync(serverCrtPath);

// Ensure Node.js TLS verification securely trusts our local Root CA
// for internal Next.js Server Actions flight pre-rendering / redirects,
// without disabling TLS certificate verification or triggering NODE_TLS_REJECT_UNAUTHORIZED warnings.
if (hasSsl) {
  const caPath = fs.existsSync(rootPemPath) ? rootPemPath : fs.existsSync(rootCrtPath) ? rootCrtPath : null;
  if (caPath) {
    if (!process.env.NODE_EXTRA_CA_CERTS) {
      process.env.NODE_EXTRA_CA_CERTS = caPath;
    }
    try {
      const rootCaBuffer = fs.readFileSync(caPath);
      const origCreateSecureContext = tls.createSecureContext;
      tls.createSecureContext = function (options: any) {
        const ctx = origCreateSecureContext.call(this, options);
        if (ctx && (ctx as any).context && typeof (ctx as any).context.addCACert === "function") {
          try {
            (ctx as any).context.addCACert(rootCaBuffer);
          } catch {
            // Already added or context finalized
          }
        }
        return ctx;
      };
    } catch {
      // Ignore if unable to hook
    }
  }
}

const getLocalIps = (): string[] => {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
};

const app = next({
  dev: isDev,
  hostname,
  port,
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const requestHandler = (req: any, res: any) => {
    // Fast, lightweight health check endpoint for startup scripts & monitoring
    const reqPath = (req.url || "").split("?")[0].replace(/\/+$/, "") || "/";
    if (reqPath === "/_hpc_health" || reqPath === "/api/health") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        });
        res.end();
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      });
      res.end(
        JSON.stringify({
          status: "ok",
          app: "hpc",
          ssl: hasSsl,
          timestamp: new Date().toISOString(),
          name: "Health And Pain Care Center",
          role: "server",
          defaultPort: port,
          pid: process.pid,
          uptime: process.uptime(),
          env: process.env.NODE_ENV,
          capabilities: {
            sse: true,
            speechSynthesis: true,
            offlineMode: true,
            localPrinting: true,
          },
        }),
      );
      return;
    }

    // Direct download endpoint for Root CA certificate
    if (req.url === "/rootCA.crt") {
      const crtFile = path.resolve(process.cwd(), "public", "rootCA.crt");
      if (fs.existsSync(crtFile)) {
        const fileContent = fs.readFileSync(crtFile);
        res.writeHead(200, {
          "Content-Type": "application/x-x509-ca-cert",
          "Content-Disposition": 'attachment; filename="rootCA.crt"',
          "Content-Length": fileContent.length,
          "Cache-Control": "no-cache",
        });
        res.end(fileContent);
        return;
      }
    }

    if (req.url === "/rootCA.pem") {
      const pemFile = path.resolve(process.cwd(), "public", "rootCA.pem");
      if (fs.existsSync(pemFile)) {
        const fileContent = fs.readFileSync(pemFile);
        res.writeHead(200, {
          "Content-Type": "application/x-pem-file",
          "Content-Disposition": 'attachment; filename="rootCA.pem"',
          "Content-Length": fileContent.length,
          "Cache-Control": "no-cache",
        });
        res.end(fileContent);
        return;
      }
    }

    handle(req, res);
  };

  let server: any;

  if (hasSsl) {
    const caPath = fs.existsSync(rootPemPath) ? rootPemPath : fs.existsSync(rootCrtPath) ? rootCrtPath : null;
    const httpsOptions: {
      key: Buffer;
      cert: Buffer;
      ca?: Buffer;
    } = {
      key: fs.readFileSync(serverKeyPath),
      cert: fs.readFileSync(serverCrtPath),
    };
    if (caPath) {
      httpsOptions.ca = fs.readFileSync(caPath);
    }
    server = createHttpsServer(httpsOptions, requestHandler);

    // Gracefully handle plain HTTP request sent to HTTPS port: redirect to HTTPS
    server.on("clientError", (err: any, socket: any) => {
      if (err.code === "ERR_SSL_HTTP_REQUEST") {
        const raw = err.rawPacket ? err.rawPacket.toString("ascii") : "";
        const hostMatch = raw.match(/host:\s*([^\r\n]+)/i);
        const host = hostMatch ? hostMatch[1].trim() : `localhost:${port}`;
        const hostnameOnly = host.split(":")[0];
        const targetSocket = socket._parent || socket;
        try {
          targetSocket.end(
            `HTTP/1.1 302 Found\r\nLocation: https://${hostnameOnly}:${port}/\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
          );
        } catch {
          socket.destroy();
        }
        return;
      }
      socket.destroy(err);
    });
  } else {
    server = createHttpServer(requestHandler);
  }

  server.once("error", (err: any) => {
    cleanupPid();
    console.error("Server error:", err);
    process.exit(1);
  });

  server.listen(port, hostname, () => {
    try {
      fs.writeFileSync(pidFile, String(process.pid), "utf-8");
    } catch {
      // Ignore if write fails
    }

    const protocol = hasSsl ? "https" : "http";
    const localIps = getLocalIps();

    console.log("========================================================");
    console.log(`  HPC Production Server Started (${hasSsl ? "SSL / HTTPS" : "HTTP"})`);
    console.log("========================================================");
    console.log(`> Local:    ${protocol}://localhost:${port}`);
    if (hostname === "0.0.0.0") {
      localIps.forEach((ip) => {
        console.log(`> Network:  ${protocol}://${ip}:${port}`);
      });
    }
    console.log(`> Mode:     ${isDev ? "development" : "production"}`);
    if (hasSsl) {
      console.log(`> Root CA:   ${protocol}://localhost:${port}/rootCA.crt (Download for devices)`);
      console.log(`> SSL Guide: ${protocol}://localhost:${port}/guide.html (Device setup guide)`);
    }
    console.log("========================================================");
  });
});
