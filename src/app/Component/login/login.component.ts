import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { UserService } from '../../_service/user.service';
import { AuthService } from '../../_service/authentication.service';
import { LoggerService } from '../../_service/logger.service';
import { ToastrService } from 'ngx-toastr';
import { LoginResponse, LoginWithPasswordRequest } from '../../_model/user.model';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, ReactiveFormsModule, MaterialModule, RouterLink, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit, OnDestroy {
  _response!: LoginResponse;
  _loginForm!: FormGroup;
  _otpLoginForm!: FormGroup;
  registrationMessage = '';

  // UI State
  loginMode: 'password' | 'otp' = 'password';
  isLoading = false;
  showPassword = false;
  otpSent = false;
  otpVerifyLoading = false;

  constructor(
    private builder: FormBuilder,
    private service: UserService,
    private authService: AuthService,
    private logger: LoggerService,
    private toastr: ToastrService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Clear only auth-related items from localStorage when entering login page
    // This ensures a fresh login state without clearing other browser data
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userrole');
    
    // TODO: Refactor menu list management if needed. No _menulist property on UserService.

    // Initialize password login form
    this._loginForm = this.builder.group({
      username: ['', [Validators.required]],
      password: ['', Validators.required],
      rememberMe: [false]
    });

    // Initialize OTP login form
    this._otpLoginForm = this.builder.group({
      email: ['', [Validators.required, Validators.email]],
      otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });

    // If query param requests OTP mode, switch to OTP and prefill email if provided
    const qp = this.route.snapshot.queryParams;
    if (qp && qp['mode'] === 'otp') {
      this.switchLoginMode('otp');
      const prefill = qp['email'] || this.authService.getUserEmail();
      if (prefill) {
        this._otpLoginForm.patchValue({ email: prefill });
      }
      // Show registration message if provided
      if (qp['reg'] || qp['msg']) {
        try {
          this.registrationMessage = qp['msg'] ? decodeURIComponent(qp['msg']) : `Registration successful for ${prefill}. Please login using OTP.`;
        } catch (e) {
          this.registrationMessage = qp['msg'] || `Registration successful for ${prefill}. Please login using OTP.`;
        }
      }
    }
  }


  _response_otp: any;
  // OTP request management
  otpRequestCount = 0;
  otpCooldown = false;
  otpCooldownSeconds = 120;
  otpCooldownTimer: any = null;
  otpErrorMessage = '';
  lastErrorMessage = '';

  // Only keep the following correct implementations:
  // ...existing code...

  ngOnDestroy(): void {
    if (this.otpCooldownTimer) {
      clearInterval(this.otpCooldownTimer);
    }
  }

  switchLoginMode(mode: 'password' | 'otp'): void {
    this.loginMode = mode;
    this.otpSent = false;
    this.otpErrorMessage = '';
    this.otpRequestCount = 0;
    if (mode === 'password') {
      this._loginForm.reset();
    } else {
      this._otpLoginForm.reset();
    }
  }

  startOtpCooldown(): void {
    this.otpCooldown = true;
    let seconds = this.otpCooldownSeconds;
    this.otpCooldownTimer = setInterval(() => {
      seconds--;
      this.otpCooldownSeconds = seconds;
      if (seconds <= 0) {
        clearInterval(this.otpCooldownTimer);
        this.otpCooldown = false;
        this.otpCooldownSeconds = 120;
      }
    }, 1000);
  }
  // ...existing code...

  verifyOtpLogin(): void {
    if (this._otpLoginForm.invalid) {
      this.otpErrorMessage = 'Please fill in all required fields';
      this.toastr.error(this.otpErrorMessage, 'Validation Error');
      return;
    }
    // Only allow digits in OTP
    const otpValue = this._otpLoginForm.get('otp')?.value;
    if (!/^[0-9]{6}$/.test(otpValue)) {
      this.otpErrorMessage = 'OTP must be 6 digits (numbers only)';
      this.toastr.error(this.otpErrorMessage, 'Validation Error');
      return;
    }
    this.otpVerifyLoading = true;
    const email = this._otpLoginForm.get('email')?.value;
    const otp = otpValue;
    this.logger.info('LOGIN_COMPONENT', 'Verifying OTP for login', { email, otpLength: otp?.length });
    this.authService.verifyOtpLogin(email, otp).subscribe({
      next: (response) => {
        this.otpVerifyLoading = false;
        console.log('OTP verify response:', response); // Debug log
        if (!response || typeof response !== 'object') {
          this.otpErrorMessage = 'Unexpected server response. Please try again later.';
          this.toastr.error(this.otpErrorMessage, 'Error');
          return;
        }
        const msg = (response.errorMessage || response.message || '').toLowerCase();
        if (msg.includes('expired')) {
          this.otpErrorMessage = 'Your OTP has expired. Please request a new one.';
          this.toastr.error(this.otpErrorMessage, 'OTP Expired');
          return;
        }
        if (msg.includes('already verified')) {
          this.toastr.info('Your account is already verified. Please login.', 'Already Verified');
          this.router.navigateByUrl('/login');
          return;
        }
        if (msg.includes('too many') || msg.includes('attempt')) {
          this.otpErrorMessage = 'Too many failed attempts. Please try again later or request a new OTP.';
          this.toastr.error(this.otpErrorMessage, 'Too Many Attempts');
          return;
        }
        if (response?.token) {
          // After OTP verification, fetch user details to get the actual username
          console.log('LOGIN_COMPONENT: OTP verified, fetching user details to get actual username');
          this.service.getUserByCode(email).subscribe({
            next: (user) => {
              if (user?.username) {
                console.log('LOGIN_COMPONENT: Got actual username from GetBycode:', user.username);
                // Update localStorage with the correct username instead of email
                localStorage.setItem('username', user.username);
              }
              this.toastr.success('OTP verified successfully', 'Success');
              // Redirect to confirmotp page, allow skip
              this.router.navigate(['/confirmotp'], { queryParams: { skipOption: true, email } });
            },
            error: (err) => {
              console.warn('LOGIN_COMPONENT: Failed to fetch user details after OTP, using email as fallback ->', err);
              this.toastr.success('OTP verified successfully', 'Success');
              this.router.navigate(['/confirmotp'], { queryParams: { skipOption: true, email } });
            }
          });
        } else {
          this.otpErrorMessage = response?.errorMessage || response?.message || 'Invalid OTP or verification failed';
          this.toastr.error(this.otpErrorMessage, 'Login Failed');
        }
      },
      error: (error) => {
        this.otpVerifyLoading = false;
        // Improved error handling for 401/500
        if (error?.status === 401) {
          // 401 could mean OTP is invalid or email not recognized
          this.otpErrorMessage = error?.error?.errorMessage || error?.error?.message || 'Invalid OTP or email. Please check and try again.';
        } else if (error?.status === 500) {
          this.otpErrorMessage = 'Server error during OTP verification. Please try again later.';
        } else if (error?.status === 400) {
          this.otpErrorMessage = error?.error?.errorMessage || error?.error?.message || 'OTP verification failed. Please try again or request a new OTP.';
        } else {
          this.otpErrorMessage = error?.error?.errorMessage || error?.error?.message || 'Failed to verify OTP. Please try again or request a new OTP.';
        }
        this.toastr.error(this.otpErrorMessage, 'Verification Error');
        console.error('OTP verification error:', error); // Debug log
      }
    });
  }
  proceedLogin(): void {
    if (this._loginForm.invalid) {
      this.toastr.error('Please fill in all required fields', 'Validation Error');
      return;
    }
    this.isLoading = true;
    const payload: LoginWithPasswordRequest = {
      identifier: this._loginForm.value.username as string,
      password: this._loginForm.value.password as string
    };
    this.logger.info('LOGIN_COMPONENT', 'Attempting password-based login', { identifier: payload.identifier });
    this.service.loginWithPassword(payload).subscribe({
      next: (response) => {
        this.isLoading = false;
        this._response = response;
        console.log('LOGIN_COMPONENT: loginWithPassword response:', response);
        this._loginForm.get('password')?.reset();
        if (this._response?.token) {
          // Use username from response if available, otherwise fetch from GetBycode
          const usernameFromResponse = this._response.username;
          console.log('LOGIN_COMPONENT: Response username:', usernameFromResponse);
          
          if (usernameFromResponse) {
            console.log('LOGIN_COMPONENT: Using username from response:', usernameFromResponse);
            this.authService.login(this._response, usernameFromResponse);
            this.proceedWithMenuLoad(usernameFromResponse, response.userRole);
          } else {
            // Fetch user details to get the actual username
            console.log('LOGIN_COMPONENT: Fetching user details using identifier:', payload.identifier);
            this.service.getUserByCode(payload.identifier).subscribe({
              next: (user) => {
                const actualUsername = user?.username || payload.identifier;
                console.log('LOGIN_COMPONENT: Got username from GetBycode:', actualUsername);
                this.authService.login(this._response, actualUsername);
                this.proceedWithMenuLoad(actualUsername, response.userRole);
              },
              error: (err) => {
                console.warn('LOGIN_COMPONENT: Failed to fetch user details, using identifier:', err);
                this.authService.login(this._response, payload.identifier);
                this.proceedWithMenuLoad(payload.identifier, response.userRole);
              }
            });
          }
        } else {
          this.toastr.error(this._response?.message || 'Invalid login response', 'Login Failed');
          this.logger.warn('LOGIN_COMPONENT', 'Login failed - no token in response', { identifier: payload.identifier, response });
        }
      },
      error: (error) => {
        this.isLoading = false;
        this._loginForm.get('password')?.reset();
        const errorMessage = error?.error?.message || 'Failed to login. Please check your credentials.';
        this.toastr.error(errorMessage, 'Error');
        this.logger.error('LOGIN_COMPONENT', 'Password login error', { identifier: payload.identifier }, error);
      }
    });
  }

  showErrorOnce(message: string, title: string): void {
    if (this.lastErrorMessage !== message) {
      this.toastr.error(message, title);
      this.lastErrorMessage = message;
      setTimeout(() => { this.lastErrorMessage = ''; }, 3000);
    }
  }

  requestLoginOtp(): void {
    const email = this._otpLoginForm.get('email')?.value;
    
    if (!email) {
      this.otpErrorMessage = 'Please enter your email address';
      this.toastr.error(this.otpErrorMessage, 'Validation Error');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.otpErrorMessage = 'Please enter a valid email address';
      this.toastr.error(this.otpErrorMessage, 'Invalid Email');
      return;
    }

    // Check cooldown
    if (this.otpCooldown) {
      this.toastr.warning(`Please wait ${this.otpCooldownSeconds}s before requesting another OTP`, 'Please Wait');
      return;
    }

    this.otpRequestCount++;
    if (this.otpRequestCount > 5) {
      this.otpErrorMessage = 'Too many OTP requests. Please try again later.';
      this.toastr.error(this.otpErrorMessage, 'Limit Exceeded');
      return;
    }

    this.isLoading = true;
    this.logger.info('LOGIN_COMPONENT', 'Requesting OTP for email', { email });

    this.authService.requestLoginOtp(email).subscribe({
      next: (response) => {
        this.isLoading = false;
        this._response_otp = response;
        this.otpSent = true;
        this.otpErrorMessage = '';
        this.startOtpCooldown();
        this.toastr.success('OTP sent to your email', 'Success');
        this.logger.info('LOGIN_COMPONENT', 'OTP request successful', { email });
      },
      error: (error) => {
        this.isLoading = false;
        const errorMessage = error?.error?.message || 'Failed to send OTP. Please try again.';
        this.otpErrorMessage = errorMessage;
        this.toastr.error(errorMessage, 'Error');
        this.logger.error('LOGIN_COMPONENT', 'OTP request failed', { email }, error);
      }
    });
  }

  onOtpInput(event: any): void {
    // Remove non-digit characters
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, '');
    this._otpLoginForm.get('otp')?.setValue(input.value, { emitEvent: false });
  }

  /**
   * Helper method to load menu and redirect after successful login
   */
  private proceedWithMenuLoad(username: string, userRole: string): void {
    this.logger.info('LOGIN_COMPONENT', 'Login successful, loading menu', { username, userRole });
    const role = userRole || this.authService.getUserRole() || '';
    this.service.loadMenuByRole(role).subscribe({
      next: (menuItems) => {
        console.log('LOGIN_COMPONENT: Menu items loaded:', menuItems);
        this.toastr.success('Login successful', 'Welcome');
        this.router.navigateByUrl('/');
      },
      error: (error) => {
        this.logger.error('LOGIN_COMPONENT', 'Failed to load menu items', { username }, error);
        this.toastr.error('Failed to load menu items', 'Error');
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
}
