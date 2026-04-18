import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, map } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';
import { Company } from '../_model/company.model';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  private baseUrl = environment.apiUrl + 'Company/';

  constructor(private http: HttpClient) {}

  private handleError(error: any, operation = 'operation') {
    console.error(`${operation} failed`, error);
    return throwError(() => new Error(`${operation} failed. Please try again.`));
  }

  getAllCompanies(includeInactive = false, searchByName?: string): Observable<Company[]> {
    let url = `${this.baseUrl}list/all?includeInactive=${includeInactive}`;
    if (searchByName) url += `&searchByName=${encodeURIComponent(searchByName)}`;
    return this.http.get<any>(url).pipe(
      map((res) => {
        if (!res) return [] as Company[];
        if (Array.isArray(res)) return res as Company[];
        if (res.data && Array.isArray(res.data)) return res.data as Company[];
        return [] as Company[];
      }),
      catchError((err) => this.handleError(err, 'Get all companies'))
    );
  }

  getActiveCompanies(): Observable<Company[]> {
    const url = `${this.baseUrl}list/active`;
    return this.http.get<any>(url).pipe(
      map((res) => {
        if (!res) return [] as Company[];
        if (Array.isArray(res)) return res as Company[];
        if (res.data && Array.isArray(res.data)) return res.data as Company[];
        return [] as Company[];
      }),
      catchError((err) => this.handleError(err, 'Get active companies'))
    );
  }

  getCompanyById(companyId: string): Observable<Company> {
    const url = `${this.baseUrl}${encodeURIComponent(companyId)}`;
    return this.http.get<any>(url).pipe(
      map((res) => {
        if (!res) return {} as Company;
        if (res.data) return res.data as Company;
        return res as Company;
      }),
      catchError((err) => this.handleError(err, 'Get company'))
    );
  }

  createCompany(payload: any) {
    const url = `${this.baseUrl}create`;
    return this.http.post<any>(url, payload).pipe(catchError((err) => this.handleError(err, 'Create company')));
  }

  updateCompany(payload: any) {
    const url = `${this.baseUrl}update`;
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.put<any>(url, payload, { headers }).pipe(catchError((err) => this.handleError(err, 'Update company')));
  }

  changeCompanyStatus(payload: any) {
    const url = `${this.baseUrl}status`;
    return this.http.patch<any>(url, payload).pipe(catchError((err) => this.handleError(err, 'Change company status')));
  }

  // Declarations
  createDeclaration(payload: any) {
    const url = `${this.baseUrl}declaration/create`;
    return this.http.post<any>(url, payload).pipe(catchError((err) => this.handleError(err, 'Create declaration')));
  }

  updateDeclaration(payload: any) {
    const url = `${this.baseUrl}declaration/update`;
    return this.http.put<any>(url, payload).pipe(catchError((err) => this.handleError(err, 'Update declaration')));
  }

  deleteDeclaration(recId: number) {
    const url = `${this.baseUrl}declaration/delete/${recId}`;
    return this.http.delete<any>(url).pipe(catchError((err) => this.handleError(err, 'Delete declaration')));
  }

  getDeclarations(companyId: string): Observable<any[]> {
    const url = `${this.baseUrl}declaration/list/${encodeURIComponent(companyId)}`;
    return this.http.get<any>(url).pipe(
      map((res) => {
        if (!res) return [] as any[];
        if (Array.isArray(res)) return res as any[];
        if (res.data && Array.isArray(res.data)) return res.data as any[];
        return [] as any[];
      }),
      catchError((err) => this.handleError(err, 'Get declarations'))
    );
  }
}
