import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss',
})
export class DashboardLayoutComponent {
  protected auth = inject(AuthService);
  private router = inject(Router);

  protected isAdmin = computed(() => this.auth.role() === 'admin');
  protected isLawyer = computed(() => this.auth.role() === 'lawyer');

  short(addr: string | null): string {
    if (!addr) return '';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
