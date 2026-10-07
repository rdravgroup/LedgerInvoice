# Home (Landing) Page: Current State and Improvement Proposal

## Current State

### Overview

The Home page is the landing page at `/` and `/home`. Both routes require authentication and pass the company activation guard. The page greets the user with the selected/current company name, provides quick links, shows key customer-ledger and invoice counts, and lists up to five recent invoices.

### Frontend

#### UI and statistics

- **Welcome header:** Displays `Welcome back, <company name>` (or `Store` when no company name is available).
- **View Company Details:** Opens a dialog with available company contact and identity information: email, mobile, address, GST number, bank/IFSC, and account number.
- **New Invoice:** Navigates to `/createinvoice`.
- **KPI cards:**
  - **Total A/R:** `totalAR` from the company outstanding summary; links to `/ledger-dashboard`.
  - **Total Paid:** `totalPaid` from the same summary; links to `/ledger-dashboard`.
  - **Overdue Amount:** `overdueAmount` mapped from the summary's `totalDue`; links to `/ledger-outstanding-ar`.
  - **Active Customers:** Count of customer records where `isActive` is true; links to `/customer`.
  - **Invoices This Month:** Displays `invoiceCount`; links to `/listinvoice`. Despite the label, the current call does not request a month date range, so the value is the count of all active invoices returned by the API, not necessarily invoices from this month.
- **Quick actions:** Quick Invoice (`/quick-invoice`), Add Customer (`/customer/add`), Products (`/product`), and Ledger Report (`/ledger-dashboard`).
- **Recent Invoices:** Shows up to five newest invoices, ordered by invoice date and then creation date in the backend. Desktop columns are Customer, Invoice #, Date, Amount, and an Edit action. The mobile layout shows customer, invoice number/date, and amount, without row actions.
- **View all:** Navigates to `/listinvoice`.
- **Empty state:** If the invoice response has no rows, displays “No invoices yet” and a Create Invoice button.
- **Loading state:** Displays KPI skeletons and a table placeholder while the invoice list is loading.
- **Responsive behavior:** KPI cards and invoice listings switch to a compact mobile layout at the configured breakpoint.

#### Listing behavior and interactions

- The Home page supplies no invoice date filters, search, or pagination controls.
- The page requests the invoice list and keeps the first five rows; sorting is performed by the backend.
- The Edit action navigates to `/editinvoice/<internal invoice number>`. No direct view, print, or download action is present on the Home listing.
- Changing the selected company reloads company data and dashboard data.
- Amounts are displayed as rupees using Angular number formatting; this template currently uses the default locale with zero decimals on KPI cards and two decimals in the desktop invoice amount. It does not dynamically use the company currency-number-format preference.

### Backend

#### APIs called

- `GET /api/Company/{companyId}`
  - Called through `UserService.getCompanyById` to load the company name/details for the header and details dialog.
  - Controller: `CompanyController.GetCompanyById`.
- `GET /api/Customer/GetAll[?companyId=...]`
  - Called through `CustomerService.Getall` for the customer-count KPI.
  - Controller: `CustomerController.GetAll`; service: `CustomerService.Getall`.
  - The client counts active customers after loading the returned customer list.
- `GET /api/Invoice/InvoiceCompanyCustomerController[?companyId=...]`
  - Called through `MasterService.GetAllInvoice`; Home passes the effective selected/token company ID, but no date range.
  - Controller: `InvoiceController.InvoiceCompanyCustomerController`; service: `InvoiceContainer.GetAllInvoicesWithCompanyCustomer`.
  - Returns active invoices, newest first, with invoice, company, and customer display fields.
- `GET /api/CustomerLedger/outstanding/report/company`
  - Called through `LedgerService.getCompanySummary`; no query parameters are provided by Home.
  - Controller: `CustomerLedgerController.GetCompanyOutstandingReport`; service: `CustomerLedgerService.GetCompanyOutstandingReport`.
  - The Angular ledger service derives summary values from the returned customer rows. If a 404 occurs, it falls back to mock summary data.

There is no dedicated Home/dashboard API or server-generated Home summary. The component orchestrates the calls and computes customer/invoice counts and some ledger totals in the browser.

#### Invoice-list server behavior

- The API restricts non-super users to their token company; super roles can use a requested company ID, or omit it to query across companies.
- The invoice query excludes inactive invoices (`tbl_Invoice.is_inactive = false`).
- Optional `fromDate` and `toDate` filters exist on the API, but Home does not send them.
- Results are ordered by invoice date descending, then creation date descending, and the full matching result is materialized before Home takes five rows.
- The response includes fields such as display/internal invoice number, invoice date, total amount, customer name, and company/customer details.

#### Outstanding-summary caveats

- The report endpoint defaults to `pageNumber=1` and `pageSize=100`; Home requests no larger page and the client sums the rows it receives. If a company has more customers than one page, the displayed sums may represent only the first page.
- `Total A/R` and `Total Paid` are sums of fields on returned customer-summary rows.
- The client derives `Overdue Amount` from overdue invoice details if present; otherwise it uses a fallback based on customer outstanding and average days-to-pay. This is not a dedicated aggregate of overdue invoice balances.
- The Home call does not pass the selected company ID to the ledger endpoint. `CustomerLedgerController` takes company scope from authentication claims, so an elevated user switching companies may not get a summary for the selected company.
- In the client adapter, a non-404 error resets summary values only partially: `totalAR` and overdue are reset, while `totalPaid` is not explicitly cleared in that error branch.

### Database

The Home page does not issue SQL directly. These are the principal persisted entities and columns used by its API calls.

#### Invoice and recent-invoice listing

- **`dbo.tbl_Invoice`** (`TblInvoiceHeader`)
  - Company/customer scope and joins: `company_id`, `customer_id`.
  - Listing values: `invoice_number`, `display_inv_number`, `invoice_year`, `invoice_date`, `create_date`, `totalamount`.
  - Active-state filter: `is_inactive`.
  - The returned DTO also maps additional invoice metadata, but the Home table uses customer name, invoice number, date, and total amount.
- **`dbo.tbl_customer`** (`TblCustomer`)
  - Join/key and customer display/count fields: `UniqueKeyID`, `companyid`, `Name`, `IsActive`.
  - The invoice listing also maps customer contact/address fields, although Home displays only the customer name.
- **`dbo.tbl_company`** (`TblCompanyImproved`)
  - Company join and header fields: `CompanyId`, `Name`; the company details dialog may use contact, address, GST, and bank/account columns.

The invoice service joins invoice rows to company by `company_id` and customer by `customer_id`, filters inactive invoices, applies optional date/company filters, and orders newest first.

#### Active-customer count

- `CustomerService.Getall` reads `dbo.tbl_customer`, scoped by `companyid` for ordinary users.
- It returns customer records; the Home component counts records with `IsActive = true` in memory.
- There is no dedicated `COUNT(*)` API for this KPI, so all scoped customer rows are fetched to count active customers.

#### Accounts-receivable figures

- **`dbo.tbl_customer_outstanding`** (`TblCustomerOutstanding`), joined to **`dbo.tbl_customer`** by company/customer:
  - Scope and join: `company_id`, `customer_id`.
  - Summary amounts: `total_invoiced`, `total_paid`, `outstanding_amount`.
  - Ageing values used to identify overdue balances: `current_0_30`, `overdue_31_60`, `overdue_61_90`, `overdue_90_plus`.
  - Other report metrics: `last_transaction_date`, `last_payment_date`, `highest_outstanding`, `average_days_to_pay`.
- The company report applies configured filters/sorting and paginates before returning rows; the Home client derives KPI totals from the returned page.
- Related transaction history is stored in `dbo.tbl_customer_ledger` (including `reference_type`, `reference_number`, `debit_amount`, `credit_amount`, and `outstanding_amount`), but the Home summary endpoint reads the denormalized outstanding table rather than querying ledger entries directly.

### Current limitations and missing features

- No sales-versus-purchase summary, revenue trend, or charts are displayed on Home; the money cards are accounts-receivable metrics.
- “Invoices This Month” is currently a misleading label because no month filter is passed; it counts all active invoices returned.
- Recent invoices have no Home-level search, date filter, pagination, or refresh control.
- The full invoice list and full customer list are fetched before the UI slices five invoices or counts active customers; this can become inefficient for large companies.
- The recent invoice list has an Edit action only on desktop; mobile rows do not expose Edit, View, Print, or Download actions.
- The ledger summary is based on a paginated report and may be incomplete for companies with more customers than the page size.
- Selected-company context is not sent to the outstanding-summary endpoint; elevated multi-company users can see a summary scoped to their token company instead.
- There is no Home-specific API error/empty state for customer and ledger KPI failures, and the page currently relies on fallback/reset behavior in the component/services.
- No dashboard charts or purchase-side statistics are present.

### Current-state summary

The current Home page is a responsive landing dashboard with company details, navigation shortcuts, five KPI cards, and a five-row recent-invoice preview. Invoice/customer figures and A/R metrics are assembled from existing company, customer, invoice, and outstanding-report APIs. The page does not currently provide sales or purchase analytics, charts, listing filters, or Home-specific document actions; its monthly invoice label and paginated ledger-summary aggregation should be treated as baseline limitations when planning improvements.

## Proposed Enhancements

### KPI cards and summary tabs

- Retain the existing A/R, Paid, Overdue, Active Customers, and Invoice Count metrics, correcting the Invoice Count label/value to reflect a selected date range or the current month.
- Add **Total Sales**, **Total Purchases**, **Sales Refunds**, **Purchase Refunds**, and **Current Stock Value** cards. Make each card clickable to its filtered invoice, purchase, refund, or stock report.
- Add a **Total Earnings** tab with the selected period’s sales, returns/refunds, purchases, and net sales. Define its formula visibly; do not label it profit unless cost of goods sold and other required expenses are available.
- Add tabs for **Total Orders**, **Purchases**, and **Sales**, each showing count and amount, trend versus the preceding equivalent period, and a drill-down link.
- Display purchase-versus-sales comparisons as separate measures, not as a single net figure with an ambiguous meaning.

### Sales, purchase, and stock analytics

- Add a bar chart comparing purchase and sales totals by assessment year (financial year from 1 April through 31 March), with selectable monthly or annual granularity.
- Add monthly/annual revenue comparisons with current-period and previous-period values and percentage change.
- Add a stock summary showing product count, current quantity/value, low-stock count, and a year-wise stock movement trend where historical movement data is available.
- Add a category pie/donut chart for product distribution, with clickable segments navigating to the category-filtered product or stock report. Revenue split by category can be a later option if product-level invoice data reliably supports it.
- Use high-contrast chart colors and subtle glow/highlight effects for readability. Keep labels, legends, keyboard interaction, and non-color distinctions so the charts remain accessible; respect reduced-motion preferences.
- Chart clicks should navigate to relevant reports with company, date range, assessment year, and category filters preserved.

### Filters, search, and notifications

- Add a common dashboard filter bar with month selection and From/To date pickers displayed as `dd/MM/yyyy`.
- Default the range to the current assessment year; switching to a month sets that month’s complete date range. Validate From Date is not after To Date and expose the active range.
- Add one quick-search field for invoices, products, and customers. Use a debounced server-side search with result types and direct links; do not load all records into the browser to search.
- Add a notification icon and dropdown for actionable alerts such as overdue invoices, low stock, and pending purchase approvals. Show counts, timestamps, and navigation to the source record/report.

### Recent transactions

- Replace or extend the recent-invoice-only area with a unified, paginated recent-transactions list for sales invoices, purchase invoices, customer/vendor refunds, and ledger payments.
- Show date, transaction type, reference, customer/vendor, amount, and status; provide type filters and direct view links.
- Include comparisons for net sales versus purchases and current period versus prior equivalent period.
- Keep recent-row actions appropriate to the transaction and permissions. Preserve the existing all-invoices link and avoid exposing Edit actions to users who cannot modify the record.

### Responsive and currency behavior

- Keep all cards, filters, charts, notification menus, and transaction listings usable on desktop and mobile, using a compact card layout for small screens.
- Add concise KPI tooltips defining scope, period, and formula.
- Format amounts with the selected company’s `CurrencyNumberFormat` (`en-IN` by default, or `en-US`) consistently in cards, chart tooltips, tables, exports, and drill-down pages. Keep API values numeric and calculations unrounded until presentation.
- Provide loading skeletons, empty states, and visible error/retry states per dashboard panel so one failed analytics call does not blank the entire page.

## Technical Implementation

### Angular frontend

- Evolve `HomeComponent` into a page coordinator and extract focused standalone components for:
  - Dashboard filter bar and shared date-range state.
  - KPI/summary cards and summary tabs.
  - Sales/purchase/year trend and category charts.
  - Notifications dropdown.
  - Unified recent-transactions table/cards.
- Reuse the app’s established company selection, currency-number-format, authentication, and route patterns.
- Prefer a chart library already present in the application; avoid adding another dependency until the existing package set is checked. Keep chart data preparation separate from display components.
- Use server-side filtering, sorting, and pagination for lists; debounce search input and cancel obsolete requests when filters/company selection change.
- Pass `companyId`, `fromDate`, `toDate`, and applicable `assessmentYear`, `groupBy`, page, and search parameters through typed frontend service contracts.

### Backend APIs and services

- Add a company-scoped dashboard summary endpoint, for example `GET /api/Dashboard/summary`, accepting a date range and optional period/grouping. Return numeric totals, counts, trend series, and alert counts in one response to avoid several independent full-table scans.
- Add or extend paginated endpoints for transaction history, global search, and notification details. Enforce company scope from authenticated claims; selected-company overrides must be limited to authorized super-admin roles.
- Reuse existing APIs where their data and filters fit:
  - `GET /api/Purchase/reports/purchase-register` for purchase invoice reporting.
  - `GET /api/Purchase/reports/vendor-outstanding` for vendor balances.
  - `GET /api/Purchase/reports/stock-summary` for the current product stock summary.
  - `GET /api/Invoice/InvoiceCompanyCustomerController` for active sales invoices (it already accepts optional date filters).
  - `GET /api/CustomerLedger/outstanding/report/company` for accounts-receivable reporting, while avoiding deriving company-wide totals from only its default paginated page.
- Implement a dedicated summary service behind a controller. Use EF Core projections and database-side `SUM`, `COUNT`, and `GROUP BY`, `AsNoTracking`, bounded result sizes, and cancellation-token forwarding. Do not materialize complete invoice, customer, or movement histories to compute cards.
- Specify definitions explicitly:
  - Sales gross: active sales invoices in the selected range; sales returns/refunds shown separately and subtracted only for a clearly named net-sales value.
  - Purchases gross: posted/non-cancelled purchase invoices in range; purchase returns and vendor refunds shown separately and only netted where appropriate.
  - Total orders: distinguish purchase orders from posted sales invoices/orders in both labels and API fields.
  - Stock on hand: current company/product stock quantity and valuation; historical year-end stock requires replayable, complete stock movements or stored snapshots and must not be inferred from current stock.
  - Earnings: show net sales as net sales, not profit, unless purchase/COGS and expense accounting are included with an agreed formula.
- Use date boundaries consistently: inclusive local date From and To at API boundaries; translate To Date to an exclusive next-day bound in database queries. Group assessment years according to the April–March business year.
- Return numeric JSON values and ISO dates. Apply company currency formatting in the Angular display and any generated export layer.
- Add focused tests for date boundaries, company authorization, return/refund signs, assessment-year grouping, empty periods, pagination, and summary reconciliation against detailed reports.

### Database and query sources

- **Sales:** `dbo.tbl_Invoice` (`company_id`, `invoice_date`, `totalamount`, `is_inactive`) and `dbo.tbl_sales_productinfo` (`invoice_year`, `invoice_number`, `product_id`, `quantity`, `taxable_amount`, GST amounts). Exclude inactive invoices/lines as appropriate.
- **Sales returns/refunds:** `dbo.tbl_sales_return` and `dbo.tbl_sales_return_item`, linked by return number and original invoice. Use return type and refund records/ledger linkage to avoid double-subtracting a refund from the credit-note effect.
- **Purchases:** `dbo.tbl_purchase_invoice` (`company_id`, `pi_number`, `invoice_date`, `status`, `grand_total`, paid/outstanding fields) and `dbo.tbl_purchase_invoice_item` (`pi_number`, product, quantity, taxable and total amounts).
- **Purchase returns/refunds/payments:** `dbo.tbl_purchase_return` / `dbo.tbl_purchase_return_item`, `dbo.tbl_purchase_refund`, `dbo.tbl_purchase_payment`, `dbo.tbl_purchase_ledger`, and `dbo.tbl_purchase_cash_bank_ledger`. Use company, transaction date, status, and reference columns to scope and classify records.
- **Stock:** `dbo.tbl_product` (`companyid`, `UniqueKeyID`, `product_name`, `category_code`, `stock_qty`, rates, and active state) provides current product balances. `dbo.tbl_stock_movement` (`company_id`, `product_id`, `movement_type`, `reference_type`, `reference_no`, `quantity`, `stock_before`, `stock_after`, `movement_date`) supports movement summaries and historical reconstruction only where movement history is complete.
- **Categories:** `dbo.tbl_Category` (`UniqueKeyID`, `Name`, `isactive`) joins to products by `category_code`.
- **Customer receivables:** `dbo.tbl_customer_outstanding` (`company_id`, `customer_id`, `total_invoiced`, `total_paid`, `outstanding_amount`, ageing buckets) and `dbo.tbl_customer_ledger` transaction fields.
- Current Purchase APIs already expose purchase register, vendor outstanding, and stock summary endpoints. The proposed Home summary endpoint should consolidate appropriate aggregates rather than creating competing definitions in Angular.
- For larger datasets, add/verify indexes around company plus transaction date/status and relevant foreign/reference keys. If dashboard latency warrants it, use explicitly refreshed daily/monthly aggregate snapshots with a documented refresh and reconciliation strategy; keep transactional detail as the source of truth.

## Expected Benefits

- Gives owners and staff a balanced view of sales, purchases, cash refunds, stock, and receivables instead of an A/R-only dashboard.
- Makes assessment-year and date-specific performance directly comparable, with clear drill-down paths to source transactions.
- Surfaces overdue, low-stock, and pending-approval issues sooner through notifications and actionable summaries.
- Reduces manual navigation and lookup time with unified transaction history and searchable invoice/product/customer records.
- Improves trust in KPIs by defining gross, return, refund, net-sales, stock, and earnings calculations and by avoiding totals derived from truncated pages.
- Improves performance for growing companies through server-side aggregation, bounded/paginated listings, company/date indexes, and independent dashboard panel loading.
- Maintains accessible, responsive visualizations and consistent company-level currency presentation across screen sizes and report links.

## Source files

- Frontend: [`home.component.ts`](./src/app/Component/home/home.component.ts), [`home.component.html`](./src/app/Component/home/home.component.html), [`app.routes.ts`](./src/app/app.routes.ts)
- Frontend services: [`master.service.ts`](./src/app/_service/master.service.ts), [`customer.service.ts`](./src/app/_service/customer.service.ts), [`ledger.service.ts`](./src/app/_service/ledger.service.ts), [`user.service.ts`](./src/app/_service/user.service.ts)
- Invoice backend: [`InvoiceController.cs`](../store-app-apis/Controllers/InvoiceController.cs), [`InvoiceContainer.cs`](../store-app-apis/Container/InvoiceContainer.cs), [`InvoiceFlatDto.cs`](../store-app-apis/Repos/Models/InvoiceFlatDto.cs)
- Customer backend: [`CustomerController.cs`](../store-app-apis/Controllers/CustomerController.cs), [`CustomerService.cs`](../store-app-apis/Container/CustomerService.cs)
- Ledger backend: [`CustomerLedgerController.cs`](../store-app-apis/Controllers/CustomerLedgerController.cs), [`CustomerLedgerService.cs`](../store-app-apis/Container/CustomerLedgerService.cs)
- Data models: [`TblInvoiceHeader.cs`](../store-app-apis/Repos/Models/TblInvoiceHeader.cs), [`TblCustomer.cs`](../store-app-apis/Repos/Models/TblCustomer.cs), [`TblCompanyImproved.cs`](../store-app-apis/Repos/Models/TblCompanyImproved.cs), [`LedgerModels.cs`](../store-app-apis/Repos/Models/LedgerModels.cs)
