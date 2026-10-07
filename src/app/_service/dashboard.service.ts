import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DashboardSummary {
  fromDate: string;
  toDate: string;
  totalAR: number;
  totalPaid: number;
  overdueAmount: number;
  activeCustomers: number;
  invoiceCount: number;
  purchaseCount: number;
  orderCount: number;
  totalSales: number;
  totalSalesReturns: number;
  salesRefunds: number;
  netSales: number;
  totalPurchases: number;
  totalPurchaseReturns: number;
  purchaseRefunds: number;
}

export interface DashboardStockSummary {
  currentStockValue: number;
  currentStockQuantity: number;
  lowStockCount: number;
  pendingApprovalCount: number;
}

export interface DashboardAnalytics {
  assessmentTrends: { assessmentYear: number; sales: number; purchases: number }[];
  monthlyTrends: { year: number; month: number; sales: number; purchases: number }[];
  categories: { categoryCode: string; categoryName: string; productCount: number; stockQuantity: number }[];
  topProducts: { productId: string; productName: string; quantitySold: number; salesAmount: number }[];
}

export interface DashboardAlert {
  type: string;
  title: string;
  detail: string;
  amount?: number | null;
  date?: string | null;
  route: string;
}

export interface DashboardTransaction {
  date: string;
  type: string;
  reference: string;
  party: string;
  amount: number;
  status: string;
  route: string;
}

export interface DashboardSearchResult {
  type: string;
  label: string;
  detail: string;
  route: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly baseUrl = environment.apiUrl + 'Dashboard/';

  constructor(private readonly http: HttpClient) {}

  getSummary(companyId: string, fromDate: string, toDate: string, customerId?: string): Observable<DashboardSummary> {
    const params = new HttpParams()
      .set('companyId', companyId)
      .set('fromDate', fromDate)
      .set('toDate', toDate)
      .set('groupBy', 'month')
      .set('customerId', customerId || '');
    return this.http.get<DashboardSummary>(this.baseUrl + 'summary', { params });
  }

  getAlerts(companyId: string): Observable<DashboardAlert[]> {
    return this.http.get<DashboardAlert[]>(this.baseUrl + 'alerts', {
      params: new HttpParams().set('companyId', companyId)
    });
  }

  getAnalytics(companyId: string, fromDate: string, toDate: string, customerId?: string): Observable<DashboardAnalytics> {
    const params = new HttpParams()
      .set('companyId', companyId)
      .set('fromDate', fromDate)
      .set('toDate', toDate)
      .set('customerId', customerId || '');
    return this.http.get<DashboardAnalytics>(this.baseUrl + 'analytics', { params });
  }

  getStockSummary(companyId: string): Observable<DashboardStockSummary> {
    return this.http.get<DashboardStockSummary>(this.baseUrl + 'stock', {
      params: new HttpParams().set('companyId', companyId)
    });
  }

  getTransactions(companyId: string, fromDate: string, toDate: string, customerId?: string): Observable<DashboardTransaction[]> {
    const params = new HttpParams()
      .set('companyId', companyId)
      .set('fromDate', fromDate)
      .set('toDate', toDate)
      .set('customerId', customerId || '');
    return this.http.get<DashboardTransaction[]>(this.baseUrl + 'transactions', { params });
  }

  search(companyId: string, query: string): Observable<DashboardSearchResult[]> {
    const params = new HttpParams().set('companyId', companyId).set('query', query);
    return this.http.get<DashboardSearchResult[]>(this.baseUrl + 'search', { params });
  }
}
