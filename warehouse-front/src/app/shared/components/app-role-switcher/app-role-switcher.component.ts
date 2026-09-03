import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppPersonaService, AppModuleType, RolePersona } from '../../../core/services/app-persona.service';

@Component({
  selector: 'app-role-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-role-switcher.component.html',
  styleUrl: './app-role-switcher.component.css'
})
export class AppRoleSwitcherComponent {
  public persona = inject(AppPersonaService);
  private elementRef = inject(ElementRef);
  private router = inject(Router);

  public isDropdownOpen = signal<boolean>(false);

  public toggleDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.persona.isMultiRole()) {
      this.isDropdownOpen.update(v => !v);
    }
  }

  public closeDropdown(): void {
    this.isDropdownOpen.set(false);
  }

  public selectRole(role: RolePersona, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.persona.switchRole(role.code);
    this.closeDropdown();
  }

  public selectApp(app: AppModuleType): void {
    if (this.persona.activeApp() !== app) {
      this.persona.switchApp(app);
      this.closeDropdown();
    }
  }

  public toggleApp(): void {
    this.persona.toggleApp();
    this.closeDropdown();
  }

  public goToLauncher(): void {
    this.closeDropdown();
    this.router.navigate(['/app/launcher']);
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  @HostListener('document:keydown.escape')
  public onEscape(): void {
    this.closeDropdown();
  }
}
