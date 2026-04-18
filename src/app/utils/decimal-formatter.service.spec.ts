import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { DecimalFormatterService } from './decimal-formatter.service';

describe('DecimalFormatterService', () => {
  let service: DecimalFormatterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(DecimalFormatterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
