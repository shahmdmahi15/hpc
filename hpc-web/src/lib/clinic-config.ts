/**
 * Health & Pain Care Center (HPC) - Central Clinic Configuration
 * Official address, contact details, branding and operational configuration.
 */

export const CLINIC_CONFIG = {
  name: "HEALTH & PAIN CARE CENTER",
  nameBangla: "হেলথ অ্যান্ড পেইন কেয়ার সেন্টার",
  tagline: "Center for Specialized Physical Therapy & Pain Rehabilitation",
  taglineBangla: "বিশেষায়িত ফিজিওথেরাপি ও পেইন রিহ্যাবিলিটেশন সেন্টার",
  shortName: "HPC",

  // Contact Details
  phone: "01822-000035",
  phoneFormatted: "01822-000035",
  phoneInternational: "+880 1822-000035",
  hotline: "01822-000035",
  email: "info@hpc-care.com",
  web: "www.hpc.care",

  // Location Details
  addressBangla: "চাঁচড়া ডালমিল (পুলিশ ফাঁড়ির বিপরীতে), সদর, যশোর-৭৪০০",
  addressEnglish: "Chanchra Dalmill (Opposite Police Outpost), Sadar, Jashore - 7400",
  fullLocation: "চাঁচড়া ডালমিল ( পুলিশ ফাঁড়ির বিপরিতে) সদর, যশোর।, Jessore, Bangladesh, 7400",
  city: "Jessore",
  country: "Bangladesh",
  postalCode: "7400",

  // Currency & Billing Defaults
  currencyCode: "BDT",
  currencySymbol: "৳",
  defaultConsultationFee: 1000,
  defaultTherapyFee: 500,
} as const;

export type ClinicConfig = typeof CLINIC_CONFIG;
