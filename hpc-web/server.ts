import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import next from "next";
import fs from "fs";
import path from "path";
import os from "os";

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

const hasSsl = fs.existsSync(serverKeyPath) && fs.existsSync(serverCrtPath);

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
    if (req.url === "/_hpc_health" || req.url === "/api/health") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(
        JSON.stringify({
          status: "ok",
          app: "hpc",
          ssl: hasSsl,
          pid: process.pid,
          uptime: process.uptime(),
          env: process.env.NODE_ENV,
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
    const httpsOptions = {
      key: fs.readFileSync(serverKeyPath),
      cert: fs.readFileSync(serverCrtPath),
    };
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
      console.log(`> Root CA:  ${protocol}://localhost:${port}/rootCA.crt (Download for devices)`);
    }
    console.log("========================================================");
  });
});
