import { Download, FileSpreadsheet, Lock, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { downloadTemplateCsv, downloadTemplateWorkbook, readWorkbook } from "../lib/excel";
import type { Lease } from "../lib/ifrs16";
import { importLeases } from "../lib/importer";

export function UploadPanel({ onClose, onLoad }: { onClose: () => void; onLoad: (leases: Lease[], replace: boolean, notes: string[]) => void }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [replace, setReplace] = useState(true);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handle(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    let file = { name: f.name, text: "" };
    if (/\.xlsx$/i.test(f.name)) {
      try {
        const sheet = await readWorkbook(f);
        if (!sheet) return setErrors([`${f.name}: no sheet with lease rows was found.`]);
        file = sheet;
      } catch {
        return setErrors([`${f.name}: couldn't read this workbook. Try saving it again as .xlsx, or as CSV.`]);
      }
    } else if (/\.xls$/i.test(f.name)) {
      return setErrors([`${f.name}: old .xls format isn't supported. Save it as .xlsx or CSV.`]);
    } else {
      file.text = await f.text();
    }
    const r = importLeases(file.text, file.name);
    if (!r.ok) return setErrors(r.errors);
    onLoad(r.leases, replace, r.notes);
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <div className="flex items-start justify-between gap-4 p-6 pb-0">
          <div>
            <h2 id="upload-title" className="text-lg font-semibold text-zinc-900">Upload your lease register</h2>
            <p className="text-sm text-zinc-500 mt-1">One row per lease. The calculator builds every schedule, journal and disclosure from it.</p>
          </div>
          <button onClick={onClose} className="p-1.5 -m-1.5 text-zinc-400 hover:text-zinc-900" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <p className="flex gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
            Your file never leaves your computer. Everything is calculated inside your browser, and nothing is uploaded or stored.
          </p>

          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="text-sm font-medium text-zinc-900">Start from the template</p>
            <p className="text-sm text-zinc-500 mt-0.5">It explains every column, and contains the sample leases to overwrite.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => downloadTemplateWorkbook()} className="inline-flex items-center gap-1.5 text-sm font-medium bg-emerald-700 text-white rounded-full px-4 py-2 hover:bg-emerald-800">
                <FileSpreadsheet className="w-4 h-4" /> Excel template (.xlsx)
              </button>
              <button onClick={downloadTemplateCsv} className="inline-flex items-center gap-1.5 text-sm border border-zinc-200 rounded-full px-3 py-2 text-zinc-700 hover:border-zinc-400">
                <Download className="w-3.5 h-3.5" /> CSV template
              </button>
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="radio" checked={replace} onChange={() => setReplace(true)} /> Replace the current leases
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" checked={!replace} onChange={() => setReplace(false)} /> Add to them
            </label>
          </div>

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handle(e.dataTransfer.files);
            }}
            className={`w-full border-2 border-dashed rounded-xl px-6 py-8 text-center transition-colors ${dragging ? "border-zinc-900 bg-zinc-50" : "border-zinc-300 hover:border-zinc-400"}`}
          >
            <Upload className="w-6 h-6 mx-auto text-zinc-400" />
            <p className="text-sm text-zinc-700 mt-2">
              <span className="font-medium text-zinc-900">Click to choose</span> or drag your register here
            </p>
            <p className="text-xs text-zinc-500 mt-1">Excel (.xlsx) or CSV</p>
          </button>
          <input ref={fileInput} type="file" accept=".csv,.txt,.xlsx,.xls" hidden onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />

          {errors.length > 0 && (
            <ul className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1 list-disc list-inside">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
