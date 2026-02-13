# x402 RefundShield (Stacks)

> **Refund-guaranteed payment layer for HTTP 402** — Built on Stacks blockchain for trustless escrow and automatic refunds.

## What is this?

**x402 RefundShield** brings **refund guarantees** to paid HTTP APIs using:
- **HTTP 402 Payment Required** status codes for payment challenges
- **Stacks smart contract** for trustless STX escrow
- **Timeout-based refunds** — if service fails, funds return automatically

**Use case**: Pay-per-request APIs where clients want protection against non-delivery, and providers want immediate payment on fulfillment.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A web browser
- (Optional) Clarinet CLI for contract deployment

### 1. Start the Server

```bash
cd apps/server
npm install
cp .env.example .env
# Edit .env with your configuration (see docs/testnet.md for deployment)
npm run dev
```

Server runs on `http://localhost:4020`

### 2. Open the UI

```bash
open apps/ui/index.html
```

Or just open `apps/ui/index.html` in your browser.

### 3. Test the Flow

1. Click **"Call /premium"** → See HTTP 402 response with payment challenge
2. (Note the auto-filled `paymentId`)
3. Enter a mock txid (e.g., `0x1234abcd`) or a real testnet transaction ID
4. Click **"Send X402-Payment header"** → See HTTP 200 with fulfilled response

**Note**: With `SKIP_VERIFICATION=true` (default for local testing), any txid works. For real verification, deploy to testnet first (see `docs/testnet.md`).

---

## 📁 Project Structure

```
contracts/
  refund-escrow.clar       # Stacks escrow contract (deposit/claim/refund)
apps/
  server/
    src/
      index.ts             # Express server entry point
      routes.ts            # HTTP 402 endpoints with verification
      refundshield.ts      # Payment challenge logic
      stacks.ts            # On-chain verification via Stacks API
    package.json
    tsconfig.json
    .env.example
  ui/
    index.html             # Demo UI
    app.js                 # Client-side logic
    styles.css             # Styling
docs/
  demo.md                  # Step-by-step demo guide
  architecture.md          # System architecture and design
  testnet.md               # Testnet deployment guide
  verification.md          # On-chain verification documentation
scripts/
  deploy-testnet.sh        # Automated testnet deployment
settings/
  Devnet.toml              # Local development configuration
  Testnet.toml             # Testnet deployment configuration
Clarinet.toml              # Clarinet project configuration
.editorconfig              # Editor configuration
.prettierrc                # Code formatting configuration
```

---

## 🔧 What's Implemented

### ✅ Core Components

- **Clarity Contract** (`refund-escrow.clar`)
  - `deposit`: Lock STX into escrow with expiry height
  - `claim`: Provider claims payment before expiry
  - `refund`: Client gets refund after expiry
  - Payment tracking with status constants (STATUS_DEPOSITED/CLAIMED/REFUNDED)
  - **NEW**: Expiry validation - requires expiry > current burn height on deposit

- **Express Server** (`apps/server`)
  - `/premium` endpoint returns HTTP 402 with payment challenge
  - **NEW**: On-chain transaction verification via Stacks API
  - `X402-Payment` header verification (validates actual deposits)
  - `/status/:paymentId` endpoint to check deposit verification
  - Receipt hash generation
  - CORS enabled for browser testing

- **Static UI** (`apps/ui`)
  - Trigger 402 payment challenges
  - Display payment requirements
  - Submit payment proof headers

### 🎯 Clarinet Integration

- **NEW**: Full Clarinet project setup for local development and testnet deployment
  - `Clarinet.toml`: Project configuration
  - `settings/Devnet.toml`: Local development network settings
  - `settings/Testnet.toml`: Testnet deployment configuration
  - `scripts/deploy-testnet.sh`: Automated deployment script

### 📝 Documentation

- `docs/demo.md`: Step-by-step demo script
- `docs/architecture.md`: System design and security model
- **NEW**: `docs/testnet.md`: Complete testnet deployment guide
- **NEW**: `docs/verification.md`: On-chain verification documentation

---

## 🎯 Payment Flow

```
1. Client → GET /premium
2. Server → 402 Payment Required + PaymentChallenge
   {
     paymentId: "abc123...",
     amountUstx: "100000",
     escrow: { address: "ST...", name: "refund-escrow" },
     expiry: { seconds: 90 },
     refundPolicy: { type: "escrow-timeout" }
   }
3. Client → Deposits STX to contract via Stacks wallet
   contract-call: refund-escrow.deposit(paymentId, provider, amount, expiry, metaHash)
4. Client → GET /premium with X402-Payment: {"paymentId":"...","txid":"..."}
5. Server → Verifies transaction on-chain (if SKIP_VERIFICATION=false)
   - Checks transaction exists and succeeded
   - Validates contract, function, payment ID, and amount
6. Server → 200 OK + Resource + receiptHash
```

**Refund guarantee**: If server doesn't provide service, client can call `refund` after expiry to reclaim funds.

**Security**: On-chain verification prevents fake transaction IDs and ensures actual payment.

---

## 🔮 What's Next (v1+)

### ~~Completed~~ ✅
- [x] **Deploy contract to Stacks testnet** - Clarinet setup complete
- [x] **Integrate Stacks API** for on-chain verification - Implemented
- [x] **Contract improvements** - Status constants and expiry validation

### Immediate Next Steps
- [ ] **Build deposit/claim/refund UI** with wallet integration (Leather/Hiro)
- [ ] **Receipt signature verification** (cryptographic proof)
- [ ] **Payment tracking database** to prevent replay attacks
- [ ] **Read contract state** via `get-payment` function

### Future Enhancements
- Batch payments (multiple resources per escrow)
- Dynamic pricing based on service quality
- Provider reputation tracking
- Subscription models
- Cross-chain support

---

## 🧪 Testing

### Manual Testing

```bash
# Health check
curl http://localhost:4020/health

# Trigger 402
curl http://localhost:4020/premium

# With payment proof (verification disabled by default for local dev)
curl -H "X402-Payment: {\"paymentId\":\"abc\",\"txid\":\"0x123\"}" \
     http://localhost:4020/premium

# Check payment status (no txid)
curl http://localhost:4020/status/abc123

# Check payment status with verification (requires real txid if verification enabled)
curl "http://localhost:4020/status/abc123?txid=0x1234abcd..."
```

### Testing with Real On-Chain Verification

1. Deploy contract to testnet (see `docs/testnet.md`)
2. Set `SKIP_VERIFICATION=false` in `.env`
3. Make a real deposit transaction
4. Use the real txid in your payment header
5. Server will verify the transaction on-chain

### Testing Contract Locally

```bash
# Check contract syntax (requires Clarinet)
clarinet check

# Start local devnet
clarinet integrate

# Run contract tests
clarinet test
```

---

## 📚 Documentation

- **[Demo Guide](docs/demo.md)**: Step-by-step walkthrough
- **[Architecture](docs/architecture.md)**: Design decisions and security model
- **[Testnet Deployment](docs/testnet.md)**: Complete guide to deploying on Stacks testnet
- **[On-Chain Verification](docs/verification.md)**: How transaction verification works

---

## 🏗️ Development

```bash
# Install dependencies
cd apps/server && npm install

# Development mode (auto-reload)
npm run dev

# Build for production
npm run build
npm start
```

---

## 💡 Why x402 + Refund Escrow?

Traditional paid APIs have a **trust problem**:
- Clients must pay upfront (risk: service doesn't deliver)
- Providers must deliver first (risk: clients don't pay)

**x402 RefundShield solves this** with blockchain escrow:
- ✅ Clients get **automatic refunds** if service fails
- ✅ Providers get **immediate payment** on delivery
- ✅ No trusted intermediary needed

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

Built for hackathon evaluation. Part of the x402 ecosystem exploring HTTP 402 Payment Required as a payment protocol standard.
