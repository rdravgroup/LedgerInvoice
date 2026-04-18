import { Component, OnInit } from '@angular/core';
import { FormsModule, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { ToastrService } from 'ngx-toastr';
import { Router, ActivatedRoute } from '@angular/router';

import { UserService } from '../../_service/user.service';
import { AuthService } from '../../_service/authentication.service';
import { LoggerService } from '../../_service/logger.service';
import { RegisterConfirm, CreatePassword } from '../../_model/user.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirmotp',
  standalone: true,
  imports: [FormsModule, MaterialModule, ReactiveFormsModule, CommonModule],
  templateUrl: './confirmotp.component.html',
  styleUrl: './confirmotp.component.css'
})
export class ConfirmotpComponent implements OnInit {
  // Legacy support
  otptext = '';
  regresponse!: RegisterConfirm;
  _response: any;

  // New password creation form
  passwordForm!: FormGroup;
  userEmail = '';
  isCreatingPassword = false;
  showPassword = false;
  showConfirmPassword = false;
  passwordStrength = '';


  constructor(
    private toastr: ToastrService,
    private router: Router,
    private route: ActivatedRoute,
    private service: UserService,
    private authService: AuthService,
    private logger: LoggerService,
    private builder: FormBuilder
  ) {}

  ngOnInit(): void {
    // Resolve email from query param (login flow) or fallback to authService
    const qp: any = this.route.snapshot.queryParams || {};
    this.userEmail = qp['email'] || this.authService.getUserEmail();

    // If user already created a password, skip this page
    if (this.userEmail) {
      this.service.getUserByCode(this.userEmail).subscribe({
        next: (u) => {
          const detectPasswordCreated = (obj: any): boolean => {
            if (!obj) return false;
            const keys = ['hasPassword', 'isPasswordCreated', 'passwordCreated', 'isPasswordSet', 'haspassword'];
            for (const k of keys) {
              if (obj[k] === true) return true;
              if (typeof obj[k] === 'string' && obj[k].toLowerCase() === 'true') return true;
            }
            if (obj.password && typeof obj.password === 'string' && obj.password.length > 0) {
              const pw = obj.password.toString().trim();
              if (pw.length === 0) return false;
              if (pw.toUpperCase() === 'EMAIL_AUTH_ONLY') return false;
              return true;
            }
            return false;
          };
          if (detectPasswordCreated(u)) {
            this.toastr.info('Password already created. Redirecting to home.', 'Info');
            this.router.navigateByUrl('/');
            return;
          }
        },
        error: () => {
          // ignore errors here
        }
      });
    }

    // Initialize password creation form
    this.passwordForm = this.builder.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      agreeTerms: [false, Validators.requiredTrue]
    }, { validators: this.passwordMatchValidator });

    this.logger.logComponentLifecycle('ConfirmotpComponent', 'ngOnInit');
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
    const password = this.passwordForm.get('newPassword')?.value;
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
   * Create password after registration (Optional)
   */
  createPassword(): void {
    if (this.passwordForm.invalid) {
      this.toastr.error('Please fill in all required fields correctly', 'Validation Error');
      return;
    }

    this.isCreatingPassword = true;

    const passwordData: CreatePassword = {
      newPassword: this.passwordForm.get('newPassword')?.value,
      confirmPassword: this.passwordForm.get('confirmPassword')?.value
    };

    this.authService.createPassword(passwordData.newPassword, passwordData.confirmPassword).subscribe({
      next: (response) => {
        this.isCreatingPassword = false;
        // Defensive: check for missing/invalid response
        if (!response || typeof response !== 'object') {
          this.logger.error('ConfirmotpComponent', 'Unexpected response structure', response);
          this.toastr.error('Unexpected server response. Please try again later.', 'Error');
          return;
        }
        const msg = (response.errorMessage || response.message || '').toLowerCase();
        if (msg.includes('expired')) {
          this.logger.warn('ConfirmotpComponent', 'OTP expired', response);
          this.toastr.error('Your OTP has expired. Please request a new one.', 'OTP Expired');
          return;
        }
        if (msg.includes('already verified')) {
          this.logger.info('ConfirmotpComponent', 'Account already verified', response);
          this.toastr.info('Your account is already verified. Please login.', 'Already Verified');
          this.router.navigateByUrl('/login');
          return;
        }
        if (msg.includes('too many') || msg.includes('attempt')) {
          this.logger.warn('ConfirmotpComponent', 'Too many OTP attempts', response);
          this.toastr.error('Too many failed attempts. Please try again later or request a new OTP.', 'Too Many Attempts');
          return;
        }
        if (response?.result === 'pass') {
          this.toastr.success('Password created successfully. You can now login with email and password.', 'Success');
          this.router.navigateByUrl('/login');
        } else {
          this.toastr.error(response?.message || 'Failed to create password', 'Error');
        }
      },
      error: (error) => {
        this.isCreatingPassword = false;
        this.logger.error('ConfirmotpComponent', 'Create password error', error);
        // Show actual API error message if available
        let apiMsg = error?.error?.message || error?.message || '';
        if (error?.status === 0) {
          this.toastr.error('Network error. Please check your connection and try again.', 'Network Error');
        } else if (error?.status >= 500) {
          this.toastr.error('Server error. Please try again later.', 'Server Error');
        } else if (apiMsg.toLowerCase().includes('expired')) {
          this.toastr.error('Your OTP has expired. Please request a new one.', 'OTP Expired');
        } else if (apiMsg.toLowerCase().includes('already verified')) {
          this.toastr.info('Your account is already verified. Please login.', 'Already Verified');
          this.router.navigateByUrl('/login');
        } else if (apiMsg.toLowerCase().includes('already created')) {
          this.toastr.info('You have already created a password. Please login.', 'Password Already Created');
          this.router.navigateByUrl('/login');
        } else if (error?.status === 429 || apiMsg.toLowerCase().includes('too many')) {
          this.toastr.error('Too many failed attempts. Please try again later or request a new OTP.', 'Too Many Attempts');
        } else if (apiMsg) {
          this.toastr.error(apiMsg, 'Error');
        } else {
          this.toastr.error('Failed to create password. Please try again.', 'Error');
        }
        // Always log the error for debugging
        console.error('Create password API error:', error);
      }
    });
  }

  /**
   * Skip password creation and go to dashboard
   */
  skipPasswordCreation(): void {
    this.toastr.info('You can set up a password anytime from your profile settings', 'Skipped');
    this.router.navigateByUrl('/');
  }

  /**
   * Legacy method: Confirm OTP (for backward compatibility)
   */
  confirmOTP(): void {
    // Map legacy regresponse (RegisterConfirm) to ConfirmRegistration
    const confirmRegistrationObj = {
      email: this.userEmail,
      otptext: this.otptext
    };
    this.service.confirmRegistration(confirmRegistrationObj).subscribe(item => {
      this._response = item;
      if (this._response.result === 'pass') {
        this.toastr.success('Registration completed successfully.', 'Success');
        this.router.navigateByUrl('/login');
      } else {
        this.toastr.error('Failed Due to: ' + this._response.message, 'Registration Failed');
      }
    });
  }
}

