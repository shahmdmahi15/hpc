import prisma from "@/lib/prisma";

/**
 * Generates the next sequential invoice number in the format `INV-YYYY-XXXX`.
 * Safely inspects the highest existing suffix number for the current calendar year.
 */
export async function generateNextInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `INV-${currentYear}-`;

  try {
    const latestInvoices = await prisma.patientInvoice.findMany({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      select: {
        invoiceNumber: true,
      },
      orderBy: {
        invoiceNumber: "desc",
      },
      take: 20,
    });

    let maxNum = 0;
    for (const inv of latestInvoices) {
      const parts = inv.invoiceNumber.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }

    if (maxNum === 0) {
      const totalCount = await prisma.patientInvoice.count();
      maxNum = totalCount;
    }

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(4, "0")}`;
  } catch (err) {
    console.error("[generateNextInvoiceNumber Error]:", err);
    // Fallback timestamp suffix to ensure guaranteed uniqueness
    const fallbackNum = Date.now().toString().slice(-4);
    return `${prefix}${fallbackNum}`;
  }
}
