import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { C } from "../lib/colors";
import { date, money, moneyShort } from "../lib/format";
import { commencementJournal, expenseByYear, financialYear, useModel, yearJournals, type Journal, type LeaseResult } from "../lib/ifrs16";
import { Card } from "./Portfolio";

const axisProps = { stroke: C.axis, fontSize: 12, tickLine: false, axisLine: false } as const;
const paren = (v: number) => (Math.abs(v) >= 0.5 ? `(${money(v)})` : "–");

function MeasurementTable({ r }: { r: LeaseResult }) {
  const L = r.lease;
  const lines: [string, number, boolean?][] = [
    ["Present value of lease payments not yet paid", r.pvOfPayments],
    ["= Lease liability at commencement", r.pvOfPayments, true],
    ["+ Payments made at commencement", r.paymentAtCommencement],
    ["+ Initial direct costs", L.initialDirectCosts],
    ["− Lease incentives received", -L.incentives],
    ["+ Restoration / redelivery provision", L.restorationCost],
    ["= Right-of-use asset at commencement", r.initialRou, true]
  ];
  return (
    <table className="w-full text-sm">
      <tbody>
        {lines
          .filter(([, v, bold]) => bold || Math.abs(v) > 0.005)
          .map(([label, v, bold]) => (
            <tr key={label} className={bold ? "font-semibold text-zinc-900 border-t border-zinc-200" : "text-zinc-700"}>
              <td className="py-1.5">{label}</td>
              <td className="py-1.5 text-right tabular-nums">{money(v)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function JournalTable({ journals }: { journals: Journal[] }) {
  if (!journals.length) return <p className="text-sm text-zinc-500">No entries in this year.</p>;
  return (
    <div className="space-y-4">
      {journals.map((j) => (
        <div key={j.description} className="break-inside-avoid">
          <p className="text-xs text-zinc-500 mb-1">
            {date(j.date)} · {j.description}
          </p>
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-400">
              <tr>
                <th className="text-left font-medium py-1">Account</th>
                <th className="text-right font-medium py-1 w-32">Debit</th>
                <th className="text-right font-medium py-1 w-32">Credit</th>
              </tr>
            </thead>
            <tbody className="border-t border-zinc-100">
              {j.lines.map((l, i) => (
                <tr key={i} className="text-zinc-700">
                  <td className={`py-1 ${l.credit ? "pl-6" : ""}`}>{l.account}</td>
                  <td className="py-1 text-right tabular-nums">{l.debit ? money(l.debit) : ""}</td>
                  <td className="py-1 text-right tabular-nums">{l.credit ? money(l.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function LeaseDetail() {
  const { selected: r, fy, portfolio } = useModel();
  const [openYears, setOpenYears] = useState<Set<string>>(new Set());

  const years = useMemo(() => (r ? expenseByYear(r, portfolio.yearEndMonth) : []), [r, portfolio.yearEndMonth]);
  if (!r) return null;
  const L = r.lease;

  // Balances at each month end for the chart (with commencement as the first point)
  const balanceData = [{ label: date(L.commencement), liability: r.pvOfPayments, rou: r.initialRou }, ...r.rows.map((row) => ({ label: date(row.date), liability: row.closingLiability, rou: row.closingRou }))];

  // Year-end marker: the last month end on or before the financial year end
  const marker = [...r.rows].reverse().find((row) => row.date <= fy.end);
  const markerLabel = marker ? date(marker.date) : null;

  // Schedule grouped by financial year
  const groups = years.map((y) => {
    const fyY = financialYear(Number(y.label.slice(2)), portfolio.yearEndMonth);
    const rows = r.rows.filter((row) => row.date >= fyY.start && row.date <= fyY.end);
    return { label: y.label, fy: fyY, rows };
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{L.name}</h2>
        <p className="text-sm text-zinc-500">
          {L.assetClass} · {L.termMonths} months from {date(L.commencement)} to {date(r.endDate)} · {L.ratePct}% discount rate
        </p>
      </div>

      {r.exempt ? (
        <Card title="Recognition exemption applied" subtitle={L.exemption === "short-term" ? "Short-term lease (IFRS 16.5(a))" : "Lease of a low-value asset (IFRS 16.5(b))"}>
          <div className="px-5 md:px-6 pb-5 text-sm text-zinc-700 space-y-3">
            <p>
              No right-of-use asset or lease liability is recognised. Total payments of <strong>{money(r.totalPayments)}</strong> are expensed straight-line at{" "}
              <strong>{money(r.straightLineMonthly)}</strong> a month (IFRS 16.6).
            </p>
            <JournalTable journals={yearJournals(r, fy)} />
          </div>
        </Card>
      ) : (
        <>
          <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
            <Card title="Initial measurement" subtitle={`At commencement, ${date(L.commencement)}`}>
              <div className="px-5 md:px-6 pb-5">
                <MeasurementTable r={r} />
                <p className="text-xs text-zinc-500 mt-4">
                  Total payments {money(r.totalPayments)} · total interest {money(r.totalInterest)} · depreciated over {r.depreciationMonths} months
                  {r.depreciationMonths !== L.termMonths ? " (useful life, as the purchase option is reasonably certain)" : ""}.
                </p>
              </div>
            </Card>

            <Card title="Balances over the lease" subtitle="Lease liability and right-of-use asset at each month end">
              <div className="px-2 md:px-4 pb-4">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={balanceData} margin={{ top: 8, right: 16, left: 0 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} minTickGap={40} />
                    <YAxis {...axisProps} tickFormatter={moneyShort} width={60} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                    {markerLabel && <ReferenceLine x={markerLabel} stroke={C.axis} strokeDasharray="4 4" label={{ value: `${fy.label} year end`, position: "insideTopRight", fontSize: 11, fill: C.axis }} />}
                    <Line dataKey="liability" name="Lease liability" stroke={C.liability} strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line dataKey="rou" name="Right-of-use asset" stroke={C.rou} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card title="Expense by year: IFRS 16 vs straight-line rent" subtitle="Interest is highest early in the lease, so IFRS 16 front-loads the total expense">
            <div className="px-2 md:px-4 pb-4">
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={years} margin={{ top: 8, right: 16, left: 0 }}>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={moneyShort} width={60} />
                  <Tooltip formatter={(v: number) => money(v)} cursor={{ fill: "#f4f4f5" }} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="depreciation" name="Depreciation" stackId="e" fill={C.depreciation} stroke="#fff" strokeWidth={1} isAnimationActive={false} />
                  <Bar dataKey="interest" name="Interest" stackId="e" fill={C.interest} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Line dataKey="straightLine" name="Straight-line rent" stroke={C.straightLine} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      {!r.exempt && (
        <div className="grid lg:grid-cols-[1fr_440px] gap-6 items-start">
          <Card title="Amortisation schedule" subtitle="By financial year. Select a year to see each month">
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="text-xs text-zinc-500 border-y border-zinc-200 bg-zinc-50/60">
                  <tr>
                    <th className="text-left font-medium px-5 md:px-6 py-2">Period</th>
                    <th className="text-right font-medium px-3 py-2">Opening liability</th>
                    <th className="text-right font-medium px-3 py-2">Interest</th>
                    <th className="text-right font-medium px-3 py-2">Payments</th>
                    <th className="text-right font-medium px-3 py-2">Closing liability</th>
                    <th className="text-right font-medium px-3 py-2">Depreciation</th>
                    <th className="text-right font-medium px-3 pr-6 py-2">Closing ROU</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const open = openYears.has(g.label);
                    const first = g.rows[0];
                    const last = g.rows[g.rows.length - 1];
                    const s = (f: (x: (typeof g.rows)[number]) => number) => g.rows.reduce((t, x) => t + f(x), 0);
                    const isFy = g.label === fy.label;
                    return (
                      <Fragment key={g.label}>
                        <tr
                          onClick={() => {
                            const n = new Set(openYears);
                            if (open) n.delete(g.label);
                            else n.add(g.label);
                            setOpenYears(n);
                          }}
                          className={`cursor-pointer border-b border-zinc-100 ${isFy ? "bg-blue-50/60 font-medium" : "hover:bg-zinc-50"}`}
                        >
                          <td className="px-5 md:px-6 py-2 text-zinc-900">
                            <span className="inline-flex items-center gap-1.5">
                              {open ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                              {g.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(first.openingLiability)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(s((x) => x.interest))}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{paren(s((x) => x.payment))}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(last.closingLiability)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{paren(s((x) => x.depreciation))}</td>
                          <td className="px-3 pr-6 py-2 text-right tabular-nums">{money(last.closingRou)}</td>
                        </tr>
                        {open &&
                          g.rows.map((x) => (
                            <tr key={x.month} className="text-zinc-600 text-xs border-b border-zinc-50">
                              <td className="px-5 md:px-6 py-1.5 pl-11">
                                Month {x.month} · {date(x.date)}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{money(x.openingLiability)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{money(x.interest)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{paren(x.payment)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{money(x.closingLiability)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{paren(x.depreciation)}</td>
                              <td className="px-3 pr-6 py-1.5 text-right tabular-nums">{money(x.closingRou)}</td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {r.paymentAtCommencement > 0 && (
              <p className="text-xs text-zinc-500 px-5 md:px-6 pb-4">
                The first payment of {money(r.paymentAtCommencement)} was made at commencement, so it is in the right-of-use asset rather than the liability.
              </p>
            )}
          </Card>

          <Card title={`Journal entries, ${fy.label}`} subtitle="Summarised for the year; post monthly in practice">
            <div className="px-5 md:px-6 pb-5">
              <JournalTable journals={yearJournals(r, fy)} />
              {!yearJournals(r, fy).length && commencementJournal(r) && (
                <div className="mt-4">
                  <p className="text-xs text-zinc-500 mb-2">At commencement:</p>
                  <JournalTable journals={[commencementJournal(r)!]} />
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
