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
  "nav.serials": { en: "Daily Serials", bn: "দৈনিক সিরিয়াল" },
  "nav.patients": { en: "Patients Directory", bn: "রোগীদের তালিকা" },
  "nav.ledger": { en: "Cash Ledger", bn: "ক্যাশ লেজার" },
  "nav.chambers": { en: "Chambers & Bays", bn: "কক্ষ ও চেম্বার" },
  "nav.slot_matrix": {
    en: "Slot Schedule Matrix",
    bn: "স্লট শিডিউল ম্যাট্রিক্স",
  },
  "nav.kiosk": { en: "Live Waiting Kiosk", bn: "লাইভ ওয়েটিং কিয়স্ক" },
  "nav.profile": { en: "My Profile", bn: "আমার প্রোফাইল" },
  "nav.users": { en: "Staff & User Access", bn: "স্টাফ ও ইউজার এক্সেস" },
  "nav.sessions": { en: "Active Sessions", bn: "সক্রিয় লগইন সেশন" },
  "nav.logs": { en: "Security Audit Logs", bn: "সিকিউরিটি অডিট লগ" },
  "nav.packages": { en: "21-30 Day Packages", bn: "২১-৩০ দিনের প্যাকেজ" },
  "nav.slots": { en: "Booking Slots & Serials", bn: "বুকিং স্লট ও সিরিয়াল" },
  "nav.system_command": {
    en: "System Command Center",
    bn: "সিস্টেম কমান্ড সেন্টার",
  },
  "nav.front_desk": {
    en: "Front Desk & Reception",
    bn: "ফ্রন্ট ডেস্ক ও রিসেপশন",
  },
  "nav.doctor_hub": {
    en: "Doctor Clinical Workstation",
    bn: "ডাক্তার ক্লিনিক্যাল হাব",
  },
  "nav.handler_hub": {
    en: "Care Handler Execution Hub",
    bn: "কেয়ার হ্যান্ডলার এক্সিকিউশন হাব",
  },

  // Receptionist Metrics & Labels
  "rec.scheduled_today": { en: "Scheduled Today", bn: "আজকের নির্ধারিত" },
  "rec.waiting_room": { en: "Waiting Room", bn: "ওয়েটিং রুম" },
  "rec.completed_today": { en: "Completed Today", bn: "আজ সম্পন্ন" },
  "rec.cash_collection": {
    en: "Cash Collection (BST)",
    bn: "ক্যাশ জমা (বিএসটি)",
  },
  "rec.total_registered": { en: "Total Serials", bn: "মোট সিরিয়াল" },
  "rec.search_placeholder": {
    en: "Search ID, Name, Phone...",
    bn: "আইডি, নাম, ফোন দিয়ে খুঁজুন...",
  },
  "rec.new_patient": { en: "New Patient", bn: "নতুন রোগী নিবন্ধন" },
  "rec.checkin_pay": { en: "Check-In & Pay", bn: "চেক-ইন ও পেমেন্ট" },
  "rec.send_doctor": { en: "Send to Doctor", bn: "ডাক্তার চেম্বারে পাঠান" },
  "rec.send_therapy": { en: "Send to Therapy", bn: "থেরাপিতে পাঠান" },

  // Table Columns
  "col.serial": { en: "Serial", bn: "সিরিয়াল" },
  "col.date": { en: "Date", bn: "তারিখ" },
  "col.patient_details": { en: "Patient Details", bn: "রোগীর বিবরণ" },
  "col.phone": { en: "Phone Number", bn: "ফোন নম্বর" },
  "col.told_time": { en: "Told Time", bn: "নির্ধারিত সময়" },
  "col.arrival_status": { en: "Arrival & Status", bn: "উপস্থিতি ও অবস্থা" },
  "col.billing_payment": { en: "Billing & Payment", bn: "বিল ও পেমেন্ট" },
  "col.queue_status": { en: "Queue Status", bn: "সিরিয়াল অবস্থা" },
  "col.action": { en: "Action", bn: "কার্যক্রম" },
  "col.chamber_bay": { en: "Chamber & Bay", bn: "কক্ষ ও চেম্বার" },
  "col.time_token": { en: "Time & Token", bn: "সময় ও টোকেন" },
  "col.service_modality": { en: "Service / Modality", bn: "সেবা ও থেরাপি" },
  "col.actual_bill": { en: "Actual Bill", bn: "নির্ধারিত বিল" },
  "col.cash_received": { en: "Cash Received", bn: "প্রাপ্ত ক্যাশ" },
  "col.due_status": { en: "Due / N.P Status", bn: "বকেয়া / এন.পি" },
  "col.cashier": { en: "Cashier", bn: "ক্যাশিয়ার" },
  "col.ceo_audit": { en: "CEO Audit Status", bn: "সিইও অডিট অবস্থা" },

  // Buttons & Actions
  "btn.book_serial": { en: "Book New Serial", bn: "নতুন সিরিয়াল বুক করুন" },
  "btn.checkin": { en: "Check-In & Payment", bn: "চেক-ইন ও পেমেন্ট" },
  "btn.confirm": { en: "Confirm", bn: "নিশ্চিত করুন" },
  "btn.cancel": { en: "Cancel", bn: "বাতিল" },
  "btn.save": { en: "Save Changes", bn: "সংরক্ষণ করুন" },
  "btn.refresh": { en: "Refresh", bn: "রিফ্রেশ" },
  "btn.delete": { en: "Delete", bn: "মুছে ফেলুন" },
  "btn.edit": { en: "Edit", bn: "সম্পাদনা" },
  "btn.create_room": { en: "Add Chamber / Room", bn: "নতুন চেম্বার যোগ করুন" },
  "btn.create_slot": { en: "Add Booking Slot", bn: "নতুন বুকিং স্লট যোগ করুন" },
  "btn.create_package": {
    en: "Create 21-30 Day Package",
    bn: "নতুন ২১-৩০ দিনের প্যাকেজ",
  },
  "btn.add_staff": { en: "Add Staff Member", bn: "নতুন স্টাফ অ্যাকাউন্ট" },
  "btn.free_room": { en: "Free Room", bn: "রুম খালি করুন" },
  "btn.view_all": { en: "View All", bn: "সব দেখুন" },
  "btn.close": { en: "Close", bn: "বন্ধ করুন" },

  // Statuses & Badges
  "status.waiting": { en: "Waiting", bn: "অপেক্ষমান" },
  "status.in_consultation": {
    en: "In Doctor Chamber",
    bn: "ডাক্তারের চেম্বারে",
  },
  "status.in_therapy": { en: "In Therapy Session", bn: "থেরাপি চলছে" },
  "status.completed": { en: "Completed", bn: "সম্পন্ন" },
  "status.vacant": { en: "Vacant", bn: "ফাঁকা" },
  "status.occupied": { en: "Occupied", bn: "ব্যস্ত" },
  "status.staff_only": { en: "Staff Only", bn: "স্টাফ অনলি" },
  "status.active": { en: "Active", bn: "সক্রিয়" },
  "status.inactive": { en: "Inactive", bn: "নিষ্ক্রিয়" },
  "status.on_time": { en: "On-Time", bn: "সময়মত" },
  "status.late": { en: "Late", bn: "দেরি" },
  "status.np": { en: "Non-Payment (N.P)", bn: "পেমেন্ট ছাড়া (এন.পি)" },
  "status.paid": { en: "Paid in Cash", bn: "নগদ পরিশোধ" },

  // Doctor Hub
  "doc.active_in_chamber": {
    en: "Currently In Chamber",
    bn: "বর্তমানে চেম্বারে উপস্থিত",
  },
  "doc.send_handler": { en: "Send to Handler", bn: "হ্যান্ডলারের কাছে পাঠান" },
  "doc.exam_form": { en: "Clinical Exam Form", bn: "ক্লিনিক্যাল এক্সাম ফর্ম" },
  "doc.complete_visit": { en: "Complete Visit", bn: "ভিজিট সম্পন্ন করুন" },
  "doc.chief_complaint": { en: "Chief Complaint", bn: "প্রধান সমস্যা ও লক্ষণ" },
  "doc.modalities": {
    en: "Prescribed Modalities",
    bn: "নির্ধারিত ফিজিওথেরাপি পদ্ধতি",
  },

  // Care Handler Hub
  "handler.assigned": { en: "Assigned Patients", bn: "বরাদ্দকৃত রোগী" },
  "handler.active_therapy": { en: "Active In Therapy", bn: "থেরাপিরত রোগী" },
  "handler.start_therapy": { en: "Start Therapy", bn: "থেরাপি শুরু করুন" },
  "handler.end_therapy": { en: "End Therapy", bn: "থেরাপি শেষ করুন" },
  "handler.log_session": { en: "Log Session", bn: "সেশন লিপিবদ্ধ করুন" },

  // Room Management
  "room.total_chambers": { en: "Total Chambers", bn: "মোট চেম্বার" },
  "room.total_beds": { en: "Total Clinic Beds", bn: "মোট ক্লিনিক বেড" },
  "room.vacant_rooms": { en: "Vacant Rooms", bn: "খালি চেম্বার" },
  "room.occupied_rooms": { en: "Occupied Rooms", bn: "ব্যস্ত চেম্বার" },
  "room.bed_capacity": { en: "Bed Capacity", bn: "বেড ধারণক্ষমতা" },
  "room.gender_filter": { en: "Gender Preference", bn: "লিঙ্গ অগ্রাধিকার" },

  // Patient Registration & Fields
  "patient.register_title": {
    en: "Register New Patient",
    bn: "নতুন রোগী নিবন্ধন",
  },
  "patient.register_desc": {
    en: "Fill in required patient credentials to generate physical card & profile.",
    bn: "শারীরিক কার্ড ও প্রোফাইল তৈরির জন্য প্রয়োজনীয় তথ্য পূরণ করুন।",
  },
  "patient.id": { en: "Patient 5-Digit ID", bn: "রোগীর ৫-সংখ্যার আইডি" },
  "patient.name": { en: "Full Name", bn: "পূর্ণ নাম" },
  "patient.phone": { en: "Phone Number", bn: "ফোন নম্বর" },
  "patient.age": { en: "Age", bn: "বয়স" },
  "patient.gender": { en: "Gender", bn: "লিঙ্গ" },
  "patient.address": { en: "Address / Location", bn: "ঠিকানা / এলাকা" },
  "patient.occupation": { en: "Occupation", bn: "পেশা" },
  "patient.notes": {
    en: "Clinical Remarks / Notes",
    bn: "ক্লিনিক্যাল মন্তব্য / নোট",
  },
  "patient.auto_generate": { en: "Auto Generate", bn: "অটো তৈরি করুন" },
  "patient.save_proceed": {
    en: "Save & Proceed to Booking",
    bn: "সংরক্ষণ ও বুকিংয়ে যান",
  },

  // Serial Booking Dialog
  "booking.schedule_title": {
    en: "Schedule Patient Serial",
    bn: "সিরিয়াল বুকিং করুন",
  },
  "booking.schedule_desc": {
    en: "Set appointment date and promised arrival time.",
    bn: "অ্যাপয়েন্টমেন্টের তারিখ এবং আসার নির্ধারিত সময় নির্ধারণ করুন।",
  },
  "booking.date": { en: "Appointment Date", bn: "অ্যাপয়েন্টমেন্টের তারিখ" },
  "booking.purpose": {
    en: "Visit Purpose / Type",
    bn: "ভিজিটের উদ্দেশ্য / ধরন",
  },
  "booking.time_slot": {
    en: "Appointment Time Slot",
    bn: "অ্যাপয়েন্টমেন্টের সময় স্লট",
  },
  "booking.assigned_room": {
    en: "Assigned Room / Therapy Bay",
    bn: "বরাদ্দকৃত চেম্বার / থেরাপি বে",
  },
  "booking.desk_remarks": { en: "Desk Remarks", bn: "ডেস্কের মন্তব্য" },
  "booking.report_session": {
    en: "Report Review Session (রিপোর্ট)",
    bn: "রিপোর্ট পর্যালোচনা সেশন",
  },
  "booking.confirm": {
    en: "Confirm Serial Booking",
    bn: "সিরিয়াল বুকিং নিশ্চিত করুন",
  },

  // Physical Arrival & Payment Dialog
  "checkin.title": {
    en: "Record Arrival & Payment",
    bn: "উপস্থিতি ও পেমেন্ট রেকর্ড",
  },
  "checkin.desc": {
    en: "Stamps patient check-in time and records payment.",
    bn: "রোগীর চেক-ইন সময় ও পেমেন্ট রেকর্ড করুন।",
  },
  "checkin.payment_collection": {
    en: "Payment Collection",
    bn: "পেমেন্ট গ্রহণ",
  },
  "checkin.amount": { en: "Amount (৳)", bn: "টাকার পরিমাণ (৳)" },
  "checkin.method": { en: "Payment Method", bn: "পেমেন্ট মাধ্যম" },
  "checkin.mark_np": {
    en: "Mark as N.P (No Payment Made)",
    bn: "এন.পি হিসেবে চিহ্নিত করুন (পেমেন্ট ছাড়া)",
  },
  "checkin.np_desc": {
    en: "Check this if patient is on a complimentary visit, package, or pending dues.",
    bn: "রোগী প্যাকেজ বা বকেয়ায় থাকলে এটি টিক দিন।",
  },
  "checkin.confirm": {
    en: "Confirm Arrival & Save",
    bn: "উপস্থিতি নিশ্চিত ও সংরক্ষণ",
  },

  // Gender & Visit Types
  "gender.male": { en: "Male (পুরুষ)", bn: "পুরুষ" },
  "gender.female": { en: "Female (মহিলা)", bn: "মহিলা" },
  "visit.new_consultation": {
    en: "New Consultation (নতুন ভিজিট)",
    bn: "নতুন ভিজিট",
  },
  "visit.follow_up": {
    en: "Follow-up Therapy (চলমান থেরাপি)",
    bn: "চলমান থেরাপি",
  },
  "visit.report_review": {
    en: "Report Review (রিপোর্ট পর্যালোচনা)",
    bn: "রিপোর্ট পর্যালোচনা",
  },
  "visit.therapy_procedure": {
    en: "Therapy Procedure (থেরাপি পদ্ধতি)",
    bn: "থেরাপি পদ্ধতি",
  },
  "visit.emergency": { en: "Emergency (জরুরী)", bn: "জরুরী" },
  "payment.cash": { en: "Cash (নগদ)", bn: "নগদ" },
  "payment.mobile": { en: "bKash / Nagad / Rocket", bn: "বিকাশ / নগদ / রকেট" },
  "payment.card": { en: "Card (কার্ড)", bn: "কার্ড" },
  "payment.other": { en: "Other (অন্যান্য)", bn: "অন্যান্য" },
};

const I18nContext = React.createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

function subscribeToLangChanges(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("hpc_lang_change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("hpc_lang_change", callback);
  };
}

function getLangSnapshot(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem("hpc_lang");
    if (saved === "en" || saved === "bn") return saved;
  } catch {
    // ignore
  }
  return "en";
}

function getLangServerSnapshot(): Language {
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = React.useSyncExternalStore(
    subscribeToLangChanges,
    getLangSnapshot,
    getLangServerSnapshot,
  );

  const setLang = React.useCallback((newLang: Language) => {
    try {
      localStorage.setItem("hpc_lang", newLang);
      document.cookie = `hpc_lang=${newLang}; path=/; max-age=31536000`;
      window.dispatchEvent(new Event("hpc_lang_change"));
    } catch {
      // ignore
    }
  }, []);

  const t = React.useCallback(
    (key: string, fallback?: string) => {
      const item = translations[key];
      if (item) {
        return item[lang] || fallback || item.en;
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

export function useLanguage() {
  return React.useContext(I18nContext);
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      suppressHydrationWarning
      className={`inline-flex items-center rounded-lg bg-muted/60 p-0.5 border border-border text-[11px] font-bold ${className}`}
    >
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => setLang("en")}
        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
          lang === "en"
            ? "bg-card text-foreground shadow-xs font-black"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => setLang("bn")}
        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
          lang === "bn"
            ? "bg-card text-foreground shadow-xs font-black"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        বাংলা
      </button>
    </div>
  );
}
