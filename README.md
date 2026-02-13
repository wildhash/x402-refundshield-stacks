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

### 1. Start the Server

```bash
cd apps/server
npm install
cp .env.example .env
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
3. Enter a mock txid (e.g., `0x1234abcd`)
4. Click **"Send X402-Payment header"** → See HTTP 200 with fulfilled response

---

## 📁 Project Structure

```
contracts/
  refund-escrow.clar       # Stacks escrow contract (deposit/claim/refund)
apps/
  server/
    src/
      index.ts             # Express server entry point
      routes.ts            # HTTP 402 endpoints
      refundshield.ts      # Payment challenge logic
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
```

---

## 🔧 What's Implemented (v0)

### ✅ Core Components

- **Clarity Contract** (`refund-escrow.clar`)
  - `deposit`: Lock STX into escrow with expiry height
  - `claim`: Provider claims payment before expiry
  - `refund`: Client gets refund after expiry
  - Payment tracking with status (deposited/claimed/refunded)

- **Express Server** (`apps/server`)
  - `/premium` endpoint returns HTTP 402 with payment challenge
  - `X402-Payment` header verification (basic)
  - Receipt hash generation
  - CORS enabled for browser testing

- **Static UI** (`apps/ui`)
  - Trigger 402 payment challenges
  - Display payment requirements
  - Submit payment proof headers

### 📝 Documentation

- `docs/demo.md`: Step-by-step demo script
- `docs/architecture.md`: System design and security model

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
3. Client → Deposits STX to contract (manual for v0)
4. Client → GET /premium with X402-Payment: {"paymentId":"...","txid":"..."}
5. Server → 200 OK + Resource + receiptHash
```

**Refund guarantee**: If server doesn't provide service, client can call `refund` after expiry to reclaim funds.

---

## 🔮 What's Next (v1+)

### Immediate Next Steps
- [ ] **Deploy contract to Stacks testnet**
- [ ] **Integrate Stacks API** for on-chain verification
- [ ] **Build deposit/claim/refund UI** with wallet integration
- [ ] **Receipt signature verification** (cryptographic proof)

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

# With payment proof
curl -H "X402-Payment: {\"paymentId\":\"abc\",\"txid\":\"0x123\"}" \
     http://localhost:4020/premium

# Check payment status
curl http://localhost:4020/status/abc123
```

---

## 📚 Documentation

- **[Demo Guide](docs/demo.md)**: Step-by-step walkthrough
- **[Architecture](docs/architecture.md)**: Design decisions and security model

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
