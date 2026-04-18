import { Component, OnInit, ViewChild, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../../_service/user.service';
import { LoggerService } from '../../_service/logger.service';
import { UserProfileService } from '../../_service/user-profile.service';
import { AuthService } from '../../_service/authentication.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  isLoading = false;
  currentUsername = '';
  showPassword = false;
  userEmailDisplay = '';
  hasPassword = false;
  // Dialog is used to show non-editable info

  @ViewChild('logoutDialog') logoutDialog!: TemplateRef<any>;
  logoutDialogRef: MatDialogRef<any> | null = null;

  constructor(
    private builder: FormBuilder,
    private service: UserService,
    private toastr: ToastrService,
    private logger: LoggerService,
    private router: Router,
    private dialog: MatDialog,
    private authService: AuthService,
    private profileService: UserProfileService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    console.log('ProfileComponent: ngOnInit called');
    this.logger.logComponentLifecycle('ProfileComponent', 'ngOnInit');
    
    // Debug auth state
    const fromService = this.authService.getUsername();
    const fromStorage = localStorage.getItem('username');
    console.log('ProfileComponent: AuthService.getUsername() ->', fromService);
    console.log('ProfileComponent: localStorage.getItem("username") ->', fromStorage);
    console.log('ProfileComponent: authService.getAuthStatus() ->', this.authService.getAuthStatus());
    console.log('ProfileComponent: localStorage.getItem("token") ->', localStorage.getItem('token') ? 'EXISTS' : 'MISSING');
    
    this.loadCurrentUserData();
  }

  initializeForm(): void {
    this.profileForm = this.builder.group({
      username: [{ value: '', disabled: true }, Validators.required],
      newUsername: [''],
      name: ['', Validators.required],
      phone: ['', Validators.required],
      address: ['']
    });
  }

  loadCurrentUserData(): void {
    console.log('ProfileComponent: loadCurrentUserData() called');
    this.currentUsername = this.authService.getUsername() || localStorage.getItem('username') || '';
    console.log('ProfileComponent: currentUsername ->', this.currentUsername);
    
    if (!this.currentUsername) {
      console.error('ProfileComponent: No username found! Auth status may be lost.');
      this.toastr.error('Unable to load user information. Please login again.', 'Error');
      this.router.navigateByUrl('/login');
      return;
    }

    // Always fetch fresh data from the API
    console.log('ProfileComponent: fetching from API for', this.currentUsername);
    this.service.getUserByCode(this.currentUsername).subscribe({
      next: (user) => {
        console.log('ProfileComponent: getUserByCode response ->', user);
        
        if (!user) {
          console.warn('ProfileComponent: API returned empty user object');
          this.profileForm.patchValue({ username: this.currentUsername });
          this.cdr.detectChanges();
          return;
        }

        const rawName = user.name || '';
        const rawEmail = user.email || '';
        const rawPhone = user.phone || '';
        const rawAddress = user.address || '';

        const clean = (s: string) => (typeof s === 'string' ? s.replace(/\r|\n/g, ' ').replace(/\s+/g, ' ').trim() : '');

        const name = clean(rawName);
        const email = clean(rawEmail);
        const phone = clean(rawPhone);
        const address = clean(rawAddress);

        console.log('ProfileComponent: cleaned values ->', { name, email, phone, address });

        // Store in profileService for future use
        if (name) this.profileService.setName(name);
        if (phone) this.profileService.setPhone(phone);
        if (address) this.profileService.setAddress(address);
        if (email) this.profileService.setEmail(email);

        // Patch form
        this.profileForm.patchValue({
          username: this.currentUsername,
          name,
          phone,
          address
        });

        this.userEmailDisplay = email || this.currentUsername || '';

        // Determine whether user has created a password (try common flags)
        const detectPasswordCreated = (u: any): boolean => {
          if (!u) return false;
          const truthyKeys = ['hasPassword', 'isPasswordCreated', 'passwordCreated', 'isPasswordSet', 'haspassword'];
          for (const k of truthyKeys) {
            if (u[k] === true) return true;
            if (typeof u[k] === 'string' && u[k].toLowerCase() === 'true') return true;
          }
          // Some APIs use a placeholder string like 'EMAIL_AUTH_ONLY' to indicate no password set
          if (u.password && typeof u.password === 'string' && u.password.length > 0) {
            const pw = u.password.toString().trim();
            if (pw.length === 0) return false;
            if (pw.toUpperCase() === 'EMAIL_AUTH_ONLY') return false;
            return true;
          }
          return false;
        };

        this.hasPassword = detectPasswordCreated(user as any);

        console.log('ProfileComponent: password field ->', (user as any).password);
        console.log('ProfileComponent: detectPasswordCreated ->', this.hasPassword, 'user object:', user);

        console.log('ProfileComponent: form patched ->', this.profileForm.getRawValue());
        this.cdr.detectChanges();
        console.log('ProfileComponent: view updated');
      },
      error: (err) => {
        console.error('ProfileComponent: getUserByCode failed ->', err);
        this.toastr.error('Failed to load profile. Please try again.', 'Error');
        this.profileForm.patchValue({ username: this.currentUsername });
        this.userEmailDisplay = this.currentUsername || '';
        this.cdr.detectChanges();
      }
    });
  }

  updateProfile(): void {
    if (this.profileForm.invalid) {
      this.logger.logFormValidation('ProfileForm', false, this.profileForm.errors);
      this.toastr.error('Please fill in all required fields', 'Validation Error');
      return;
    }

    this.isLoading = true;
    const profileData = {
      username: this.currentUsername,
      newUsername: this.profileForm.value.newUsername || null,
      name: this.profileForm.value.name,
      phone: this.profileForm.value.phone,
      address: this.profileForm.value.address
    };

    this.logger.info('ProfileComponent', 'Updating user profile', profileData);

    this.service.updateProfile(profileData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.logger.logApiResponse('POST', '/api/User/updateprofile', 200, response);

        if (response.result === 'pass') {
          this.logger.logAuthEvent('Profile updated successfully', { user: this.currentUsername });

          // Update profile storage with new values
          this.profileService.setName(this.profileForm.value.name);
          this.profileService.setPhone(this.profileForm.value.phone);
          this.profileService.setAddress(this.profileForm.value.address);

          // Notify user and force logout via a non-closable dialog
          this.toastr.success('Profile updated. You will be logged out to apply changes.', 'Success');

          const dialogRef = this.dialog.open(this.logoutDialog, { width: '420px', disableClose: true });
          this.logoutDialogRef = dialogRef;
          dialogRef.afterClosed().subscribe(() => {
            this.logoutDialogRef = null;
            this.profileService.clearProfile();
            this.authService.logout();
            this.router.navigateByUrl('/login');
          });
        } else {
          this.logger.error('ProfileComponent', 'Profile update failed', response);
          this.toastr.error(response.message || 'Failed to update profile', 'Update Failed');
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.logger.logApiError('POST', '/api/User/updateprofile', error?.status || 500, error);
        
        if (error?.status === 0) {
          this.toastr.error('Network error. Please check your connection and try again.', 'Network Error');
        } else if (error?.status >= 500) {
          this.toastr.error('Server error. Please try again later.', 'Server Error');
        } else {
          this.toastr.error('Failed to update profile. Please try again.', 'Update Failed');
        }
      }
    });
  }

  cancelUpdate(): void {
    this.router.navigateByUrl('/');
  }


  openInfoDialog(templateRef: any): void {
    this.dialog.open(templateRef, { width: '420px' });
  }

  closeLogoutDialog(): void {
    this.logoutDialogRef?.close();
  }
}
