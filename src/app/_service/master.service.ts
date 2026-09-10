import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MasterService {
  constructor(private http: HttpClient) {}

  baseUrl = environment.apiUrl;

  private handleError(error: any, operation: string) {
    console.error(`${operation} failed:`, error);
    return throwError(() => error);
  }

  Deletecustomer(code: string) {
    return this.http.delete(this.baseUrl + 'Customer/Remove?code=' + code)
      .pipe(catchError(err => this.handleError(err, 'Delete customer')));
  }
  
  GetCustomer(companyId?: string) {
    let url = this.baseUrl + 'Customer/GetAll';
    if (companyId) url += '?companyId=' + encodeURIComponent(companyId);
    return this.http.get(url)
      .pipe(catchError(err => this.handleError(err, 'Get customers')));
  }

  EnsureCashCustomer(companyId: string) {
    const url = this.baseUrl + 'Customer/EnsureCashCustomer?companyId=' + encodeURIComponent(companyId);
    return this.http.post(url, {})
      .pipe(catchError(err => this.handleError(err, 'Ensure cash customer')));
  }

  GetCustomerbycode(code: any, companyId?: string) {
    let url = this.baseUrl + 'Customer/GetByUniqueKeyID?Code=' + encodeURIComponent(code);
    if (companyId) url += '&companyId=' + encodeURIComponent(companyId);
    return this.http.get(url)
      .pipe(catchError(err => this.handleError(err, 'Get customer')));
  }
  
  GetProducts(companyId?: string) {
    let url = this.baseUrl + 'Product/GetAll';
    if (companyId) url += '?companyId=' + encodeURIComponent(companyId);
    return this.http.get(url)
      .pipe(catchError(err => this.handleError(err, 'Get products')));
  }
  
  GetProductbycode(code: any, companyId?: string) {
    let url = this.baseUrl + 'Product/GetByCode?Code=' + encodeURIComponent(code);
    if (companyId) url += '&companyId=' + encodeURIComponent(companyId);
    return this.http.get(url)
      .pipe(catchError(err => this.handleError(err, 'Get product')));
  }

  GetAllInvoice(companyId?: string) {
    // Dev-only: allow simulating a 403 subscription-expired response
    try {
      const simulate = !!environment.simulateSubscriptionExpired || (typeof window !== 'undefined' && localStorage?.getItem && localStorage.getItem('SIMULATE_SUBSCRIPTION_EXPIRED') === '1');
      if (simulate) {
        const fakeErr = new HttpErrorResponse({ status: 403, statusText: 'Forbidden', error: { status: 'error', message: 'Subscription expired' } });
        return throwError(() => fakeErr);
      }
    } catch {
      // ignore localStorage access errors in non-browser envs
    }

    let url = this.baseUrl + 'Invoice/InvoiceCompanyCustomerController';
    if (companyId) url += '?companyId=' + encodeURIComponent(companyId);
    return this.http.get(url).pipe(catchError(err => this.handleError(err, 'Get invoices')));
  }

  GetInvHeaderbycode(invoiceno: any) {
    return this.http.get(this.baseUrl + 'Invoice/InvoiceHeaderController?invoiceno=' + invoiceno)
      .pipe(catchError(err => this.handleError(err, 'Get invoice header')));
  }
  
  GetInvDetailbycode(invoiceno: any) {
    return this.http.get(this.baseUrl + 'Invoice/InvoiceSalesItemController?invoiceno=' + invoiceno)
      .pipe(catchError(err => this.handleError(err, 'Get invoice details')));
  }
  
  RemoveInvoice(invoiceno: any) {
    const encodedInvoiceNo = encodeURIComponent(invoiceno);
    return this.http.delete(this.baseUrl + 'Invoice/Remove?InvoiceNo=' + encodedInvoiceNo)
      .pipe(catchError(err => this.handleError(err, 'Remove invoice')));
  }

  SaveInvoice(invoicedata: any, companyId?: string) {
    let url = this.baseUrl + 'Invoice/Save';
    if (companyId) url += '?companyId=' + encodeURIComponent(companyId);
    return this.http.post(url, invoicedata)
      .pipe(catchError(err => this.handleError(err, 'Save invoice')));
  }

  GenerateDisplayInvoiceNumber(companyId: string, invoiceDate: Date) {
    const date = invoiceDate.toISOString().slice(0, 10);
    const url = `${this.baseUrl}Invoice/GenerateDisplayInvoiceNumber?companyId=${encodeURIComponent(companyId)}&invoiceDate=${encodeURIComponent(date)}`;
    return this.http.get<{ result?: string; Result?: string; displayInvNumber?: string }>(url)
      .pipe(catchError(err => this.handleError(err, 'Generate invoice number')));
  }

  GenerateInvoicePDF(invoiceno: string) {
    const encodedInvoiceNo = encodeURIComponent(invoiceno);
    const url = `${this.baseUrl}Invoice/${encodedInvoiceNo}/pdf`;

    return this.http.get(url, {
      observe: 'response',
      responseType: 'blob',
    }).pipe(
      catchError((error) => {
        console.error(`Error fetching invoice PDF for ${invoiceno}:`, error);
        return throwError(() => error);
      })
    );
  }

  GenerateStatementAccountPdf(invoiceno: string) {
    const encodedInvoiceNo = encodeURIComponent(invoiceno);
    const url = `${this.baseUrl}Invoice/${encodedInvoiceNo}/statement-account-pdf`;

    return this.http.get(url, {
      observe: 'response',
      responseType: 'blob',
    }).pipe(
      catchError((error) => {
        console.error(`Error fetching statement account PDF for ${invoiceno}:`, error);
        return throwError(() => error);
      })
    );
  }

  GeneratePosReceipt(invoiceno: string) {
    const encodedInvoiceNo = encodeURIComponent(invoiceno);
    return this.http.get(`${this.baseUrl}InvoiceDelivery/${encodedInvoiceNo}/pos-print`, {
      observe: 'response',
      responseType: 'blob',
    }).pipe(
      catchError((error) => {
        console.error(`Error fetching POS receipt for ${invoiceno}:`, error);
        return throwError(() => error);
      })
    );
  }

  GeneratePosReceiptPreview(invoiceno: string) {
    const encodedInvoiceNo = encodeURIComponent(invoiceno);
    return this.http.get(`${this.baseUrl}InvoiceDelivery/${encodedInvoiceNo}/pos-preview-pdf`, {
      observe: 'response',
      responseType: 'blob',
    }).pipe(
      catchError((error) => {
        console.error(`Error fetching POS preview for ${invoiceno}:`, error);
        return throwError(() => error);
      })
    );
  }

  SendInvoiceByEmail(invoiceno: string, toEmail?: string, subject?: string) {
    const encodedInvoiceNo = encodeURIComponent(invoiceno);
    const payload: any = {
      subject: subject || `Invoice ${invoiceno}`
    };
    if (toEmail && toEmail.trim()) payload.toEmail = toEmail.trim();

    return this.http.post(`${this.baseUrl}InvoiceDelivery/${encodedInvoiceNo}/send-email`, payload)
      .pipe(catchError(err => this.handleError(err, 'Send invoice email')));
  }

  BuildInvoiceWhatsAppLink(invoiceno: string, phoneNumber?: string) {
    const encodedInvoiceNo = encodeURIComponent(invoiceno);
    const payload: any = {};
    if (phoneNumber && phoneNumber.trim()) payload.phoneNumber = phoneNumber.trim();

    return this.http.post(`${this.baseUrl}InvoiceDelivery/${encodedInvoiceNo}/send-whatsapp`, payload)
      .pipe(catchError(err => this.handleError(err, 'Build invoice WhatsApp link')));
  }

  // Get subscription status for the current company (server will use token's CompanyId if none provided)
  GetSubscriptionStatus(companyId?: string) {
    let url = this.baseUrl + 'Subscription/Status';
    if (companyId) url += '?companyId=' + encodeURIComponent(companyId);
    return this.http.get(url).pipe(catchError(err => this.handleError(err, 'Get subscription status')));
  }

  // Master endpoints
  GetCategories() {
    return this.http.get(this.baseUrl + 'Master/CatGetAll')
      .pipe(catchError(err => this.handleError(err, 'Get categories')));
  }

  GetAllCategories() {
    return this.http.get(this.baseUrl + 'Master/CatGetAll');
  }

  GetCategoryByCode(ukid: string) {
    return this.http.get(this.baseUrl + 'Master/CatGetByCode?UKID=' + ukid);
  }

  GetCategoriesByName(categoryName: string) {
    return this.http.get(this.baseUrl + 'Master/CatGetbycategory?CategoryName=' + categoryName);
  }

  SaveCategory(categoryData: any) {
    return this.http.post(this.baseUrl + 'Master/SaveCategory', categoryData);
  }

  RemoveCategory(ukid: string) {
    return this.http.delete(this.baseUrl + 'Master/Remove?UKID=' + ukid);
  }

  GetAllMeasurements() {
    return this.http.get(this.baseUrl + 'Master/MeasurmentGetall');
  }

  GetProductsByName(name: string) {
    return this.http.get(this.baseUrl + 'Product/Getbyname?name=' + name);
  }

  SaveProduct(productData: any, companyId?: string) {
    const options = companyId ? { params: new HttpParams().set('companyId', companyId) } : {};
    return this.http.post(this.baseUrl + 'Product/SaveProduct', productData, options);
  }

  RemoveProduct(code: string, companyId?: string) {
    let url = this.baseUrl + 'Product/RemoveProduct?code=' + code;
    if (companyId) url += '&companyId=' + encodeURIComponent(companyId);
    return this.http.delete(url);
  }

  GetCountries() {
    return this.http.get(this.baseUrl + 'Master/GetCountries')
      .pipe(catchError(err => this.handleError(err, 'Get countries')));
  }

  GetStatesByCountry(countryCode: string) {
    return this.http.get(this.baseUrl + 'Master/GetStatesByCountry?countryCode=' + countryCode)
      .pipe(catchError(err => this.handleError(err, 'Get states')));
  }
}
