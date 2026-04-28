import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
})
export class PublicLayoutComponent {
  protected auth = inject(AuthService);
  private router = inject(Router);

  short(addr: string | null): string {
    if (!addr) return '';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

  goToDashboard(): void {
    const r = this.auth.role();
    if (r === 'admin') this.router.navigateByUrl('/admin');
    else if (r === 'lawyer') this.router.navigateByUrl('/lawyer');
    else if (r === 'lawyer-pending') this.router.navigateByUrl('/pending-approval');
    else this.router.navigateByUrl('/');
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
