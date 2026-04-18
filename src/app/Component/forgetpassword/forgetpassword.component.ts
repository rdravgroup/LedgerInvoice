import { Component, OnInit } from '@angular/core';
import { MaterialModule } from '../../material.module';
import { FormsModule, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

import { UserService } from '../../_service/user.service';
import { AuthService } from '../../_service/authentication.service';
import { LoggerService } from '../../_service/logger.service';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-forgetpassword',
  standalone: true,
  imports: [MaterialModule, FormsModule, ReactiveFormsModule, CommonModule, MatIconModule, RouterLink],
  templateUrl: './forgetpassword.component.html',
  styleUrl: './forgetpassword.component.css'
})
export class ForgetpasswordComponent implements OnInit {
  // Current step in forgot password flow
  currentStep: 'email' | 'otp' | 'reset' = 'email';

  // Forms
  emailForm!: FormGroup;
  otpForm!: FormGroup;
  resetForm!: FormGroup;

  // State
  isLoading = false;
  userEmail = '';
  passwordStrength = '';
  showPassword = false;
  showConfirmPassword = false;

  // Response
  _response: any;


  constructor(
    private toastr: ToastrService,
    private router: Router,
    private service: UserService,
    private authService: AuthService,
    private logger: LoggerService,
    private builder: FormBuilder
  ) {}

  ngOnInit(): void {
    // Email form
    this.emailForm = this.builder.group({
      email: ['', [Validators.required, Validators.email]]
    });

    // OTP form
    this.otpForm = this.builder.group({
      otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });

    // Reset password form
    this.resetForm = this.builder.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    }, { validators: this.passwordMatchValidator });

    this.logger.logComponentLifecycle('ForgetpasswordComponent', 'ngOnInit');
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
   * Step 1: Request OTP for password reset
   */
  requestPasswordResetOtp(): void {
    if (this.emailForm.invalid) {
      this.toastr.error('Please enter a valid email address', 'Validation Error');
      this.logger.logFormValidation('ForgetPasswordEmailForm', false, this.emailForm.errors);
      return;
    }

    this.isLoading = true;
    this.userEmail = this.emailForm.get('email')?.value;
    this.logger.info('ForgetpasswordComponent', 'Requesting password reset OTP', { email: this.userEmail });

    this.authService.requestForgotPasswordOtp(this.userEmail).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.logger.logApiResponse('POST', '/api/User/requestForgotPasswordOtp', response?.status || 200, response);
        if (response?.result === 'pass') {
          this.logger.logAuthEvent('Forgot password OTP sent', { email: this.userEmail });
          this.currentStep = 'otp';
          this.toastr.success('OTP sent to your registered email. Please check your inbox.', 'OTP Sent');
        } else {
          this.logger.error('ForgetpasswordComponent', 'Failed to send OTP', response);
          this.toastr.error(response?.message || 'Failed to send OTP', 'Error');
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.toastr.error('Failed to request OTP. Please try again.', 'Error');
        console.error('Request OTP error:', error);
      }
    });
  }

  /**
   * Step 2: Verify OTP format and move to password reset
   * (Full OTP validation will happen on backend during password reset)
   */
  verifyOtpAndProceed(): void {
    if (this.otpForm.invalid) {
      this.toastr.error('Please enter a valid 6-digit OTP', 'Validation Error');
      return;
    }

    // Client-side validation: OTP should be 6 digits
    const otp = this.otpForm.get('otp')?.value;
    if (!/^[0-9]{6}$/.test(otp)) {
      this.toastr.error('OTP must be exactly 6 digits', 'Invalid OTP Format');
      return;
    }
    
    this.logger.info('ForgetpasswordComponent', 'OTP format validated, proceeding to password reset', { otpLength: otp?.length });
    // OTP is valid format, move to password reset step
    // Full OTP validation will happen on backend when submitting password + OTP together
    this.currentStep = 'reset';
    this.resetForm.reset();
    this.toastr.info('OTP accepted. Please enter your new password.', 'Enter Password');
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
    const password = this.resetForm.get('newPassword')?.value;
    this.passwordStrength = this.getPasswordStrength(password);
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Toggle confirm password visibility
   */
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  /**
   * Step 3: Reset password with OTP
   */
  resetPasswordWithOtp(): void {
    if (this.resetForm.invalid || this.otpForm.invalid) {
      console.warn('Form validation failed:', {
        resetFormValid: this.resetForm.valid,
        resetFormErrors: this.resetForm.errors,
        otpFormValid: this.otpForm.valid,
        otpFormErrors: this.otpForm.errors
      });
      this.toastr.error('Please fill in all required fields correctly', 'Validation Error');
      return;
    }

    this.isLoading = true;
    const otp = this.otpForm.get('otp')?.value;
    const newPassword = this.resetForm.get('newPassword')?.value;
    const confirmPassword = this.resetForm.get('confirmPassword')?.value;

    const resetObj = {
      email: this.userEmail,
      otp: otp,
      newPassword: newPassword,
      confirmPassword: confirmPassword
    };

    this.logger.info('FORGET_PASSWORD_COMPONENT', 'Submitting password reset form', {
      email: this.userEmail,
      step: this.currentStep
    });

    this.service.resetPasswordWithOtp(resetObj).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.logger.info('FORGET_PASSWORD_COMPONENT', 'Password reset response received', {
          result: response?.result
        });
        // Defensive: check for missing/invalid response
        if (!response || typeof response !== 'object') {
          this.logger.error('FORGET_PASSWORD_COMPONENT', 'Unexpected response structure', response);
          this.toastr.error('Unexpected server response. Please try again later.', 'Error');
          return;
        }
        const msg = (response.errorMessage || response.message || '').toLowerCase();
        if (msg.includes('expired')) {
          this.logger.warn('FORGET_PASSWORD_COMPONENT', 'OTP expired', response);
          this.toastr.error('Your OTP has expired. Please request a new one.', 'OTP Expired');
          return;
        }
        if (msg.includes('already verified')) {
          this.logger.info('FORGET_PASSWORD_COMPONENT', 'Account already verified', response);
          this.toastr.info('Your account is already verified. Please login.', 'Already Verified');
          this.router.navigateByUrl('/login');
          return;
        }
        if (msg.includes('too many') || msg.includes('attempt')) {
          this.logger.warn('FORGET_PASSWORD_COMPONENT', 'Too many OTP attempts', response);
          this.toastr.error('Too many failed attempts. Please try again later or request a new OTP.', 'Too Many Attempts');
          return;
        }
        if (response?.result === 'pass') {
          this.logger.info('FORGET_PASSWORD_COMPONENT', 'Password reset successful', {
            email: this.userEmail
          });
          this.toastr.success('Password reset successfully! You can now login with your new password.', 'Success');
          this.router.navigateByUrl('/login');
        } else {
          this.logger.warn('FORGET_PASSWORD_COMPONENT', 'Password reset failed', {
            message: response?.message
          });
          this.toastr.error(response?.message || 'Failed to reset password', 'Error');
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.logger.error('FORGET_PASSWORD_COMPONENT', 'Reset password error', {
          email: this.userEmail,
          error: error.message
        }, error);
        // Network/server error handling
        if (error?.status === 0) {
          this.toastr.error('Network error. Please check your connection and try again.', 'Network Error');
        } else if (error?.status >= 500) {
          this.toastr.error('Server error. Please try again later.', 'Server Error');
        } else if (error?.status === 400 && error?.error?.message?.toLowerCase().includes('expired')) {
          this.toastr.error('Your OTP has expired. Please request a new one.', 'OTP Expired');
        } else if (error?.status === 400 && error?.error?.message?.toLowerCase().includes('already verified')) {
          this.toastr.info('Your account is already verified. Please login.', 'Already Verified');
          this.router.navigateByUrl('/login');
        } else if (error?.status === 429 || (error?.error?.message && error?.error?.message.toLowerCase().includes('too many'))) {
          this.toastr.error('Too many failed attempts. Please try again later or request a new OTP.', 'Too Many Attempts');
        } else {
          this.toastr.error('Failed to reset password. Please check your OTP and try again.', 'Error');
        }
      }
    });
  }

  /**
   * Go back to previous step
   */
  goBack(): void {
    if (this.currentStep === 'otp') {
      this.currentStep = 'email';
      this.otpForm.reset();
    } else if (this.currentStep === 'reset') {
      this.currentStep = 'otp';
      this.resetForm.reset();
    }
  }

  /**
   * Cancel and return to login
   */
  cancel(): void {
    this.router.navigateByUrl('/login');
  }
}

