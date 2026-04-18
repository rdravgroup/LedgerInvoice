export interface CustomerApiResult {
  result: string;
  errorMessage?: string;
  message?: string;
}

export interface APIResponse {
  responseCode: number;
  result: string | null;
  errorMessage: string | null;
}

export interface ResponseType {
  result: string | null;
  kyValue: string | null;
  message: string | null;
}

export interface TokenResponse {
  token: string | null;
  refreshToken: string | null;
  userRole: string | null;
}