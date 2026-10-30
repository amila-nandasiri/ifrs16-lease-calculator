// Reads a lease register from CSV (or an Excel sheet converted to CSV): one row per lease.
// Column names, frequencies and dates are matched loosely.

import sampleCsv from "../../data/leases.csv?raw";
import { parseCsv } from "./csv";
import { ASSET_CLASSES, type Exemption, type Frequency, type Lease, type Portfolio, type Timing } from "./ifrs16";

export type UploadedFile = { name: string; text: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function parseNumber(raw: string | undefined): number | null {
  let v = (raw ?? "").trim();
  if (!v || v === "-") return null;
  let negative = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  v = v.replace(/[^0-9.\-]/g, "");
  if (!v || v === "-" || v === ".") return null;
  const n = Number(v);
  return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** ISO, day-first numeric (01/04/2026), "1-Apr-2026", or an Excel serial date */
export function parseDate(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  const iso = (y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
  };
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return +m[2] > 12 ? iso(+m[3], +m[1], +m[2]) : iso(+m[3], +m[2], +m[1]);
  m = v.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s,-]+(\d{2,4})$/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return iso(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  if (/^\d{5}$/.test(v) && +v > 20000 && +v < 80000) return new Date(Date.UTC(1899, 11, 30) + +v * 86_400_000).toISOString().slice(0, 10);
  return null;
}

const COLUMNS: Record<string, string[]> = {
  name: ["leasename", "lease", "name", "description", "asset", "assetdescription"],
  assetClass: ["assetclass", "class", "category", "assettype", "type"],
  commencement: ["commencementdate", "commencement", "startdate", "start", "leasestart"],
  term: ["termmonths", "leasetermmonths", "term", "months", "leaseterm"],
  payment: ["payment", "paymentamount", "rent", "leasepayment", "amount", "installment", "instalment"],
  frequency: ["frequency", "paymentfrequency", "period"],
  timing: ["timing", "paymenttiming", "advancearrears", "paidin"],
  escalation: ["escalationpct", "escalation", "annualincrease", "increasepct", "indexation"],
  rate: ["discountratepct", "discountrate", "ibr", "incrementalborrowingrate", "rate", "interestrate"],
  idc: ["initialdirectcosts", "idc", "directcosts"],
  incentives: ["leaseincentives", "incentives", "incentive"],
  restoration: ["restorationcost", "restoration", "dismantling", "redeliverycost", "makegood"],
  rvg: ["residualvalueguarantee", "rvg", "residualguarantee"],
  purchase: ["purchaseoption", "purchaseprice", "option"],
  life: ["usefullifemonths", "usefullife", "life"],
  exemption: ["exemption", "exempt", "recognitionexemption"]
};

function frequencyOf(v: string): Frequency {
  const t = v.toLowerCase();
  if (/quart|^q/.test(t)) return "quarterly";
  if (/semi|half|bi-?ann|6/.test(t)) return "semi-annual";
  if (/annual|year|^y/.test(t)) return "annual";
  return "monthly";
}

const timingOf = (v: string): Timing => (/arrear|end/i.test(v) ? "arrears" : "advance");

function exemptionOf(v: string): Exemption {
  if (/short/i.test(v)) return "short-term";
  if (/low/i.test(v)) return "low-value";
  return "none";
}

function classOf(v: string): string {
  const match = ASSET_CLASSES.find((c) => c.toLowerCase() === v.trim().toLowerCase());
  if (match) return match;
  if (/aircraft|plane|aviation|helicopter/i.test(v)) return "Aircraft";
  if (/property|building|office|land|warehouse|hangar|premises|real estate/i.test(v)) return "Property";
  if (/vehicle|car|truck|van|bus|boat|vessel/i.test(v)) return "Vehicles";
  if (/equip|machin|plant|\bit\b|computer|laptop/i.test(v)) return "Equipment";
  return v.trim() || "Other";
}

let idCounter = 0;
export const newId = () => `L${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export type ImportResult = { ok: true; leases: Lease[]; notes: string[] } | { ok: false; errors: string[] };

export function importLeases(text: string, fileName = "file"): ImportResult {
  const [headers = [], ...rows] = parseCsv(text);
  const hn = headers.map(norm);
  const col = (k: keyof typeof COLUMNS) => {
    for (const c of COLUMNS[k]) {
      const i = hn.indexOf(c);
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = Object.fromEntries(Object.keys(COLUMNS).map((k) => [k, col(k as keyof typeof COLUMNS)])) as Record<keyof typeof COLUMNS, number>;
  const missing = (["commencement", "term", "payment", "rate"] as const).filter((k) => idx[k] < 0);
  if (missing.length) return { ok: false, errors: [`"${fileName}" is missing columns for: ${missing.join(", ")}. Found: ${headers.join(", ")}.`] };

  const leases: Lease[] = [];
  const notes: string[] = [];
  rows.forEach((r, n) => {
    const get = (k: keyof typeof COLUMNS) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");
    const num = (k: keyof typeof COLUMNS) => parseNumber(get(k)) ?? 0;
    const commencement = parseDate(get("commencement"));
    const term = parseNumber(get("term"));
    const payment = parseNumber(get("payment"));
    const rate = parseNumber(get("rate"));
    if (!commencement || !term || term <= 0 || payment === null || rate === null) {
      notes.push(`Row ${n + 2} skipped: commencement date, term, payment or discount rate is missing or unreadable.`);
      return;
    }
    const life = parseNumber(get("life"));
    leases.push({
      id: newId(),
      name: get("name") || `Lease ${n + 1}`,
      assetClass: classOf(get("assetClass") || get("name")),
      commencement,
      termMonths: Math.round(term),
      payment,
      frequency: frequencyOf(get("frequency")),
      timing: timingOf(get("timing")),
      escalationPct: num("escalation"),
      ratePct: rate < 1 && rate > 0 ? rate * 100 : rate, // accept 0.075 as 7.5%
      initialDirectCosts: num("idc"),
      incentives: num("incentives"),
      restorationCost: num("restoration"),
      residualGuarantee: num("rvg"),
      purchaseOption: num("purchase"),
      usefulLifeMonths: life && life > 0 ? Math.round(life) : null,
      exemption: exemptionOf(get("exemption"))
    });
  });
  if (!leases.length) return { ok: false, errors: [`No usable leases in "${fileName}".`, ...notes] };
  notes.unshift(`${leases.length} leases read from "${fileName}".`);
  const shortTerm = leases.filter((l) => l.termMonths <= 12 && l.exemption === "none");
  if (shortTerm.length) notes.push(`${shortTerm.length} lease(s) have a term of 12 months or less and could use the short-term exemption: ${shortTerm.map((l) => l.name).join(", ")}.`);
  return { ok: true, leases, notes };
}

export function samplePortfolio(): Portfolio {
  const r = importLeases(sampleCsv, "leases.csv");
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return { company: "Maldives seaplane operator (fictional)", currency: "USD", yearEndMonth: 12, leases: r.leases };
}

export const TEMPLATE_CSV = sampleCsv;

export function leasesToCsvRows(leases: Lease[]): (string | number)[][] {
  return [
    ["lease_name", "asset_class", "commencement_date", "term_months", "payment", "frequency", "timing", "escalation_pct", "discount_rate_pct", "initial_direct_costs", "lease_incentives", "restoration_cost", "residual_value_guarantee", "purchase_option", "useful_life_months", "exemption"],
    ...leases.map((l) => [l.name, l.assetClass, l.commencement, l.termMonths, l.payment, l.frequency, l.timing, l.escalationPct, l.ratePct, l.initialDirectCosts, l.incentives, l.restorationCost, l.residualGuarantee, l.purchaseOption, l.usefulLifeMonths ?? "", l.exemption])
  ];
}
