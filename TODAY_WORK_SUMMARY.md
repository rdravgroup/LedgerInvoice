# Today's Work Summary

Date: 2026-09-20

## Request handled

The goal was to support company-level invoice discount configuration and make the configured discount work in Create Invoice and Edit Invoice.

Supported configuration values:

- Discount mode: `none`, `itemwise`, `invoicewise`, or `both`
- Discount type: `percentage` or `manual`
- Discount value: numeric value such as `0.5`

## What was implemented

### Editable invoice discount controls

Create Invoice and Edit Invoice now expose discount inputs according to company configuration:

- `itemwise`: item discount input only
- `invoicewise`: overall discount input only
- `both`: both inputs
- `none`: no discount inputs

Each visible input supports percentage or manual amount. Company defaults are populated automatically, and users can override the type/value. Totals recalculate immediately while editing.

The controls are available in both desktop line-item rows and the mobile item editor. The invoice payload includes item and overall discount values and types.

### Backend validation and persistence

The API now:

- Enforces the company discount mode during save
- Validates percentage discounts are at most 100%
- Validates manual item discounts do not exceed the item amount
- Validates manual overall discounts do not exceed the invoice base
- Recalculates trusted totals server-side
- Persists item and overall discount values so Edit Invoice reloads them

Run the migration before deploying the API changes:

- `sql/invoice_discount_persistence.sql`

The same migration now also adds product master discount fields:

- `discount_type`
- `discount_value`

Product master values are used as the invoice item discount fallback when an item-specific invoice override is not entered. Product discount type/value are supported by the product API and product form.

### Company settings UI

Updated the company settings dialog so it contains controls for:

- Discount Mode
- Discount Type
- Default Discount Value
- Existing invoice configuration such as rate mode and invoice number mode
- Existing invoice action toggles and bank details

The company form normalizes the values and includes them in the update payload.

Files:

- `src/app/Component/companymanage/company-form-dialog.component.html`
- `src/app/Component/companymanage/company-form-dialog.component.ts`
- `src/app/_model/company.model.ts`

### Frontend invoice calculation

Updated Create Invoice/Edit Invoice so it loads the company discount configuration and recalculates totals.

The frontend now calculates:

- Item-wise percentage discounts
- Item-wise manual discounts
- Invoice-wise percentage discounts
- Invoice-wise manual discounts
- Combined item-wise and invoice-wise discounts

The final total is reduced by the calculated discount and the discount amount is included in the invoice payload.

File:

- `src/app/Component/createinvoice/createinvoice.component.ts`

### Visible invoice discount information

Initially, the discount calculation existed but the invoice page only displayed the final total. This was the missing visible part reported during verification.

The invoice page now displays:

- An active discount banner
- Current discount mode
- Current discount type/value
- Total applied discount
- Separate Item wise and Invoice wise discount rows in the summary panel

The desktop and mobile invoice layouts now also include inline validation messages for negative values, percentages above 100%, and manual discounts above the applicable item/invoice amount.

Files:

- `src/app/Component/createinvoice/createinvoice.component.html`
- `src/app/Component/createinvoice/createinvoice.component.css`

### Frontend regression coverage

Added and retained focused regression coverage for invoice discount calculation.

File:

- `src/app/Component/createinvoice/createinvoice.component.spec.ts`

### Backend enforcement

Updated the API invoice save pipeline so it loads the company discount configuration and applies the discount before persisting invoice totals.

The backend supports the same modes and types as the frontend and prevents invalid discount values from bypassing the rule.

Files in the API project:

- `store-app-apis/Container/InvoiceContainer.cs`
- `store-app-apis/Container/CompanyService.cs`
- `store-app-apis/Modal/CompanyRequestDTO.cs`
- `store-app-apis/Repos/Models/TblCompanyImproved.cs`

## Database finding

The older `db48413_live.sql` file contained the company configuration columns such as:

- `sales_invoice_rate_mode`
- `invoice_display_number_mode`
- `invoice_display_number_prefix`
- `show_action_*`

But it did not contain these discount columns:

- `discount_mode`
- `discount_type`
- `discount_value`

That caused SQL Server error 207 when the script tried to reference the missing columns.

The required database change is to add these columns to `dbo.tbl_company`:

- `discount_mode NVARCHAR(20)` with default `none`
- `discount_type NVARCHAR(20)` with default `percentage`
- `discount_value DECIMAL(18,2)` with default `0`

You confirmed that the current database is now updated and contains this row for `COMP8`:

- `discount_mode = itemwise`
- `discount_type = percentage`
- `discount_value = 0.50`

## What was missed or was incomplete

### 1. The database schema script was not updated

The application model and API were updated before the old database script was updated. This caused repeated `Invalid column name 'discount_mode'` errors.

The missing deliverable was a committed database migration or an updated SQL script containing the three discount columns. The database was later updated manually, but the old source SQL file itself was not updated as part of the code change.

### 2. API integration was blocked by authentication

The local API was started on port `5096` and both the company route and invoice route were reached. They returned `401 Unauthorized`, so response-field propagation could not be inspected without a valid login token.

The Angular API configuration points to port `7238`, but that port was not listening; the launch profile uses HTTP port `5096`.

### 3. Existing compiler warnings remain

The API build succeeds, but the project still reports existing nullable-reference and platform warnings. They were not related to this discount change and were not modified.

### 4. Angular adapter warning cleaned up

`InvoiceDateAdapter` now has an explicit `@Injectable()` decorator. The focused test no longer reports that deprecation warning.

## Verification completed

### Angular focused test

Command:

```powershell
Set-Location -Path 'D:\Applications\BillingERP\store_app'
npx ng test --watch=false --browsers=ChromeHeadless --include src/app/Component/createinvoice/createinvoice.component.spec.ts
```

Result:

```text
TOTAL: 3 SUCCESS
```

### Angular build

Command:

```powershell
Set-Location -Path 'D:\Applications\BillingERP\store_app'
npx ng build --configuration development
```

Result:

```text
Application bundle generation complete.
```

### Backend build

The .NET API build completed successfully. Existing nullable-reference and platform warnings remain in unrelated areas.

## Current expected behavior

For company `COMP8`, after a browser hard refresh and after at least one invoice item is added:

- The invoice page should show `Discount active: Item wise`
- It should show `0.5% configured from Company Settings`
- The summary should show the applied Item wise discount amount
- The final invoice total should be reduced by `0.5%` of each item amount
- The backend should recalculate/enforce the company discount during invoice save

## Recommended next checks

If the banner still does not appear, inspect the browser Network response for:

```text
GET Company/COMP8
```

The response must contain either camel-case or Pascal-case properties:

```json
{
  "discountMode": "itemwise",
  "discountType": "percentage",
  "discountValue": 0.5
}
```

If those properties are missing from the response, the issue is in the running API deployment or database connection, not in the invoice template.
