"use client";

import * as React from "react";

export type Language = "en" | "bn";

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const translations: Record<string, { en: string; bn: string }> = {
  // Navigation & Common Headers
  "nav.dashboard": { en: "Dashboard", bn: "ড্যাশবোর্ড" },
  "nav.profile": { en: "My Profile", bn: "আমার প্রোফাইল" },
  "nav.users": { en: "User Management", bn: "ব্যবহারকারী ব্যবস্থাপনা" },
  "nav.sessions": { en: "Active Sessions", bn: "সক্রিয় লগইন সেশন" },
  "nav.logs": { en: "Security Audit Logs", bn: "সিকিউরিটি অডিট লগ" },
  "nav.system_command": {
    en: "System Command Center",
    bn: "সিস্টেম কমান্ড সেন্টার",
  },
  "header.waiting_room": {
    en: "Waiting Room Display",
    bn: "ওয়েটিং রুম ডিসপ্লে",
  },
  "header.fullscreen": {
    en: "Toggle Fullscreen",
    bn: "ফুলস্ক্রিন মোড",
  },
  "header.operational": {
    en: "Operational",
    bn: "সিস্টেম সচল",
  },
  "header.back_login": {
    en: "Back to Login Portal",
    bn: "লগইন পোর্টালে ফিরুন",
  },

  // Buttons & Actions
  "btn.confirm": { en: "Confirm", bn: "নিশ্চিত করুন" },
  "btn.cancel": { en: "Cancel", bn: "বাতিল" },
  "btn.save": { en: "Save Changes", bn: "সংরক্ষণ করুন" },
  "btn.refresh": { en: "Refresh", bn: "রিফ্রেশ" },
  "btn.delete": { en: "Delete", bn: "মুছে ফেলুন" },
  "btn.edit": { en: "Edit", bn: "সম্পাদনা" },
  "btn.add_staff": { en: "Add User", bn: "নতুন ব্যবহারকারী" },
  "btn.view_all": { en: "View All", bn: "সব দেখুন" },
  "btn.close": { en: "Close", bn: "বন্ধ করুন" },
  "btn.print": { en: "Print", bn: "প্রিন্ট করুন" },
  "btn.export": { en: "Export", bn: "এক্সপোর্ট" },
  "btn.back": { en: "Back", bn: "ফিরে যান" },
  "btn.next": { en: "Next", bn: "পরবর্তী" },
  "btn.submit": { en: "Submit", bn: "জমা দিন" },

  // Statuses & Badges
  "status.active": { en: "Active", bn: "সক্রিয়" },
  "status.inactive": { en: "Inactive", bn: "নিষ্ক্রিয়" },
  "status.success": { en: "Success", bn: "সফল" },
  "status.failure": { en: "Failure", bn: "ব্যর্থ" },
  "status.pending": { en: "Pending", bn: "বকেয়া / অপেক্ষমান" },
  "status.paid": { en: "Paid", bn: "পরিশোধিত" },
  "status.calling": { en: "Calling", bn: "ডাকা হচ্ছে" },
  "status.checked_in": { en: "Waiting", bn: "অপেক্ষমান" },
  "status.in_consultation": { en: "In Consultation", bn: "পরামর্শ নিচ্ছেন" },
  "status.in_therapy": { en: "In Therapy", bn: "থেরাপি চলছে" },
  "status.completed": { en: "Completed", bn: "সম্পন্ন" },
  "status.cancelled": { en: "Cancelled", bn: "বাতিল" },

  // User Management
  "user.total_staff": { en: "Total Users", bn: "মোট ব্যবহারকারী" },
  "user.administrators": { en: "Administrators", bn: "অ্যাডমিনিস্ট্রেটর" },
  "user.create_new": { en: "Create New User", bn: "নতুন ব্যবহারকারী তৈরি" },
  "user.reset_password": { en: "Reset Password", bn: "পাসওয়ার্ড রিসেট" },
  "user.revoke_sessions": {
    en: "Revoke Active Sessions",
    bn: "সক্রিয় সেশন বাতিল করুন",
  },
  "user.delete_user": { en: "Delete Account", bn: "অ্যাকাউন্ট মুছুন" },

  // Active Sessions
  "session.total_active": {
    en: "Active Logged-in Devices",
    bn: "সক্রিয় লগইন ডিভাইস",
  },
  "session.revoke_all": {
    en: "Terminate All Other Sessions",
    bn: "অন্য সকল সেশন বন্ধ করুন",
  },
  "session.current": { en: "Current Session", bn: "বর্তমান সেশন" },
  "session.terminate": { en: "Terminate", bn: "টার্মিনেট করুন" },

  // Audit Logs
  "audit.immutable_trail": {
    en: "Immutable Security Audit Trail",
    bn: "অপরিবর্তনীয় সিকিউরিটি অডিট ট্রেল",
  },
  "audit.filter_all": { en: "All Events", bn: "সকল ইভেন্ট" },
  "audit.inspect": { en: "Inspect Record", bn: "রেকর্ড পরিদর্শন" },

  // Login & Authentication Portal
  "login.title": {
    en: "Staff Authentication Portal",
    bn: "স্টাফ অথেনটিকেশন পোর্টাল",
  },
  "login.subtitle": {
    en: "Select your departmental role and enter your security credential",
    bn: "আপনার ডিপার্টমেন্টাল রোল নির্বাচন করুন এবং সিকিউরিটি পাসওয়ার্ড লিখুন",
  },
  "login.badge": {
    en: "Encrypted Database Security",
    bn: "এনক্রিপ্টেড ডাটাবেস সিকিউরিটি",
  },
  "login.select_role": {
    en: "Select Department / Role",
    bn: "ডিপার্টমেন্ট / রোল নির্বাচন করুন",
  },
  "login.required": { en: "required", bn: "আবশ্যক" },
  "login.password": { en: "Security Password", bn: "সিকিউরিটি পাসওয়ার্ড" },
  "login.password_placeholder": {
    en: "Enter authorized password...",
    bn: "অনুমোদিত পাসওয়ার্ড লিখুন...",
  },
  "login.password_min": {
    en: "min 6 characters",
    bn: "কমপক্ষে ৬ অক্ষর",
  },
  "login.caps_lock": {
    en: "Caps Lock is ON",
    bn: "ক্যাপস লক চালু আছে",
  },
  "login.authenticating": {
    en: "Authenticating Session...",
    bn: "সেশন যাচাই করা হচ্ছে...",
  },
  "login.signin_as": { en: "Sign In as", bn: "লগইন করুন:" },
  "login.footer": {
    en: "Health And Pain Care Center • Encrypted Session Security",
    bn: "হেলথ অ্যান্ড পেইন কেয়ার সেন্টার • এনক্রিপ্টেড সেশন সিকিউরিটি",
  },
  "login.hero_title": {
    en: "Enterprise Clinical & Staff Access",
    bn: "এন্টারপ্রাইজ ক্লিনিক্যাল ও স্টাফ এক্সেস",
  },
  "login.hero_subtitle": {
    en: "High-performance clinic operations, authenticated device sessions, and role-based access security.",
    bn: "উচ্চ ক্ষমতার ক্লিনিক অপারেশন, সিকিউর ডিভাইস সেশন এবং রোল-ভিত্তিক এক্সেস সিকিউরিটি।",
  },
  "login.feature_argon": {
    en: "Argon2id Memory-Hard Cryptographic Hashing",
    bn: "Argon2id মেমরি-হার্ড ক্রিপ্টোগ্রাফিক হ্যাশিং",
  },
  "login.feature_session": {
    en: "Database-backed SHA-256 Session Tokens",
    bn: "ডাটাবেস সমর্থিত SHA-256 সেশন সিকিউরিটি",
  },
  "login.feature_rbac": {
    en: "Role-Based Access Control (5 Departments)",
    bn: "রোল-ভিত্তিক এক্সেস কন্ট্রোল (৫টি বিভাগ)",
  },
  "login.feature_audit": {
    en: "Real-Time Immutable Audit Logging",
    bn: "রিয়েল-টাইম অপরিবর্তনীয় অডিট লগিং",
  },

  // Roles in i18n
  "role.admin": { en: "Administrator", bn: "অ্যাডমিনিস্ট্রেটর" },
  "role.admin_desc": {
    en: "System ops, audit logs, and security controls",
    bn: "সিস্টেম অপারেশন, অডিট লগ ও সিকিউরিটি",
  },
  "role.doctor": { en: "Doctor", bn: "ডাক্তার" },
  "role.doctor_desc": {
    en: "Diagnostic plans and clinical doctor portal",
    bn: "ডায়াগনস্টিক ও ক্লিনিক্যাল ডাক্তার পোর্টাল",
  },
  "role.receptionist": {
    en: "Receptionist",
    bn: "রিসেপশনিস্ট",
  },
  "role.receptionist_desc": {
    en: "Client check-in, intake, and scheduling",
    bn: "রোগী চেক-ইন, বুকিং ও ফ্রন্ট ডেস্ক",
  },
  "role.handler": {
    en: "Handler",
    bn: "হ্যান্ডলার",
  },
  "role.handler_desc": {
    en: "Triage care, therapy, and mobility support",
    bn: "কেয়ার ট্রায়াজ, থেরাপি ও সহায়তা",
  },
  "role.cashier": {
    en: "Cashier",
    bn: "ক্যাশিয়ার",
  },
  "role.cashier_desc": {
    en: "Billing records, receipts, and cash register",
    bn: "বিলিং রেকর্ড, রিসিপ্ট ও ক্যাশ রেজিস্টার",
  },

  // Waiting Room Live Queue View
  "waiting_room.title": {
    en: "Waiting Hall Live Queue",
    bn: "ওয়েটিং রুম লাইভ সিরিয়াল বোর্ড",
  },
  "waiting_room.subtitle": {
    en: "Real-time checked-in patient queue board with arrival punctuality indicators.",
    bn: "রিয়েল-টাইম উপস্থিত রোগীর সিরিয়াল ও আগমন মনিটরিং বোর্ড।",
  },
  "waiting_room.token": { en: "Token No.", bn: "টোকেন নং" },
  "waiting_room.patient": { en: "Patient Name", bn: "রোগীর নাম" },
  "waiting_room.status": { en: "Current Status", bn: "বর্তমান অবস্থা" },
  "waiting_room.room": { en: "Room / Chamber", bn: "রুম / চেম্বার" },
  "waiting_room.doctor": { en: "Attending Doctor", bn: "দায়িত্বরত চিকিৎসক" },
  "waiting_room.dept": { en: "Department", bn: "বিভাগ" },
  "waiting_room.all": { en: "All Departments", bn: "সকল বিভাগ" },
  "waiting_room.consultation": { en: "Doctor Consultation", bn: "ডাক্তার কনসাল্টেশন" },
  "waiting_room.therapy": { en: "Therapy Floor", bn: "থেরাপি ফ্লোর" },
  "waiting_room.empty": {
    en: "No patients currently in this queue",
    bn: "এই মুহূর্তে কোনো রোগী সিরিয়ালে নেই",
  },
  "waiting_room.calling_now": { en: "Calling Now", bn: "এখন ডাকা হচ্ছে" },
  "waiting_room.in_service": { en: "In Consultation / Therapy", bn: "সেবা গ্রহণ করছেন" },
  "waiting_room.waiting_list": { en: "Waiting in Hall", bn: "ওয়েটিং হলে অপেক্ষমান" },
  "waiting_room.bilingual": { en: "Bilingual (EN + BN)", bn: "দ্বিভাষিক (ইংরেজি + বাংলা)" },
  "waiting_room.en_only": { en: "English Voice", bn: "ইংরেজি ভয়েস" },
  "waiting_room.bn_only": { en: "Bangla Voice", bn: "বাংলা ভয়েস" },
  "waiting_room.sound_on": { en: "Announcements On", bn: "ভয়েস ঘোষণা চালু" },
  "waiting_room.sound_off": { en: "Announcements Muted", bn: "ভয়েস ঘোষণা বন্ধ" },
  "waiting_room.auto_refresh": { en: "Auto-refresh in", bn: "অটো-রিফ্রেশ হতে বাকি" },

  // Common Fields & Terms
  "common.token": { en: "Token", bn: "টোকেন" },
  "common.patient": { en: "Patient", bn: "রোগী" },
  "common.age": { en: "Age", bn: "বয়স" },
  "common.years": { en: "years", bn: "বছর" },
  "common.gender": { en: "Gender", bn: "লিঙ্গ" },
  "common.male": { en: "Male", bn: "পুরুষ" },
  "common.female": { en: "Female", bn: "মহিলা" },
  "common.other": { en: "Other", bn: "অন্যান্য" },
  "common.phone": { en: "Phone Number", bn: "ফোন নম্বর" },
  "common.date": { en: "Date", bn: "তারিখ" },
  "common.time": { en: "Time", bn: "সময়" },
  "common.actions": { en: "Actions", bn: "পদক্ষেপ" },
  "common.search": { en: "Search patients, tokens...", bn: "রোগী বা টোকেন খুঁজুন..." },
  "common.filter": { en: "Filter", bn: "ফিল্টার" },
  "common.all": { en: "All", bn: "সকল" },
  "common.save": { en: "Save", bn: "সংরক্ষণ" },
  "common.cancel": { en: "Cancel", bn: "বাতিল" },
  "common.confirm": { en: "Confirm", bn: "নিশ্চিত করুন" },
  "common.close": { en: "Close", bn: "বন্ধ করুন" },
  "common.print": { en: "Print", bn: "প্রিন্ট" },
  "common.loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
  "common.no_records": { en: "No records found", bn: "কোনো তথ্য পাওয়া যায়নি" },
  "common.performer": { en: "Station Performer", bn: "কাউন্টার পারফর্মার" },
  "common.enter_pin": { en: "Enter 4-digit PIN", bn: "৪-সংখ্যার পিন লিখুন" },

  // Receptionist Desk
  "reception.title": { en: "Reception Desk & Intake Counter", bn: "রিসেপশন ও রোগী বুকিং কাউন্টার" },
  "reception.book_ticket": { en: "Book Therapy Ticket", bn: "থেরাপি টিকিট বুকিং" },
  "reception.walk_in": { en: "Walk-in Consultation", bn: "জরুরি কনসাল্টেশন টিকিট" },
  "reception.new_patient": { en: "Register New Patient", bn: "নতুন রোগী নিবন্ধন" },
  "reception.active_queue": { en: "Today's Patient Queue", bn: "আজকের রোগী সিরিয়াল" },
  "reception.check_in_btn": { en: "Check In", bn: "চেক-ইন করুন" },
  "reception.checked_in": { en: "Checked In", bn: "চেক-ইন সম্পন্ন" },
  "reception.cancel_ticket": { en: "Cancel Ticket", bn: "টিকিট বাতিল" },
  "reception.print_ticket": { en: "Print Ticket", bn: "টিকিট প্রিন্ট" },

  // Doctor Desk
  "doctor.title": { en: "Doctor Consultation Chamber", bn: "ডাক্তার কনসাল্টেশন চেম্বার" },
  "doctor.call_next": { en: "Call Next Patient", bn: "পরবর্তী রোগী ডাকুন" },
  "doctor.calling_chamber": { en: "Call to Chamber", bn: "চেম্বারে ডাকুন" },
  "doctor.start_consultation": { en: "Start Consultation", bn: "পরামর্শ শুরু করুন" },
  "doctor.route_therapy": { en: "Route to Therapy", bn: "থেরাপির জন্য পাঠান" },
  "doctor.route_cashier": { en: "Send to Cashier", bn: "ক্যাশিয়ারে পাঠান" },
  "doctor.complete": { en: "Complete Visit", bn: "ভিজিট সমাপ্ত" },
  "doctor.prescribe": { en: "Prescription & Plan", bn: "প্রেসক্রিপশন ও প্ল্যান" },
  "doctor.medical_history": { en: "Medical History", bn: "চিকিৎসা ইতিহাস" },
  "doctor.adjust_fee": { en: "Update Fee", bn: "ফি নির্ধারণ" },
  "doctor.chamber_num": { en: "Chamber", bn: "চেম্বার" },

  // Cashier Desk
  "cashier.title": { en: "Cashier & Billing Desk", bn: "ক্যাশিয়ার ও বিলিং কাউন্টার" },
  "cashier.collect_payment": { en: "Collect Payment", bn: "পেমেন্ট গ্রহণ" },
  "cashier.gross_fee": { en: "Gross Fee", bn: "মোট ফি" },
  "cashier.paid_amount": { en: "Paid Amount", bn: "পরিশোধিত টাকা" },
  "cashier.due_balance": { en: "Due Balance", bn: "বকেয়া টাকা" },
  "cashier.payment_method": { en: "Payment Method", bn: "পেমেন্ট মাধ্যম" },
  "cashier.cash": { en: "Cash", bn: "নগদ টাকা" },
  "cashier.card": { en: "Card", bn: "কার্ড" },
  "cashier.bkash": { en: "bKash", bn: "বিকাশ" },
  "cashier.nagad": { en: "Nagad", bn: "নগদ (Nagad)" },
  "cashier.rocket": { en: "Rocket", bn: "রকেট" },
  "cashier.print_receipt": { en: "Print Money Receipt", bn: "মানি রিসিপ্ট প্রিন্ট" },
  "cashier.checkout_complete": { en: "Payment Successful", bn: "পেমেন্ট সফলভাবে গৃহীত" },
  "cashier.total_bill": { en: "Total Bill", bn: "সর্বমোট বিল" },

  // Handler Desk
  "handler.title": { en: "Therapy Floor & Bed Allocation", bn: "থেরাপি ফ্লোর ও বেড বরাদ্দ" },
  "handler.call_patient": { en: "Call to Therapy Bed", bn: "বেডে ডাকুন" },
  "handler.start_therapy": { en: "Start Therapy", bn: "থেরাপি শুরু করুন" },
  "handler.complete_therapy": { en: "Complete Therapy", bn: "থেরাপি সমাপ্ত করুন" },
  "handler.bed_room": { en: "Bed / Room", bn: "বেড / রুম" },
  "handler.slots": { en: "Therapy Slots", bn: "থেরাপি স্লটসমূহ" },

  // Admin Desk
  "admin.title": { en: "System Command & Clinical Operations", bn: "সিস্টেম কমান্ড ও ক্লিনিক্যাল অপারেশন" },
  "admin.export_reports": { en: "Export Clinical & Financial Reports", bn: "ক্লিনিক্যাল ও ফাইন্যান্সিয়াল রিপোর্ট এক্সপোর্ট" },
  "admin.export_desc": { en: "Download consolidated Excel (.xlsx) and CSV reports", bn: "এক্সেল (.xlsx) ও সিএসভি আকারে সম্পূর্ণ রিপোর্ট ডাউনলোড করুন" },
  "admin.rooms": { en: "Room Management", bn: "রুম ব্যবস্থাপনা" },
  "admin.slots": { en: "Slot Management", bn: "স্লট ব্যবস্থাপনা" },
  "admin.users": { en: "Staff & User Accounts", bn: "স্টাফ ও ইউজার অ্যাকাউন্ট" },
  "admin.audit": { en: "Security Audit Trail", bn: "সিকিউরিটি অডিট ট্রেল" },
  "admin.daily_closing": { en: "Daily Register Closing", bn: "দৈনিক হিসাব রেজিস্টার ক্লোজিং" },
};

function getClientLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem("hpc_lang") as Language;
    if (saved === "en" || saved === "bn") return saved;
  } catch {
    // Ignore localStorage errors
  }
  return "en";
}

function getServerLanguage(): Language {
  return "en";
}

function subscribeLanguageChange(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("hpc_lang_change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("hpc_lang_change", callback);
  };
}

const I18nContext = React.createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = React.useSyncExternalStore(
    subscribeLanguageChange,
    getClientLanguage,
    getServerLanguage,
  );

  const setLang = React.useCallback((newLang: Language) => {
    try {
      localStorage.setItem("hpc_lang", newLang);
      window.dispatchEvent(new Event("hpc_lang_change"));
    } catch {
      // Ignore
    }
  }, []);

  const t = React.useCallback(
    (key: string, fallback?: string) => {
      const entry = translations[key];
      if (entry && entry[lang]) {
        return entry[lang];
      }
      return fallback || key;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return React.useContext(I18nContext);
}

export function formatNumberByLang(num: number | string | null | undefined, lang: Language): string {
  if (num === null || num === undefined) return "";
  if (lang !== "bn") return String(num);
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num).replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
}

export function formatDateByLang(date: Date | string, lang: Language): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return typeof date === "string" ? date : "";
  if (lang === "bn") {
    return d.toLocaleDateString("bn-BD", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs font-medium select-none ${className || ""}`}
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        title="Switch to English"
        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
          lang === "en"
            ? "bg-background text-foreground shadow-xs font-bold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("bn")}
        title="বাংলা ভাষায় পরিবর্তন করুন"
        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
          lang === "bn"
            ? "bg-background text-foreground shadow-xs font-bold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        বাং
      </button>
    </div>
  );
}
