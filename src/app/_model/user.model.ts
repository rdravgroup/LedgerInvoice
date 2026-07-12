// src/app/_model/user.model.ts
// CHANGED: Added MenuNode, MenuPermissionBatch interfaces; extended Menu, Menus with icon/parentcode.
// All existing interfaces (Users, Roles, etc.) unchanged.

export interface Menu {
  menucode:      string;
  menuname:      string;
  menuIcon?:     string;
  displayOrder?: number;
  parentcode?:   string;
}

// NEW: hierarchical node for appmenu sidebar and userrole matrix
export interface MenuNode {
  code:          string;
  name:          string;
  menuIcon?:     string;
  displayOrder?: number;
  parentcode?:   string;
  isParent?:     boolean;
  haveview?:     boolean;
  haveadd?:      boolean;
  haveedit?:     boolean;
  havedelete?:   boolean;
  children?:     MenuNode[];
  expanded?:     boolean;     // UI state
}

// NEW: batch response (replaces N+1 API calls)
export interface MenuPermissionBatch {
  role:        string;
  permissions: MenuPermission[];
}

export interface MenuPermission {
  userrole?:     string;
  code?:         string;
  menucode:      string;
  menuname?:     string;
  name?:         string;
  haveview:      boolean;
  haveadd:       boolean;
  haveedit:      boolean;
  havedelete:    boolean;
  menuIcon?:     string;
  displayOrder?: number;
  parentcode?:   string;
}

export interface Users {
  username:     string;
  name:         string;
  email:        string;
  phone:        string;
  address?:     string;
  isactive:     boolean;
  statusname?:  string;
  role:         string;
  password?:    string;
  islocked?:    boolean;
  failattempt?: number;
}

export interface Roles {
  code:   string;
  name:   string;
  status: boolean;
}

export interface Menus {
  code:          string;
  name:          string;
  status:        boolean;
  menuIcon?:     string;
  displayOrder?: number;
  parentcode?:   string;
}

export interface TblRolePermission {
  id:         number;
  userrole:   string;
  menucode:   string;
  haveview:   boolean;
  haveadd:    boolean;
  haveedit:   boolean;
  havedelete: boolean;
}

export interface UserDetailed {
  username:      string;
  name:          string;
  email:         string;
  phone:         string;
  role:          string;
  isactive:      boolean;
  islocked:      boolean;
  failattempt:   number;
  address?:      string;
  authProvider?: string;
  googleId?:     string;
  companyId?:    string;
  createdAt?:    string;
  updatedAt?:    string;
  // Backwards-compatible company details used by UI templates
  company?: {
    companyId?: string;
    companyName?: string;
    address?: string;
    emailId?: string;
    mobileNo?: string;
  };
  // Additional audit fields surfaced by some APIs
  lastLoginDate?: string;
  createIp?: string;
  updateIp?: string;
  lastIpAddress?: string;
}

export interface UpdateRole   { username: string; role: string; }
export interface UpdateStatus { username: string; isactive: boolean; }
export interface UserCredentials { username: string; password: string; }
export interface LoginResponse {
  token: string;
  refreshToken?: string;
  role?: string;
  companyId?: string;
  // Backwards-compatible fields used in various components
  userRole?: string;
  username?: string;
  message?: string;
  errorMessage?: string;
  result?: string;
}

export interface ApiResponse { result: string; message?: string; errorMessage?: string; data?: any; }

export interface InitialRegistration { name?: string; email: string; phone?: string; }

// Flexible confirmation type: some code paths use { code, otp } while others use { email, otptext }
export interface ConfirmRegistration {
  code?: string;
  otp?: string;
  email?: string;
  otptext?: string;
}
export type RegisterConfirm = ConfirmRegistration;

// Requests that historically used 'username' may now use 'email' in merged code.
export interface RequestLoginOtp { username?: string; email?: string; }
export interface VerifyLoginOtp { username?: string; email?: string; otp?: string; otptext?: string; }

// CreatePassword accepts either legacy (password) or new (newPassword) naming
export interface CreatePassword {
  username?: string;
  password?: string; // legacy
  newPassword?: string;
  confirmPassword?: string;
}

export interface RequestForgotPasswordOtp { username?: string; email?: string; }

export interface ResetPasswordWithOtp {
  username?: string;
  email?: string;
  otp?: string;
  otptext?: string;
  password?: string; // legacy
  newPassword?: string;
  confirmPassword?: string;
}

export interface ResetPasswordRequest {
  username?: string;
  email?: string;
  oldPassword?: string;
  oldpassword?: string;
  newPassword?: string;
  newpassword?: string;
  confirmNewPassword?: string;
  confirmnewpassword?: string;
}

export interface LoginWithPasswordRequest { identifier: string; password: string; username?: string; }

// Convenience types used by UI components
export interface UpdateUser { username: string; role?: string; status?: boolean; }
export interface UpdatePassword { username?: string; oldPassword?: string; newPassword?: string; confirmNewPassword?: string; }
