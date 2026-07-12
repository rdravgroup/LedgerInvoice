import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AiChatApiResponse, AiChatResponse } from '../_model/ai-chat.model';
import { AuthService } from './authentication.service';
import { SelectedCompanyService } from './selected-company.service';

@Injectable({
  providedIn: 'root'
})
export class AiChatService {
  private readonly baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private selectedCompanyService: SelectedCompanyService,
    private authService: AuthService
  ) {}

  sendMessage(message: string): Observable<AiChatResponse> {
    const companyId = this.selectedCompanyService.getSelectedCompanyId() || this.authService.getCompanyId();

    return this.http.post<AiChatApiResponse>(`${this.baseUrl}ai/chat`, { message, companyId }).pipe(
      map((response) => response.data)
    );
  }
}
