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

  Getall(): Observable<customer[]> {
    return this.http.get<customer[]>(this.baseUrl + 'Customer/GetAll')
      .pipe(catchError(err => this.handleError(err)));
  }

  Getbycode(code: string): Observable<customer> {
    return this.http.get<customer>(this.baseUrl + 'Customer/GetByUniqueKeyID?code=' + code)
      .pipe(catchError(err => this.handleError(err)));
  }

  Createcustomer(_data: customer): Observable<CustomerApiResult> {
    return this.http.post<CustomerApiResult>(this.baseUrl + 'Customer/create', _data)
      .pipe(catchError(err => this.handleError(err)));
  }

  Updatecustomer(_data: customer): Observable<CustomerApiResult> {
    return this.http.put<CustomerApiResult>(this.baseUrl + 'Customer/Update?code=' + _data.uniqueKeyID, _data)
      .pipe(catchError(err => this.handleError(err)));
  }

  Deletecustomer(code: string): Observable<any> {
    return this.http.delete(this.baseUrl + 'Customer/Remove?code=' + code)
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
