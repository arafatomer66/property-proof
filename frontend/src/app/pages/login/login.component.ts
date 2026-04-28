import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  busy = signal(false);
  error = signal<string | null>(null);

  async submit() {
    this.error.set(null);

    if (!this.email || !this.password) {
      this.error.set('Email and password are required.');
      return;
    }

    this.busy.set(true);
    try {
      await this.auth.login(this.email, this.password);
      this.routeByRole();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }

  fillAdmin() {
    this.email = 'admin@propertyproof.local';
    this.password = 'admin123';
  }

  private routeByRole() {
    const r = this.auth.role();
    if (r === 'admin') this.router.navigateByUrl('/admin');
    else if (r === 'lawyer') this.router.navigateByUrl('/lawyer');
    else if (r === 'lawyer-pending') this.router.navigateByUrl('/pending-approval');
    else this.router.navigateByUrl('/');
  }
}
