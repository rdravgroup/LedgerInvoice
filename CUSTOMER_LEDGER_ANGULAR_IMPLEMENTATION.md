# Customer Ledger - Angular Implementation Guide

## Project Structure Overview
```
src/app/
├── Component/
│   └── ledger/                           # ← NEW: Create this folder
│       ├── ledger-dashboard/
│       ├── ageing-report/
│       ├── outstanding-ar/
│       ├── payment-record/
│       └── disputes/
├── _service/
│   └── ledger.service.ts                 # ← NEW: Create this service
└── _model/
    └── ledger.model.ts                   # ← NEW: Create these models
```

---

## STEP 1: Create Customer Ledger Models

**File:** `src/app/_model/ledger.model.ts`

```typescript
// API Response Models
export interface APIResponse {
  result: string;
  errorMessage: string | null;
  data: any;
}

// Company-Level Summary
export interface CompanySummary {
  totalAR: number;
  totalDue: number;
  daysOutstanding: number;
  collectionRate: number;
  largestCustomer: string;
  currency: string;
}

// Ageing Distribution by Bucket
export interface AgeDistribution {
  bucket_0_30: AgeingBucket;
  bucket_30_60: AgeingBucket;
  bucket_60_90: AgeingBucket;
  bucket_90_plus: AgeingBucket;
}

export interface AgeingBucket {
  days: string;
  amount: number;
  percentage: number;
}

// Customer Outstanding Information
export interface CustomerOutstanding {
  customerId: string;
  customerName: string;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  daysOutstanding: number;
  lastPaymentDate: string | null;
}

// Customer Ledger Details
export interface CustomerLedger {
  customerId: string;
  customerName: string;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  daysOutstanding: number;
  transactions: LedgerTransaction[];
}

// Ledger Transaction
export interface LedgerTransaction {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  type: 'invoice' | 'payment' | 'adjustment';
  description: string;
  status: 'outstanding' | 'paid' | 'partial';
}

// Ageing Summary Timeline
export interface AgeingSummary {
  date: string;
  bucket_0_30: number;
  bucket_30_60: number;
  bucket_60_90: number;
  bucket_90_plus: number;
}

// Dispute
export interface Dispute {
  id: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  reason: string;
  status: 'open' | 'in-progress' | 'resolved';
  createdDate: string;
  notes: string[];
}

// Payment Request
export interface PaymentEntryRequest {
  customerId: string;
  invoiceNumber: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
}

// AR Analysis
export interface ARAnalysis {
  totalAR: number;
  totalPaid: number;
  collectionRate: number;
  averageDSO: number;
  trend: ARTrend[];
}

export interface ARTrend {
  month: string;
  ar: number;
  collected: number;
}

// Maintenance Status
export interface MaintenanceStatus {
  lastAgeingUpdateTime: string;
  lastOutstandingRefreshTime: string;
  lastSnapshotCreationTime: string;
  ageingUpdateStatus: string;
  outstandingRefreshStatus: string;
  snapshotCreationStatus: string;
}
```

---

## STEP 2: Create Customer Ledger Service

**File:** `src/app/_service/ledger.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, catchError, throwError } from 'rxjs';
import {
  APIResponse,
  CompanySummary,
  AgeDistribution,
  CustomerOutstanding,
  CustomerLedger,
  AgeingSummary,
  Dispute,
  PaymentEntryRequest,
  ARAnalysis,
  MaintenanceStatus
} from '../_model/ledger.model';

@Injectable({
  providedIn: 'root'
})
export class LedgerService {
  baseUrl = environment.apiUrl;
  
  private handleError(error: any): Observable<never> {
    console.error('Ledger API Error:', error);
    return throwError(() => new Error(error.message || 'Ledger API error occurred'));
  }

  constructor(private http: HttpClient) { }

  // ===== CORE READ ENDPOINTS =====

  /**
   * Get company-level AR summary (Total AR, DSO, Collection Rate)
   */
  getCompanySummary(companyId: string): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/company/${companyId}/summary`
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Get ageing distribution by buckets (0-30, 30-60, 60-90, 90+)
   */
  getAgeDistribution(companyId: string): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/company/${companyId}/age-distribution`
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Get list of customers with outstanding AR
   */
  getCustomersOutstanding(companyId: string, page: number = 1, pageSize: number = 10): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/customers-outstanding/${companyId}?page=${page}&pageSize=${pageSize}`
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Get customer ledger details
   */
  getCustomerLedger(customerId: string): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/customer/${customerId}`
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Get transaction history for customer
   */
  getCustomerHistory(customerId: string, page: number = 1, pageSize: number = 20): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/customer/${customerId}/history?page=${page}&pageSize=${pageSize}`
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Get ageing snapshot timeline for customer
   */
  getCustomerAgeingSummary(customerId: string, months: number = 6): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/customer/${customerId}/ageing-summary?months=${months}`
    ).pipe(catchError(err => this.handleError(err)));
  }

  // ===== ANALYSIS & REPORTING =====

  /**
   * Get AR metrics and trends
   */
  getARAnalysis(companyId: string): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/company/${companyId}/ar-analysis`
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Analyze overdue AR by due date
   */
  getDueDateAnalysis(companyId: string): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/company/${companyId}/due-date-analysis`
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Get customer payment trend analysis
   */
  getCustomerTrendAnalysis(customerId: string): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/customer/${customerId}/trend-analysis`
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Get month-end AR report
   */
  getMonthEndReport(companyId: string): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/company/${companyId}/month-end-report`
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Get executive summary for directors
   */
  getDirectorSummary(companyId: string): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/company/${companyId}/director-summary`
    ).pipe(catchError(err => this.handleError(err)));
  }

  // ===== MAINTENANCE OPERATIONS (MANUAL TRIGGER) =====

  /**
   * Manually trigger ageing bucket update (Admins only)
   */
  triggerAgeingUpdate(): Observable<APIResponse> {
    return this.http.post<APIResponse>(
      `${this.baseUrl}ledger/maintenance/update-ageing`,
      {}
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Manually trigger outstanding refresh (Admins only)
   */
  triggerOutstandingRefresh(): Observable<APIResponse> {
    return this.http.post<APIResponse>(
      `${this.baseUrl}ledger/maintenance/refresh-outstanding`,
      {}
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Manually trigger ageing snapshot creation (Admins only)
   */
  triggerSnapshotCreation(): Observable<APIResponse> {
    return this.http.post<APIResponse>(
      `${this.baseUrl}ledger/maintenance/create-snapshot`,
      {}
    ).pipe(catchError(err => this.handleError(err)));
  }

  // ===== DISPUTES =====

  /**
   * Get disputes for company
   */
  getDisputes(companyId: string): Observable<APIResponse> {
    return this.http.get<APIResponse>(
      `${this.baseUrl}ledger/company/${companyId}/disputes`
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Create new dispute
   */
  createDispute(dispute: Dispute): Observable<APIResponse> {
    return this.http.post<APIResponse>(
      `${this.baseUrl}ledger/disputes/create`,
      dispute
    ).pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Resolve dispute
   */
  resolveDispute(disputeId: string, resolution: string): Observable<APIResponse> {
    return this.http.post<APIResponse>(
      `${this.baseUrl}ledger/disputes/${disputeId}/resolve`,
      { resolution }
    ).pipe(catchError(err => this.handleError(err)));
  }

  // ===== PAYMENTS =====

  /**
   * Record customer payment
   */
  recordPayment(companyId: string, payment: PaymentEntryRequest): Observable<APIResponse> {
    return this.http.post<APIResponse>(
      `${this.baseUrl}ledger/payment-received`,
      payment
    ).pipe(catchError(err => this.handleError(err)));
  }
}
```

---

## STEP 3: Create Ledger Dashboard Component

**File:** `src/app/Component/ledger/ledger-dashboard/ledger-dashboard.component.ts`

```typescript
import { Component, OnInit } from '@angular/core';
import { LedgerService } from '../../../_service/ledger.service';
import { CompanySummary, AgeDistribution, APIResponse } from '../../../_model/ledger.model';
import { AuthenticationService } from '../../../_service/authentication.service';

@Component({
  selector: 'app-ledger-dashboard',
  templateUrl: './ledger-dashboard.component.html',
  styleUrls: ['./ledger-dashboard.component.css']
})
export class LedgerDashboardComponent implements OnInit {
  companySummary: CompanySummary | null = null;
  ageDistribution: AgeDistribution | null = null;
  loading = true;
  error: string | null = null;
  companyId: string = '';

  constructor(
    private ledgerService: LedgerService,
    private authService: AuthenticationService
  ) {
    this.companyId = authService.getCompanyId() || '';
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    // Get company summary
    this.ledgerService.getCompanySummary(this.companyId).subscribe({
      next: (response: APIResponse) => {
        if (response.result === 'pass') {
          this.companySummary = response.data;
        } else {
          this.error = response.errorMessage || 'Failed to load company summary';
        }
      },
      error: (err) => {
        this.error = 'Error loading company summary: ' + err.message;
        console.error(err);
      }
    });

    // Get age distribution
    this.ledgerService.getAgeDistribution(this.companyId).subscribe({
      next: (response: APIResponse) => {
        if (response.result === 'pass') {
          this.ageDistribution = response.data;
        } else {
          this.error = response.errorMessage || 'Failed to load age distribution';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error loading age distribution: ' + err.message;
        this.loading = false;
        console.error(err);
      }
    });
  }

  // Format currency
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(value);
  }
}
```

---

## STEP 4: Create Ledger Dashboard HTML Template

**File:** `src/app/Component/ledger/ledger-dashboard/ledger-dashboard.component.html`

```html
<div class="ledger-dashboard">
  <h2>Customer Ledger Dashboard</h2>

  <!-- Error Alert -->
  <div *ngIf="error" class="alert alert-danger">
    {{ error }}
  </div>

  <!-- Loading Spinner -->
  <div *ngIf="loading" class="spinner">
    <p>Loading ledger data...</p>
  </div>

  <!-- Summary Cards -->
  <div *ngIf="!loading && companySummary" class="summary-cards">
    <div class="card">
      <h4>Total A/R</h4>
      <p class="value">{{ formatCurrency(companySummary?.totalAR) }}</p>
    </div>

    <div class="card">
      <h4>Due Amount</h4>
      <p class="value text-danger">{{ formatCurrency(companySummary?.totalDue) }}</p>
    </div>

    <div class="card">
      <h4>Days Outstanding</h4>
      <p class="value">{{ companySummary?.daysOutstanding }} days</p>
    </div>

    <div class="card">
      <h4>Collection Rate</h4>
      <p class="value text-success">{{ (companySummary?.collectionRate * 100)?.toFixed(1) }}%</p>
    </div>

    <div class="card">
      <h4>Largest Customer</h4>
      <p class="value">{{ companySummary?.largestCustomer }}</p>
    </div>
  </div>

  <!-- Ageing Distribution -->
  <div *ngIf="!loading && ageDistribution" class="ageing-section">
    <h3>Ageing Distribution</h3>
    
    <div class="ageing-buckets">
      <div class="bucket" *ngFor="let key of ['bucket_0_30', 'bucket_30_60', 'bucket_60_90', 'bucket_90_plus']">
        <h5>{{ ageDistribution[key as keyof AgeDistribution]?.days }}</h5>
        <p>{{ formatCurrency(ageDistribution[key as keyof AgeDistribution]?.amount) }}</p>
        <div class="progress">
          <div class="progress-bar" 
            [style.width.%]="ageDistribution[key as keyof AgeDistribution]?.percentage"></div>
        </div>
        <small>{{ ageDistribution[key as keyof AgeDistribution]?.percentage }}%</small>
      </div>
    </div>
  </div>
</div>
```

---

## STEP 5: Create Outstanding AR Component

**File:** `src/app/Component/ledger/outstanding-ar/outstanding-ar.component.ts`

```typescript
import { Component, OnInit } from '@angular/core';
import { LedgerService } from '../../../_service/ledger.service';
import { CustomerOutstanding, APIResponse } from '../../../_model/ledger.model';
import { AuthenticationService } from '../../../_service/authentication.service';

@Component({
  selector: 'app-outstanding-ar',
  templateUrl: './outstanding-ar.component.html',
  styleUrls: ['./outstanding-ar.component.css']
})
export class OutstandingARComponent implements OnInit {
  customers: CustomerOutstanding[] = [];
  loading = true;
  error: string | null = null;
  companyId: string = '';
  currentPage = 1;
  pageSize = 10;

  constructor(
    private ledgerService: LedgerService,
    private authService: AuthenticationService
  ) {
    this.companyId = authService.getCompanyId() || '';
  }

  ngOnInit(): void {
    this.loadOutstandingCustomers();
  }

  loadOutstandingCustomers(): void {
    this.loading = true;
    this.error = null;

    this.ledgerService.getCustomersOutstanding(this.companyId, this.currentPage, this.pageSize).subscribe({
      next: (response: APIResponse) => {
        if (response.result === 'pass') {
          this.customers = response.data;
        } else {
          this.error = response.errorMessage || 'Failed to load customers';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error: ' + err.message;
        this.loading = false;
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(value);
  }

  getStatusClass(daysOutstanding: number): string {
    if (daysOutstanding <= 30) return 'status-ok';
    if (daysOutstanding <= 60) return 'status-warning';
    return 'status-danger';
  }
}
```

---

## STEP 6: Update App Routes

**File:** `src/app/app.routes.ts`

Add these routes:

```typescript
import { LedgerDashboardComponent } from './Component/ledger/ledger-dashboard/ledger-dashboard.component';
import { OutstandingARComponent } from './Component/ledger/outstanding-ar/outstanding-ar.component';

export const routes: Routes = [
  // ... existing routes ...

  {
    path: 'ledger',
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        component: LedgerDashboardComponent,
      },
      {
        path: 'outstanding',
        component: OutstandingARComponent,
      },
    ]
  },

  // ... rest of routes ...
];
```

---

## STEP 7: Add Menu Navigation Item

Update your menu/navbar to include:

```html
<li>
  <a routerLink="/ledger/dashboard">
    <i class="fa fa-bar-chart"></i> Ledger Dashboard
  </a>
</li>
<li>
  <a routerLink="/ledger/outstanding">
    <i class="fa fa-list"></i> Outstanding A/R
  </a>
</li>
```

---

## STEP 8: Quick Implementation Checklist

### Phase 1: Models & Services (30 min)
- [ ] Create `ledger.model.ts` with all interfaces
- [ ] Create `ledger.service.ts` with all endpoint methods
- [ ] Test services in browser console

### Phase 2: Dashboard Component (1 hour)
- [ ] Create `ledger-dashboard` component folder
- [ ] Create `.ts`, `.html`, `.css` files
- [ ] Implement summary card display
- [ ] Implement ageing distribution display
- [ ] Add loading and error states

### Phase 3: Outstanding AR Component (1 hour)
- [ ] Create `outstanding-ar` component folder
- [ ] Create `.ts`, `.html`, `.css` files
- [ ] Create data table with pagination
- [ ] Add filtering/sorting

### Phase 4: Routing & Navigation (30 min)
- [ ] Add routes to `app.routes.ts`
- [ ] Update navigation menu
- [ ] Test navigation

### Phase 5: Styling & Polish (1 hour)
- [ ] Add CSS for cards and tables
- [ ] Add Material Design (if using Angular Material)
- [ ] Responsive design for mobile

---

## TESTING ENDPOINTS IN POSTMAN

```
1. Get Company Summary
   GET: {{baseUrl}}/api/ledger/company/{{companyId}}/summary
   Headers: Authorization: Bearer {{token}}

2. Get Age Distribution
   GET: {{baseUrl}}/api/ledger/company/{{companyId}}/age-distribution
   Headers: Authorization: Bearer {{token}}

3. Get Outstanding Customers
   GET: {{baseUrl}}/api/ledger/customers-outstanding/{{companyId}}
   Headers: Authorization: Bearer {{token}}

4. Trigger Manual Update (Admin Only)
   POST: {{baseUrl}}/api/ledger/maintenance/update-ageing
   Headers: Authorization: Bearer {{admin_token}}
   Body: {}
```

---

## COMMON ISSUES & SOLUTIONS

### Issue 1: CORS Error
**Solution:** Verify proxy.conf.json or backend CORS settings
```json
{
  "/api": {
    "target": "http://localhost:5000",
    "secure": false
  }
}
```

### Issue 2: Unauthorized (401)
**Solution:** Check token in localStorage and ensure it includes CompanyId claim
```typescript
// In AuthenticationService
getCompanyId(): string {
  const token = localStorage.getItem('token');
  if (!token) return '';
  
  const decoded = JSON.parse(atob(token.split('.')[1]));
  return decoded['CompanyId'] || '';
}
```

### Issue 3: Data Not Loading
**Solution:** Check browser console for API errors and verify:
- CompanyId is being passed correctly
- User has proper role permissions
- API is returning data (test in Postman first)

---

## Next Steps After Basic Implementation

1. **Add Charts** - Use ChartJS or ng2-charts for ageing visualization
2. **Add Filters** - Filter by date range, customer, status
3. **Add Reports** - Generate PDF/Excel exports
4. **Add Disputes** - Full dispute management UI
5. **Add Payments** - Payment entry and reconciliation
6. **Add Maintenance Panel** - Admin panel for manual triggers

---

## Environment Setup

Ensure `environment.ts` has:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api/'
};
```

