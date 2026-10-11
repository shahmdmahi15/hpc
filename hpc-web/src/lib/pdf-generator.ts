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

/**
 * Compiles multiple DOM elements into a single multi-page PDF document.
 * Each element is rendered on its own dedicated high-resolution page.
 */
export async function downloadMultipleElementsAsPdf(
  elementsOrIds: (HTMLElement | string)[],
  options: PdfGenerationOptions = {}
): Promise<boolean> {
  if (typeof window === "undefined" || elementsOrIds.length === 0) return false;

  const {
    filename = `HPC-Doc-History-${Date.now()}.pdf`,
    format = "a4",
    orientation = "portrait",
    quality = 0.95,
  } = options;

  try {
    const isCustom55 =
      format === "custom-5.5x8.125" ||
      format === "statement" ||
      format === "half-sheet";

    const pdf = isCustom55
      ? new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [STANDARD_PAPER_SIZE.widthMm, STANDARD_PAPER_SIZE.heightMm],
          compress: true,
        })
      : new jsPDF({
          orientation,
          unit: "mm",
          format: format === "thermal" ? "a4" : format,
          compress: true,
        });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginMm = isCustom55 ? 5 : 8;
    const contentWidth = pageWidth - marginMm * 2;

    let pageAdded = 0;

    for (let i = 0; i < elementsOrIds.length; i++) {
      const item = elementsOrIds[i];
      const targetElement =
        typeof item === "string" ? document.getElementById(item) : item;

      if (!targetElement) continue;

      const originalBg = targetElement.style.backgroundColor;
      targetElement.style.backgroundColor = "#ffffff";

      const dataUrl = await htmlToImage.toPng(targetElement, {
        quality,
        pixelRatio: 2.5,
        backgroundColor: "#ffffff",
        cacheBust: true,
        skipFonts: false,
      });

      targetElement.style.backgroundColor = originalBg;

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });

      const aspectRatio = img.height / img.width;
      const contentHeight = contentWidth * aspectRatio;

      if (pageAdded > 0) {
        pdf.addPage();
      }

      if (contentHeight <= pageHeight - marginMm * 2) {
        pdf.addImage(
          dataUrl,
          "PNG",
          marginMm,
          marginMm,
          contentWidth,
          contentHeight,
          undefined,
          "FAST"
        );
      } else {
        const scaledWidth = (pageHeight - marginMm * 2) / aspectRatio;
        const xOffset = (pageWidth - scaledWidth) / 2;
        pdf.addImage(
          dataUrl,
          "PNG",
          xOffset,
          marginMm,
          scaledWidth,
          pageHeight - marginMm * 2,
          undefined,
          "FAST"
        );
      }

      pageAdded++;
    }

    if (pageAdded === 0) return false;

    pdf.save(filename);
    return true;
  } catch (err) {
    console.error("[PDF Generator] Failed to generate multi-page PDF:", err);
    return false;
  }
}

export interface PrintIsolatedOptions {
  title?: string;
  paperSize?: "hpc" | "5.5x8.27" | "a4" | "A4" | "thermal" | "80mm" | string; // Default: "5.5in 8.27in"
  margin?: string; // Optional custom margin
}

/**
 * Prints a specific DOM element cleanly via the dedicated #hpc-print-root mount point.
 * Dynamically provisions exact CSS @page rules for A4 clinical sheets, 80mm thermal POS slips,
 * or standard 5.5" x 8.27" HPC paper Wi-Fi printers.
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

  const { title = "Print Document", paperSize = "5.5x8.27" } = options;

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

  // 4. Inject dynamic @page styling matching the requested hardware paper geometry
  const normalizedSize = (paperSize || "").toLowerCase();
  const isA4 = normalizedSize === "a4";
  const isThermal = normalizedSize === "thermal" || normalizedSize === "80mm";

  let dynamicStyle = document.getElementById(
    "hpc-dynamic-print-style"
  ) as HTMLStyleElement | null;
  if (!dynamicStyle) {
    dynamicStyle = document.createElement("style");
    dynamicStyle.id = "hpc-dynamic-print-style";
    document.head.appendChild(dynamicStyle);
  }

  if (isA4) {
    dynamicStyle.textContent = `
      @media print {
        @page {
          size: A4 portrait !important;
          margin: 8mm !important;
        }
        html, body {
          width: 100% !important;
          height: auto !important;
          min-height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        #hpc-print-root,
        .print-document-container {
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          min-height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
        }
        #hpc-print-root > div,
        .print-document-container > div {
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          min-height: calc(297mm - 20mm) !important;
          border: 1.5px solid #000000 !important;
          padding: 6mm !important;
          box-sizing: border-box !important;
        }
      }
    `;
  } else if (isThermal) {
    dynamicStyle.textContent = `
      @media print {
        @page {
          size: 80mm auto !important;
          margin: 2mm !important;
        }
        html, body {
          width: 80mm !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        #hpc-print-root,
        .print-document-container {
          width: 76mm !important;
          max-width: 76mm !important;
          height: auto !important;
          min-height: auto !important;
          margin: 0 auto !important;
          padding: 0 !important;
          border: none !important;
        }
        #hpc-print-root > div,
        .print-document-container > div {
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          min-height: auto !important;
          border: 1px dashed #64748b !important;
          padding: 2.5mm !important;
          box-sizing: border-box !important;
          justify-content: flex-start !important;
        }
      }
    `;
  } else {
    dynamicStyle.textContent = `
      @media print {
        @page {
          size: 5.5in 8.27in !important;
          margin: 0 !important;
        }
        #hpc-print-root,
        .print-document-container {
          width: 5.5in !important;
          height: 8.27in !important;
          max-width: 5.5in !important;
          min-height: 8.27in !important;
          margin: 0 auto !important;
          padding: 0.18in !important;
          border: none !important;
        }
        #hpc-print-root > div,
        .print-document-container > div {
          width: 100% !important;
          max-width: none !important;
          height: 100% !important;
          min-height: calc(8.27in - 0.36in) !important;
          border: 1.5px solid #000000 !important;
          padding: 0.16in !important;
          box-sizing: border-box !important;
        }
      }
    `;
  }

  // 5. Setup cleanup listener that cleans up once print dialog finishes
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
    const injectedStyle = document.getElementById("hpc-dynamic-print-style");
    if (injectedStyle) {
      injectedStyle.remove();
    }
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);

  // 6. Trigger print cleanly on the next animation frame after DOM commitment
  requestAnimationFrame(() => {
    try {
      window.print();
    } catch (e) {
      console.error("[Print Isolated] Print execution error:", e);
      cleanup();
    }
  });
}
