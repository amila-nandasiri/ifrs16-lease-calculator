import { X } from "lucide-react";
import { useState } from "react";
import { ASSET_CLASSES, calculateLease, type Exemption, type Frequency, type Lease, type Timing } from "../lib/ifrs16";
import { money } from "../lib/format";

const input = "w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300";

type NumKey = "termMonths" | "payment" | "escalationPct" | "ratePct" | "initialDirectCosts" | "incentives" | "restorationCost" | "residualGuarantee" | "purchaseOption";

export function LeaseForm({ lease, onSave, onClose }: { lease: Lease; onSave: (l: Lease) => void; onClose: () => void }) {
  const [l, setL] = useState<Lease>(lease);
  const [life, setLife] = useState(lease.usefulLifeMonths?.toString() ?? "");
  const set = <K extends keyof Lease>(k: K, v: Lease[K]) => setL({ ...l, [k]: v });
  const num = (k: NumKey, label: string, hint?: string) => (
    <label className="text-xs text-zinc-500">
      {label}
      <input type="number" step="any" value={Number.isFinite(l[k]) ? l[k] : ""} onChange={(e) => set(k, e.target.value === "" ? 0 : Number(e.target.value))} className={`${input} mt-1`} />
      {hint && <span className="block mt-1">{hint}</span>}
    </label>
  );

  const valid = l.name.trim() && l.commencement && l.termMonths > 0 && l.payment >= 0 && l.ratePct >= 0;
  const preview = valid ? calculateLease({ ...l, usefulLifeMonths: life ? Number(life) : null }) : null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="lease-form-title">
        <div className="flex items-start justify-between gap-4 p-6 pb-0">
          <h2 id="lease-form-title" className="text-lg font-semibold text-zinc-900">{lease.name ? "Edit lease" : "Add a lease"}</h2>
          <button onClick={onClose} className="p-1.5 -m-1.5 text-zinc-400 hover:text-zinc-900" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <fieldset className="grid sm:grid-cols-2 gap-3">
            <legend className="text-sm font-medium text-zinc-900 mb-2">The lease</legend>
            <label className="text-xs text-zinc-500 sm:col-span-2">
              Name
              <input value={l.name} onChange={(e) => set("name", e.target.value)} className={`${input} mt-1`} placeholder="e.g. Head office" />
            </label>
            <label className="text-xs text-zinc-500">
              Asset class
              <select value={l.assetClass} onChange={(e) => set("assetClass", e.target.value)} className={`${input} mt-1`}>
                {[...new Set([...ASSET_CLASSES, l.assetClass])].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs text-zinc-500">
              Commencement date
              <input type="date" value={l.commencement} onChange={(e) => set("commencement", e.target.value)} className={`${input} mt-1`} />
            </label>
            {num("termMonths", "Lease term (months)", "Including extension options reasonably certain to be exercised")}
            {num("ratePct", "Discount rate (% a year)", "Rate implicit in the lease, or your incremental borrowing rate")}
          </fieldset>

          <fieldset className="grid sm:grid-cols-2 gap-3">
            <legend className="text-sm font-medium text-zinc-900 mb-2">Payments</legend>
            {num("payment", "Payment per period", "In the first year")}
            <label className="text-xs text-zinc-500">
              Frequency
              <select value={l.frequency} onChange={(e) => set("frequency", e.target.value as Frequency)} className={`${input} mt-1`}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semi-annual">Semi-annual</option>
                <option value="annual">Annual</option>
              </select>
            </label>
            <label className="text-xs text-zinc-500">
              Paid
              <select value={l.timing} onChange={(e) => set("timing", e.target.value as Timing)} className={`${input} mt-1`}>
                <option value="advance">In advance (start of each period)</option>
                <option value="arrears">In arrears (end of each period)</option>
              </select>
            </label>
            {num("escalationPct", "Fixed annual increase (%)", "Applied every 12 months")}
          </fieldset>

          <fieldset className="grid sm:grid-cols-2 gap-3">
            <legend className="text-sm font-medium text-zinc-900 mb-2">Other amounts (optional)</legend>
            {num("initialDirectCosts", "Initial direct costs", "Added to the right-of-use asset")}
            {num("incentives", "Lease incentives received", "Deducted from the right-of-use asset")}
            {num("restorationCost", "Restoration / redelivery cost (present value)", "Provision added to the asset")}
            {num("residualGuarantee", "Residual value guarantee expected payable", "Paid at the end of the term")}
            {num("purchaseOption", "Purchase option price", "Only if reasonably certain to be exercised")}
            <label className="text-xs text-zinc-500">
              Useful life of the asset (months)
              <input type="number" value={life} onChange={(e) => setLife(e.target.value)} className={`${input} mt-1`} disabled={!l.purchaseOption} />
              <span className="block mt-1">Depreciation period when the purchase option applies</span>
            </label>
            <label className="text-xs text-zinc-500 sm:col-span-2">
              Recognition exemption
              <select value={l.exemption} onChange={(e) => set("exemption", e.target.value as Exemption)} className={`${input} mt-1`}>
                <option value="none">None: recognise on the balance sheet</option>
                <option value="short-term">Short-term lease (12 months or less)</option>
                <option value="low-value">Low-value asset</option>
              </select>
              {l.exemption === "short-term" && l.termMonths > 12 && <span className="block mt-1 text-red-700">The short-term exemption only applies to a term of 12 months or less.</span>}
            </label>
          </fieldset>

          {preview && !preview.exempt && (
            <p className="text-sm text-zinc-600 bg-zinc-50 rounded-lg px-4 py-3">
              Lease liability at commencement <strong className="text-zinc-900">{money(preview.pvOfPayments)}</strong> · right-of-use asset{" "}
              <strong className="text-zinc-900">{money(preview.initialRou)}</strong>
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-200 bg-zinc-50 rounded-b-2xl">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-full text-zinc-700 hover:bg-zinc-200/60">Cancel</button>
          <button
            onClick={() => onSave({ ...l, name: l.name.trim(), usefulLifeMonths: life && l.purchaseOption ? Number(life) : null })}
            disabled={!valid || (l.exemption === "short-term" && l.termMonths > 12)}
            className="text-sm font-medium px-5 py-2 rounded-full bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-300 disabled:cursor-not-allowed"
          >
            Save lease
          </button>
        </div>
      </div>
    </div>
  );
}
