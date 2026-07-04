import { Component, signal, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { AuthService } from './core/auth/auth.service';
import { WebSocketService } from './core/http/websocket.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('warehouse-app');
  private auth = inject(AuthService);
  private ws = inject(WebSocketService);

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.ws.connect();
      } else {
        this.ws.disconnect();
      }
    });
  }
}
