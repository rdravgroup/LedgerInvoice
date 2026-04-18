import { Component, OnInit } from '@angular/core';
import { MaterialModule } from '../../material.module';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { UserService } from '../../_service/user.service';
import { AuthService } from '../../_service/authentication.service';
import { LoggerService } from '../../_service/logger.service';
import { ToastrService } from 'ngx-toastr';
import { UpdatePassword, ResetPasswordRequest } from '../../_model/user.model';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-updatepassword',
  standalone: true,
  imports: [MaterialModule, ReactiveFormsModule, CommonModule, MatIconModule],
  templateUrl: './updatepassword.component.html',
  styleUrl: './updatepassword.component.css',
})
export class UpdatepasswordComponent implements OnInit {
  currentusername = '';
  _response: any;

  // Form group for OTP-based password reset (legacy support)
  _resetform_update!: FormGroup;
  
  // Form group for logged-in user password change (new)
  changePasswordForm!: FormGroup;

  // UI State
  isLoading = false;
  showOldPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  passwordStrength = '';

  // Component mode
  componentMode: 'forgotpassword' | 'changepassword' = 'changepassword';

  constructor(
    private builder: FormBuilder,
    private service: UserService,
    private authService: AuthService,
    private logger: LoggerService,
    private toastr: ToastrService,
    private router: Router
  ) {
    // Legacy form for forgot password OTP reset
    this._resetform_update = this.builder.group({
      password: this.builder.control('', Validators.required),
      otptext: this.builder.control('', Validators.required),
    });

    // Form for logged-in user to change password with old password
    this.changePasswordForm = this.builder.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.logger.logComponentLifecycle('UpdatepasswordComponent', 'ngOnInit');
    // TODO: Refactor username retrieval if needed. No username() method on UserService.

    // Determine component mode based on context
    if (this.currentusername) {
      this.componentMode = 'forgotpassword';
    } else {
      this.componentMode = 'changepassword';
    }
  }

  /**
   * Custom validator to check if passwords match
   */
  passwordMatchValidator(form: FormGroup): { [key: string]: any } | null {
    const password = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  /**
   * Calculate password strength
   */
  getPasswordStrength(password: string): string {
    if (!password) return '';

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;

    if (strength === 0) return '';
    if (strength <= 1) return 'Weak';
    if (strength <= 2) return 'Fair';
    if (strength === 3) return 'Good';
    return 'Strong';
  }

  /**
   * Update password strength display
   */
  onPasswordChange(): void {
    const password = this.changePasswordForm.get('newPassword')?.value;
    this.passwordStrength = this.getPasswordStrength(password);
  }

  /**
   * Toggle password visibility
   */
  toggleOldPasswordVisibility(): void {
    this.showOldPassword = !this.showOldPassword;
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  /**
   * Legacy method: Update password with OTP (for forgot password flow)
   */
  proceedChangeWithOtp(): void {
    if (this._resetform_update.valid) {
      const payload = {
        username: this.currentusername,
        otp: this._resetform_update.value.otptext as string,
        newPassword: this._resetform_update.value.password as string,
        confirmPassword: this._resetform_update.value.password as string
      };

      this.isLoading = true;
      this.service.resetPasswordWithOtp(payload as any).subscribe({
        next: (item) => {
          this.isLoading = false;
          this._response = item;

          if (this._response.result === 'pass') {
            this.toastr.success(
              'Password changed successfully. Please login with your new password.',
              'Success'
            );
            this.router.navigateByUrl('/login');
          } else {
            this.toastr.error(
              'Failed: ' + this._response.message,
              'Password Change Failed'
            );
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('OTP password change error:', error);
          let apiErrorMsg = error?.error?.message || error?.message || '';
          if (apiErrorMsg) {
            this.toastr.error(apiErrorMsg, 'Error');
          } else {
            this.toastr.error('An error occurred while updating password', 'Error');
          }
        }
      });
    } else {
      this.toastr.error('Please fill in all required fields', 'Validation Error');
    }
  }

  /**
   * New method: Change password for logged-in user with old password
   */
  changePasswordWithOldPassword(): void {
    if (this.changePasswordForm.invalid) {
      this.toastr.error('Please fill in all required fields correctly', 'Validation Error');
      return;
    }

    this.isLoading = true;
    const username = this.authService.getUsername();

    // Use lowercase field names to match backend API expectations
    // Determine whether stored identifier is an email or username
    const identifierValue = username || '';
    const isEmailLike = identifierValue.includes('@');

    const changePasswordData: ResetPasswordRequest = {
      oldpassword: this.changePasswordForm.get('oldPassword')?.value,
      newpassword: this.changePasswordForm.get('newPassword')?.value
    };
    if (isEmailLike) {
      changePasswordData.email = identifierValue;
    } else {
      changePasswordData.username = identifierValue;
    }

    console.log('Sending change password request with payload:', changePasswordData);
    this.logger.info('UPDATEPASSWORD_COMPONENT', 'Changing password', { username, newPasswordLength: changePasswordData.newpassword.length });

    this.service.resetPasswordWithOldPassword(changePasswordData).subscribe({
      next: (response) => {
        this.isLoading = false;
        console.log('Change password success response:', response);
        this._response = response;

        if (this._response.result === 'pass' || this._response.Result === 'pass') {
          this.toastr.success(
            'Password changed successfully. Please login again with your new password.',
            'Success'
          );
          this.authService.logout();
          this.router.navigateByUrl('/login');
        } else {
          const errorMsg = this._response.message || this._response.Message || 'Failed to change password';
          this.toastr.error(errorMsg, 'Error');
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Change password error - Full error object:', error);
        console.error('Change password error - error.error:', error?.error);
        console.error('Change password error - status:', error?.status);
        
        // Extract actual API error message - handle nested error object
        let apiErrorMsg = '';
        if (error?.error?.error?.message) {
          apiErrorMsg = error.error.error.message;
        } else if (error?.error?.message) {
          apiErrorMsg = error.error.message;
        } else if (error?.message) {
          apiErrorMsg = error.message;
        }
        
        console.log('Extracted error message:', apiErrorMsg);
        this.logger.error('UPDATEPASSWORD_COMPONENT', 'Change password failed', { status: error?.status, message: apiErrorMsg });
        
        if (error?.status === 0) {
          this.toastr.error('Network error. Please check your connection and try again.', 'Network Error');
        } else if (error?.status === 400) {
          // Bad request - show actual API message
          const lowerMsg = apiErrorMsg.toLowerCase();
          if (lowerMsg.includes('old password') || lowerMsg.includes('incorrect password')) {
            this.toastr.error('Incorrect old password. Please try again.', 'Invalid Old Password');
          } else if (lowerMsg.includes('same') || lowerMsg.includes('current')) {
            this.toastr.error('New password cannot be the same as old password.', 'Same Password');
          } else if (lowerMsg.includes('password')) {
            this.toastr.error(apiErrorMsg, 'Password Error');
          } else if (apiErrorMsg) {
            this.toastr.error(apiErrorMsg, 'Bad Request');
          } else {
            this.toastr.error('Invalid request. Please check your input and try again.', 'Validation Error');
          }
        } else if (error?.status === 401) {
          this.toastr.error('Unauthorized. Please login again.', 'Unauthorized');
          this.authService.logout();
          this.router.navigateByUrl('/login');
        } else if (error?.status >= 500) {
          this.toastr.error('Server error. Please try again later.', 'Server Error');
        } else if (apiErrorMsg) {
          this.toastr.error(apiErrorMsg, 'Error');
        } else {
          this.toastr.error('Failed to change password. Please try again.', 'Error');
        }
      }
    });
  }

  /**
   * Cancel and go back
   */
  cancel(): void {
    if (this.componentMode === 'changepassword') {
      this.router.navigateByUrl('/'); // Go to dashboard
    } else {
      this.router.navigateByUrl('/login'); // Go to login
    }
  }
}

