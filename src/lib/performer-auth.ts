import prisma from "@/lib/prisma";

export interface VerifyPerformerPinResult {
  success: boolean;
  valid: boolean;
  error?: string;
  performer?: {
    id: string;
    name: string;
    email: string | null;
    whatsapp: string;
    phone: string | null;
  };
}

/**
 * Validates that the provided 4-digit PIN matches the performer's security PIN in the database.
 * Ensures zero impersonation between staff members sharing physical desk stations.
 */
export async function verifyPerformerPin(
  performerId: string | null | undefined,
  pin: string | null | undefined,
): Promise<VerifyPerformerPinResult> {
  if (!performerId) {
    return {
      success: false,
      valid: false,
      error: "You must select which staff member is authorizing this action.",
    };
  }

  const performer = await prisma.performer.findUnique({
    where: { id: performerId },
    select: {
      id: true,
      name: true,
      email: true,
      whatsapp: true,
      phone: true,
      pin: true,
    },
  });

  if (!performer) {
    return {
      success: false,
      valid: false,
      error: "The specified staff performer profile could not be found.",
    };
  }

  if (!pin || pin.trim().length === 0) {
    return {
      success: false,
      valid: false,
      error: `Security verification required. Please enter 4-digit PIN for ${performer.name}.`,
    };
  }

  const cleanPin = pin.trim();
  if (cleanPin !== performer.pin) {
    return {
      success: false,
      valid: false,
      error: `Invalid 4-digit PIN code entered for staff member ${performer.name}.`,
    };
  }

  return {
    success: true,
    valid: true,
    performer: {
      id: performer.id,
      name: performer.name,
      email: performer.email,
      whatsapp: performer.whatsapp,
      phone: performer.phone,
    },
  };
}
