import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Github, Printer, RotateCcw, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LeaseDetail } from "./components/LeaseDetail";
import { LeaseForm } from "./components/LeaseForm";
import { Disclosures, LeaseRegister } from "./components/Portfolio";
import { UploadPanel } from "./components/UploadPanel";
import { downloadRegisterCsv, downloadReportWorkbook, downloadScheduleCsv } from "./lib/excel";
import { date, moneyShort, setCurrency } from "./lib/format";
import { calculateLease, disclose, financialYear, ModelContext, type Lease, type Model, type Portfolio } from "./lib/ifrs16";
import { newId, samplePortfolio } from "./lib/importer";

const REPO = "https://github.com/amila-nandasiri/ifrs16-lease-calculator";
const SITE = "https://dewapriya.com";
const OFFLINE_FILE = "ifrs16-lease-calculator.html";
const isOffline = typeof location !== "undefined" && location.protocol === "file:";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const blankLease = (): Lease => ({
  id: newId(),
  name: "",
  assetClass: "Property",
  commencement: new Date().toISOString().slice(0, 8) + "01",
  termMonths: 60,
  payment: 10000,
  frequency: "monthly",
  timing: "advance",
  escalationPct: 0,
  ratePct: 7.5,
  initialDirectCosts: 0,
  incentives: 0,
  restorationCost: 0,
  residualGuarantee: 0,
  purchaseOption: 0,
  usefulLifeMonths: null,
  exemption: "none"
});

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4 md:p-5 break-inside-avoid">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900 mt-1 tabular-nums">{value}</p>
      <p className="text-xs text-zinc-500 mt-2">{note}</p>
    </div>
  );
}

function ReportMenu({ model }: { model: Model }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const item = "w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-lg hover:bg-zinc-100";
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-2 text-sm border border-zinc-200 rounded-full px-4 py-2 text-zinc-700 hover:border-zinc-400 transition-colors bg-white">
        <Download className="w-4 h-4" /> Download report <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-zinc-200 rounded-xl shadow-xl p-1.5 z-40 text-sm">
          <button className={item} onClick={pick(() => downloadReportWorkbook(model))}>
            <FileSpreadsheet className="w-4 h-4 mt-0.5 text-emerald-700" />
            <span>
              <span className="block font-medium text-zinc-900">Excel report, {model.fy.label}</span>
              <span className="text-xs text-zinc-500">Disclosures, register, journals and a schedule for every lease</span>
            </span>
          </button>
          <button className={item} onClick={pick(() => window.print())}>
            <Printer className="w-4 h-4 mt-0.5 text-zinc-500" />
            <span>
              <span className="block font-medium text-zinc-900">PDF report</span>
              <span className="text-xs text-zinc-500">Print or "Save as PDF" this page</span>
            </span>
          </button>
          <div className="border-t border-zinc-100 my-1" />
          <button className={item} onClick={pick(() => downloadRegisterCsv(model))}>
            <Download className="w-4 h-4 mt-0.5 text-zinc-500" />
            <span className="font-medium text-zinc-900">Lease register (CSV)</span>
          </button>
          {model.selected && !model.selected.exempt && (
            <button className={item} onClick={pick(() => downloadScheduleCsv(model.selected!))}>
              <Download className="w-4 h-4 mt-0.5 text-zinc-500" />
              <span className="font-medium text-zinc-900">Schedule: {model.selected.lease.name} (CSV)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const sample = useMemo(() => samplePortfolio(), []);
  const [portfolio, setPortfolio] = useState<Portfolio>(sample);
  const [isSample, setIsSample] = useState(true);
  const [notes, setNotes] = useState<string[]>([]);
  const [year, setYear] = useState(2026);
  const [selectedId, setSelectedId] = useState<string | null>(sample.leases[0]?.id ?? null);
  const [editing, setEditing] = useState<Lease | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const model: Model = useMemo(() => {
    setCurrency(portfolio.currency);
    const results = portfolio.leases.map(calculateLease);
    const fy = financialYear(year, portfolio.yearEndMonth);
    return { portfolio, results, fy, disclosure: disclose(results, fy), selected: results.find((r) => r.lease.id === selectedId) ?? results[0] ?? null };
  }, [portfolio, year, selectedId]);

  const { disclosure: d, fy } = model;
  const update = (p: Partial<Portfolio>) => {
    setPortfolio({ ...portfolio, ...p });
    setIsSample(false);
  };
  const active = d.perLease.filter((p) => p.status === "Active").length;
  const exempt = d.perLease.filter((p) => p.status === "Exempt").length;

  return (
    <ModelContext.Provider value={model}>
      <div className="min-h-screen">
        <header className="border-b border-zinc-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-zinc-500">Lease accounting · {portfolio.company}</p>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-zinc-900 mt-1">IFRS 16 Lease Calculator</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button onClick={() => setShowUpload(true)} className="inline-flex items-center gap-2 text-sm font-medium bg-emerald-700 text-white rounded-full px-4 py-2 hover:bg-emerald-800 transition-colors">
                <Upload className="w-4 h-4" /> Use your data
              </button>
              <ReportMenu model={model} />
              {!isOffline && (
                <>
                  <a href={REPO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm border border-zinc-200 rounded-full px-4 py-2 text-zinc-700 hover:border-zinc-400 transition-colors" title="Source code">
                    <Github className="w-4 h-4" /> <span className="hidden sm:inline">Code</span>
                  </a>
                  <a href={SITE} className="inline-flex items-center gap-1.5 text-sm bg-zinc-900 text-white rounded-full px-4 py-2 hover:bg-zinc-700 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Portfolio
                  </a>
                </>
              )}
            </div>
          </div>
        </header>

        {isSample ? (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm print:hidden">
            <p className="max-w-7xl mx-auto px-4 md:px-6 py-2.5">
              <strong className="font-medium">Fictional sample:</strong> the lease portfolio of a Maldives seaplane operator, covering aircraft, terminal, offices, vehicles and exempt leases. Edit any lease,
              add your own, or{" "}
              <button onClick={() => setShowUpload(true)} className="underline underline-offset-2 font-medium hover:text-amber-950">
                upload your lease register
              </button>
              . Everything stays on your computer.
            </p>
          </div>
        ) : (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-sm print:hidden">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p>
                  Showing <strong className="font-medium">your leases</strong>, calculated only in this browser. Nothing is uploaded or saved, so download the register to keep your changes.
                </p>
                {notes.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-emerald-800">Import notes ({notes.length})</summary>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-emerald-900/90">
                      {notes.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                  </details>
                )}
              </div>
              <button
                onClick={() => {
                  setPortfolio(sample);
                  setIsSample(true);
                  setNotes([]);
                  setSelectedId(sample.leases[0]?.id ?? null);
                }}
                className="inline-flex items-center gap-1.5 text-emerald-900 font-medium hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Back to sample leases
              </button>
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setYear(year - 1)} className="p-2 rounded-full border border-zinc-200 bg-white hover:border-zinc-400 print:hidden" aria-label="Previous year">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center min-w-44">
                <p className="text-lg font-semibold text-zinc-900">{fy.label}</p>
                <p className="text-xs text-zinc-500">
                  {date(fy.start)} to {date(fy.end)}
                </p>
              </div>
              <button onClick={() => setYear(year + 1)} className="p-2 rounded-full border border-zinc-200 bg-white hover:border-zinc-400 print:hidden" aria-label="Next year">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm print:hidden">
              <label className="text-zinc-500">
                Year end{" "}
                <select value={portfolio.yearEndMonth} onChange={(e) => update({ yearEndMonth: Number(e.target.value) })} className="ml-1 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-900">
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </label>
              <label className="text-zinc-500">
                Currency{" "}
                <input
                  value={portfolio.currency}
                  onChange={(e) => update({ currency: e.target.value.toUpperCase().slice(0, 3) })}
                  className="ml-1 w-16 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-900 uppercase"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 print:grid-cols-6 gap-3 md:gap-4">
            <Kpi label="Lease liabilities" value={moneyShort(d.liability.closing)} note={`${moneyShort(d.liability.current)} current · ${moneyShort(d.liability.nonCurrent)} non-current`} />
            <Kpi label="Right-of-use assets" value={moneyShort(d.rou.closing)} note={`At ${date(fy.end)}`} />
            <Kpi label="Depreciation" value={moneyShort(d.pnl.depreciation)} note={`Right-of-use assets, ${fy.label}`} />
            <Kpi label="Interest" value={moneyShort(d.pnl.interest)} note={`On lease liabilities, ${fy.label}`} />
            <Kpi label="Cash paid for leases" value={moneyShort(d.cashFlow.total)} note={`Including ${moneyShort(d.cashFlow.exempt)} exempt leases`} />
            <Kpi label="Leases" value={String(active)} note={`active at year end · ${exempt} exempt`} />
          </div>

          <LeaseRegister
            onAdd={() => setEditing(blankLease())}
            onEdit={(l) => setEditing(l)}
            onDelete={(id) => update({ leases: portfolio.leases.filter((l) => l.id !== id) })}
            onSelect={setSelectedId}
          />

          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900 mb-4">Year-end disclosures</h2>
            <Disclosures />
          </div>

          {model.selected && (
            <div className="border-t border-zinc-200 pt-6">
              <div className="flex flex-wrap items-center gap-3 mb-2 print:hidden">
                <p className="text-sm text-zinc-500">Lease detail</p>
                <select
                  value={model.selected.lease.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm text-zinc-900"
                  aria-label="Choose a lease"
                >
                  {model.results.map((r) => <option key={r.lease.id} value={r.lease.id}>{r.lease.name}</option>)}
                </select>
              </div>
              <LeaseDetail />
            </div>
          )}

          <section className="grid md:grid-cols-3 gap-6 text-sm text-zinc-600 pt-4 break-inside-avoid">
            <div>
              <h3 className="font-medium text-zinc-900 mb-1">Measurement</h3>
              <p>
                The lease liability is the present value of payments not paid at commencement, discounted monthly at the annual rate converted to a monthly rate. The right-of-use
                asset adds payments at commencement, initial direct costs and restoration costs, less incentives (IFRS 16.23–28).
              </p>
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 mb-1">Subsequent measurement</h3>
              <p>
                Interest accrues monthly on the liability, and payments reduce it. The asset is depreciated straight-line over the lease term, or over its useful life when a
                purchase option is reasonably certain (IFRS 16.29–38).
              </p>
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 mb-1">Scope of this calculator</h3>
              <p>
                It covers fixed and fixed-escalating payments, and short-term and low-value exemptions. Lease modifications, variable payments linked to an index, and
                remeasurements aren't modelled.
              </p>
            </div>
          </section>

          {!isOffline && (
            <section className="bg-white border border-zinc-200 rounded-2xl p-5 md:p-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
              <div>
                <h2 className="font-semibold text-zinc-900">Use it offline</h2>
                <p className="text-sm text-zinc-500 mt-0.5 max-w-2xl">
                  Download the whole calculator as a single HTML file. Open it in any browser, with or without internet, and load your lease register. Nothing is sent anywhere.
                </p>
              </div>
              <a href={OFFLINE_FILE} download className="inline-flex items-center gap-2 text-sm font-medium bg-zinc-900 text-white rounded-full px-5 py-2.5 hover:bg-zinc-700 transition-colors">
                <Download className="w-4 h-4" /> Download HTML file
              </a>
            </section>
          )}
        </main>

        <footer className="border-t border-zinc-200 mt-8">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-wrap justify-between gap-2 text-xs text-zinc-500">
            <p>
              Built by <a href={SITE} className="text-zinc-900 hover:underline">Amila Dewapriya</a>, CMA · not a substitute for professional advice
            </p>
            <p className="font-mono">React · TypeScript · Recharts</p>
          </div>
        </footer>
      </div>

      {editing && (
        <LeaseForm
          lease={editing}
          onClose={() => setEditing(null)}
          onSave={(l) => {
            const exists = portfolio.leases.some((x) => x.id === l.id);
            update({ leases: exists ? portfolio.leases.map((x) => (x.id === l.id ? l : x)) : [...portfolio.leases, l] });
            setSelectedId(l.id);
            setEditing(null);
          }}
        />
      )}
      {showUpload && (
        <UploadPanel
          onClose={() => setShowUpload(false)}
          onLoad={(leases, replace, n) => {
            const next = replace ? leases : [...portfolio.leases, ...leases];
            setPortfolio({ ...portfolio, company: replace ? "Your leases" : portfolio.company, leases: next });
            setIsSample(false);
            setNotes(n);
            setSelectedId(leases[0]?.id ?? null);
            setShowUpload(false);
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </ModelContext.Provider>
  );
}
