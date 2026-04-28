import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HashService {
  async sha256OfFile(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return '0x' + Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
