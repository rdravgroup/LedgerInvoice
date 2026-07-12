import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { customer } from '../_model/customer.model';
import { Observable } from 'rxjs';
import { CustomerApiResult } from '../_model/api-response.model';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {

  constructor(private http: HttpClient) { }

  baseUrl = environment.apiUrl;

  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    return throwError(() => new Error(error.message || 'An unexpected error occurred'));
  }

  Getall(companyId?: string): Observable<customer[]> {
    let url = this.baseUrl + 'Customer/GetAll';
    if (companyId) url += '?companyId=' + encodeURIComponent(companyId);
    return this.http.get<customer[]>(url)
      .pipe(catchError(err => this.handleError(err)));
  }

  Getbycode(code: string, companyId?: string): Observable<customer> {
    let url = this.baseUrl + 'Customer/GetByUniqueKeyID?code=' + encodeURIComponent(code);
    if (companyId) url += '&companyId=' + encodeURIComponent(companyId);
    return this.http.get<customer>(url)
      .pipe(catchError(err => this.handleError(err)));
  }

  Createcustomer(_data: customer, companyId?: string): Observable<CustomerApiResult> {
    let url = this.baseUrl + 'Customer/Create';
    if (companyId) url += '?companyId=' + encodeURIComponent(companyId);
    return this.http.post<CustomerApiResult>(url, _data)
      .pipe(catchError(err => this.handleError(err)));
  }

  Updatecustomer(_data: customer, companyId?: string): Observable<CustomerApiResult> {
    let url = this.baseUrl + 'Customer/Update?code=' + encodeURIComponent(_data.uniqueKeyID);
    if (companyId) url += '&companyId=' + encodeURIComponent(companyId);
    return this.http.put<CustomerApiResult>(url, _data)
      .pipe(catchError(err => this.handleError(err)));
  }

  Deletecustomer(code: string, companyId?: string): Observable<any> {
    let url = this.baseUrl + 'Customer/Remove?code=' + encodeURIComponent(code);
    if (companyId) url += '&companyId=' + encodeURIComponent(companyId);
    return this.http.delete(url)
      .pipe(catchError(err => this.handleError(err)));
  }

  ExportCustomersToExcel(): Observable<any> {
    return this.http.get(this.baseUrl + 'Exportexcel', {
      observe: 'response',
      responseType: 'blob'
    })
      .pipe(catchError(err => this.handleError(err)));
  }

}
