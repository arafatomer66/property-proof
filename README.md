# PropertyProof

A small, end-to-end blockchain project for exploring the core primitives of smart contracts: a decentralized, append-only registry for property document authenticity and change management.

A super admin (registrar) anchors the **SHA-256 hash** of a deed/mutation/sale agreement on-chain. Anyone signed in can later drop a PDF into the verifier and instantly see whether it is authentic, an outdated revision, or unknown/forged. The full revision history of every property is publicly auditable.

Login is **email + password** — no MetaMask, no seed phrases. An encrypted wallet is generated and stored in your browser.

---

## What's in the box

| Path | What |
|------|------|
| `contracts/PropertyProof.sol` | Solidity 0.8.24 smart contract, ~120 lines |
| `test/PropertyProof.test.ts` | Hardhat + Chai unit tests |
| `scripts/deploy.ts` | Deploys to local node + writes ABI to frontend |
| `frontend/` | Angular 20 (standalone components) + ethers.js v6 |

The document file itself never leaves the owner's machine — only its 32-byte SHA-256 hash is anchored on-chain.

---

## Stack

| Layer | Tech |
|-------|------|
| Contract | Solidity 0.8.24, Hardhat |
| Network  | Local Hardhat node, chainId 31337 |
| Frontend | Angular 20 (standalone), ethers.js v6 |
| Hashing  | Browser-native `crypto.subtle` (SHA-256) |
| Auth     | Email + password → encrypted in-browser wallet (scrypt KDF) |
| Funding  | Auto-faucet from a known dev account on signup (dev only) |

---

## Setup

```bash
cd property-proof
npm install
cd frontend && npm install && cd ..
```

No MetaMask needed.

---

## Run it locally

Three terminals.

**Terminal 1 — start the local chain.**

```bash
npx hardhat node
```

This prints 20 funded test accounts with private keys.

**Terminal 2 — deploy the contract.**

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

This prints the deployed address and writes `frontend/src/assets/PropertyProof.json` (address + ABI), which the Angular app loads automatically. **Re-run this script every time you restart the Hardhat node.**

The contract's super admin is the deployer (Hardhat account #0).

**Terminal 3 — start the Angular app.**

```bash
cd frontend
npm start   # serves on http://localhost:4200
```

Open the app and either:

- Click **"Use admin credentials"** → fills `admin@propertyproof.local` / `admin123` → Create account → you're the super admin.
- Or sign up with any other email → you're a regular user (read-only Verify + History).

---

## End-to-end demo flow

The "killer demo" — try it once the app is up.

1. **Register.** Pick any PDF (`deed_v1.pdf`). Property ID `PLOT-001`, note "Original deed", click **Use my address** for the recorded owner. Submit.
2. **Verify (authentic).** Verify page → same `deed_v1.pdf`, property ID `PLOT-001` → ✅ AUTHENTIC & CURRENT.
3. **Verify (forged).** `cp deed_v1.pdf tampered.pdf && echo "x" >> tampered.pdf`. Verify it → ❌ NOT FOUND.
4. **Amend.** Make `deed_v2.pdf`. Amend page records it as a new revision. Verify `deed_v1.pdf` → ⚠️ OUTDATED. Verify `deed_v2.pdf` → ✅ AUTHENTIC & CURRENT.
5. **Access control.** Logout, sign up with a non-admin email, try to visit `/register` → bounced to the Access Denied page.
6. **History.** History page shows the full append-only chain.

---

## Run the contract tests

```bash
npx hardhat test
```

Covers register, duplicate-revert, admin-only restrictions on amend/transfer, verify (current/outdated/unknown/tampered), and history ordering.

---

# How it works behind the scenes

The full lifecycle of one **Register** click — every layer involved.

## Layer 1: Your browser (the Angular app)

### A. Hashing the file

```ts
// hash.service.ts
async sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return '0x' + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
```

- Reads PDF bytes into memory
- Calls the **Web Crypto API** (`crypto.subtle.digest`) — built into every modern browser
- Computes **SHA-256** = a 32-byte fingerprint that's deterministic but irreversible
- Result: a hex string like `0x3f8a92...`

The PDF never leaves the device. Only the 32-byte hash gets sent.

> **Avalanche effect:** change one bit of the input → ~half the output bits flip. That's why a single-byte change to the PDF gives a totally different hash. This is the math behind tamper detection.

### B. Submitting the registration

```ts
// contract.service.ts
async registerProperty(propertyId, docHash, note, recordedOwner) {
  const signer = this.auth.getSigner();
  const c = new Contract(address, abi, signer);
  const tx = await c.registerProperty(propertyId, docHash, note, recordedOwner);
  await tx.wait();
  return tx.hash;
}
```

## Layer 2: Embedded wallet (replaces MetaMask)

When you sign up:

1. AuthService checks if your email is in the admin whitelist. If yes → wraps Hardhat #0's known private key. If no → generates a fresh random private key with `ethers.Wallet.createRandom()`.
2. The key is encrypted with your password using **scrypt** (a slow KDF that resists brute-force) → an encrypted JSON keystore.
3. Encrypted keystore goes into `localStorage`. The raw key is held only in memory while you're logged in.
4. New non-admin accounts get an automatic 1 ETH faucet drip from a dev key so they can pay gas.

When you submit a transaction, ethers.js does this:

1. **Encodes the function call** — packs `registerProperty("PLOT-001", "0x3f8a...", ...)` into 4-byte selector + ABI-encoded args
2. **Builds a transaction object** — `{ to, data, gasLimit, nonce, chainId: 31337, ... }`
3. **Signs with ECDSA over the secp256k1 curve** → produces a signature `(r, s, v)`
4. The signature mathematically proves the tx came from your address — without revealing the private key

Possession of the key = the right to act. That's the heart of blockchain auth.

## Layer 3: The Hardhat node (the "blockchain")

The signed tx is sent via JSON-RPC to `http://127.0.0.1:8545`:

```json
POST /
{
  "jsonrpc": "2.0",
  "method": "eth_sendRawTransaction",
  "params": ["0xf86c0a85..."],
  "id": 1
}
```

The node:

### 1. Recovers your address from the signature
ECDSA recovery is pure math — given the tx data + signature, anyone can compute "this was signed by `0xf39F…2266`". No lookup needed.

### 2. Validates the tx
- Enough ETH for gas? (Yes — Hardhat pre-funds.)
- Nonce correct? (Replay protection.)
- Signature valid for this exact tx data? (Tamper protection.)

### 3. Executes the contract via the EVM

```solidity
function registerProperty(
    string calldata propertyId,
    bytes32 docHash,
    string calldata note,
    address recordedOwner
) external onlyAdmin {
    require(revisions[propertyId].length == 0, "Already registered");
    revisions[propertyId].push(Revision({
        docHash: docHash,
        owner: recordedOwner,
        timestamp: uint64(block.timestamp),
        note: note
    }));
    currentOwner[propertyId] = recordedOwner;
    emit PropertyRegistered(propertyId, docHash, recordedOwner);
}
```

Three things happen:

1. **`onlyAdmin` modifier** checks `msg.sender == superAdmin`. `msg.sender` is the address recovered from the signature. If you're not admin, the EVM `revert`s and the tx fails. **The UI hiding tabs is a courtesy — the contract itself enforces the access control.**
2. **State write** — appends a new `Revision` struct to `revisions["PLOT-001"]` in persistent contract storage.
3. **Event emit** — logs `PropertyRegistered(...)` to the receipt; indexers and frontends can subscribe.

### 4. Mines a block
The tx is bundled into a block. The block's hash references the previous block's hash → which references the one before → forming the "chain." Tampering with any past block invalidates every block after it.

### 5. Returns the tx hash
A keccak256 hash of the signed tx — globally unique, your permanent receipt.

## Layer 4: Verify (the inverse — read-only, no gas)

```solidity
function verify(string calldata propertyId, bytes32 docHash) external view returns (
    bool exists, bool isCurrent, uint256 revisionIndex
) {
    Revision[] storage chain = revisions[propertyId];
    for (uint256 i = 0; i < chain.length; i++) {
        if (chain[i].docHash == docHash) {
            return (true, i == chain.length - 1, i);
        }
    }
    return (false, false, 0);
}
```

The browser:

1. Hashes the PDF locally
2. Calls `verify(...)` via `eth_call` — no signature, no gas, just a read
3. Node runs the function, returns the result as JSON
4. UI shows ✅ / ⚠️ / ❌

Tampered PDF → different hash → loop finds no match → `exists: false`.

## The full picture

```
PDF bytes → SHA-256 in browser → 32-byte hash
                                    │
                                    ▼
Private key signs (hash + propertyId + note + owner) → ECDSA signature
                                    │
                                    ▼
JSON-RPC eth_sendRawTransaction → Hardhat node :8545
                                    │
                                    ▼
Node recovers signer → checks onlyAdmin → runs EVM bytecode
                                    │
                                    ▼
Bytecode appends Revision to mapping → emits event
                                    │
                                    ▼
Block mined → tx hash returned → green success in browser
```

## What's genuinely revolutionary here

- **No central server stores the file or the hash.** The contract IS the database.
- **No admin can edit history.** There's no `update` function — only `push` to the array. Even the contract author can't go back and rewrite revision #0.
- **Anyone with the chain data can independently verify.** No need to trust a server. The math is the proof.
- **Identity = key possession.** No usernames, no Auth0, no password reset emails. The signature *is* the proof of identity.

The whole stack is ~120 lines of Solidity + ~200 lines of TypeScript. Everything else (block production, signature verification, peer consensus on a real chain) is the protocol doing its job underneath.

---

## Honest caveats

This is a **learning project**. Several things are deliberately not solved:

1. **Blockchain proves "no change since registration", not "the original was genuine."** Whoever registers the first hash is trusted. A real land registry would have a notary or registrar as the trusted first signer.
2. **Property IDs and wallet addresses are public.** On a public chain, anyone reads every property's full history. Real deployments need a permissioned chain or ZK primitives.
3. **The browser-side wallet is not production-grade.** Passwords are held in `sessionStorage` while logged in for the auto-restore convenience. Real apps should use **Privy**, **Web3Auth**, **Magic.link**, or similar — they add MPC for key recovery and never store passwords client-side.
4. **The faucet uses a hard-coded dev private key.** Trivial — the Hardhat keys are public. Don't ship this.

What it *does* prove well: a given file is bit-for-bit identical to the version someone registered, the revision history is tamper-proof, and only the super admin (a cryptographic identity) can write.
