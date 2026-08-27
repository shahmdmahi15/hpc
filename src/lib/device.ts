export interface ClientDeviceInfo {
  ipAddress: string;
  userAgent: string;
  device: string;
  browser: string;
  os: string;
}

/**
 * Normalizes raw IP addresses (e.g. IPv6 loopback, IPv4-mapped IPv6).
 */
export function normalizeIpAddress(rawIp: string | null | undefined): string {
  if (!rawIp) return "127.0.0.1";
  let ip = rawIp.trim();

  // Strip IPv4-mapped IPv6 prefix
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  // Normalize IPv6 localhost
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") {
    return "127.0.0.1 (Localhost)";
  }

  return ip;
}

/**
 * Parses user agent string into structured OS, browser, and device classifications.
 */
export function parseUserAgentString(userAgent: string): {
  os: string;
  browser: string;
  device: string;
} {
  if (!userAgent || userAgent === "Unknown User Agent") {
    return {
      os: "Unknown OS",
      browser: "Unknown Browser",
      device: "Desktop",
    };
  }

  // Parse Operating System
  let os = "Unknown OS";
  if (/windows phone/i.test(userAgent)) {
    os = "Windows Phone";
  } else if (/win(dows|98|nt|95)/i.test(userAgent)) {
    if (/windows nt 10/i.test(userAgent)) os = "Windows 10/11";
    else if (/windows nt 6.3/i.test(userAgent)) os = "Windows 8.1";
    else if (/windows nt 6.2/i.test(userAgent)) os = "Windows 8";
    else if (/windows nt 6.1/i.test(userAgent)) os = "Windows 7";
    else os = "Windows";
  } else if (/iphone|ipad|ipod/i.test(userAgent)) {
    os = "iOS";
  } else if (/macintosh|mac os x/i.test(userAgent)) {
    os = "macOS";
  } else if (/android/i.test(userAgent)) {
    os = "Android";
  } else if (/linux/i.test(userAgent)) {
    os = "Linux";
  }

  // Parse Browser & Version snippet if available
  let browser = "Unknown Browser";
  const edgeMatch = userAgent.match(/edg\/([\d.]+)/i);
  const chromeMatch = userAgent.match(/chrome\/([\d.]+)/i);
  const firefoxMatch = userAgent.match(/firefox\/([\d.]+)/i);
  const safariMatch = userAgent.match(/version\/([\d.]+).*safari/i);
  const operaMatch = userAgent.match(/(?:opr|opera)\/([\d.]+)/i);

  if (edgeMatch) {
    browser = `Edge ${edgeMatch[1].split(".")[0]}`;
  } else if (operaMatch) {
    browser = `Opera ${operaMatch[1].split(".")[0]}`;
  } else if (chromeMatch && !/edg\//i.test(userAgent)) {
    browser = `Chrome ${chromeMatch[1].split(".")[0]}`;
  } else if (firefoxMatch) {
    browser = `Firefox ${firefoxMatch[1].split(".")[0]}`;
  } else if (safariMatch && !chromeMatch) {
    browser = `Safari ${safariMatch[1].split(".")[0]}`;
  } else if (/safari/i.test(userAgent) && !chromeMatch) {
    browser = "Safari";
  }

  // Parse Device Type
  let device = "Desktop";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(userAgent)) {
    device = "Tablet";
  } else if (
    /mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(
      userAgent,
    )
  ) {
    device = "Mobile";
  }

  return { os, browser, device };
}

/**
 * Extracts and parses client metadata (IP address, user agent, browser, OS, device type)
 * from incoming Next.js request headers.
 */
export async function getClientDeviceInfo(): Promise<ClientDeviceInfo> {
  const { headers } = await import("next/headers");
  const headerList = await headers();

  // Extract IP Address (handling standard proxies, Cloudflare, etc.)
  const forwardedFor = headerList.get("x-forwarded-for");
  const realIp = headerList.get("x-real-ip");
  const cfConnectingIp = headerList.get("cf-connecting-ip");
  const clientIp = headerList.get("x-client-ip");

  let rawIp = "127.0.0.1";
  if (forwardedFor) {
    rawIp = forwardedFor.split(",")[0].trim();
  } else if (cfConnectingIp) {
    rawIp = cfConnectingIp.trim();
  } else if (realIp) {
    rawIp = realIp.trim();
  } else if (clientIp) {
    rawIp = clientIp.trim();
  }

  const ipAddress = normalizeIpAddress(rawIp);
  const userAgent = headerList.get("user-agent") || "Unknown User Agent";
  const { os, browser, device } = parseUserAgentString(userAgent);

  return {
    ipAddress,
    userAgent,
    device,
    browser,
    os,
  };
}
