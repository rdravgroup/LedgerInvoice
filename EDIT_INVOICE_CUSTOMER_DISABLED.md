# Edit Invoice - Customer Dropdown Disabled Feature

## Overview

When editing an existing invoice, the **Customer dropdown is disabled** to prevent accidental customer changes. The customer information from the original API response is preserved and used when saving the edited invoice.

## What Changed

### 1. **Component Logic (createinvoice.component.ts)**

#### New Property Added:
```typescript
private apiCustomerId: string = ''; // Store original customer ID from API response for edit mode
```

This property stores the customer ID returned from the API when loading an invoice for editing.

#### SetEditInfo Method Updated:
```typescript
// Store the original customer ID from API response
this.apiCustomerId = editdata.customerId || '';

// ... other code ...

// Disable customer dropdown in edit mode by disabling the form control
this.invoiceform.get('customerId')?.disable();
```

When loading an invoice in edit mode:
- The original customer ID is stored in `apiCustomerId`
- The customer dropdown form control is disabled to prevent selection changes

#### SaveInvoice Method Updated:
```typescript
if (this.isedit) {
  this.invoiceform.patchValue({ updateBy: username });
  // In edit mode, restore the original customer ID from API response
  // This ensures we don't accidentally change the customer when saving
  this.invoiceform.patchValue({ customerId: this.apiCustomerId }, { emitEvent: false });
} else {
  this.invoiceform.patchValue({ createBy: username });
}
```

Before saving in edit mode:
- The original customer ID from the API response is restored to the form
- This guarantees the correct customer ID is sent to the backend, not any modified selection

### 2. **Template (createinvoice.component.html)**

#### Customer Dropdown Updated:
```html
<mat-form-field appearance="outline">
    <mat-label>Customer</mat-label>
    <mat-select formControlName="customerId" 
                (selectionChange)="customerchange($event.value)" 
                required 
                [disabled]="isedit">
        <mat-option *ngFor="let item of mastercustomer" [value]="item.uniqueKeyID">
            {{ item.name }}
        </mat-option>
    </mat-select>
    <mat-error *ngIf="invoiceform.get('customerId')?.hasError('required')">
        Customer is required
    </mat-error>
    <mat-hint *ngIf="isedit" class="hint-text">
        Customer cannot be changed in edit mode
    </mat-hint>
</mat-form-field>
```

Key changes:
- Added `[disabled]="isedit"` binding to disable the dropdown when editing
- Added hint text to inform users that customer cannot be changed in edit mode

## Flow Diagram

```
Load Edit Invoice (GET API)
    ↓
Get API Response with customerId
    ↓
Store customerId in apiCustomerId property
    ↓
Patch form with API data including customerId
    ↓
Disable customer dropdown control
    ↓
Display form (customer dropdown is read-only/disabled)
    ↓
User can view but not change customer
    ↓
User saves invoice
    ↓
Restore customerId from apiCustomerId (from API response)
    ↓
Send to backend with original customer ID
```

## User Experience

### Create Invoice Mode
- ✅ Customer dropdown is **ENABLED**
- ✅ User can freely select any customer
- ✅ Selection triggers customer change event to load details

### Edit Invoice Mode
- ❌ Customer dropdown is **DISABLED** (grayed out)
- ✅ Original customer name is displayed but not selectable
- ✅ Hint text explains: "Customer cannot be changed in edit mode"
- ✅ User cannot accidentally change the customer
- ✅ When saved, the original customer ID from API response is used

## API Integration

### When Loading Invoice for Edit:
```
GET /api/Invoice/InvoiceHeaderController?invoiceno=INV00000058

Response:
{
    "customerId": "CUST00000025",
    "customerName": "ABC Company",
    "invoiceNumber": "INV00000058",
    ... other fields
}
```

The `customerId` (CUST00000025) is stored in `apiCustomerId` for later use.

### When Saving Invoice:
```
PUT /api/Invoice/SaveInvoice
{
    "invoiceNumber": "INV00000058",
    "customerId": "CUST00000025",  ← Always the original customer ID
    "displayInvNumber": "T1",
    ... other fields
}
```

The `customerId` sent to backend is always from the API response (`apiCustomerId`), never from the dropdown selection.

## Code References

**Files Modified:**
1. [createinvoice.component.ts](createinvoice.component.ts)
   - Added `apiCustomerId` property
   - Updated `SetEditInfo()` method to store and disable
   - Updated `SaveInvoice()` method to restore customer ID

2. [createinvoice.component.html](createinvoice.component.html)
   - Added `[disabled]="isedit"` to mat-select
   - Added hint text for edit mode

## Testing Checklist

- [ ] **Create Invoice**: Customer dropdown is enabled, user can select any customer
- [ ] **Edit Invoice**: Customer dropdown is disabled and grayed out
- [ ] **Edit Invoice**: Hint text "Customer cannot be changed in edit mode" appears
- [ ] **Edit Invoice**: Customer name from API is displayed in dropdown
- [ ] **Edit Invoice - Save**: Saved invoice uses original customer ID from API, not any attempted selection
- [ ] **Edit Invoice - Verify**: Check backend logs to confirm correct customer ID is received

## Common Issues & Solutions

### Issue: Dropdown still allows selection in edit mode
**Solution**: Check that form control is properly disabled:
```typescript
this.invoiceform.get('customerId')?.disable(); // Make sure this line is called
```

### Issue: Customer ID changes when saving
**Solution**: Verify that customer ID restoration is called before save:
```typescript
// This MUST be called before getRawValue()
this.invoiceform.patchValue({ customerId: this.apiCustomerId }, { emitEvent: false });
```

### Issue: Form appears invalid when disabled
**Solution**: Use `formData.getRawValue()` which includes disabled controls, already implemented in the code.

## Future Enhancements

1. **Read-only Mode**: Display customer as read-only text instead of disabled dropdown
2. **Audit Trail**: Log customer ID changes if user attempts to bypass restrictions
3. **Permission-based**: Show/hide dropdown based on user role (e.g., admin can change customer)
4. **Customer Merge**: Handle scenarios where customer data is merged/consolidated

## Security Notes

✅ **Good Practices Implemented:**
- Customer dropdown is prevented at UI level (disabled)
- Customer ID is enforced at code level (restored from API before save)
- Original customer data is preserved from API response
- No opportunity for user to accidentally change customer

## Support

For issues or questions about this feature:
- Check browser console for DEBUG logs
- Verify API response contains correct `customerId`
- Ensure `apiCustomerId` is properly stored after API call
- Review form control state when entering edit mode
