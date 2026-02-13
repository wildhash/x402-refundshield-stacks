# Demo Script

## Quick Start

This demo showcases the x402 RefundShield payment flow using HTTP 402 status codes and a Stacks blockchain escrow contract.

### Prerequisites

- Node.js 18+ installed
- A web browser

### Step 1: Start the Server

```bash
cd apps/server
npm install
cp .env.example .env
npm run dev
```

The server will start on `http://localhost:4020`.

### Step 2: Open the UI

Open `apps/ui/index.html` in your web browser (you can just double-click it or use `open apps/ui/index.html` on macOS).

### Step 3: Test the Payment Flow

1. **Trigger 402 Payment Required**
   - Click the "Call /premium" button
   - You should see a 402 status with a payment challenge including:
     - `paymentId`: A unique identifier for this payment
     - `amountUstx`: The amount required (default: 100000 µSTX = 0.1 STX)
     - `escrow`: Contract details for the escrow
     - `refundPolicy`: Details about the refund guarantee

2. **Simulate Payment Fulfillment**
   - The `paymentId` will be auto-filled
   - Enter a mock transaction ID (e.g., `0x1234...`)
   - Click "Send X402-Payment header"
   - You should see a 200 response with:
     - `premium: true`
     - `message: "✅ fulfilled"`
     - A `receiptHash` that proves fulfillment

### Step 4: Test Other Endpoints

You can also test:
- Health check: `curl http://localhost:4020/health`
- Payment status: `curl http://localhost:4020/status/PAYMENT_ID`

## What's Happening

1. **Client requests** a protected resource (`/premium`)
2. **Server responds** with HTTP 402 and a payment challenge
3. **Client deposits** STX to the escrow contract (in v0, this is simulated)
4. **Client sends proof** via `X402-Payment` header
5. **Server verifies** (in v0, minimal verification) and returns the resource
6. **Server can claim** payment from escrow by providing a receipt hash
7. **Client can refund** after expiry if service wasn't delivered

## v0 Limitations

- Payment verification is mocked (just checks for header presence)
- No actual blockchain interaction yet
- No signature verification on receipts

## Next Steps (v1)

- Deploy contract to Stacks testnet
- Integrate Stacks API for on-chain verification
- Add signature verification for receipts
- Build proper deposit/claim/refund UI flows
