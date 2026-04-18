# Ledger API - Documentation & Implementation Guide

## Issue Summary

The Angular `ledger-dashboard` component was calling **non-existent** API endpoints. The backend `CustomerLedgerController` has different endpoint URLs than what the Angular service was requesting.

---

## Correct API Endpoints (Backend - C#)

### Base URL
```
https://localhost:7238/api/ledger
```

### 1. Company-Level Reports

#### Get Outstanding AR Report
```
GET /api/ledger/outstanding/report/company
```
**Parameters:** (optional query params)
- `sortBy` - ("outstanding", "customerName", etc.)
- `showOnlyOverdue` - (true/false)
- `minDaysOverdue` - (number of days)

**Response:**
```json
{
  "pageNumber": 1,
  "pageSize": 20,
  "totalCount": 45,
  "totalPages": 3,
  "data": [
    {
      "customerId": "CUST001",
      "customerName": "ABC Corporation",
      "totalInvoiced": 50000,
      "totalPaid": 30000,
      "balance": 20000,
      "daysOutstanding": 45,
      "lastPaymentDate": "2026-03-15",
      "collectionRisk": "medium"
    },
    ...
  ]
}
```

#### Get Ageing Report
```
GET /api/ledger/ageing/report/company?pageNumber=1&pageSize=20
```

**Response:**
```json
{
  "pageNumber": 1,
  "pageSize": 20,
  "totalCount": 45,
  "data": [
    {
      "customerId": "CUST001",
      "customerName": "ABC Corporation",
      "bucket_0_30": 5000,
      "bucket_30_60": 3000,
      "bucket_60_90": 2000,
      "bucket_90_plus": 10000,
      "totalOutstanding": 20000,
      "healthScore": 65
    },
    ...
  ]
}
```

#### Get DSO Analysis
```
GET /api/ledger/analytics/dso
```

**Response:**
```json
{
  "companyId": "COMP1",
  "totalAR": 125000,
  "totalInvoiced": 500000,
  "dso": 91.25,
  "collectionRate": 0.85,
  "averageDaysOverdue": 30,
  "oldestInvoice": "2026-01-15"
}
```

---

### 2. Customer-Level Details

#### Get Customer Ledger Detail
```
GET /api/ledger/customer/{customerId}
```

**Response:**
```json
{
  "customerId": "CUST001",
  "customerName": "ABC Corporation",
  "openingBalance": 10000,
  "debits": 50000,
  "credits": 40000,
  "closingBalance": 20000,
  "currency": "USD",
  "lastTransactionDate": "2026-03-25"
}
```

#### Get Customer Statement (Paginated)
```
GET /api/ledger/customer/{customerId}/statement?pageNumber=1&pageSize=20
```

**Response:**
```json
{
  "pageNumber": 1,
  "pageSize": 20,
  "totalCount": 152,
  "data": [
    {
      "transactionId": 1001,
      "date": "2026-03-20",
      "invoiceNumber": "INV-001",
      "description": "Invoice",
      "debit": 5000,
      "credit": 0,
      "balance": 5000
    },
    ...
  ]
}
```

#### Get Customer Ageing Report
```
GET /api/ledger/ageing/{customerId}
```

**Response:**
```json
{
  "customerId": "CUST001",
  "customerName": "ABC Corporation",
  "totalOutstanding": 20000,
  "bucket_0_30": 5000,
  "bucket_30_60": 3000,
  "bucket_60_90": 2000,
  "bucket_90_plus": 10000,
  "healthScore": 65
}
```

---

### 3. Maintenance Operations (Admin Only)

#### Trigger Ageing Update
```
POST /api/ledger/maintenance/update-ageing
```

#### Trigger Outstanding Refresh
```
POST /api/ledger/maintenance/refresh-outstanding
```

#### Create Ageing Snapshot
```
POST /api/ledger/maintenance/create-snapshot
```

---

## Fixed Angular Services

All endpoints in `ledger.service.ts` have been updated to use the correct backend URLs.

### Key Changes:
1. **getCompanySummary()** - Now uses `/api/ledger/outstanding/report/company`
2. **getAgeDistribution()** - Now uses `/api/ledger/ageing/report/company`
3. **getCustomersOutstanding()** - Now uses `/api/ledger/outstanding/report/company` with pagination
4. **getCustomerHistory()** - Now uses `/api/ledger/customer/{customerId}/statement`
5. **getCustomerAgeingSummary()** - Now uses `/api/ledger/ageing/{customerId}`
6. **getARAnalysis()** - Now uses `/api/ledger/analytics/dso`
7. **recordPayment()** - Now uses `/api/ledger/payment` (POST)

---

## Dashboard Component - Data Mapping

The `ledger-dashboard.component.ts` needs to transform the API responses to the expected model format.

### Example: Transform Outstanding Report to Summary

```typescript
async loadDashboardData(): Promise<void> {
  try {
    this.loading = true;
    
    // Get outstanding report (for summary data)
    const outstandingResponse = await firstValueFrom(
      this.ledgerService.getCompanySummary(this.companyId)
    );
    
    if (outstandingResponse.data) {
      const customers = outstandingResponse.data;
      
      // Calculate aggregates from the list
      const totalAR = customers.reduce((sum, c) => sum + c.balance, 0);
      const totalDue = customers
        .filter(c => c.daysOutstanding > 30)
        .reduce((sum, c) => sum + c.balance, 0);
      
      const daysOutstanding = customers.length > 0
        ? Math.round(customers.reduce((sum, c) => sum + c.daysOutstanding, 0) / customers.length)
        : 0;
      
      // Get DSO for collection rate
      const dsoResponse = await firstValueFrom(
        this.ledgerService.getARAnalysis(this.companyId)
      );
      
      this.companySummary = {
        totalAR,
        totalDue,
        daysOutstanding,
        collectionRate: dsoResponse.data?.collectionRate || 0,
        largestCustomer: customers.length > 0 
          ? customers.sort((a, b) => b.balance - a.balance)[0].customerName
          : '',
        currency: 'USD'
      };
    }
    
    // Get ageing report
    const ageingResponse = await firstValueFrom(
      this.ledgerService.getAgeDistribution(this.companyId)
    );
    
    if (ageingResponse.data && ageingResponse.data.length > 0) {
      const ageingData = ageingResponse.data[0] || {};
      
      this.ageDistribution = {
        bucket_0_30: {
          amount: ageingData.bucket_0_30 || 0,
          percentage: this.calculatePercentage(ageingData.bucket_0_30, this.companySummary.totalAR),
          days: '0-30'
        },
        bucket_30_60: {
          amount: ageingData.bucket_30_60 || 0,
          percentage: this.calculatePercentage(ageingData.bucket_30_60, this.companySummary.totalAR),
          days: '30-60'
        },
        bucket_60_90: {
          amount: ageingData.bucket_60_90 || 0,
          percentage: this.calculatePercentage(ageingData.bucket_60_90, this.companySummary.totalAR),
          days: '60-90'
        },
        bucket_90_plus: {
          amount: ageingData.bucket_90_plus || 0,
          percentage: this.calculatePercentage(ageingData.bucket_90_plus, this.companySummary.totalAR),
          days: '90+'
        }
      };
    }
    
  } catch (error) {
    this.error = error instanceof Error ? error.message : 'Failed to load dashboard data';
    this.toastr.error(this.error);
  } finally {
    this.loading = false;
  }
}

private calculatePercentage(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}
```

---

## Next Steps

1. ✅ **Service Updated** - `ledger.service.ts` now calls correct endpoints
2. ⏳ **Component Update** - Update `ledger-dashboard.component.ts` to:
   - Transform API responses to local models
   - Handle pagination from list responses
   - Calculate aggregates (Total AR, DSO, Collection Rate)
3. ⏳ **Testing** - Test with real data from backend
4. ⏳ **Backend Enhancement** - Consider adding dedicated `/summary` endpoint for better performance

---

## API Response Structure

All API endpoints return:
```json
{
  "result": "pass|fail",
  "errorMessage": "null or error description",
  "message": "optional message",
  "data": { /* actual response data */ }
}
```

---

## Testing in Browser

Use these browser console commands to test:
```javascript
// Get outstanding report
fetch('https://localhost:7238/api/ledger/outstanding/report/company', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
.then(r => r.json())
.then(d => console.log(d))

// Get ageing report
fetch('https://localhost:7238/api/ledger/ageing/report/company', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
.then(r => r.json())
.then(d => console.log(d))

// Get DSO analysis
fetch('https://localhost:7238/api/ledger/analytics/dso', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
.then(r => r.json())
.then(d => console.log(d))
```

---

## Summary

| Feature | Old Endpoint | New Endpoint | Status |
|---------|------------|------------|--------|
| Company Summary | `/ledger/company/{id}/summary` ❌ | `/ledger/outstanding/report/company` ✅ | Fixed |
| Ageing Report | `/ledger/company/{id}/age-distribution` ❌ | `/ledger/ageing/report/company` ✅ | Fixed |
| DSO Analysis | `/ledger/company/{id}/ar-analysis` ❌ | `/ledger/analytics/dso` ✅ | Fixed |
| Customer Statement | `/ledger/customer/{id}/history` ❌ | `/ledger/customer/{id}/statement` ✅ | Fixed |
| Customer Ageing | `/ledger/customer/{id}/ageing-summary` ❌ | `/ledger/ageing/{id}` ✅ | Fixed |
| Record Payment | `/ledger/payment-received` ❌ | `/ledger/payment` ✅ | Fixed |
| Maintenance - Ageing | `/ledger/maintenance/update-ageing` ✅ | Same | ✅ Correct |
| Maintenance - Outstanding | `/ledger/maintenance/refresh-outstanding` ✅ | Same | ✅ Correct |
| Maintenance - Snapshot | `/ledger/maintenance/create-snapshot` ✅ | Same | ✅ Correct |
