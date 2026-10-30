# IFRS 16 Lease Calculator

A lessee lease accounting tool under IFRS 16. For a whole portfolio of leases it calculates the lease liability and right-of-use asset, builds monthly amortisation schedules and journal entries, and produces the year-end disclosures.

**Live demo:** https://dewapriya.com/projects/ifrs16/

> The sample is **fictional**: the lease portfolio of a Maldives seaplane operator, the same company as my [AR Collections Dashboard](https://github.com/amila-nandasiri/ar-collections-dashboard) and [13-Week Cash Flow Forecast](https://github.com/amila-nandasiri/cash-flow-forecast). It is a portfolio project, not a substitute for professional advice.

## Why I built it

Aircraft and property leases are among the largest balances on an airline's balance sheet, and IFRS 16 is where many teams fall back on fragile spreadsheets. This tool applies the standard consistently across every lease, shows the workings, and produces the numbers auditors ask for.

## What it does

**For each lease:**

- **Initial measurement (IFRS 16.23–28):**
  - The lease liability is the present value of payments not paid at commencement, including fixed escalations, residual value guarantees and purchase options reasonably certain to be exercised.
  - The right-of-use asset adds payments made at commencement, initial direct costs and restoration or redelivery costs, less incentives received.
- **Monthly amortisation schedule:** interest, payments and the closing liability, plus straight-line depreciation over the lease term. When a purchase option is reasonably certain, depreciation runs over the asset's useful life instead (IFRS 16.32).
- **Expense profile:** IFRS 16 expense (depreciation plus interest) against straight-line rent, showing how the standard front-loads expense.
- **Journal entries:** at commencement and for the year.
- **Recognition exemptions:** short-term and low-value leases are expensed straight-line, with nothing on the balance sheet (IFRS 16.5–8).

**For the portfolio, by financial year:**

- **Lease liabilities:** the movement (opening, new leases, interest, payments, closing) and the current/non-current split
- **Right-of-use assets:** the movement by asset class
- **Profit or loss:** depreciation, interest, and short-term and low-value expense
- **Cash outflow:** principal, interest, payments at commencement and exempt leases
- **Maturity analysis:** undiscounted payments by year, reconciled to the lease liability

## Use your own leases

Add or edit leases in the app, or upload a lease register (Excel or CSV, one row per lease). Download the **Excel template** from the upload panel; it explains every column. Files are processed entirely in the browser, and nothing is uploaded or stored.

## Reports

- **Excel report:** disclosures, the register with calculated balances, journals for the year, and a monthly schedule sheet for each lease
- **PDF:** prints the page on landscape A4
- **CSV:** the lease register, and the selected lease's schedule

## Calculation conventions

| | |
|---|---|
| Discount rate | Annual effective rate, converted to monthly: (1 + r)^(1/12) − 1 |
| Timing | Interest accrues monthly. Payments in advance fall at the start of each period (the first at commencement); payments in arrears fall at the end |
| Escalation | A fixed % increase every 12 months from commencement |
| Current portion | The liability at year end less the liability 12 months later |
| Not modelled | Lease modifications, index-linked variable payments and reassessments |

The calculations are checked against textbook cases. For example, payments of 100 a year in arrears for 3 years at 5% give a liability of 272.32 and total interest of 27.68. The roll-forwards reconcile exactly.

## Tech

- **App:** React, TypeScript, Recharts and Tailwind CSS, built with Vite
- **Engine:** [`src/lib/ifrs16.ts`](src/lib/ifrs16.ts) covers measurement, schedules, disclosures and journals
- **Sample data:** [`data/leases.csv`](data/leases.csv), in the same format as the upload template
- **Offline version:** `npm run build` also produces `dist/ifrs16-lease-calculator.html`, a single self-contained file

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

---

Built by [Amila Dewapriya](https://dewapriya.com), CMA: finance professional building with data and code.
