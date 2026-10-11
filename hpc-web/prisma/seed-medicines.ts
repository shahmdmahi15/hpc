import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export interface MedicineSeedResult {
  success: boolean;
  insertedGenerics: number;
  insertedBrands: number;
  totalInserted: number;
  totalInDatabase: number;
  durationMs: number;
  message: string;
}

export function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

export function extractGenericAndStrength(genericWithStrength: string): {
  generic: string;
  strength: string;
} {
  if (!genericWithStrength) return { generic: "", strength: "" };
  const trimmed = genericWithStrength.trim();
  const strengthMatch = trimmed.match(
    /(\d+(?:\.\d+)?\s*(?:mg(?:\/\d+\s*ml)?|mcg|gm|g|ml|l|%|iu|u|w\/v|w\/w)(?:\s*\+\s*\d+(?:\.\d+)?\s*(?:mg|mcg|gm|g|ml|l|%|iu|u))?)/i
  );
  if (strengthMatch) {
    const strength = strengthMatch[0].trim();
    const generic = trimmed.replace(strength, "").replace(/\+\s*$/, "").trim();
    return { generic: generic || trimmed, strength };
  }
  return { generic: trimmed, strength: "" };
}

export function getClinicalDefaults(genericName: string): {
  defaultMealTiming: "BEFORE" | "AFTER";
  defaultTimes: string[];
  defaultDuration: string;
  instructions: string | null;
} {
  const g = (genericName || "").toLowerCase();

  // 1. Anti-ulcerants / PPIs: Before meal
  if (
    g.includes("prazole") ||
    g.includes("omeprazole") ||
    g.includes("esomeprazole") ||
    g.includes("pantoprazole") ||
    g.includes("rabeprazole") ||
    g.includes("lansoprazole") ||
    g.includes("dexlansoprazole")
  ) {
    return {
      defaultMealTiming: "BEFORE",
      defaultTimes: ["MORNING", "NIGHT"],
      defaultDuration: "14 days",
      instructions: "Take 20-30 minutes before meal.",
    };
  }

  // 2. Neuropathic pain (Pregabalin, Gabapentin): Night dose
  if (g.includes("pregabalin") || g.includes("gabapentin")) {
    return {
      defaultMealTiming: "AFTER",
      defaultTimes: ["NIGHT"],
      defaultDuration: "14 days",
      instructions: "For radiating nerve pain. Take at bedtime.",
    };
  }

  // 3. Muscle relaxants (Tolperisone, Baclofen, Tizanidine): BID
  if (
    g.includes("tolperisone") ||
    g.includes("baclofen") ||
    g.includes("tizanidine") ||
    g.includes("chlorzoxazone")
  ) {
    return {
      defaultMealTiming: "AFTER",
      defaultTimes: ["MORNING", "NIGHT"],
      defaultDuration: "7 days",
      instructions: "Muscle relaxant, take after meal.",
    };
  }

  // 4. Strong NSAIDs (Aceclofenac, Naproxen, Etoricoxib, Ketorolac, Diclofenac): With food
  if (
    g.includes("aceclofenac") ||
    g.includes("naproxen") ||
    g.includes("etoricoxib") ||
    g.includes("ketorolac") ||
    g.includes("diclofenac") ||
    g.includes("ibuprofen") ||
    g.includes("indomethacin")
  ) {
    return {
      defaultMealTiming: "AFTER",
      defaultTimes: ["MORNING", "NIGHT"],
      defaultDuration: "7 days",
      instructions: "Take after full meal with plenty of water.",
    };
  }

  // 5. Paracetamol / Ace Plus: Pain/Fever
  if (g.includes("paracetamol") || g.includes("acetaminophen")) {
    return {
      defaultMealTiming: "AFTER",
      defaultTimes: ["MORNING", "AFTERNOON", "NIGHT"],
      defaultDuration: "5 days",
      instructions: "Take for pain/fever after meal as needed.",
    };
  }

  // 6. Calcium + Vitamin D / Neuro vitamins
  if (
    g.includes("calcium") ||
    g.includes("vitamin d") ||
    g.includes("methylcobalamin") ||
    g.includes("thiamine") ||
    g.includes("neuro")
  ) {
    return {
      defaultMealTiming: "AFTER",
      defaultTimes: ["MORNING"],
      defaultDuration: "30 days",
      instructions: "Take once daily after breakfast.",
    };
  }

  // 7. Topical gels & sprays
  if (g.includes("gel") || g.includes("spray") || g.includes("ointment") || g.includes("cream")) {
    return {
      defaultMealTiming: "AFTER",
      defaultTimes: ["MORNING", "NIGHT"],
      defaultDuration: "10 days",
      instructions: "Apply gently on affected painful area 2-3 times daily.",
    };
  }

  // Default Standard Rx
  return {
    defaultMealTiming: "AFTER",
    defaultTimes: ["MORNING", "NIGHT"],
    defaultDuration: "7 days",
    instructions: null,
  };
}

/**
 * High-performance seeder for DGDA Bangladesh national drug catalog.
 */
export function seedDgdaMedicines(
  dbPath: string,
  mode: "all" | "generics" | "brands" = "all"
): MedicineSeedResult {
  const startTime = Date.now();
  const db = new Database(dbPath, { timeout: 10000 });

  // Enable WAL and fast write optimizations
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
  } catch {}

  const dgdaCsvPath = path.resolve(process.cwd(), "prisma/dgda.csv");
  const expCsvPath = path.resolve(process.cwd(), "prisma/medicine_information_export.csv");

  let insertedGenerics = 0;
  let insertedBrands = 0;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO Medicine (
      id, name, genericName, strength, form, company,
      defaultMealTiming, defaultTimes, defaultDuration, instructions,
      isActive, "order", createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      1, ?, datetime('now'), datetime('now')
    )
  `);

  const runSeeding = db.transaction(() => {
    // --------------------------------------------------------
    // 1. DGDA Generics Library (dgda.csv)
    // --------------------------------------------------------
    if (mode === "all" || mode === "generics") {
      if (fs.existsSync(dgdaCsvPath)) {
        const dgdaContent = fs.readFileSync(dgdaCsvPath, "utf8");
        const dgdaLines = dgdaContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

        for (let i = 1; i < dgdaLines.length; i++) {
          const row = parseCSVLine(dgdaLines[i]);
          if (row.length < 4) continue;
          const generic = row[1]?.trim();
          const dosage = row[2]?.trim() || "Tablet";
          const strength = row[3]?.trim() || "";

          if (!generic) continue;

          let prefix = "Tab.";
          if (/capsule/i.test(dosage)) prefix = "Cap.";
          else if (/syrup/i.test(dosage)) prefix = "Syr.";
          else if (/suspension/i.test(dosage)) prefix = "Susp.";
          else if (/injection|infusion/i.test(dosage)) prefix = "Inj.";
          else if (/drop/i.test(dosage)) prefix = "Drop";
          else if (/cream|ointment|gel/i.test(dosage)) prefix = "Gel/Cream";
          else if (/suppository/i.test(dosage)) prefix = "Supp.";

          const name = `${prefix} ${generic} ${strength} (Generic)`.replace(/\s+/g, " ").trim();
          const clinical = getClinicalDefaults(generic);

          const res = insertStmt.run(
            `dgda_${i}`,
            name,
            generic,
            strength || null,
            dosage,
            "DGDA National Generic",
            clinical.defaultMealTiming,
            JSON.stringify(clinical.defaultTimes),
            clinical.defaultDuration,
            clinical.instructions,
            i
          );
          if (res.changes > 0) insertedGenerics++;
        }
      }
    }

    // --------------------------------------------------------
    // 2. Commercial Brands & Trade Formulations (export.csv)
    // --------------------------------------------------------
    if (mode === "all" || mode === "brands") {
      if (fs.existsSync(expCsvPath)) {
        const expContent = fs.readFileSync(expCsvPath, "utf8");
        const expLines = expContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const seenNames = new Set<string>();

        for (let i = 1; i < expLines.length; i++) {
          const row = parseCSVLine(expLines[i]);
          if (row.length < 5) continue;
          const sl = row[0]?.trim();
          const company = row[1]?.trim() || "Unknown Company";
          let tradeName = row[2]?.trim();
          const genericWithStrength = row[3]?.trim() || "";
          const dosageForm = row[4]?.trim() || "Tablet";
          const darNo = row[5]?.trim() || "";

          if (!tradeName) {
            tradeName = genericWithStrength || `Medicine-${sl || i}`;
          }

          const { generic, strength } = extractGenericAndStrength(genericWithStrength);

          let cleanName = tradeName;
          if (strength && !cleanName.toLowerCase().includes(strength.toLowerCase())) {
            cleanName = `${cleanName} ${strength}`;
          }
          if (dosageForm && !cleanName.toLowerCase().includes(dosageForm.toLowerCase())) {
            cleanName = `${cleanName} (${dosageForm})`;
          }

          const key = cleanName.toLowerCase();
          if (seenNames.has(key)) {
            const compShort = company.split(/,|\sPLC|\sLimited|\sLtd/)[0].trim();
            cleanName = `${cleanName} - ${compShort}`;
            const key2 = cleanName.toLowerCase();
            if (seenNames.has(key2)) {
              cleanName = `${cleanName} [${darNo || sl || i}]`;
            }
          }
          seenNames.add(cleanName.toLowerCase());

          const clinical = getClinicalDefaults(generic || genericWithStrength);

          const res = insertStmt.run(
            `exp_${sl || i}`,
            cleanName,
            generic || genericWithStrength || null,
            strength || null,
            dosageForm,
            company,
            clinical.defaultMealTiming,
            JSON.stringify(clinical.defaultTimes),
            clinical.defaultDuration,
            clinical.instructions,
            i + 5000
          );
          if (res.changes > 0) insertedBrands++;
        }
      }
    }
  });

  runSeeding();

  const totalInDb = (db.prepare("SELECT COUNT(*) as c FROM Medicine").get() as { c: number }).c;
  const durationMs = Date.now() - startTime;
  db.close();

  return {
    success: true,
    insertedGenerics,
    insertedBrands,
    totalInserted: insertedGenerics + insertedBrands,
    totalInDatabase: totalInDb,
    durationMs,
    message: `Successfully seeded ${insertedGenerics.toLocaleString()} Generics and ${insertedBrands.toLocaleString()} Commercial Brands (${(
      insertedGenerics + insertedBrands
    ).toLocaleString()} total) into Medicine Directory in ${(durationMs / 1000).toFixed(2)}s! Total directory size: ${totalInDb.toLocaleString()} medicines.`,
  };
}

// Direct CLI Execution
if (require.main === module) {
  const dbPath = path.resolve(process.cwd(), "hpc.db");
  console.log(`[DGDA Seeder CLI] Target Database: ${dbPath}`);
  const result = seedDgdaMedicines(dbPath, "all");
  console.log(`[DGDA Seeder CLI] ${result.message}`);
}
