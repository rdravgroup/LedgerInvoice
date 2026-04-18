import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CustomerService } from '../../_service/customer.service';
import { MasterService } from '../../_service/master.service';
import { MaterialModule } from '../../material.module';
import { CommonModule } from '@angular/common';
import { customer } from '../../_model/customer.model';
import { CustomerApiResult } from '../../_model/api-response.model';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { Country, State } from '../../_model/location.model';


@Component({
  selector: 'app-addcustomer',
  standalone: true,
  imports: [FlexLayoutModule,MaterialModule, ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './addcustomer.component.html',
  styleUrls: ['./addcustomer.component.css'],
})
export class AddcustomerComponent implements OnInit {
  customerform!: FormGroup;
  title = 'Add Customer';
  isedit = false;
  editcode = '';
  editdata!: customer;
  showOptional = false;

  countryList: Country[] = [];
  stateList: State[] = [];
  allStates: State[] = [];

  constructor(
    private builder: FormBuilder,
    private toastr: ToastrService,
    private router: Router,
    private service: CustomerService,
    private masterService: MasterService,
    private act: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.customerform = this.builder.group({
      uniqueKeyID: [''],
      name: ['', Validators.required],
      email: [''],
      phone: [''],
      addressDetails: ['', Validators.required],
      isActive: [true],

      countryName: [''],
      stateName: [''],
      mobileNo: [''],
      alternateMobile: [''],
      customer_company: ['', Validators.required],
      gst_number: [''],

      // Backend-only fields
      updateDate: [new Date().toISOString()],
      createIp: [''],
      updateIp: [''],
      countryCode: ['IN'],
      stateCode: ['UP']
    });

    // Conditional validators: only validate when user enters a value
    const emailCtrl = this.customerform.get('email');
    const phoneCtrl = this.customerform.get('phone');
    const gstCtrl = this.customerform.get('gst_number');

    emailCtrl?.valueChanges.subscribe((val) => {
      if (val) {
        emailCtrl.setValidators([Validators.email]);
      } else {
        emailCtrl.clearValidators();
      }
      emailCtrl.updateValueAndValidity({ emitEvent: false });
    });

    phoneCtrl?.valueChanges.subscribe((val) => {
      if (val) {
        phoneCtrl.setValidators([Validators.pattern(/^[0-9]{7,15}$/)]);
      } else {
        phoneCtrl.clearValidators();
      }
      phoneCtrl.updateValueAndValidity({ emitEvent: false });
    });

    gstCtrl?.valueChanges.subscribe((val) => {
      if (val) {
        gstCtrl.setValidators([Validators.minLength(6), Validators.maxLength(32)]);
      } else {
        gstCtrl.clearValidators();
      }
      gstCtrl.updateValueAndValidity({ emitEvent: false });
    });

    this.loadCountries();

    this.editcode = this.act.snapshot.paramMap.get('uniqueKeyID') || '';
    if (this.editcode) {
      this.isedit = true;
      this.title = 'Edit Customer';
      this.service.Getbycode(this.editcode).subscribe((item: customer) => {
        this.editdata = item;
        this.customerform.patchValue(this.editdata);
        if (item.countryCode) {
          this.onCountryChange(item.countryCode);
        }
      });
    }
  }

  loadCountries(): void {
    this.masterService.GetCountries().subscribe((data: any) => {
      this.countryList = data;
      if (!this.isedit) {
        this.onCountryChange('IN');
      }
    });
  }

  onCountryChange(countryCode: string): void {
    if (countryCode) {
      this.masterService.GetStatesByCountry(countryCode).subscribe((data: any) => {
        this.stateList = data;
        if (!this.isedit && countryCode === 'IN') {
          this.customerform.patchValue({ stateCode: 'UP' });
        }
      });
    } else {
      this.stateList = [];
    }
    if (!countryCode || countryCode !== this.customerform.value.countryCode) {
      this.customerform.patchValue({ stateName: '', stateCode: '' });
    }
  }

  Savecustomer(): void {
    if (this.customerform.valid) {
      const selectedCountry = this.countryList.find(c => c.countryCode === this.customerform.value.countryCode);
      const selectedState = this.stateList.find(s => s.stateCode === this.customerform.value.stateCode);

      this.customerform.patchValue({
        updateDate: new Date().toISOString(),
        updateIp: '192.168.1.1',
        createIp: '192.168.1.1',
        countryName: selectedCountry?.countryName || '',
        stateName: selectedState?.stateName || ''
      });

      const payload: customer = this.customerform.value;

      const handleResponse = (item: CustomerApiResult) => {
        if (item.result === 'pass') {
          const action = this.isedit ? 'updated' : 'created';
          this.toastr.success(`Customer ${action} successfully`, 'Success');
          this.router.navigateByUrl('/customer');
        } else {
          const errorMsg = item.errorMessage || item.message || 'Unknown error';
          this.toastr.error('Due to: ' + errorMsg, 'Failed');
        }
      };

      if (this.isedit) {
        this.service.Updatecustomer(payload).subscribe({
          next: handleResponse,
          error: () => this.toastr.error('Something went wrong', 'Error'),
        });
      } else {
        this.service.Createcustomer(payload).subscribe({
          next: handleResponse,
          error: () => this.toastr.error('Something went wrong', 'Error'),
        });
      }
    }
  }
}
