import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MaterialModule } from '../../material.module';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../../_service/user.service';
import { Company } from '../../_model/company.model';

@Component({
  selector: 'app-map-company',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './map-company.component.html',
  styleUrls: ['./map-company.component.css']
})
export class MapCompanyComponent implements OnInit {
  form: FormGroup;
  username = '';
  companies: Company[] = [];
  isLoading = false;

  get selectedCompanyName(): string {
    const id = this.form.get('companyId')?.value;
    const c = this.companies.find(x => x.companyId === id);
    return c ? c.name : '';
  }

  constructor(
    private fb: FormBuilder,
    private service: UserService,
    private toastr: ToastrService,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private ref: MatDialogRef<MapCompanyComponent>
  ) {
    this.username = data?.username || '';
    this.form = this.fb.group({
      companyId: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.isLoading = true;
    this.service.getActiveCompanies().subscribe({
      next: (companies) => {
        this.companies = companies;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err?.error?.message || 'Failed to load companies';
        this.toastr.error(msg, 'Error');
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.toastr.error('Please select a company', 'Validation');
      return;
    }
    const selectedCompanyId = this.form.value.companyId;
    const selectedCompany = this.companies.find(c => c.companyId === selectedCompanyId);
    
    if (!selectedCompany) {
      this.toastr.error('Invalid company selected', 'Error');
      return;
    }

    const payload = { companyId: selectedCompany.companyId, username: this.username };
    this.service.mapCompanyCode(payload).subscribe({
      next: () => {
        this.toastr.success('Company mapped successfully', 'Success');
        this.ref.close(true);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Failed to map company';
        this.toastr.error(msg, 'Error');
      }
    });
  }

  cancel(): void {
    this.ref.close(false);
  }
}
