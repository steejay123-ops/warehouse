import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../shared';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private ws: WebSocket | null = null;
  public notifications$ = new Subject<any>();

  constructor(private auth: AuthService, private toast: ToastService) {}

  connect() {
    if (this.ws) return;

    // Use ws:// for http, wss:// for https
    const url = 'ws://localhost:8000/ws/notifications/';
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.notifications$.next(data);
        
        // Auto-show toast for notifications
        if (data.message && data.type) {
          this.toast.show(data.type, data.message);
        }
      } catch (e) {
        console.error('WebSocket parse error', e);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected. Reconnecting in 5s...');
      this.ws = null;
      setTimeout(() => this.connect(), 5000);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
