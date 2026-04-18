import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { UserDetailed } from '../../_model/user.model';
import { UserService } from '../../_service/user.service';
import { ToastrService } from 'ngx-toastr';
import { LoggerService } from '../../_service/logger.service';

@Component({
  selector: 'app-user-details-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, MatDialogModule],
  templateUrl: './user-details-dialog.component.html',
  styleUrls: ['./user-details-dialog.component.css']
})
export class UserDetailsDialogComponent implements OnInit {
  userDetails: UserDetailed | null = null;
  isLoading = false;
  errorMessage: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<UserDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { username: string },
    private userService: UserService,
    private toastr: ToastrService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.loadUserDetails();
  }

  /**
   * Load detailed user information from API
   */
  loadUserDetails(): void {
    if (!this.data?.username) {
      this.errorMessage = 'Username not provided';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    this.userService.getUserByCodeDetailed(this.data.username).subscribe({
      next: (user: UserDetailed) => {
        this.userDetails = user;
        this.isLoading = false;
        this.logger.info('UserDetailsDialog', `Loaded details for user: ${this.data.username}`);
      },
      error: (error) => {
        console.error('Error loading user details:', error);
        this.isLoading = false;
        this.errorMessage = 'Failed to load user details. Please try again.';
        this.logger.error('UserDetailsDialog', `Error loading user details: ${error.message}`);
        this.toastr.error(this.errorMessage, 'Error');
      }
    });
  }

  /**
   * Close the dialog
   */
  closeDialog(): void {
    this.dialogRef.close();
  }

  /**
   * Get company name from user details
   */
  getCompanyName(): string {
    return this.userDetails?.company?.companyName || 'N/A';
  }

  /**
   * Get company address from user details
   */
  getCompanyAddress(): string {
    return this.userDetails?.company?.address || 'N/A';
  }

  /**
   * Get created date formatted
   */
  getCreatedDate(): string {
    if (this.userDetails?.createdAt) {
      return new Date(this.userDetails.createdAt).toLocaleDateString('en-US');
    }
    return 'N/A';
  }

  /**
   * Get updated date formatted
   */
  getUpdatedDate(): string {
    if (this.userDetails?.updatedAt) {
      return new Date(this.userDetails.updatedAt).toLocaleDateString('en-US');
    }
    return 'N/A';
  }

  /**
   * Get last login date formatted
   */
  getLastLoginDate(): string {
    if (this.userDetails?.lastLoginDate) {
      return new Date(this.userDetails.lastLoginDate).toLocaleDateString('en-US');
    }
    return 'Never';
  }

  /**
   * Get status label
   */
  getStatusLabel(): string {
    return this.userDetails?.isactive ? 'Active' : 'Inactive';
  }

  /**
   * Get locked status label
   */
  getLockedLabel(): string {
    return this.userDetails?.islocked ? 'Locked' : 'Not Locked';
  }

  /**
   * Get auth provider label
   */
  getAuthProvider(): string {
    return this.userDetails?.authProvider || 'Email/Password';
  }
}
