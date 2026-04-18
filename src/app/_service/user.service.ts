import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import {
  LoginResponse,
  Menu,
  MenuPermission,
  Menus,
  Roles,
  UpdateRole,
  UpdateStatus,
  UserCredentials,
  Users,
  UserDetailed,
  TblRolePermission,
  InitialRegistration,
  RequestLoginOtp,
  ConfirmRegistration,
  VerifyLoginOtp,
  CreatePassword,
  RequestForgotPasswordOtp,
  ResetPasswordWithOtp,
  ResetPasswordRequest,
  ApiResponse,
  LoginWithPasswordRequest
} from '../_model/user.model';
import { Company } from '../_model/company.model';
import { LoggerService } from './logger.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private baseUrl = environment.apiUrl;
  constructor(private http: HttpClient, private logger: LoggerService) {}

  // --- LOGIN/AUTH METHODS ---
  initialRegistration(data: InitialRegistration): Observable<ApiResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/initialregistration`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<ApiResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }
  loginWithPassword(data: LoginWithPasswordRequest): Observable<LoginResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/loginwithpassword`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<LoginResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }
  requestLoginOtp(data: RequestLoginOtp): Observable<ApiResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/requestloginotp`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<ApiResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }
  confirmRegistration(data: ConfirmRegistration): Observable<LoginResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/confirmregisteration`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<LoginResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }
  resendRegistrationOtp(data: RequestLoginOtp): Observable<ApiResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/resendregistrationotp`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<ApiResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }
  verifyLoginOtp(data: VerifyLoginOtp): Observable<LoginResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/verifyloginotp`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<LoginResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }
  proceedLogin(data: UserCredentials): Observable<LoginResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}Authorize/GenerateToken`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<LoginResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }
  createPassword(data: CreatePassword): Observable<ApiResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/createpassword`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<ApiResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }
  requestForgotPasswordOtp(data: RequestForgotPasswordOtp): Observable<ApiResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/requestforgotpasswordotp`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<ApiResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }
  resetPasswordWithOtp(data: ResetPasswordWithOtp): Observable<ApiResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/resetpasswordwithotp`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<ApiResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }
  resetPasswordWithOldPassword(data: ResetPasswordRequest): Observable<ApiResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/resetpasswordwitholdpassword`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<ApiResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }

  // --- UTILITY & MENU/ROLE/USER METHODS ---
  updateProfile(data: any): Observable<ApiResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/updateprofile`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<ApiResponse>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }
  loadMenuByRole(role: string): Observable<Menu[]> {
    if (!role) {
      return new Observable<Menu[]>(observer => { observer.next([]); observer.complete(); });
    }
    return this.http.get<Menu[]>(this.baseUrl + 'UserRole/GetAllMenusByRole?userrole=' + role);
  }
  getMenuPermission(role: string, menuname: string): Observable<MenuPermission> {
    return this.http.get<MenuPermission>(this.baseUrl + 'UserRole/GetMenusPermissionByRole?userrole=' + role + '&menucode=' + menuname);
  }
  getAllUsers(): Observable<Users[]> {
    const url = `${this.baseUrl}User/GetAll`;
    this.logger.logApiRequest('GET', url, {});
    return this.http.get<any>(url).pipe(
      tap(response => this.logger.logApiResponse('GET', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('GET', url, err?.status || 500, err);
        return this.handleError(err);
      }),
      // Map response to array if wrapped in {data: ...}
      // If response is already an array, return as is
      // If response is {data: array}, return response.data
      // Otherwise, return []
      map(response => {
        if (Array.isArray(response)) return response;
        if (response && Array.isArray(response.data)) return response.data;
        return [];
      })
    );
  }

  /**
   * Get all users with detailed information including company details
   */
  getAllUsersDetailed(): Observable<UserDetailed[]> {
    const url = `${this.baseUrl}User/GetAllDetailed`;
    this.logger.logApiRequest('GET', url, {});
    return this.http.get<any>(url).pipe(
      tap(response => this.logger.logApiResponse('GET', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('GET', url, err?.status || 500, err);
        return this.handleError(err);
      }),
      map(response => {
        if (Array.isArray(response)) return response;
        if (response && Array.isArray(response.data)) return response.data;
        return [];
      })
    );
  }

  /**
   * Get user by code with detailed information including company details
   */
  getUserByCodeDetailed(code: string): Observable<UserDetailed> {
    const encoded = encodeURIComponent(code || '');
    const url = `${this.baseUrl}User/GetbycodeDetailed?code=${encoded}`;
    this.logger.logApiRequest('GET', url, {});
    return this.http.get<any>(url).pipe(
      tap(response => this.logger.logApiResponse('GET', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('GET', url, err?.status || 500, err);
        return this.handleError(err);
      }),
      map((res: any) => {
        // API might return wrapped object { data: user } or direct user
        if (res == null) return {} as UserDetailed;
        if (res.data) return res.data as UserDetailed;
        return res as UserDetailed;
      })
    );
  }
  getUserByCode(code: string): Observable<Users> {
    const encoded = encodeURIComponent(code || '');
    const url = this.baseUrl + 'User/GetBycode?code=' + encoded;
    console.log('UserService.getUserByCode URL ->', url);
    this.logger.logApiRequest('GET', url, {});
    return this.http.get<any>(url).pipe(
      map((res: any) => {
        // API might return wrapped object { data: user } or direct user
        if (res == null) return null;
        if (res.data) return res.data;
        return res;
      })
    );
  }
  /**
   * Map a company code to a user
   * Request body: { companyCode: string, username: string }
   */
  mapCompanyCode(data: { companyId: string; username: string }): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const url = `${this.baseUrl}User/mapcompcode`;
    this.logger.logApiRequest('POST', url, data);
    return this.http.post<any>(url, data, { headers }).pipe(
      tap(response => this.logger.logApiResponse('POST', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('POST', url, err?.status || 500, err);
        return this.handleError(err);
      })
    );
  }

  /**
   * Get list of active companies
   */
  getActiveCompanies(): Observable<Company[]> {
    const url = `${this.baseUrl}Company/list/active`;
    this.logger.logApiRequest('GET', url, {});
    return this.http.get<any>(url).pipe(
      tap(response => this.logger.logApiResponse('GET', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('GET', url, err?.status || 500, err);
        return this.handleError(err);
      }),
      map(response => {
        if (Array.isArray(response)) return response;
        if (response && Array.isArray(response.data)) return response.data;
        return [];
      })
    );
  }

  /**
   * Get company details by company ID
   */
  getCompanyById(companyId: string): Observable<Company> {
    const url = `${this.baseUrl}Company/${companyId}`;
    this.logger.logApiRequest('GET', url, {});
    return this.http.get<any>(url).pipe(
      tap(response => this.logger.logApiResponse('GET', url, 200, response)),
      catchError(err => {
        this.logger.logApiError('GET', url, err?.status || 500, err);
        return this.handleError(err);
      }),
      map(response => {
        if (!response) return {} as Company;
        // API may return wrapper { responseCode, data: { ... } }
        if (response.data) return response.data as Company;
        return response as Company;
      })
    );
  }

  getAllRoles(): Observable<Roles[]> {
    return this.http.get<Roles[]>(this.baseUrl + 'UserRole/GetAllRoles');
  }
  updateRole(data: UpdateRole): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.baseUrl + 'User/updaterole', data);
  }
  updateStatus(data: UpdateStatus): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.baseUrl + 'User/updatestatus', data);
  }
  getAllMenus(): Observable<Menus[]> {
    return this.http.get<Menus[]>(this.baseUrl + 'UserRole/GetAllMenus');
  }
  assignRolePermission(data: TblRolePermission[]): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.baseUrl + 'UserRole/asignrolepermission', data);
  }

  /** Alias for new naming convention */
  getRoles(): Observable<Roles[]> {
    return this.getAllRoles();
  }

  getMenus(): Observable<Menus[]> {
    return this.getAllMenus();
  }

  handleError(error: any): Observable<never> {
    return throwError(() => error);
  }
}
