// IFRS 16 lessee accounting: initial measurement, monthly amortisation and depreciation,
// and year-end disclosures across a portfolio of leases.
//
// Conventions
// - The annual discount rate (incremental borrowing rate) is an effective annual rate,
//   converted to a monthly rate: (1 + r)^(1/12) − 1. Interest accrues monthly.
// - Month m ends m months after commencement. Payments "in advance" fall at the start of
//   each payment period (the first at commencement); "in arrears" at the end.
// - Payments made at commencement are not part of the lease liability; they are added to
//   the right-of-use asset (IFRS 16.24(b)).
// - Fixed escalations step up every 12 months from commencement (IFRS 16.27(a)).
// - Residual value guarantees expected to be paid and purchase options reasonably certain
//   to be exercised are paid at the end of the term (IFRS 16.27(c)–(d)).
// - The right-of-use asset is depreciated straight-line over the lease term, or over the
//   asset's useful life when a purchase option is reasonably certain (IFRS 16.32).
// - Short-term and low-value leases can be exempted (IFRS 16.5–8): payments are expensed
//   straight-line and nothing is recognised on the balance sheet.

import { createContext, useContext } from "react";

export type Frequency = "monthly" | "quarterly" | "semi-annual" | "annual";
export type Timing = "advance" | "arrears";
export type Exemption = "none" | "short-term" | "low-value";

export const FREQUENCY_MONTHS: Record<Frequency, number> = { monthly: 1, quarterly: 3, "semi-annual": 6, annual: 12 };
export const ASSET_CLASSES = ["Aircraft", "Property", "Vehicles", "Equipment", "Other"] as const;

export type Lease = {
  id: string;
  name: string;
  assetClass: string;
  commencement: string; // ISO date
  termMonths: number;
  payment: number; // first-year payment per period
  frequency: Frequency;
  timing: Timing;
  escalationPct: number; // fixed increase every 12 months
  ratePct: number; // incremental borrowing rate, annual effective
  initialDirectCosts: number;
  incentives: number; // lease incentives received at commencement
  restorationCost: number; // present value of dismantling / restoration / redelivery costs
  residualGuarantee: number; // amount expected to be payable at end of term
  purchaseOption: number; // exercise price, if reasonably certain
  usefulLifeMonths: number | null; // used when a purchase option is reasonably certain
  exemption: Exemption;
};

export type ScheduleRow = {
  month: number; // 1..
  date: string; // end of the month (commencement + month months)
  openingLiability: number;
  interest: number;
  payment: number;
  closingLiability: number;
  depreciation: number;
  closingRou: number;
};

export type LeaseResult = {
  lease: Lease;
  exempt: boolean;
  monthlyRate: number;
  payments: { month: number; date: string; amount: number }[]; // all contractual cash flows, incl. at commencement
  paymentAtCommencement: number;
  pvOfPayments: number; // initial lease liability
  initialRou: number;
  depreciationMonths: number;
  rows: ScheduleRow[];
  totalPayments: number;
  totalInterest: number;
  endDate: string;
  straightLineMonthly: number; // what the expense would be as straight-line rent
};

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

const addDays = (iso: string, days: number) => new Date(Date.parse(iso + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// One lease
// ---------------------------------------------------------------------------

export function calculateLease(lease: Lease): LeaseResult {
  const T = Math.max(1, Math.round(lease.termMonths));
  const step = FREQUENCY_MONTHS[lease.frequency];
  const i = Math.pow(1 + lease.ratePct / 100, 1 / 12) - 1;
  const esc = lease.escalationPct / 100;

  // Contractual payments by month offset from commencement
  const byMonth = new Map<number, number>();
  const add = (k: number, amt: number) => amt && byMonth.set(k, (byMonth.get(k) ?? 0) + amt);
  for (let k = lease.timing === "advance" ? 0 : step; lease.timing === "advance" ? k < T : k <= T; k += step) {
    add(k, lease.payment * Math.pow(1 + esc, Math.floor((lease.timing === "advance" ? k : k - step) / 12)));
  }
  add(T, lease.residualGuarantee + lease.purchaseOption);
  const payments = [...byMonth.entries()].sort((a, b) => a[0] - b[0]).map(([month, amount]) => ({ month, date: addMonths(lease.commencement, month), amount }));
  const totalPayments = payments.reduce((t, p) => t + p.amount, 0);
  const regularTotal = totalPayments - lease.residualGuarantee - lease.purchaseOption;
  const straightLineMonthly = regularTotal / T;
  const endDate = addMonths(lease.commencement, T);

  const exempt = lease.exemption !== "none";
  if (exempt) {
    // Expensed straight-line; nothing on the balance sheet
    return {
      lease,
      exempt,
      monthlyRate: i,
      payments,
      paymentAtCommencement: 0,
      pvOfPayments: 0,
      initialRou: 0,
      depreciationMonths: T,
      rows: Array.from({ length: T }, (_, k) => ({
        month: k + 1,
        date: addMonths(lease.commencement, k + 1),
        openingLiability: 0,
        interest: 0,
        payment: (byMonth.get(k + 1) ?? 0) + (k === 0 ? (byMonth.get(0) ?? 0) : 0),
        closingLiability: 0,
        depreciation: 0,
        closingRou: 0
      })),
      totalPayments,
      totalInterest: 0,
      endDate,
      straightLineMonthly
    };
  }

  const paymentAtCommencement = byMonth.get(0) ?? 0;
  const pvOfPayments = payments.filter((p) => p.month > 0).reduce((t, p) => t + p.amount / Math.pow(1 + i, p.month), 0);
  const initialRou = pvOfPayments + paymentAtCommencement + lease.initialDirectCosts - lease.incentives + lease.restorationCost;
  const ownershipLikely = lease.purchaseOption > 0 && lease.usefulLifeMonths && lease.usefulLifeMonths > 0;
  const depreciationMonths = ownershipLikely ? Math.round(lease.usefulLifeMonths!) : T;

  const rows: ScheduleRow[] = [];
  let liability = pvOfPayments;
  let rou = initialRou;
  const monthlyDep = initialRou / depreciationMonths;
  let totalInterest = 0;
  for (let m = 1; m <= Math.max(T, depreciationMonths); m++) {
    const opening = liability;
    const interest = m <= T ? opening * i : 0;
    const payment = byMonth.get(m) ?? 0;
    liability = opening + interest - payment;
    if (Math.abs(liability) < 0.01) liability = 0; // clear floating-point dust once repaid
    const depreciation = m <= depreciationMonths ? monthlyDep : 0;
    rou = Math.max(0, rou - depreciation);
    totalInterest += interest;
    rows.push({ month: m, date: addMonths(lease.commencement, m), openingLiability: opening, interest, payment, closingLiability: liability, depreciation, closingRou: m === depreciationMonths ? 0 : rou });
  }

  return { lease, exempt, monthlyRate: i, payments, paymentAtCommencement, pvOfPayments, initialRou, depreciationMonths, rows, totalPayments, totalInterest, endDate, straightLineMonthly };
}

/** Balances at a date: zero before commencement, initial amounts on the commencement date */
export function balancesAt(r: LeaseResult, date: string) {
  if (r.exempt || date < r.lease.commencement) return { liability: 0, rou: 0 };
  let liability = r.pvOfPayments;
  let rou = r.initialRou;
  for (const row of r.rows) {
    if (row.date > date) break;
    liability = row.closingLiability;
    rou = row.closingRou;
  }
  return { liability, rou };
}

// ---------------------------------------------------------------------------
// Financial years and portfolio disclosures
// ---------------------------------------------------------------------------

export type FinancialYear = { label: string; start: string; end: string };

/** The financial year ending in `year`, with the year end in `endMonth` (1–12) */
export function financialYear(year: number, endMonth: number): FinancialYear {
  const end = new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10);
  const prevEnd = new Date(Date.UTC(year - 1, endMonth, 0)).toISOString().slice(0, 10);
  return { label: `FY${year}`, start: addDays(prevEnd, 1), end };
}

export const priorYearEnd = (fy: FinancialYear) => addDays(fy.start, -1);

export type Movement = { opening: number; additions: number; depreciation: number; interest: number; payments: number; closing: number };

export type Disclosure = {
  fy: FinancialYear;
  rouByClass: { assetClass: string; opening: number; additions: number; depreciation: number; closing: number }[];
  rou: Movement;
  liability: Movement & { current: number; nonCurrent: number };
  pnl: { depreciation: number; interest: number; exemptExpense: number; total: number; straightLine: number };
  cashFlow: { principal: number; interest: number; atCommencement: number; exempt: number; total: number };
  maturity: { bucket: string; amount: number }[];
  perLease: {
    id: string;
    name: string;
    assetClass: string;
    status: "Active" | "Not started" | "Ended" | "Exempt";
    openingLiability: number;
    closingLiability: number;
    current: number;
    closingRou: number;
    interest: number;
    depreciation: number;
    payments: number;
  }[];
};

const inFy = (fy: FinancialYear, date: string) => date >= fy.start && date <= fy.end;

export function disclose(results: LeaseResult[], fy: FinancialYear): Disclosure {
  const prevEnd = priorYearEnd(fy);
  const nextYearEnd = addMonths(fy.end, 12);
  const perLease: Disclosure["perLease"] = [];
  const classes = new Map<string, { opening: number; additions: number; depreciation: number; closing: number }>();
  const liability = { opening: 0, additions: 0, depreciation: 0, interest: 0, payments: 0, closing: 0, current: 0, nonCurrent: 0 };
  const rou = { opening: 0, additions: 0, depreciation: 0, interest: 0, payments: 0, closing: 0 };
  const pnl = { depreciation: 0, interest: 0, exemptExpense: 0, total: 0, straightLine: 0 };
  const cash = { principal: 0, interest: 0, atCommencement: 0, exempt: 0, total: 0 };
  const buckets = ["Within 1 year", "1–2 years", "2–3 years", "3–4 years", "4–5 years", "Over 5 years"];
  const maturity = buckets.map((bucket) => ({ bucket, amount: 0 }));

  for (const r of results) {
    const L = r.lease;
    const rowsInFy = r.rows.filter((row) => inFy(fy, row.date));
    const sum = (f: (row: ScheduleRow) => number) => rowsInFy.reduce((t, row) => t + f(row), 0);
    const starts = inFy(fy, L.commencement);
    const status: Disclosure["perLease"][number]["status"] = r.exempt ? "Exempt" : L.commencement > fy.end ? "Not started" : r.endDate <= prevEnd ? "Ended" : "Active";

    if (r.exempt) {
      // Short-term / low-value: expensed straight-line over the term (IFRS 16.6); cash as paid
      const expense = r.straightLineMonthly * r.rows.filter((row) => inFy(fy, row.date)).length;
      const paid = r.payments.filter((p) => inFy(fy, p.date)).reduce((t, p) => t + p.amount, 0);
      pnl.exemptExpense += expense;
      cash.exempt += paid;
      perLease.push({ id: L.id, name: L.name, assetClass: L.assetClass, status, openingLiability: 0, closingLiability: 0, current: 0, closingRou: 0, interest: 0, depreciation: 0, payments: paid });
      continue;
    }

    if (status === "Not started") {
      // Not yet recognised at the year end (a commitment, outside these balances)
      perLease.push({ id: L.id, name: L.name, assetClass: L.assetClass, status, openingLiability: 0, closingLiability: 0, current: 0, closingRou: 0, interest: 0, depreciation: 0, payments: 0 });
      continue;
    }

    const open = balancesAt(r, prevEnd);
    const close = balancesAt(r, fy.end);
    const later = balancesAt(r, nextYearEnd);
    const interest = sum((row) => row.interest);
    const depreciation = sum((row) => row.depreciation);
    const payments = sum((row) => row.payment);
    const atCommencement = starts ? r.paymentAtCommencement : 0;
    const current = close.liability - later.liability;

    liability.opening += open.liability;
    liability.additions += starts ? r.pvOfPayments : 0;
    liability.interest += interest;
    liability.payments += payments;
    liability.closing += close.liability;
    liability.current += current;
    rou.opening += open.rou;
    rou.additions += starts ? r.initialRou : 0;
    rou.depreciation += depreciation;
    rou.closing += close.rou;
    const c = classes.get(L.assetClass) ?? { opening: 0, additions: 0, depreciation: 0, closing: 0 };
    c.opening += open.rou;
    c.additions += starts ? r.initialRou : 0;
    c.depreciation += depreciation;
    c.closing += close.rou;
    classes.set(L.assetClass, c);

    pnl.depreciation += depreciation;
    pnl.interest += interest;
    pnl.straightLine += r.straightLineMonthly * rowsInFy.filter((row) => row.month <= L.termMonths).length;
    cash.interest += interest;
    cash.principal += payments - interest;
    cash.atCommencement += atCommencement;

    // Undiscounted cash flows after the year end (IFRS 16.58 / IFRS 7.39)
    for (const p of r.payments) {
      if (p.date <= fy.end) continue;
      const months = (Number(p.date.slice(0, 4)) - Number(fy.end.slice(0, 4))) * 12 + (Number(p.date.slice(5, 7)) - Number(fy.end.slice(5, 7)));
      const idx = Math.min(5, Math.max(0, Math.ceil(months / 12) - 1));
      maturity[idx].amount += p.amount;
    }

    perLease.push({ id: L.id, name: L.name, assetClass: L.assetClass, status, openingLiability: open.liability, closingLiability: close.liability, current, closingRou: close.rou, interest, depreciation, payments: payments + atCommencement });
  }

  liability.nonCurrent = liability.closing - liability.current;
  pnl.total = pnl.depreciation + pnl.interest + pnl.exemptExpense;
  pnl.straightLine += pnl.exemptExpense;
  cash.total = cash.principal + cash.interest + cash.atCommencement + cash.exempt;

  return {
    fy,
    rouByClass: [...classes.entries()].map(([assetClass, v]) => ({ assetClass, ...v })).filter((c) => Math.abs(c.opening) + Math.abs(c.closing) + Math.abs(c.additions) > 0.5),
    rou,
    liability,
    pnl,
    cashFlow: cash,
    maturity,
    perLease
  };
}

// ---------------------------------------------------------------------------
// Expense profile by year for one lease: IFRS 16 vs straight-line rent
// ---------------------------------------------------------------------------

export function expenseByYear(r: LeaseResult, endMonth: number) {
  const out: { label: string; depreciation: number; interest: number; total: number; straightLine: number }[] = [];
  const firstYear = Number(r.lease.commencement.slice(0, 4));
  const lastDate = r.rows[r.rows.length - 1]?.date ?? r.endDate;
  for (let y = firstYear; ; y++) {
    const fy = financialYear(y, endMonth);
    if (fy.start > lastDate) break;
    const rows = r.rows.filter((row) => inFy(fy, row.date));
    if (!rows.length) continue;
    const depreciation = rows.reduce((t, row) => t + row.depreciation, 0);
    const interest = rows.reduce((t, row) => t + row.interest, 0);
    const straightLine = r.straightLineMonthly * rows.filter((row) => row.month <= r.lease.termMonths).length;
    out.push({ label: fy.label, depreciation, interest, total: r.exempt ? straightLine : depreciation + interest, straightLine });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Journal entries
// ---------------------------------------------------------------------------

export type Journal = { date: string; description: string; lines: { account: string; debit: number; credit: number }[] };

export function commencementJournal(r: LeaseResult): Journal | null {
  if (r.exempt) return null;
  const L = r.lease;
  const lines: Journal["lines"] = [{ account: "Right-of-use asset", debit: r.initialRou, credit: 0 }];
  lines.push({ account: "Lease liability", debit: 0, credit: r.pvOfPayments });
  if (r.paymentAtCommencement) lines.push({ account: "Cash (first payment in advance)", debit: 0, credit: r.paymentAtCommencement });
  if (L.initialDirectCosts) lines.push({ account: "Cash (initial direct costs)", debit: 0, credit: L.initialDirectCosts });
  if (L.incentives) lines.push({ account: "Cash (lease incentive received)", debit: L.incentives, credit: 0 });
  if (L.restorationCost) lines.push({ account: "Provision for restoration", debit: 0, credit: L.restorationCost });
  return { date: L.commencement, description: `Initial recognition: ${L.name}`, lines };
}

export function yearJournals(r: LeaseResult, fy: FinancialYear): Journal[] {
  if (r.exempt) {
    // Straight-line expense; any difference to cash paid sits in accruals or prepayments
    const expense = r.straightLineMonthly * r.rows.filter((row) => inFy(fy, row.date)).length;
    const paid = r.payments.filter((p) => inFy(fy, p.date)).reduce((t, p) => t + p.amount, 0);
    if (!expense && !paid) return [];
    const diff = expense - paid;
    const lines: Journal["lines"] = [
      { account: "Lease expense (short-term / low-value)", debit: expense, credit: 0 },
      { account: "Cash", debit: 0, credit: paid }
    ];
    if (Math.abs(diff) > 0.5) lines.push(diff > 0 ? { account: "Accruals", debit: 0, credit: diff } : { account: "Prepayments", debit: -diff, credit: 0 });
    return [{ date: fy.end, description: `Exempt lease expense, ${fy.label}`, lines }];
  }
  const rows = r.rows.filter((row) => inFy(fy, row.date));
  const interest = rows.reduce((t, row) => t + row.interest, 0);
  const payments = rows.reduce((t, row) => t + row.payment, 0);
  const dep = rows.reduce((t, row) => t + row.depreciation, 0);
  const out: Journal[] = [];
  const c = inFy(fy, r.lease.commencement) ? commencementJournal(r) : null;
  if (c) out.push(c);
  if (interest) out.push({ date: fy.end, description: `Interest on lease liability, ${fy.label}`, lines: [{ account: "Interest expense", debit: interest, credit: 0 }, { account: "Lease liability", debit: 0, credit: interest }] });
  if (payments) out.push({ date: fy.end, description: `Lease payments, ${fy.label}`, lines: [{ account: "Lease liability", debit: payments, credit: 0 }, { account: "Cash", debit: 0, credit: payments }] });
  if (dep) out.push({ date: fy.end, description: `Depreciation of right-of-use asset, ${fy.label}`, lines: [{ account: "Depreciation expense", debit: dep, credit: 0 }, { account: "Accumulated depreciation, right-of-use asset", debit: 0, credit: dep }] });
  return out;
}

// ---------------------------------------------------------------------------
// App state shared with components
// ---------------------------------------------------------------------------

export type Portfolio = {
  company: string;
  currency: string;
  yearEndMonth: number;
  leases: Lease[];
};

export type Model = {
  portfolio: Portfolio;
  results: LeaseResult[];
  fy: FinancialYear;
  disclosure: Disclosure;
  selected: LeaseResult | null;
};

export const ModelContext = createContext<Model | null>(null);

export function useModel(): Model {
  const m = useContext(ModelContext);
  if (!m) throw new Error("useModel must be used inside ModelContext");
  return m;
}
