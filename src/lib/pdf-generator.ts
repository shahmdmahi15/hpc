"use client";

import { jsPDF } from "jspdf";
import * as htmlToImage from "html-to-image";

export interface PdfGenerationOptions {
  filename?: string;
  format?: "statement" | "half-sheet" | "custom-5.5x8.125" | "thermal" | "a5" | "a4";
  orientation?: "portrait" | "landscape";
  quality?: number;
}

/**
 * Standard Wi-Fi printer paper size: 5.5" width x 8.27" height (139.7mm x 210.0mm / A5 height)
 */
export const STANDARD_PAPER_SIZE = {
  widthInches: 5.5,
  heightInches: 8.27,
  widthMm: 139.7,
  heightMm: 210.0,
  cssSize: "5.5in 8.27in",
};

/**
 * Generates and downloads a high-resolution, crisp PDF from any DOM element using jsPDF and html-to-image.
 * Supports native Bengali font rendering, crisp SVG/vector icons, and custom 5.5" x 8.125" paper geometry.
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
    filename = `HPC-Doc-${Date.now()}.pdf`,
    format = "custom-5.5x8.125",
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
    if (format === "custom-5.5x8.125" || format === "statement" || format === "half-sheet") {
      // 5.5" width x 8.125" height cut paper for Wi-Fi printer
      const pdfWidthMm = STANDARD_PAPER_SIZE.widthMm;
      const pdfHeightMm = STANDARD_PAPER_SIZE.heightMm;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pdfWidthMm, pdfHeightMm],
        compress: true,
      });

      const marginMm = 5;
      const contentWidth = pdfWidthMm - marginMm * 2;
      const contentHeight = contentWidth * aspectRatio;

      if (contentHeight <= pdfHeightMm - marginMm * 2) {
        pdf.addImage(dataUrl, "PNG", marginMm, marginMm, contentWidth, contentHeight, undefined, "FAST");
      } else {
        const scaledWidth = (pdfHeightMm - marginMm * 2) / aspectRatio;
        const xOffset = (pdfWidthMm - scaledWidth) / 2;
        pdf.addImage(dataUrl, "PNG", xOffset, marginMm, scaledWidth, pdfHeightMm - marginMm * 2, undefined, "FAST");
      }

      pdf.save(filename);
    } else if (format === "thermal") {
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
      // Standard A5 or A4
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

export interface PrintIsolatedOptions {
  title?: string;
  paperSize?: string; // Default: "5.5in 8.125in"
  margin?: string; // Default: "0.2in"
}

/**
 * Prints a specific DOM element cleanly via the dedicated #hpc-print-root mount point.
 * Configured specifically for 5.5" width x 8.125" height standard paper Wi-Fi printers.
 * Ensures the main dashboard, browser chrome, navigation, and dialog overlays are NOT printed.
 * Eliminates blank pages caused by zero-dimension iframe sandbox restrictions.
 */
export function printElementIsolated(
  elementOrId: HTMLElement | string,
  titleOrOptions: string | PrintIsolatedOptions = "Print Document"
): void {
  if (typeof window === "undefined") return;

  const options: PrintIsolatedOptions =
    typeof titleOrOptions === "string"
      ? { title: titleOrOptions }
      : titleOrOptions;

  const { title = "Print Document" } = options;

  const targetElement =
    typeof elementOrId === "string"
      ? document.getElementById(elementOrId)
      : elementOrId;

  if (!targetElement) {
    console.warn("[Print Isolated] Target element not found:", elementOrId);
    window.print();
    return;
  }

  // 1. Locate or create the dedicated #hpc-print-root attached to document.body
  let printRoot = document.getElementById("hpc-print-root");
  if (!printRoot) {
    printRoot = document.createElement("div");
    printRoot.id = "hpc-print-root";
    printRoot.className = "print-document-container";
    document.body.appendChild(printRoot);
  }

  // 2. Clone the target element HTML into the isolated print container
  printRoot.innerHTML = targetElement.outerHTML;

  // 3. Temporarily set document title for the printer driver and header/footer
  const originalTitle = document.title;
  if (title) {
    document.title = title;
  }

  // 4. Setup cleanup listener that cleans up once print dialog finishes
  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    if (printRoot) {
      printRoot.innerHTML = "";
    }
    if (originalTitle) {
      document.title = originalTitle;
    }
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);

  // 5. Trigger print cleanly on the next animation frame after DOM commitment
  requestAnimationFrame(() => {
    try {
      window.print();
    } catch (e) {
      console.error("[Print Isolated] Print execution error:", e);
      cleanup();
    }
  });
}
