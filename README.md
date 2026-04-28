# PropertyProof

A blockchain-backed land registry that solves the most expensive problem in real estate: **"is this deed real?"**

Citizens, lawyers, banks, and journalists can independently verify any property document in 30 seconds — without trusting a central office, without storing the original file anywhere public, without MetaMask, and without paying gas. The govt registrar's office (Super Admin) is the source of truth, KYC'd lawyers can submit pending records on behalf of clients, and every revision is an append-only entry on-chain that no one — not even the contract author — can edit.

Login is **email + password**. An encrypted wallet is generated and stored in your browser. The PDF stays on a small backend; only the 32-byte SHA-256 hash is anchored on-chain.

---

## Why this exists

In Bangladesh — and in most of the world — land disputes are the **single largest source of court cases**. Two people walk in with two "originals" of the same deed, the records office can be persuaded to back either one, and the courts spend years untangling it.

The trust today is *"do you trust this office?"*. With PropertyProof, it shifts to *"does the math check out?"* — and the math always does. The first hash anchored is the canonical one. Tampering with the file by even one byte changes the hash completely (the SHA-256 avalanche effect). Forgery becomes mathematically detectable; the records office becomes auditable in real time.

---

## What's in the box

| Path | What |
|------|------|
| `contracts/PropertyProof.sol` | Solidity 0.8.24 smart contract — roles + pending queue + revisions |
| `test/PropertyProof.test.ts` | 28 Hardhat + Chai unit tests |
| `scripts/deploy.ts` | Deploys to local Hardhat node, writes ABI to frontend |
| `backend/server.ts` | Node/Express service for file storage + lawyer applications |
| `frontend/` | Angular 20 (standalone) + ethers.js v6 |

The PDF never leaves the user's machine without their action — and even then it goes only to the backend, never to the public chain. Only its 32-byte fingerprint is on-chain.

---

## Target audience — who benefits, and how

### The citizen / property owner
- A tamper-proof receipt for their deed. Govt staff change, paper files vanish, offices get hacked — the hash on-chain remains.
- Prove ownership in 30 seconds to a buyer or bank. No bribes, no notary appointments.
- See the *full history* of any plot before buying. No hidden mutations, no surprise prior claims.

### The buyer / bank issuing a loan
- Today: weeks of lawyer time poring over title chain at the registrar's office. Often still defrauded by good-quality forgeries.
- With this: drop the PDF into **Verify** → instant ✅ AUTHENTIC & CURRENT, ⚠️ OUTDATED, or ❌ NOT FOUND.

### The lawyer
- A faster, auditable workflow. Submission goes into an on-chain queue with timestamps and tx hashes. "I filed it on day X, the registrar approved on day Y" is *proven*, not claimed.
- A public, on-chain reputation: every submission they ever filed is attached to their wallet, viewable by anyone.

### The govt / registrar
- Eliminates the "lost file" excuse. Independent auditors, journalists, and opposition can verify the office isn't rewriting records.
- Drastically reduces forgery: walk-in fakes can't compete with an already-anchored canonical hash.
- Cuts staff time. Citizens self-serve at `/property/PLOT-001` — no clerks pulling paper files.

### Journalists, NGOs, researchers
- Permissionless read access. Map who owns what across a district. Spot patterns — bulk acquisitions, ownership flipping around political events, dynastic land concentration.

---

## Stack

| Layer | Tech |
|-------|------|
| Contract | Solidity 0.8.24, Hardhat |
| Network  | Local Hardhat node, chainId 31337 |
| Backend  | Node 20 + Express + Multer (file uploads), JSON-flat-file DB |
| Frontend | Angular 20 (standalone), ethers.js v6 |
| Hashing  | Browser-native `crypto.subtle` (SHA-256), backend cross-checks |
| Auth     | Email + password → encrypted in-browser wallet (scrypt KDF) |
| Funding  | Auto-faucet from a known dev account on signup (dev only) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Angular frontend  (port 4300)                   │
│                                                                   │
│   PUBLIC LAYOUT                  DASHBOARD LAYOUT                 │
│   (no login)                     (after login)                    │
│   ─────────────                  ─────────────                    │
│   / (search + hero)              /admin/*  ← Super Admin only     │
│   /property/:id                  /lawyer/* ← KYC'd lawyer only    │
│   /verify                        /pending-approval ← waiting room │
│   /history                                                        │
│   /login, /signup                                                 │
└────────────────────┬─────────────────────────────┬───────────────┘
                     │                             │
            signed tx│                  uploads PDF│
                     ▼                             ▼
       ┌──────────────────────────┐   ┌────────────────────────────┐
       │   Hardhat node :8545      │   │   Node/Express :4500        │
       │   ─────────────           │   │   ─────────────             │
       │   PropertyProof.sol       │   │   /api/files/upload         │
       │   - admin role            │   │   /api/files/:filename      │
       │   - isLawyer mapping      │   │   /api/lawyer-applications  │
       │   - pending[] queue       │   │       (POST/GET)            │
       │   - revisions[] (proof)   │   │   /api/lawyer-applications/ │
       │   - immutable history     │   │       :id/mark-approved     │
       │   - emits events          │   │   uploads/ (PDF bytes)      │
       │                           │   │   data/lawyer-apps.json     │
       └───────────────────────────┘   └────────────────────────────┘
                ON-CHAIN                       OFF-CHAIN
        (tamper-proof, costs gas)        (cheap, mutable)
```

### Source-of-truth split

| Lives on-chain (immutable, auditable)        | Lives off-chain (mutable, cheap)              |
|----------------------------------------------|------------------------------------------------|
| `superAdmin` address                         | PDF / image bytes                              |
| `isLawyer[address]` role mapping             | Lawyer name, bar number, jurisdiction          |
| `pending[]` submission queue + status        | Application reason / freetext                  |
| `revisions[propertyId][]` — every version    | (anything mutable & cheap)                     |
| `currentOwner[propertyId]`                   |                                                |
| Document **hashes** (SHA-256, 32 bytes)      |                                                |
| Submitter address per revision               |                                                |

The hash is what *links* the two sides. The backend stores the file; the chain stores its fingerprint. Re-hash the file later and check the chain — if the hash matches, the file is byte-for-byte the registered one. If even one byte changed, the hash diverges completely.

### Roles & relationship

| Role            | Identity                              | Powers                                                                |
|-----------------|---------------------------------------|-----------------------------------------------------------------------|
| **Super Admin** | Govt office (Hardhat #0 in dev)       | Direct register/amend/transfer; approve or reject any submission; grant or revoke lawyer roles |
| **Lawyer**      | `isLawyer[address] == true`           | Submit *pending* registrations and amendments; cannot write directly  |
| **Lawyer-pending** | Application filed, not yet approved | Read access only; sees own application status                         |
| **Citizen**     | Anyone, even unauthenticated          | Search any property; verify any file; browse full history             |

The contract enforces all of this. The UI hides admin/lawyer tabs as a courtesy, but even if a citizen called `approvePending` directly, the EVM would `revert` because of the `onlyAdmin` modifier.

### The two approval flows

**Lawyer onboarding:**
```
Lawyer signs up → backend POST /api/lawyer-applications (status=pending)
                → AuthService.role() = 'lawyer-pending'
                → /pending-approval screen

Admin opens /admin/lawyer-applications
   → clicks Approve
   → frontend signs grantLawyerRole(addr) on-chain (authoritative step)
   → frontend POST /api/lawyer-applications/:id/mark-approved (status display)

Lawyer logs in next time → AuthService.refreshRole() reads isLawyer[addr]
                        → role flips to 'lawyer'
                        → redirected to /lawyer
```

**Property registration:**
```
Lawyer fills form → frontend hashes PDF (SHA-256)
                  → frontend uploads PDF to backend (returns url + hash)
                  → frontend asserts upload-hash == local-hash (tamper check)
                  → frontend signs submitRegistration(...) on-chain
                  → contract pushes PendingSubmission to pending[]
                  → emits SubmissionFiled event

Admin opens /admin/pending-submissions
   → clicks Approve
   → frontend signs approvePending(id)
   → contract reads pending[id], routes to _writeRegistration internal
   → revision pushed to revisions[propertyId][]
   → currentOwner[propertyId] set
   → emits PropertyRegistered event

Public visits /property/PLOT-001
   → browser calls getHistory(propertyId) — read-only, no gas
   → renders the revision list with download links
```

---

## Features

**Public, no-login surface**
- 🔍 **Search** by property ID
- 📜 **Property page** `/property/:id` — full revision history, every file downloadable, every submitter visible
- 🛡️ **Verify** — drop any PDF, get ✅ AUTHENTIC & CURRENT / ⚠️ OUTDATED / ❌ NOT FOUND in seconds
- 📚 **History** — append-only chain of revisions with submitter addresses and timestamps

**Embedded wallet (no MetaMask)**
- Email + password sign-up generates a fresh secp256k1 keypair in the browser
- Private key encrypted with **scrypt** KDF, stored as JSON keystore in `localStorage`
- Auto-faucet on signup so non-admin users have ETH for gas
- Admin email maps deterministically to Hardhat account #0 — the deployer is the registrar

**Lawyer dashboard**
- Lawyer application form (full name, bar number, jurisdiction, reason)
- "My submissions" list with status badges (PENDING / APPROVED / REJECTED)
- Submit registration & amendment forms with file upload + on-chain anchoring

**Registrar (admin) dashboard**
- Overview cards showing pending applications and pending submissions
- One-click **Approve / Reject** for lawyer applications (signs `grantLawyerRole`)
- One-click **Approve / Reject** for property submissions (writes the revision)
- Direct write paths: Register, Amend, Transfer ownership

**Tamper-proof guarantees**
- Append-only revisions — no `update` function in the contract, only `push`
- The contract author themselves cannot rewrite history
- Hash mismatch between browser and backend aborts the upload — the user is alerted
- Every state-changing call emits an event for indexers / auditors

---

## Setup

```bash
cd property-proof
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

No MetaMask, no Docker, no external services.

---

## Run it locally

Four terminals.

**Terminal 1 — start the local chain.**

```bash
npx hardhat node
```

Prints 20 funded test accounts.

**Terminal 2 — deploy the contract.**

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

Prints the deployed address and writes `frontend/src/assets/PropertyProof.json` (address + ABI), which the Angular app loads automatically. **Re-run this script every time you restart the Hardhat node.**

The contract's super admin is the deployer (Hardhat account #0).

**Terminal 3 — start the backend.**

```bash
cd backend
npm start         # serves on http://localhost:4500
```

The first start creates `backend/uploads/` and `backend/data/lawyer-apps.json`.

**Terminal 4 — start the Angular app.**

```bash
cd frontend
npm start         # serves on http://localhost:4300
```

Open the app:

- **Public surface** — http://localhost:4300 lands on the search page. No login required.
- **Become admin** — `/login` → "Use admin credentials" → fills `admin@propertyproof.local` / `admin123` → you're the super admin.
- **Become a lawyer** — `/signup` → switch to **Lawyer** tab → fill the application → admin reviews and approves.
- **Citizen** — sign up with any email, or just browse without signing in.

---

## End-to-end demo flow

The full lifecycle in 7 steps:

1. **Public read.** http://localhost:4300/verify — drop any PDF for a non-existent property. Expect ❌ NOT FOUND.
2. **Admin direct register.** Login as admin → sidebar **Register property** → `PLOT-001`, recorded owner = a Hardhat test address (e.g. `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`), upload a PDF.
3. **Public verify.** Logout → `/verify` → same PDF, `PLOT-001` → ✅ AUTHENTIC & CURRENT.
4. **Tamper.** `cp deed.pdf tampered.pdf && echo "x" >> tampered.pdf`. Verify it → ❌ NOT FOUND.
5. **Lawyer onboarding.** `/signup` → Lawyer tab → submit application → land on `/pending-approval`. Logout, log in as admin → `/admin/lawyer-applications` → Approve. Log out, log back in as the lawyer.
6. **Lawyer submits.** Sidebar **Submit registration** → `PLOT-002`, upload a PDF → "Submitted for review."
7. **Admin approves submission.** Logout, log in as admin → `/admin/pending-submissions` → Approve → revision is on-chain.

Then visit http://localhost:4300/property/PLOT-002 — public, no login, see the full history with the submitter's address and a working file download link.

---

## Run the contract tests

```bash
npx hardhat test
```

28 tests covering: admin role, lawyer grant/revoke, register, duplicate-revert, amend, transfer, lawyer submissions, non-lawyer revert, revoked-lawyer revert, non-admin approve revert, reject doesn't write a revision, double-resolve revert, verify (current/outdated/unknown/tampered), and history ordering.

---

# How it works behind the scenes

The full lifecycle of one **Submit Registration** click — every layer involved.

## Layer 1: Your browser (the Angular app)

### A. Hashing the file

```ts
async sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return '0x' + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
```

- Reads bytes into memory
- Calls the **Web Crypto API** (`crypto.subtle.digest`) — built into every modern browser
- Computes **SHA-256** = a 32-byte fingerprint, deterministic, irreversible
- Result: a hex string like `0x3f8a92...`

> **Avalanche effect:** change one bit of the input → about half the output bits flip. That's why a single-byte change to a PDF gives a totally different hash, and that's the math behind tamper detection.

### B. Uploading the file (and cross-checking)

```ts
const upload = await fileService.upload(file);                    // POST /api/files/upload
if (upload.hash.toLowerCase() !== localHash.toLowerCase())
  throw new Error('Upload hash mismatch');                        // backend tamper check
```

The backend hashes the file independently and returns its own SHA-256. If the two diverge, something corrupted the upload — the frontend aborts before any on-chain write.

### C. Signing the submission

```ts
const tx = await contract.submitRegistration(propertyId, hash, note, recordedOwner, fileURL);
await tx.wait();
```

## Layer 2: Embedded wallet (replaces MetaMask)

When the user signs up:

1. AuthService checks the admin whitelist. If admin → wraps Hardhat #0's known private key. If not → generates a fresh random key with `ethers.Wallet.createRandom()`.
2. Key is encrypted with the user's password using **scrypt** (a slow KDF that resists brute-force) → JSON keystore.
3. Keystore is stored in `localStorage`. Plain key is held only in memory while logged in.
4. Non-admin accounts get a 1 ETH faucet drip from a dev key so they can pay gas.

When a transaction is submitted, ethers.js does this:

1. **Encodes the function call** — packs `submitRegistration(...)` into a 4-byte selector + ABI-encoded args.
2. **Builds a transaction object** — `{ to, data, gasLimit, nonce, chainId: 31337, ... }`.
3. **Signs with ECDSA over the secp256k1 curve** → produces a signature `(r, s, v)`.
4. The signature mathematically proves the tx came from your address — without revealing the private key.

Possession of the key = the right to act. That's the heart of blockchain auth.

## Layer 3: The Hardhat node (the "blockchain")

The signed tx is sent via JSON-RPC to `http://127.0.0.1:8545`. The node:

1. **Recovers your address** from the signature. ECDSA recovery is pure math — no lookup needed.
2. **Validates** — enough ETH for gas? nonce correct? signature valid for this exact tx data?
3. **Executes the contract via the EVM**:

   ```solidity
   function submitRegistration(...)
       external onlyLawyer returns (uint256 id)
   {
       require(bytes(propertyId).length > 0, "propertyId required");
       require(docHash != bytes32(0), "docHash required");
       require(recordedOwner != address(0), "recordedOwner required");

       id = pending.length;
       pending.push(PendingSubmission({
           kind: SubmissionKind.REGISTER,
           propertyId: propertyId,
           docHash: docHash,
           ...
           submittedBy: msg.sender,
           submittedAt: uint64(block.timestamp),
           status: SubmissionStatus.PENDING,
           rejectReason: ""
       }));
       emit SubmissionFiled(id, SubmissionKind.REGISTER, msg.sender, propertyId);
   }
   ```

   - The `onlyLawyer` modifier checks `isLawyer[msg.sender]`. The UI hiding tabs is a courtesy — the contract enforces access control.
   - State write: pushes a `PendingSubmission` struct to the on-chain queue.
   - Event emit: `SubmissionFiled` for indexers and frontends.
4. **Mines a block.** The block's hash references the previous block's hash → forming the chain. Tampering with any past block invalidates every block after it.
5. **Returns the tx hash** — keccak256 of the signed tx, your permanent receipt.

## Layer 4: Admin approval

The admin opens `/admin/pending-submissions`, reviews, and clicks Approve. That's a second on-chain tx:

```solidity
function approvePending(uint256 id) external onlyAdmin {
    PendingSubmission storage p = pending[id];
    require(p.status == SubmissionStatus.PENDING, "not pending");

    if (p.kind == SubmissionKind.REGISTER) {
        _writeRegistration(p.propertyId, p.docHash, p.note, p.recordedOwner, p.fileURL, p.submittedBy);
    } else {
        _writeAmendment(p.propertyId, p.docHash, p.note, p.fileURL, p.submittedBy);
    }
    p.status = SubmissionStatus.APPROVED;
    emit SubmissionApproved(id);
}
```

Internally this routes to the same `_writeRegistration` helper that admin's direct `registerProperty` uses, guaranteeing identical behavior whether the admin wrote it directly or approved a lawyer's submission.

## Layer 5: Verify (the inverse — read-only, no gas)

```solidity
function verify(string calldata propertyId, bytes32 docHash) external view returns (
    bool exists, bool isCurrent, uint256 revisionIndex
) {
    Revision[] storage chain = revisions[propertyId];
    for (uint256 i = 0; i < chain.length; i++) {
        if (chain[i].docHash == docHash)
            return (true, i == chain.length - 1, i);
    }
    return (false, false, 0);
}
```

The browser:

1. Hashes the PDF locally
2. Calls `verify(...)` via `eth_call` — no signature, no gas, just a read
3. Node runs the function, returns the result as JSON
4. UI shows ✅ / ⚠️ / ❌ and a download link to the original file

A tampered PDF produces a different hash, the loop finds no match, returns `exists: false`. **Nothing about the file or the contract leaks; only the answer comes back.**

---

## What's revolutionary here

- **No central server stores the canonical record.** The contract IS the database; the backend is just convenient file storage.
- **No admin can edit history.** No `update` function — only `push`. Even the contract author can't rewrite revision #0.
- **Permissionless verification.** Anyone with the chain data can independently check authenticity. No login, no fee.
- **Identity = key possession.** No usernames, no Auth0, no password reset emails. The signature *is* the proof of identity.
- **Roles are on-chain too.** Whether you're a lawyer is a fact in the contract, not a row in some startup's database that could be flipped at will.

The whole stack — contract + tests + backend + frontend — is well under 2,000 lines of code. Everything else (block production, signature verification, peer consensus on a real chain) is the protocol doing its job underneath.

---

## Honest caveats

This is a **learning project**. Several things are deliberately not solved:

1. **Blockchain proves "no change since registration", not "the original was genuine."** Whoever registers the first hash is trusted. Real systems need a notary, KYC chain, or registrar as the trusted first signer — which is exactly the Super Admin role here.
2. **Property IDs and wallet addresses are public.** On a public chain, anyone reads every property's full history. Real deployments need a permissioned chain, role-based access at the indexer layer, or ZK primitives.
3. **The browser-side wallet is not production-grade.** Passwords are held in `sessionStorage` while logged in for the auto-restore convenience. Real apps should use **Privy**, **Web3Auth**, **Magic.link**, or similar — they add MPC for key recovery and never store passwords client-side.
4. **The faucet uses a hard-coded dev private key.** Trivial — the Hardhat keys are public. Don't ship this.
5. **The backend has no auth.** It trusts the contract: anyone could `POST /mark-approved` directly, but it's a no-op without the matching on-chain `grantLawyerRole`. In production, the backend would mint short-lived JWTs from a wallet signature, or be eliminated entirely in favor of IPFS/Arweave for file storage.
6. **Files are stored on the local backend, not on a decentralized store.** A real system would put files on IPFS, S3 with signed URLs, or Arweave — and use the on-chain `fileURL` only as a pointer.

What it *does* prove well: a given file is bit-for-bit identical to the version someone registered, the revision history is tamper-proof, only authorized roles can write, and the public can audit everything without permission.
