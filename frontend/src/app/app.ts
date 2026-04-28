import { Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ContractService } from './services/contract.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected auth = inject(AuthService);
  protected contract = inject(ContractService);
  private router = inject(Router);

  protected showChrome = computed(() => this.auth.isLoggedIn());

  short(addr: string | null): string {
    if (!addr) return '';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
