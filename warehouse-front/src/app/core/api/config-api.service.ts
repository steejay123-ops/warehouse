import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PublicConfig {
  system_version: string;
  system_name: string;
  offline_sync_interval_minutes?: number;
  offline_cache_ttl_minutes?: number;
  chat_enabled?: boolean;
  chat_file_sharing?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfigApiService {
  constructor(private apiService: ApiService) {}

  getPublicConfig(): Observable<PublicConfig> {
    return this.apiService.get<PublicConfig>('public/config');
  }
}
