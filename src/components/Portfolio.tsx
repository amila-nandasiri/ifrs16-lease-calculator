import { Pencil, Plus, Trash2 } from "lucide-react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { C } from "../lib/colors";
import { currencyCode, date, money, moneyShort, thousands } from "../lib/format";
import { useModel, type Lease } from "../lib/ifrs16";

const FREQ_LABEL = { monthly: "month", quarterly: "quarter", "semi-annual": "half-year", annual: "year" } as const;
const STATUS_STYLE = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Not started": "bg-zinc-100 text-zinc-600 ring-zinc-200",
  Ended: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  Exempt: "bg-amber-50 text-amber-800 ring-amber-200"
} as const;

export function Card({ title, subtitle, children, className = "", action }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`bg-white border border-zinc-200 rounded-2xl min-w-0 break-inside-avoid ${className}`}>
      <div className="p-5 md:p-6 pb-0 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-zinc-900">{title}</h2>
          {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function LeaseRegister({ onEdit, onAdd, onDelete, onSelect }: { onEdit: (l: Lease) => void; onAdd: () => void; onDelete: (id: string) => void; onSelect: (id: string) => void }) {
  const { results, disclosure, selected, fy } = useModel();
  const status = new Map(disclosure.perLease.map((p) => [p.id, p]));
  return (
    <Card
      title="Lease register"
      subtitle={`${results.length} leases. Select one to see its schedule and journals; balances are at ${date(fy.end)}.`}
      action={
        <button onClick={onAdd} className="inline-flex items-center gap-1.5 text-sm font-medium border border-zinc-200 rounded-full px-4 py-2 text-zinc-900 hover:border-zinc-400 print:hidden">
          <Plus className="w-4 h-4" /> Add lease
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="text-xs text-zinc-500 border-y border-zinc-200 bg-zinc-50/60">
            <tr>
              <th className="text-left font-medium px-5 md:px-6 py-2.5">Lease</th>
              <th className="text-left font-medium px-3 py-2.5">Status</th>
              <th className="text-left font-medium px-3 py-2.5">Commenced</th>
              <th className="text-right font-medium px-3 py-2.5">Term</th>
              <th className="text-right font-medium px-3 py-2.5">Payment</th>
              <th className="text-right font-medium px-3 py-2.5">Rate</th>
              <th className="text-right font-medium px-3 py-2.5">Initial liability</th>
              <th className="text-right font-medium px-3 py-2.5">Liability at {date(fy.end)}</th>
              <th className="text-right font-medium px-3 py-2.5">ROU asset at {date(fy.end)}</th>
              <th className="px-3 pr-6 py-2.5 print:hidden" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {results.map((r) => {
              const p = status.get(r.lease.id)!;
              const isSel = selected?.lease.id === r.lease.id;
              return (
                <tr key={r.lease.id} onClick={() => onSelect(r.lease.id)} className={`cursor-pointer ${isSel ? "bg-blue-50/60" : "hover:bg-zinc-50"}`}>
                  <td className={`px-5 md:px-6 py-2.5 ${isSel ? "border-l-2 border-[#2a78d6]" : "border-l-2 border-transparent"}`}>
                    <p className="font-medium text-zinc-900">{r.lease.name}</p>
                    <p className="text-xs text-zinc-500">{r.lease.assetClass}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${STATUS_STYLE[p.status]}`}>
                      {p.status === "Exempt" ? (r.lease.exemption === "short-term" ? "Short-term" : "Low-value") : p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-600">{date(r.lease.commencement)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">{r.lease.termMonths} mo</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">
                    {money(r.lease.payment)} <span className="text-zinc-400">/ {FREQ_LABEL[r.lease.frequency]}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">{r.lease.ratePct}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-900">{r.exempt ? "–" : money(r.pvOfPayments)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-900">{p.closingLiability ? money(p.closingLiability) : "–"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-900">{p.closingRou ? money(p.closingRou) : "–"}</td>
                  <td className="px-3 pr-6 py-2.5 text-right print:hidden" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onEdit(r.lease)} className="p-1.5 text-zinc-400 hover:text-zinc-900" aria-label={`Edit ${r.lease.name}`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => confirm(`Delete "${r.lease.name}"?`) && onDelete(r.lease.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-700"
                      aria-label={`Delete ${r.lease.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Disclosures
// ---------------------------------------------------------------------------

type Line = { label: string; value: number; bold?: boolean; muted?: boolean };

function MovementTable({ lines }: { lines: Line[] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {lines.map((l) => (
          <tr key={l.label} className={l.bold ? "border-t border-zinc-200 font-semibold text-zinc-900" : l.muted ? "text-zinc-500" : "text-zinc-700"}>
            <td className={`py-1.5 pl-5 md:pl-6 ${l.muted ? "pl-9 md:pl-10" : ""}`}>{l.label}</td>
            <td className="py-1.5 pr-5 md:pr-6 text-right tabular-nums">{thousands(l.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Disclosures() {
  const { disclosure: d, fy } = useModel();
  const k = `${currencyCode()} '000`;
  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <Card title="Lease liabilities" subtitle={`${fy.label} movement · ${k}`}>
        <div className="pb-4">
          <MovementTable
            lines={[
              { label: `At ${date(d.fy.start)}`, value: d.liability.opening, bold: true },
              { label: "New leases", value: d.liability.additions },
              { label: "Interest", value: d.liability.interest },
              { label: "Lease payments", value: -d.liability.payments },
              { label: `At ${date(d.fy.end)}`, value: d.liability.closing, bold: true },
              { label: "Current (due within 12 months)", value: d.liability.current, muted: true },
              { label: "Non-current", value: d.liability.nonCurrent, muted: true }
            ]}
          />
        </div>
      </Card>

      <Card title="Right-of-use assets" subtitle={`${fy.label} movement by asset class · ${k}`}>
        <div className="overflow-x-auto pb-4">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="text-xs text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="text-left font-medium pl-5 md:pl-6 py-1.5" />
                {d.rouByClass.map((c) => <th key={c.assetClass} className="text-right font-medium px-3 py-1.5">{c.assetClass}</th>)}
                <th className="text-right font-medium pr-5 md:pr-6 pl-3 py-1.5 text-zinc-900">Total</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  [`At ${date(d.fy.start)}`, "opening", true],
                  ["Additions", "additions", false],
                  ["Depreciation", "depreciation", false],
                  [`At ${date(d.fy.end)}`, "closing", true]
                ] as const
              ).map(([label, key, bold]) => (
                <tr key={key} className={bold ? "border-t border-zinc-200 font-semibold text-zinc-900" : "text-zinc-700"}>
                  <td className="pl-5 md:pl-6 py-1.5">{label}</td>
                  {d.rouByClass.map((c) => (
                    <td key={c.assetClass} className="text-right tabular-nums px-3 py-1.5">{thousands(key === "depreciation" ? -c[key] : c[key])}</td>
                  ))}
                  <td className="text-right tabular-nums pr-5 md:pr-6 pl-3 py-1.5">{thousands(key === "depreciation" ? -d.rou[key] : d.rou[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Amounts in profit or loss" subtitle={`${fy.label} · ${k}`}>
        <div className="pb-4">
          <MovementTable
            lines={[
              { label: "Depreciation of right-of-use assets", value: d.pnl.depreciation },
              { label: "Interest on lease liabilities", value: d.pnl.interest },
              { label: "Short-term and low-value lease expense", value: d.pnl.exemptExpense },
              { label: "Total lease expense", value: d.pnl.total, bold: true },
              { label: "As straight-line rent, for comparison", value: d.pnl.straightLine, muted: true }
            ]}
          />
        </div>
      </Card>

      <Card title="Cash outflow for leases" subtitle={`${fy.label} · ${k}`}>
        <div className="pb-4">
          <MovementTable
            lines={[
              { label: "Principal elements of lease payments", value: d.cashFlow.principal },
              { label: "Payments at commencement", value: d.cashFlow.atCommencement },
              { label: "Interest paid", value: d.cashFlow.interest },
              { label: "Short-term and low-value lease payments", value: d.cashFlow.exempt },
              { label: "Total cash outflow", value: d.cashFlow.total, bold: true }
            ]}
          />
        </div>
      </Card>

      <Card title="Maturity analysis" subtitle={`Undiscounted lease payments after ${date(d.fy.end)} · ${k}`} className="lg:col-span-2">
        <div className="grid md:grid-cols-[1fr_320px] gap-2 px-2 md:px-4 pb-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.maturity} margin={{ top: 16, right: 8, left: 8 }}>
              <XAxis dataKey="bucket" stroke={C.axis} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip cursor={{ fill: "#f4f4f5" }} formatter={(v: number) => money(v)} />
              <Bar dataKey="amount" name="Undiscounted payments" fill={C.bar} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="amount" position="top" formatter={(v: number) => (v ? moneyShort(v) : "")} fontSize={11} fill="#3f3f46" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <MovementTable
            lines={[
              ...d.maturity.map((m) => ({ label: m.bucket, value: m.amount })),
              { label: "Total undiscounted", value: d.maturity.reduce((t, m) => t + m.amount, 0), bold: true },
              { label: "Less: future interest", value: d.liability.closing - d.maturity.reduce((t, m) => t + m.amount, 0), muted: true },
              { label: "Lease liability", value: d.liability.closing, bold: true }
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
