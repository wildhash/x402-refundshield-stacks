# Quick Reference Guide

## Installation

```bash
npm install
cp .env.example .env
npm start
```

## Environment Variables

```bash
PORT=3000
CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
CONTRACT_NAME=timeout-escrow
PROVIDER_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
TIMEOUT_BLOCKS=144
DEFAULT_AMOUNT=1000000
```

## API Endpoints

### GET /api/health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

### GET /api/protected-resource
Protected resource that requires payment

**Without payment proof:**
```json
{
  "status": 402,
  "message": "Payment Required",
  "paymentDetails": {
    "network": "stacks-testnet",
    "contract": "ST1...GZGM.timeout-escrow",
    "provider": "ST1...GZGM",
    "amount": "1000000",
    "escrowId": "abc123...",
    "timeoutBlocks": 144
  },
  "refundPolicy": {
    "contractAddress": "ST1...GZGM",
    "contractName": "timeout-escrow",
    "escrowId": "abc123...",
    "amount": "1000000",
    "refundable": true,
    "timeoutBlocks": 144
  }
}
```

**With valid payment proof:**
```json
{
  "success": true,
  "message": "Access granted to protected resource",
  "data": {
    "content": "This is premium content that requires payment",
    "timestamp": 1234567890,
    "receiptHash": "def456..."
  },
  "escrowId": "abc123..."
}
```

### GET /api/status/:escrowId
Check escrow status

**Response:**
```json
{
  "escrowId": "abc123...",
  "status": "active",
  "escrow": {
    "payer": "ST1...",
    "provider": "ST1...",
    "amount": "1000000",
    "expiryHeight": 1144,
    "claimed": false,
    "refunded": false
  },
  "currentHeight": 1000,
  "isExpired": false
}
```

### POST /api/claim
Provider claims escrow

**Request:**
```json
{
  "escrowId": "abc123...",
  "receiptHash": "def456..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Escrow claimed",
  "escrowId": "abc123...",
  "receiptHash": "def456..."
}
```

### GET /api/escrows
List all tracked escrows

**Response:**
```json
{
  "escrows": [
    {
      "escrowId": "abc123...",
      "amount": "1000000",
      "expiryHeight": 1144,
      "created": 1234567890,
      "status": "pending"
    }
  ]
}
```

## Smart Contract Functions

### deposit-escrow
Create a new escrow deposit

**Parameters:**
- `escrow-id` (buff 32) - Unique escrow identifier
- `provider` (principal) - Provider address
- `amount` (uint) - Amount in microSTX
- `timeout-blocks` (uint) - Timeout in blocks

**Returns:**
```clarity
(ok { escrow-id: buff, expiry-height: uint })
```

### claim-escrow
Provider claims escrow with receipt hash

**Parameters:**
- `escrow-id` (buff 32) - Escrow identifier
- `receipt-hash` (buff 32) - Receipt hash

**Returns:**
```clarity
(ok true)
```

**Requirements:**
- Called by provider before expiry
- Escrow not already claimed or refunded

### refund-escrow
Payer reclaims funds after expiry

**Parameters:**
- `escrow-id` (buff 32) - Escrow identifier

**Returns:**
```clarity
(ok true)
```

**Requirements:**
- Called by payer after expiry
- Escrow not already claimed or refunded

### get-escrow (read-only)
Get escrow details

**Parameters:**
- `escrow-id` (buff 32) - Escrow identifier

**Returns:**
```clarity
(optional {
  payer: principal,
  provider: principal,
  amount: uint,
  expiry-height: uint,
  claimed: bool,
  refunded: bool,
  receipt-hash: (optional (buff 32))
})
```

## SDK Usage

### Initialize Client

```javascript
const { X402Client } = require('./sdk');

const client = new X402Client({
  contractAddress: 'ST1...GZGM',
  contractName: 'timeout-escrow',
  defaultFee: BigInt(10000) // optional
});
```

### Create Deposit Transaction

```javascript
const tx = await client.createDepositTransaction(
  escrowId,              // hex string
  providerAddress,       // principal string
  1000000,              // amount in microSTX
  144,                  // timeout in blocks
  privateKey,           // sender private key
  { fee: BigInt(15000) } // optional custom fee
);

const result = await client.broadcastTransaction(tx);
```

### Create Claim Transaction

```javascript
const tx = await client.createClaimTransaction(
  escrowId,              // hex string
  receiptHash,          // hex string
  privateKey,           // provider private key
  { fee: BigInt(15000) } // optional custom fee
);

const result = await client.broadcastTransaction(tx);
```

### Create Refund Transaction

```javascript
const tx = await client.createRefundTransaction(
  escrowId,              // hex string
  privateKey,           // payer private key
  { fee: BigInt(15000) } // optional custom fee
);

const result = await client.broadcastTransaction(tx);
```

### Create Payment Proof

```javascript
const proof = client.createPaymentProof(escrowId, txId);
// Use in x-payment-proof header
```

## Express Middleware

```javascript
const express = require('express');
const { createX402Middleware } = require('./sdk');

const app = express();

app.get('/premium', 
  createX402Middleware({ serverUrl: 'http://localhost:3000' }),
  (req, res) => {
    res.json({ content: 'Premium content' });
  }
);
```

## Testing

```bash
# Run all tests
npm test

# Start server
npm start

# Test health endpoint
curl http://localhost:3000/api/health

# Test 402 endpoint
curl http://localhost:3000/api/protected-resource

# Check escrow status
curl http://localhost:3000/api/status/[escrow-id]

# List all escrows
curl http://localhost:3000/api/escrows
```

## Common Error Codes

### Contract Errors
- `u100` - ERR-NOT-FOUND: Escrow not found
- `u101` - ERR-ALREADY-CLAIMED: Escrow already claimed
- `u102` - ERR-NOT-EXPIRED: Escrow not yet expired
- `u103` - ERR-EXPIRED: Escrow already expired
- `u104` - ERR-UNAUTHORIZED: Unauthorized caller
- `u105` - ERR-INVALID-AMOUNT: Invalid amount (must be > 0)

### API Errors
- `402` - Payment Required: No valid payment proof
- `404` - Not Found: Escrow not found
- `500` - Internal Server Error: Server error

## Payment Flow

1. **Client requests protected resource**
   ```bash
   GET /api/protected-resource
   → 402 Payment Required
   ```

2. **Client deposits to escrow**
   ```javascript
   await client.createDepositTransaction(...)
   await client.broadcastTransaction(tx)
   ```

3. **Client accesses with payment proof**
   ```bash
   GET /api/protected-resource
   Headers: { "x-payment-proof": "..." }
   → 200 OK with content
   ```

4. **Provider claims OR payer refunds**
   ```javascript
   // Provider (before timeout)
   await client.createClaimTransaction(...)
   
   // Payer (after timeout)
   await client.createRefundTransaction(...)
   ```

## Tips

- Always check escrow status before claiming/refunding
- Store escrow IDs for tracking
- Monitor block height for expiry
- Use appropriate fees based on network conditions
- Test on testnet before mainnet deployment
- Keep private keys secure
- Implement proper error handling
