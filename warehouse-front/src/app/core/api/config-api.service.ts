import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PublicConfig {
  system_version: string;
  system_name: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigApiService {
  constructor(private apiService: ApiService) {}

  getPublicConfig(): Observable<PublicConfig> {
    return this.apiService.get<PublicConfig>('public/config');
  }
}
