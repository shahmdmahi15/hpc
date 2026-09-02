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

  // Statuses & Badges
  "status.active": { en: "Active", bn: "সক্রিয়" },
  "status.inactive": { en: "Inactive", bn: "নিষ্ক্রিয়" },
  "status.success": { en: "Success", bn: "সফল" },
  "status.failure": { en: "Failure", bn: "ব্যর্থ" },

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
  "role.doctor": { en: "Pain Care Specialist", bn: "পেইন কেয়ার বিশেষজ্ঞ" },
  "role.doctor_desc": {
    en: "Diagnostic plans and clinical doctor portal",
    bn: "ডায়াগনস্টিক ও ক্লিনিক্যাল ডাক্তার পোর্টাল",
  },
  "role.receptionist": {
    en: "Front Desk Reception",
    bn: "ফ্রন্ট ডেস্ক রিসেপশন",
  },
  "role.receptionist_desc": {
    en: "Client check-in, intake, and scheduling",
    bn: "রোগী চেক-ইন, বুকিং ও ফ্রন্ট ডেস্ক",
  },
  "role.handler": {
    en: "Therapy & Care Handler",
    bn: "কেয়ার হ্যান্ডলার",
  },
  "role.handler_desc": {
    en: "Triage care, therapy, and mobility support",
    bn: "কেয়ার ট্রায়াজ, থেরাপি ও সহায়তা",
  },
  "role.cashier": {
    en: "Cashier & Accounts",
    bn: "ক্যাশিয়ার ও অ্যাকাউন্টস",
  },
  "role.cashier_desc": {
    en: "Billing records, receipts, and cash register",
    bn: "বিলিং রেকর্ড, রিসিপ্ট ও ক্যাশ রেজিস্টার",
  },
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

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs font-medium ${className || ""}`}
    >
      <button
        type="button"
        onClick={() => setLang("en")}
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
