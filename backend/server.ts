import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const PORT = Number(process.env.PORT ?? 4500);
const ROOT = __dirname;
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const DATA_DIR = path.join(ROOT, 'data');
const APPS_FILE = path.join(DATA_DIR, 'lawyer-apps.json');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(APPS_FILE)) fs.writeFileSync(APPS_FILE, '[]');

type AppStatus = 'pending' | 'approved' | 'rejected';

interface LawyerApp {
  id: string;
  fullName: string;
  email: string;
  walletAddress: string;
  barLicenseNumber: string;
  jurisdiction: string;
  reason: string;
  status: AppStatus;
  rejectReason?: string;
  submittedAt: string;
  resolvedAt?: string;
}

function readApps(): LawyerApp[] {
  try {
    const raw = fs.readFileSync(APPS_FILE, 'utf-8');
    return JSON.parse(raw) as LawyerApp[];
  } catch {
    return [];
  }
}

let writing = Promise.resolve();
function writeApps(apps: LawyerApp[]): Promise<void> {
  writing = writing.then(
    () =>
      new Promise<void>((resolve, reject) => {
        fs.writeFile(APPS_FILE, JSON.stringify(apps, null, 2), (err) =>
          err ? reject(err) : resolve(),
        );
      }),
  );
  return writing;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const random = crypto.randomBytes(8).toString('hex');
    const stamp = Date.now();
    cb(null, `${stamp}-${random}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

function sha256OfFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  const h = crypto.createHash('sha256').update(buf).digest('hex');
  return '0x' + h;
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'property-proof-backend' });
});

app.post('/api/files/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const filePath = path.join(UPLOADS_DIR, req.file.filename);
  const hash = sha256OfFile(filePath);
  const url = `http://localhost:${PORT}/api/files/${req.file.filename}`;
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
    hash,
    url,
  });
});

app.get('/api/files/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'not found' });
  res.sendFile(filePath);
});

app.get('/api/lawyer-applications', (_req, res) => {
  res.json(readApps());
});

app.get('/api/lawyer-applications/by-wallet/:address', (req, res) => {
  const addr = req.params.address.toLowerCase();
  const apps = readApps().filter((a) => a.walletAddress.toLowerCase() === addr);
  res.json(apps);
});

app.post('/api/lawyer-applications', async (req: Request, res: Response) => {
  const {
    fullName,
    email,
    walletAddress,
    barLicenseNumber,
    jurisdiction,
    reason,
  } = req.body ?? {};

  if (!fullName || !email || !walletAddress || !barLicenseNumber || !jurisdiction) {
    return res.status(400).json({ error: 'missing required fields' });
  }

  const apps = readApps();
  const existing = apps.find(
    (a) =>
      a.walletAddress.toLowerCase() === String(walletAddress).toLowerCase() &&
      a.status !== 'rejected',
  );
  if (existing) {
    return res.status(409).json({
      error: 'an application already exists for this wallet',
      application: existing,
    });
  }

  const application: LawyerApp = {
    id: crypto.randomUUID(),
    fullName: String(fullName),
    email: String(email),
    walletAddress: String(walletAddress),
    barLicenseNumber: String(barLicenseNumber),
    jurisdiction: String(jurisdiction),
    reason: String(reason ?? ''),
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };

  apps.push(application);
  await writeApps(apps);
  res.status(201).json(application);
});

app.post('/api/lawyer-applications/:id/mark-approved', async (req, res) => {
  const apps = readApps();
  const app = apps.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'not found' });
  app.status = 'approved';
  app.resolvedAt = new Date().toISOString();
  delete app.rejectReason;
  await writeApps(apps);
  res.json(app);
});

app.post('/api/lawyer-applications/:id/mark-rejected', async (req, res) => {
  const reason: string = String(req.body?.reason ?? '');
  const apps = readApps();
  const app = apps.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'not found' });
  app.status = 'rejected';
  app.rejectReason = reason;
  app.resolvedAt = new Date().toISOString();
  await writeApps(apps);
  res.json(app);
});

app.listen(PORT, () => {
  console.log(`property-proof-backend listening on http://localhost:${PORT}`);
});
