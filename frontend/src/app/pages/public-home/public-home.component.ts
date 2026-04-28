import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './public-home.component.html',
  styleUrl: './public-home.component.scss',
})
export class PublicHomeComponent {
  private router = inject(Router);

  query = '';
  error = signal<string | null>(null);

  search() {
    const id = this.query.trim();
    if (!id) {
      this.error.set('Enter a property ID to search.');
      return;
    }
    this.error.set(null);
    this.router.navigate(['/property', id]);
  }
}
