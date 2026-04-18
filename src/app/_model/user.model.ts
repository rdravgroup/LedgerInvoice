// DTO for login with email and password (matches backend)
export interface LoginWithPasswordRequest {
  identifier: string; // username or email
  password: string;
}
// ========== REGISTRATION FLOW ==========
export interface InitialRegistration {
  email: string;
}

export interface RequestLoginOtp {
  email: string;
}

export interface ConfirmRegistration {
  email: string;
  otptext: string;
}

export interface ResendRegistrationOtp {
  email: string;
}

export interface UserRegister {
  userName: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  role: string;
}

export interface RegisterConfirm {
  userid: number;
  username: string;
  otptext: string;
}

// ========== LOGIN FLOW ==========
export interface UserCredentials {
  Email: string;
  password: string;
}

export interface VerifyLoginOtp {
  email: string;
  otptext: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  userRole: string;
  username?: string;
  result?: string;
  message?: string;
  errorMessage?: string;
}

// ========== PASSWORD MANAGEMENT ==========
export interface CreatePassword {
  newPassword: string;
  confirmPassword: string;
}

export interface RequestForgotPasswordOtp {
  email: string;
}

export interface ResetPasswordWithOtp {
  email?: string;
  username?: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPassword {
  username: string;
  oldpassword: string;
  newpassword: string;
}

// Request for resetting password using old password (logged-in user)
export interface ResetPasswordRequest {
  email?: string;      // optional, provide either email or username
  username?: string;   // optional
  oldpassword: string;
  newpassword: string;
}

export interface ResetPasswordWithOldPassword {
  oldPassword: string;
  newPassword: string;
}

export interface UpdatePassword {
  username: string;
  password: string;
  otptext: string;
}

// ========== PROFILE & ROLE ==========
export interface UpdateUserProfile {
  name: string;
  phone: string;
  address: string;
}

export interface UpdateUserRole {
  username: string;
  role: string;
}

export interface Menu {
  menucode: string;
  menuname: string;
}

export interface MenuPermission {
  userrole: string;
  code: string;
  menucode: string;
  name: string;
  haveview: boolean;
  haveadd: boolean;
  haveedit: boolean;
  havedelete: boolean;
}

export interface Users {
  username: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  isactive: boolean;
  statusname?: string;
  role: string;
  password?: string;
  islocked?: boolean;
  failattempt?: number;
}

export interface Roles {
  code: string;
  name: string;
  status: boolean;
}

export interface UpdateUser {
  username: string;
  role: string;
  status: boolean;
}

export interface UpdateRole {
  username: string | null;
  role: string | null;
}

export interface UpdateStatus {
  username: string | null;
  status: boolean;
}

export interface TblRolePermission {
  id: number;
  userrole: string | null;
  menucode: string | null;
  haveview: boolean;
  haveadd: boolean;
  haveedit: boolean;
  havedelete: boolean;
}

export interface Menus {
  code: string;
  name: string;
  status: boolean;
}

// ========== COMPANY BASIC INFO (nested in detailed user) ==========
export interface CompanyBasicInfo {
  companyId: string;
  companyName: string;
  address: string;
  createdDate: string;
  updatedDate: string;
}

// ========== USER DETAILED DTO ==========
export interface UserDetailed {
  username: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isactive: boolean;
  islocked: boolean;
  failattempt: number;
  address?: string;
  authProvider?: string;
  googleId?: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginDate?: string;
  createIp?: string;
  updateIp?: string;
  lastIpAddress?: string;
  company?: CompanyBasicInfo;
  statusname?: string;
}

// ========== API RESPONSE ==========
export interface ApiResponse<T = any> {
  result: string;
  message?: string;
  errorMessage?: string;
  data?: T;
}