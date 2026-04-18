import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { catchError, throwError } from 'rxjs';
import { ProductDTO } from '../_model/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    return throwError(() => new Error(error.message || 'An unexpected error occurred'));
  }

  getAllProducts(): Observable<ProductDTO[]> {
    return this.http.get<ProductDTO[]>(`${this.baseUrl}Product/GetAll`)
      .pipe(catchError(err => this.handleError(err)));
  }

  getProductById(id: string): Observable<ProductDTO> {
    return this.http.get<ProductDTO>(`${this.baseUrl}Product/GetByUniqueKeyID?code=${id}`)
      .pipe(catchError(err => this.handleError(err)));
  }

  searchProducts(searchTerm: string): Observable<ProductDTO[]> {
    return this.http.get<ProductDTO[]>(`${this.baseUrl}Product/Search?searchTerm=${searchTerm}`)
      .pipe(catchError(err => this.handleError(err)));
  }
}
