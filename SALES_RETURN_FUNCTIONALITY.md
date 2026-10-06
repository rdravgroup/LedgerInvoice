# Sales Returns: Current Functionality

## What the feature does

Sales returns are created from **Invoice List → Actions → Return** (also available on the mobile invoice card). The action is shown to users allowed to return invoices and is disabled for locked invoices. `openReturn()` checks the same conditions, opens the Sales Return dialog, and reloads the invoice list after a successful create.

The dialog loads only returnable invoice lines from `GET /api/Invoice/Return/Items/{invoiceNumber}`. The API provides sold and previously-returned quantities, so each selected line defaults to its remaining returnable quantity. Users choose **Credit Note (adjust balance)** or **Refund (adjust balance + record payment)**, select one or more lines, enter quantities and an optional reason, and click **Create Return**. Line totals use the invoice's taxable unit rate plus GST, with amounts rounded to two decimals. Refunds also require a date and payment mode (`cash`, `bank_transfer`, `upi`, `card`, or `cheque`); bank transfer and cheque require a bank name. The dialog sends these fields with the return lines to `POST /api/Invoice/Return/Create`.

## What happens when Create Return is clicked

The API requires authentication and rejects `super_duper_admin` as read-only. It resolves the company scope, then the service checks that the invoice exists in scope and is not locked or inactive. It validates each product against the invoice and checks that its quantity does not exceed the sold quantity less quantities recorded on prior returns.

Within a serializable database transaction, the service validates the invoice scope, lock state, selected products, and remaining quantities against stored invoice lines and previous returns. It calculates prices and GST from the invoice records (not client-submitted amounts), generates an `SR` return number and `CN` credit-note number, and saves the return header and item rows. It adds returned quantities to stock, writes `RETURN_IN` movements referencing the return, increments the invoice's `total_returns`, writes the customer-ledger `RETURN` credit, and persists a `SalesReturn` audit record with invoice, reason, user, date, and IP. For **Refund**, the same transaction also adds a `SALES_REFUND` cash/bank ledger outflow (linked by `return_no`) and a customer-ledger `REFUND` debit. A failure before commit rolls back these changes together. On success, the dialog displays both generated numbers and offers print and PDF download of the return slip.

## Database records

The EF Core entities map to **`tbl_sales_return`** and **`tbl_sales_return_item`**. The header stores the return number, company/customer/invoice links, return date and type, reason/remark, status, subtotal, GST total, grand total, credit-note number, and create user/date/IP. Each item row stores the return number, product, quantity, rate, taxable amount, GST rate/amount, and total. `return_no` is the header key; item rows use an identity `rec_id`.

The create operation also updates the original invoice's `total_returns` and product stock; inserts rows in `tbl_stock_movement`, `tbl_customer_ledger`, and the audit log; and does not delete or rewrite the original invoice lines. Customer-ledger credit-note entries use reference type `RETURN`, reference number `return_no`, credit amount equal to the return grand total, and a negative outstanding amount. Refund entries use reference type `REFUND` and the same return reference. `tbl_cashbank_ledger` records a `SALES_REFUND` transaction with payment mode, account/bank details, reference, date, and credit amount (cash leaving the business). The generated credit-note number is stored on the return header and included in ledger descriptions; there is no separate credit-note entity in this flow.

The EF entities map `tbl_sales_return`, `tbl_sales_return_item`, and `tbl_cashbank_ledger`; the context registers their `DbSet`s. Run `store-app-apis/Migrations/AddSalesReturnCashBankLedger.sql` against the target database before using the updated refund workflow. It creates missing tables and indexes and adds refund-specific columns when the sales return table already exists.

## Credit Note versus Refund

Both return types create the credit note and reduce customer receivables. **Refund** additionally records the cash/bank outflow and customer-ledger settlement entry using the full calculated return amount. The API validates the return type and supported payment modes.

## Returns page and reporting

The separate **Sales Returns** page reads the shared `GET /api/Invoice/Report?reportType=returns` endpoint and exports through `GET /api/Invoice/Report/Export?reportType=returns`. It shows return number, original invoice, date, customer, type, refund date/mode, total, credit-note number, and reason, with date/customer filters, text search, sorting, pagination, total value, CSV, Excel, and PDF exports, and print. Dates are selected/displayed as `dd/MM/yyyy`; the default is the current April–March assessment year; page sizes are 10–1000 with a default of 500.

Date, company, and customer filters are applied by the backend, and results are sorted newest first. The report materializes the filtered results before the browser performs page-size pagination. Report and return-slip currency amounts use Indian digit grouping.

## Main implementation files

- Invoice-list action and dialog launch: [`src/app/Component/listinvoice/listinvoice.component.ts`](./src/app/Component/listinvoice/listinvoice.component.ts), [`src/app/Component/listinvoice/listinvoice.component.html`](./src/app/Component/listinvoice/listinvoice.component.html)
- Return form and request creation: [`src/app/Component/listinvoice/sales-return-dialog.component.ts`](./src/app/Component/listinvoice/sales-return-dialog.component.ts), [`src/app/Component/listinvoice/sales-return-dialog.component.html`](./src/app/Component/listinvoice/sales-return-dialog.component.html)
- API endpoint and DTOs: [`store-app-apis/Controllers/InvoiceController.cs`](../store-app-apis/Controllers/InvoiceController.cs), [`store-app-apis/Modal/SalesDTOs.cs`](../store-app-apis/Modal/SalesDTOs.cs)
- Persistence, stock, ledger, audit, and reports: [`store-app-apis/Service/SalesReturnService.cs`](../store-app-apis/Service/SalesReturnService.cs), [`store-app-apis/Repos/Models/TblSalesReturn.cs`](../store-app-apis/Repos/Models/TblSalesReturn.cs)
- Return-list UI: [`src/app/Component/sales-returns/sales-returns.component.ts`](./src/app/Component/sales-returns/sales-returns.component.ts), [`src/app/Component/sales-returns/sales-returns.component.html`](./src/app/Component/sales-returns/sales-returns.component.html)
