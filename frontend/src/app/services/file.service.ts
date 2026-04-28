import { Injectable } from '@angular/core';

const BACKEND_URL = 'http://localhost:4500';

export interface UploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  hash: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class FileService {
  async upload(file: File): Promise<UploadResult> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${BACKEND_URL}/api/files/upload`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Upload failed: ${res.status} ${text}`);
    }
    return (await res.json()) as UploadResult;
  }
}
