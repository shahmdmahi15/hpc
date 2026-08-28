/**
 * System-Wide Validation Utilities & Regex Patterns for Clinical Workflows
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// ----------------------------------------------------
// BANGLADESH PHONE NUMBER VALIDATION
// ----------------------------------------------------
export function validateBDPhoneNumber(phone: string): {
  isValid: boolean;
  message?: string;
} {
  const cleaned = phone.replace(/[\s\-+]/g, "");

  // Formats supported: 013XXXXXXXX, 014XXXXXXXX, 015XXXXXXXX, 016XXXXXXXX, 017XXXXXXXX, 018XXXXXXXX, 019XXXXXXXX
  // or with 880: 88017XXXXXXXX
  const bdPhoneRegex = /^(?:8801|01)[3-9]\d{8}$/;

  if (!cleaned) {
    return { isValid: false, message: "Phone number is required." };
  }

  if (cleaned.length < 11 || cleaned.length > 13) {
    return {
      isValid: false,
      message: "Phone number must be 11 digits (e.g. 01973-818213).",
    };
  }

  if (!bdPhoneRegex.test(cleaned)) {
    return {
      isValid: false,
      message:
        "Please enter a valid Bangladesh mobile operator number (e.g. 017, 019, 018, 016, 015, 013, 014).",
    };
  }

  return { isValid: true };
}

// ----------------------------------------------------
// PATIENT REGISTRATION VALIDATION
// ----------------------------------------------------
export function validatePatientForm(data: {
  patientId: string;
  name: string;
  phone: string;
  age?: number | string;
  gender?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.patientId || !data.patientId.trim()) {
    errors.patientId = "5-digit Patient ID is required (e.g. 10001).";
  } else if (!/^\d{5}$/.test(data.patientId.trim())) {
    errors.patientId =
      "Patient ID must be exactly 5 digits (e.g. 10001, 10002).";
  }

  if (!data.name || !data.name.trim()) {
    errors.name = "Patient full name is required.";
  } else if (data.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
  }

  const phoneRes = validateBDPhoneNumber(data.phone || "");
  if (!phoneRes.isValid && phoneRes.message) {
    errors.phone = phoneRes.message;
  }

  if (data.age !== undefined && data.age !== "") {
    const ageNum = Number(data.age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 125) {
      errors.age = "Please provide a valid age between 0 and 125.";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// ----------------------------------------------------
// SERIAL BOOKING VALIDATION
// ----------------------------------------------------
export function validateSerialBooking(data: {
  date: string;
  toldTime: string;
  roomNo?: string;
  patientId?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.date) {
    errors.date = "Appointment date is required.";
  }

  if (!data.toldTime) {
    errors.toldTime = "Promised arrival time is required.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// ----------------------------------------------------
// PAYMENT COLLECTION VALIDATION
// ----------------------------------------------------
export function validatePaymentInput(data: {
  paidAmount: number;
  actualBill?: number;
  isNoPayment?: boolean;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.isNoPayment) {
    if (isNaN(data.paidAmount) || data.paidAmount < 0) {
      errors.paidAmount = "Payment amount cannot be negative.";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
