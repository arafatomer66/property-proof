import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  mode = signal<'signin' | 'signup'>('signin');
  email = '';
  password = '';
  busy = signal(false);
  error = signal<string | null>(null);
  hint = signal<string | null>(null);

  switchMode(m: 'signin' | 'signup') {
    this.mode.set(m);
    this.error.set(null);
    this.hint.set(null);
  }

  async submit() {
    this.error.set(null);
    this.hint.set(null);

    if (!this.email || !this.password) {
      this.error.set('Email and password are required.');
      return;
    }

    this.busy.set(true);
    try {
      if (this.mode() === 'signup') {
        await this.auth.signup(this.email, this.password);
        if (this.auth.isAdmin()) {
          this.hint.set('Welcome, super admin!');
        }
      } else {
        await this.auth.login(this.email, this.password);
      }
      this.router.navigateByUrl('/verify');
    } catch (e: any) {
      this.error.set(e?.message ?? 'Something went wrong.');
    } finally {
      this.busy.set(false);
    }
  }

  fillAdmin() {
    this.email = 'admin@propertyproof.local';
    this.password = 'admin123';
    this.mode.set('signup');
  }
}
