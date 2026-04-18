import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MasterService {
  constructor(private http: HttpClient) {}

  baseUrl = environment.apiUrl;

  private handleError(error: any, operation: string) {
    console.error(`${operation} failed:`, error);
    return throwError(() => new Error(`${operation} failed. Please try again.`));
  }

  Deletecustomer(code: string) {
    return this.http.delete(this.baseUrl + 'Customer/Remove?code=' + code)
      .pipe(catchError(err => this.handleError(err, 'Delete customer')));
  }
  
  GetCustomer() {
    return this.http.get(this.baseUrl + 'Customer/GetAll')
      .pipe(catchError(err => this.handleError(err, 'Get customers')));
  }
  
  GetCustomerbycode(code: any) {
    return this.http.get(this.baseUrl + 'Customer/GetByUniqueKeyID?Code=' + code)
      .pipe(catchError(err => this.handleError(err, 'Get customer')));
  }
  
  GetProducts() {
    return this.http.get(this.baseUrl + 'Product/GetAll')
      .pipe(catchError(err => this.handleError(err, 'Get products')));
  }
  
  GetProductbycode(code: any) {
    return this.http.get(this.baseUrl + 'Product/GetByCode?Code=' + code)
      .pipe(catchError(err => this.handleError(err, 'Get product')));
  }

  GetAllInvoice() {
    return this.http.get(this.baseUrl + 'Invoice/InvoiceCompanyCustomerController')
      .pipe(catchError(err => this.handleError(err, 'Get invoices')));
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
    return this.http.delete(this.baseUrl + 'Invoice/Remove?InvoiceNo=' + invoiceno)
      .pipe(catchError(err => this.handleError(err, 'Remove invoice')));
  }

  SaveInvoice(invoicedata: any) {
    return this.http.post(this.baseUrl + 'Invoice/Save', invoicedata)
      .pipe(catchError(err => this.handleError(err, 'Save invoice')));
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
        return throwError(() => new Error('Failed to download invoice PDF'));
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
        return throwError(() => new Error('Failed to download statement account PDF'));
      })
    );
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

  SaveProduct(productData: any) {
    return this.http.post(this.baseUrl + 'Product/SaveProduct', productData);
  }

  RemoveProduct(code: string) {
    return this.http.delete(this.baseUrl + 'Product/RemoveProduct?code=' + code);
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
