/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ToastrModule } from 'ngx-toastr';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';

import { CreateinvoiceComponent } from './createinvoice.component';
import { MasterService } from '../../_service/master.service';

describe('CreateinvoiceComponent', () => {
  let component: CreateinvoiceComponent;
  let fixture: ComponentFixture<CreateinvoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CreateinvoiceComponent,
        HttpClientTestingModule,
        RouterTestingModule,
        ToastrModule.forRoot(),
        BrowserAnimationsModule,
        MatNativeDateModule,
        MatDatepickerModule,
        MatProgressSpinnerModule,
        MatGridListModule,
        MatInputModule,
        MatSelectModule,
        MatTableModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        ReactiveFormsModule,
        FormsModule,
        CommonModule
      ]
    })
    .compileComponents();

    const masterService = TestBed.inject(MasterService);
    spyOn(masterService as any, 'GetCustomer').and.returnValue(of([]));
    spyOn(masterService as any, 'GetProducts').and.returnValue(of([]));

    fixture = TestBed.createComponent(CreateinvoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not stay in loading state for a new invoice', () => {
    expect(component.isLoading).toBeFalse();
  });
});
