import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { Router, RouterLink } from '@angular/router';

import { ConfirmRegistration } from '../../_model/user.model';
import { UserService } from '../../_service/user.service';
import { AuthService } from '../../_service/authentication.service';
import { LoggerService } from '../../_service/logger.service';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, MaterialModule, RouterLink, CommonModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  // Forms
  _emailForm!: FormGroup; // Step 1: Email only
  _otpForm!: FormGroup;   // Step 2: OTP verification
  
  // State variables
  currentStep: 'email' | 'otp' = 'email';
  isLoading = false;
  isVerifying = false;
  userEmail = '';
  otpMessage = '';
  
  // Responses
  _response: any;


  constructor(
    private builder: FormBuilder,
    private service: UserService,
    private authService: AuthService,
    private logger: LoggerService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialize email registration form (Step 1)
    this._emailForm = this.builder.group({
      email: ['', [Validators.required, Validators.email]]
    });

    // Initialize OTP verification form (Step 2)
    this._otpForm = this.builder.group({
      otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });

    this.logger.logComponentLifecycle('RegisterComponent', 'ngOnInit');
  }

  /**
   * Step 1: Register with email and request OTP
   */
  proceedWithEmail(): void {
    if (this._emailForm.invalid) {
      this.toastr.error('Please enter a valid email address', 'Validation Error');
      this.logger.logFormValidation('RegisterEmailForm', false, this._emailForm.errors);
      return;
    }

    this.isLoading = true;
    this.userEmail = this._emailForm.get('email')?.value;
    this.logger.info('RegisterComponent', 'Proceeding with email registration', { email: this.userEmail });

    // Call initial registration endpoint
    this.service.initialRegistration({ email: this.userEmail }).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.logger.logApiResponse('POST', '/api/User/initialRegistration', 200, response);
        if (response?.result === 'pass') {
          // Store email for later use
          this.authService.setUserEmail(this.userEmail);
          this.logger.logAuthEvent('Registration OTP sent', { email: this.userEmail });
          // Move to OTP verification step on this page
          this.currentStep = 'otp';
          this.otpMessage = `OTP has been sent to ${this.userEmail}`;
          this.toastr.success('OTP sent to your email. Please check your inbox.', 'Verify Email');
        } else {
          this.logger.error('RegisterComponent', 'Registration failed', response);
          this.toastr.error(response?.errorMessage || response?.message || 'Registration failed', 'Error');
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.logger.logApiError('POST', '/api/User/initialRegistration', error?.status || 500, error);
        this.toastr.error('Failed to register. Please try again.', 'Error');
      }
    });
  }

  /**
   * Step 2: Verify OTP
   */
  verifyOtp(): void {
    if (this._otpForm.invalid) {
      this.toastr.error('Please enter a valid 6-digit OTP', 'Validation Error');
      this.logger.logFormValidation('RegisterOtpForm', false, this._otpForm.errors);
      return;
    }

    this.isVerifying = true;
    const otp = this._otpForm.get('otp')?.value;

    const confirmData: ConfirmRegistration = {
      email: this.userEmail,
      otptext: otp
    };
    this.logger.info('RegisterComponent', 'Verifying OTP', confirmData);

    // Call confirm registration endpoint
    this.service.confirmRegistration(confirmData).subscribe({
      next: (response) => {
        this.isVerifying = false;
        this.logger.logApiResponse('POST', '/api/User/confirmRegistration', 200, response);
        // Defensive: check for missing/invalid response
        if (!response || typeof response !== 'object') {
          this.logger.error('RegisterComponent', 'Unexpected response structure', response);
          this.toastr.error('Unexpected server response. Please try again later.', 'Error');
          return;
        }
        // Handle edge cases by backend message or result
        const msg = (response.errorMessage || response.message || '').toLowerCase();
        if (msg.includes('expired')) {
          this.logger.warn('RegisterComponent', 'OTP expired', response);
          this.toastr.error('Your OTP has expired. Please request a new one.', 'OTP Expired');
          return;
        }
        if (msg.includes('already verified')) {
          this.logger.info('RegisterComponent', 'Account already verified', response);
          this.toastr.info('Your account is already verified. Please login.', 'Already Verified');
          this.router.navigateByUrl('/login');
          return;
        }
        if (msg.includes('too many') || msg.includes('attempt')) {
          this.logger.warn('RegisterComponent', 'Too many OTP attempts', response);
          this.toastr.error('Too many failed attempts. Please try again later or request a new OTP.', 'Too Many Attempts');
          return;
        }
        if (response?.result === 'pass') {
          // Registration verified. Prompt user to login using OTP on the Login page.
          this.logger.logAuthEvent('Registration OTP verified', { email: this.userEmail });
          const msg = encodeURIComponent(`Registration successful for ${this.userEmail}. Please login using OTP to create your password or access the portal.`);
          this.toastr.success(response?.errorMessage || response?.message || 'Email verified successfully!', 'Success');
          // Navigate to Login and open OTP tab, include message so Login shows persistent info
          this.router.navigate(['/login'], { queryParams: { mode: 'otp', email: this.userEmail, reg: '1', msg } });
        } else {
          this.logger.error('RegisterComponent', 'OTP verification failed', response);
          this.toastr.error(response?.errorMessage || response?.message || 'OTP verification failed', 'Error');
        }
      },
      error: (error) => {
        this.isVerifying = false;
        this.logger.logApiError('POST', '/api/User/confirmRegistration', error?.status || 500, error);
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
          this.toastr.error('Failed to verify OTP. Please try again.', 'Error');
        }
      }
    });
  }

  /**
   * Resend OTP
   */
  resendOtp(): void {
    this.isLoading = true;
    this.logger.info('RegisterComponent', 'Resending registration OTP', { email: this.userEmail });
    this.service.resendRegistrationOtp({ email: this.userEmail }).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.logger.logApiResponse('POST', '/api/User/resendRegistrationOtp', 200, response);
        if (response?.result === 'pass') {
          this.logger.logAuthEvent('Registration OTP resent', { email: this.userEmail });
          this.toastr.success('OTP resent to your email', 'OTP Resent');
          this._otpForm.get('otp')?.reset();
        } else {
          this.logger.error('RegisterComponent', 'Failed to resend OTP', response);
          this.toastr.error(response?.message || 'Failed to resend OTP', 'Error');
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.logger.logApiError('POST', '/api/User/resendRegistrationOtp', error?.status || 500, error);
        this.toastr.error('Failed to resend OTP', 'Error');
      }
    });
  }

  /**
   * Go back to email step
   */
  goBack(): void {
    this.logger.debug('RegisterComponent', 'Going back to email step');
    this.currentStep = 'email';
    this._otpForm.reset();
    this.userEmail = '';
  }
}
