// Excel support: read an uploaded lease register, and write the template and the report.

import readXlsxFile from "read-excel-file/browser";
import writeXlsxFile, { type Cell, type SheetData } from "write-excel-file/browser";
import { downloadText, parseCsv, toCsv } from "./csv";
import { yearJournals, type LeaseResult, type Model } from "./ifrs16";
import { leasesToCsvRows, TEMPLATE_CSV, type UploadedFile } from "./importer";

const isoDate = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/** The first sheet with data rows (skipping instruction sheets) as CSV text */
export async function readWorkbook(file: File): Promise<UploadedFile | null> {
  const sheets = await readXlsxFile(file);
  const sheet = sheets.find((s) => !/^(instructions|read ?me|notes?)$/i.test(s.sheet.trim()) && s.data.length > 1);
  if (!sheet) return null;
  return { name: `${file.name} · ${sheet.sheet}`, text: toCsv(sheet.data.map((row) => row.map((v) => (v instanceof Date ? isoDate(v) : v === null ? "" : String(v))))) };
}

const header = (v: string): Cell => ({ value: v, fontWeight: "bold", backgroundColor: "#F4F4F5", borderStyle: "thin", borderColor: "#D4D4D8" });
const amt = (n: number, bold = false): Cell => ({ value: Math.round(n * 100) / 100, type: Number, format: "#,##0.00;(#,##0.00);-", ...(bold ? { fontWeight: "bold" as const } : {}) });
const dt = (iso: string): Cell => ({ value: new Date(iso + "T00:00:00Z"), type: Date, format: "dd mmm yyyy" });
const DATE_COLS = /date/i;
const NUM_COLS = /months|payment|pct|costs|incentives|cost|guarantee|option/i;

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const INSTRUCTIONS = [
  ["IFRS 16 lease calculator: lease register template"],
  [""],
  ["Fill in one row per lease on the Leases sheet (the example rows are the sample portfolio; overwrite or delete them), save, then upload on the calculator."],
  [""],
  ["Column", "What to enter"],
  ["lease_name", "A short name for the lease"],
  ["asset_class", "Aircraft, Property, Vehicles, Equipment or Other"],
  ["commencement_date", "Date the asset is available for use (the commencement date)"],
  ["term_months", "Lease term in months, including extension options reasonably certain to be exercised"],
  ["payment", "Payment per period in the first year, excluding VAT/GST"],
  ["frequency", "monthly, quarterly, semi-annual or annual"],
  ["timing", "advance (start of each period) or arrears (end of each period)"],
  ["escalation_pct", "Fixed % increase every 12 months (0 if none)"],
  ["discount_rate_pct", "Rate implicit in the lease, or your incremental borrowing rate, % a year (e.g. 7.5)"],
  ["initial_direct_costs", "Costs of obtaining the lease, added to the right-of-use asset"],
  ["lease_incentives", "Incentives received at commencement, deducted from the asset"],
  ["restoration_cost", "Present value of dismantling, restoration or redelivery costs"],
  ["residual_value_guarantee", "Amount expected to be payable under a residual value guarantee"],
  ["purchase_option", "Exercise price, only if reasonably certain to be exercised"],
  ["useful_life_months", "Useful life of the asset, used for depreciation when the purchase option applies"],
  ["exemption", "none, short-term (12 months or less) or low-value"],
  [""],
  ["Your data stays on your computer: the calculator works entirely in your browser."]
];

export async function downloadTemplateWorkbook() {
  const rows = parseCsv(TEMPLATE_CSV);
  const head = rows[0];
  await writeXlsxFile([
    { sheet: "Instructions", data: INSTRUCTIONS.map((r, i) => r.map((v): Cell => (i === 0 || i === 4 ? { value: v, fontWeight: "bold" } : v))), columns: [{ width: 26 }, { width: 100 }] },
    {
      sheet: "Leases",
      data: [
        head.map(header),
        ...rows.slice(1).map((r) =>
          r.map((v, i): Cell => {
            if (DATE_COLS.test(head[i]) && v) return { value: new Date(v + "T00:00:00Z"), type: Date, format: "yyyy-mm-dd" };
            if (NUM_COLS.test(head[i]) && v !== "") return { value: Number(v), type: Number };
            return v;
          })
        )
      ],
      columns: head.map((h) => ({ width: h === "lease_name" ? 36 : Math.max(12, h.length + 2) })),
      stickyRowsCount: 1
    }
  ]).toFile("ifrs16-lease-register-template.xlsx");
}

export const downloadTemplateCsv = () => downloadText("ifrs16-lease-register-template.csv", TEMPLATE_CSV);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const sheetName = (s: string, used: Set<string>) => {
  let base = s.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim();
  let name = base;
  for (let n = 2; used.has(name); n++) name = `${base.slice(0, 25)} ${n}`;
  used.add(name);
  return name;
};

function scheduleSheet(r: LeaseResult): SheetData {
  return [
    [{ value: r.lease.name, fontWeight: "bold", fontSize: 13 }],
    [`Liability at commencement`, amt(r.pvOfPayments), "", "Right-of-use asset", amt(r.initialRou)],
    [],
    ["Month", "Date", "Opening liability", "Interest", "Payment", "Closing liability", "Depreciation", "Closing ROU asset"].map(header),
    ...r.rows.map((x): Cell[] => [x.month, dt(x.date), amt(x.openingLiability), amt(x.interest), amt(x.payment), amt(x.closingLiability), amt(x.depreciation), amt(x.closingRou)])
  ];
}

export async function downloadReportWorkbook(m: Model) {
  const { disclosure: d, fy, portfolio } = m;
  const cur = portfolio.currency;
  const summary: SheetData = [
    [{ value: `IFRS 16 lease disclosures, ${fy.label}`, fontWeight: "bold", fontSize: 14 }],
    ["Company", portfolio.company],
    ["Year", `${fy.start} to ${fy.end}`],
    ["Currency", cur],
    [],
    [header("Lease liabilities"), header(cur)],
    ["Opening", amt(d.liability.opening)],
    ["New leases", amt(d.liability.additions)],
    ["Interest", amt(d.liability.interest)],
    ["Lease payments", amt(-d.liability.payments)],
    ["Closing", amt(d.liability.closing, true)],
    ["  Current", amt(d.liability.current)],
    ["  Non-current", amt(d.liability.nonCurrent)],
    [],
    [header("Right-of-use assets"), ...d.rouByClass.map((c) => header(c.assetClass)), header("Total")],
    ["Opening", ...d.rouByClass.map((c) => amt(c.opening)), amt(d.rou.opening, true)],
    ["Additions", ...d.rouByClass.map((c) => amt(c.additions)), amt(d.rou.additions, true)],
    ["Depreciation", ...d.rouByClass.map((c) => amt(-c.depreciation)), amt(-d.rou.depreciation, true)],
    ["Closing", ...d.rouByClass.map((c) => amt(c.closing)), amt(d.rou.closing, true)],
    [],
    [header("Profit or loss"), header(cur)],
    ["Depreciation of right-of-use assets", amt(d.pnl.depreciation)],
    ["Interest on lease liabilities", amt(d.pnl.interest)],
    ["Short-term and low-value lease expense", amt(d.pnl.exemptExpense)],
    ["Total", amt(d.pnl.total, true)],
    [],
    [header("Cash outflow"), header(cur)],
    ["Principal elements of lease payments", amt(d.cashFlow.principal)],
    ["Payments at commencement", amt(d.cashFlow.atCommencement)],
    ["Interest paid", amt(d.cashFlow.interest)],
    ["Short-term and low-value lease payments", amt(d.cashFlow.exempt)],
    ["Total", amt(d.cashFlow.total, true)],
    [],
    [header("Maturity analysis (undiscounted)"), header(cur)],
    ...d.maturity.map((x): Cell[] => [x.bucket, amt(x.amount)]),
    ["Total", amt(d.maturity.reduce((t, x) => t + x.amount, 0), true)]
  ];

  const status = new Map(d.perLease.map((p) => [p.id, p]));
  const [regHead, ...regRows] = leasesToCsvRows(portfolio.leases);
  const register: SheetData = [
    [...regHead.map(String), "liability_at_commencement", "rou_at_commencement", `liability_${fy.end}`, `rou_${fy.end}`, "status"].map(header),
    ...regRows.map((row, i): Cell[] => {
      const r = m.results[i];
      const p = status.get(r.lease.id)!;
      return [...row.map((v) => (v === "" ? null : v)), amt(r.pvOfPayments), amt(r.initialRou), amt(p.closingLiability), amt(p.closingRou), p.status];
    })
  ];

  const journals: SheetData = [["Lease", "Date", "Description", "Account", "Debit", "Credit"].map(header)];
  for (const r of m.results) {
    for (const j of yearJournals(r, fy)) {
      for (const l of j.lines) journals.push([r.lease.name, dt(j.date), j.description, l.account, l.debit ? amt(l.debit) : null, l.credit ? amt(l.credit) : null]);
    }
  }

  const used = new Set(["Disclosures", "Register", "Journals"]);
  await writeXlsxFile([
    { sheet: "Disclosures", data: summary, columns: [{ width: 40 }, ...Array.from({ length: 6 }, () => ({ width: 16 }))] },
    { sheet: "Register", data: register, columns: register[0].map((_, i) => ({ width: i === 0 ? 34 : 16 })), stickyRowsCount: 1 },
    { sheet: "Journals", data: journals, columns: [{ width: 34 }, { width: 13 }, { width: 44 }, { width: 44 }, { width: 15 }, { width: 15 }], stickyRowsCount: 1 },
    ...m.results.filter((r) => !r.exempt).map((r) => ({ sheet: sheetName(r.lease.name, used), data: scheduleSheet(r), columns: [{ width: 8 }, { width: 13 }, ...Array.from({ length: 6 }, () => ({ width: 17 }))], stickyRowsCount: 4 }))
  ]).toFile(`ifrs16-leases-${fy.label}.xlsx`);
}

export function downloadScheduleCsv(r: LeaseResult) {
  const rows = [
    ["Month", "Date", "Opening liability", "Interest", "Payment", "Closing liability", "Depreciation", "Closing ROU asset"],
    ...r.rows.map((x) => [x.month, x.date, x.openingLiability.toFixed(2), x.interest.toFixed(2), x.payment.toFixed(2), x.closingLiability.toFixed(2), x.depreciation.toFixed(2), x.closingRou.toFixed(2)])
  ];
  downloadText(`${r.lease.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-schedule.csv`, toCsv(rows));
}

export const downloadRegisterCsv = (m: Model) => downloadText("lease-register.csv", toCsv(leasesToCsvRows(m.portfolio.leases)));
