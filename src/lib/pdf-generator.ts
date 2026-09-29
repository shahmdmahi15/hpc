"use client";

import { jsPDF } from "jspdf";
import * as htmlToImage from "html-to-image";

export interface PdfGenerationOptions {
  filename?: string;
  format?: "thermal" | "a5" | "a4";
  orientation?: "portrait" | "landscape";
  quality?: number;
}

/**
 * Generates and downloads a high-resolution, crisp PDF from any DOM element using jsPDF and html-to-image.
 * Supports native Bengali font rendering, crisp SVG/vector icons, and custom page geometry.
 */
export async function downloadElementAsPdf(
  elementOrId: HTMLElement | string,
  options: PdfGenerationOptions = {}
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const targetElement =
    typeof elementOrId === "string"
      ? document.getElementById(elementOrId)
      : elementOrId;

  if (!targetElement) {
    console.error("[PDF Generator] Target element not found:", elementOrId);
    return false;
  }

  const {
    filename = `HPC-Receipt-${Date.now()}.pdf`,
    format = "a5",
    orientation = "portrait",
    quality = 0.95,
  } = options;

  try {
    // 1. Temporarily ensure background is pure white and clean for rendering
    const originalBg = targetElement.style.backgroundColor;
    targetElement.style.backgroundColor = "#ffffff";

    // 2. Render DOM node to high-DPI PNG image using html-to-image
    const dataUrl = await htmlToImage.toPng(targetElement, {
      quality,
      pixelRatio: 3, // 3x pixel ratio guarantees razor-sharp Bengali glyphs and borders
      backgroundColor: "#ffffff",
      cacheBust: true,
      skipFonts: false,
    });

    // Restore original style
    targetElement.style.backgroundColor = originalBg;

    // 3. Load image into memory to determine native aspect ratio
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });

    const imgWidthPx = img.width;
    const imgHeightPx = img.height;
    const aspectRatio = imgHeightPx / imgWidthPx;

    // 4. Configure jsPDF with proper page geometry
    if (format === "thermal") {
      // Standard 80mm continuous thermal POS roll (usable width ~72mm, total 80mm)
      const pdfWidthMm = 80;
      const pdfHeightMm = Math.max(100, Math.round(pdfWidthMm * aspectRatio) + 6);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pdfWidthMm, pdfHeightMm],
        compress: true,
      });

      pdf.addImage(dataUrl, "PNG", 0, 2, pdfWidthMm, pdfWidthMm * aspectRatio, undefined, "FAST");
      pdf.save(filename);
    } else {
      // Standard A5 or A4 clinical money receipt voucher
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format,
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const marginMm = 8;
      const contentWidth = pageWidth - marginMm * 2;
      const contentHeight = contentWidth * aspectRatio;

      // Fit inside single page cleanly
      if (contentHeight <= pageHeight - marginMm * 2) {
        pdf.addImage(dataUrl, "PNG", marginMm, marginMm, contentWidth, contentHeight, undefined, "FAST");
      } else {
        const scaledWidth = (pageHeight - marginMm * 2) / aspectRatio;
        const xOffset = (pageWidth - scaledWidth) / 2;
        pdf.addImage(dataUrl, "PNG", xOffset, marginMm, scaledWidth, pageHeight - marginMm * 2, undefined, "FAST");
      }

      pdf.save(filename);
    }

    return true;
  } catch (error) {
    console.error("[PDF Generator] Failed to generate PDF:", error);
    return false;
  }
}

/**
 * Prints a specific DOM element cleanly via an isolated hidden iframe.
 * Ensures the main dashboard, browser chrome, navigation, and dialog overlays are NOT printed.
 */
export function printElementIsolated(elementOrId: HTMLElement | string, title = "Print Document"): void {
  if (typeof window === "undefined") return;

  const targetElement =
    typeof elementOrId === "string"
      ? document.getElementById(elementOrId)
      : elementOrId;

  if (!targetElement) {
    window.print();
    return;
  }

  // Create isolated iframe
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.zIndex = "-1000";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }

  // Copy stylesheets and fonts from main document into iframe
  const styleNodes = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"));
  const headHtml = styleNodes.map((node) => node.outerHTML).join("\n");

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        ${headHtml}
        <style>
          @page {
            margin: 0mm;
            size: auto;
          }
          body {
            margin: 0;
            padding: 8px;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            justify-content: center;
          }
          * {
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        <div>${targetElement.outerHTML}</div>
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("[Print Isolated] Print execution error:", e);
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }
  }, 350);
}
