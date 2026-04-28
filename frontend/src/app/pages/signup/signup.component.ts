import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LawyerApplicationService } from '../../services/lawyer-application.service';

type SignupRole = 'citizen' | 'lawyer';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent {
  private auth = inject(AuthService);
  private lawyerApps = inject(LawyerApplicationService);
  private router = inject(Router);

  role = signal<SignupRole>('citizen');
  email = '';
  password = '';
  fullName = '';
  barLicenseNumber = '';
  jurisdiction = '';
  reason = '';
  busy = signal(false);
  error = signal<string | null>(null);

  switchRole(r: SignupRole) {
    this.role.set(r);
    this.error.set(null);
  }

  async submit() {
    this.error.set(null);
    if (!this.email || !this.password) {
      this.error.set('Email and password are required.');
      return;
    }

    if (this.role() === 'lawyer') {
      if (!this.fullName || !this.barLicenseNumber || !this.jurisdiction) {
        this.error.set('Lawyer applications need full name, bar number, and jurisdiction.');
        return;
      }
    }

    this.busy.set(true);
    try {
      await this.auth.signup(this.email, this.password);

      if (this.role() === 'lawyer') {
        await this.lawyerApps.submit({
          fullName: this.fullName,
          email: this.email,
          walletAddress: this.auth.address()!,
          barLicenseNumber: this.barLicenseNumber,
          jurisdiction: this.jurisdiction,
          reason: this.reason,
        });
        await this.auth.refreshRole();
        this.router.navigateByUrl('/pending-approval');
      } else if (this.auth.isAdmin()) {
        this.router.navigateByUrl('/admin');
      } else {
        this.router.navigateByUrl('/');
      }
    } catch (e: any) {
      this.error.set(e?.message ?? 'Sign-up failed.');
    } finally {
      this.busy.set(false);
    }
  }
}
