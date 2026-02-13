# x402 RefundShield for Stacks

A Stacks testnet MVP implementing HTTP 402 payments with a refund-guaranteed escrow layer.

## Overview

x402 RefundShield enables HTTP 402 (Payment Required) flows with automatic refund guarantees using Stacks smart contracts. When a client requests a protected resource, the server returns a 402 challenge. The client deposits STX into a timeout-escrow Clarity contract. The provider can claim the payment with a receipt hash before expiry, or the payer automatically gets a refund after the timeout.

## Features

- ✅ **HTTP 402 Payment Challenges** - Server returns structured payment requirements
- ✅ **Refund-Guaranteed Escrow** - Clarity smart contract with timeout mechanism
- ✅ **Automatic Refunds** - Payers can reclaim funds after expiry
- ✅ **Receipt Hash Verification** - Providers claim with proof of service
- ✅ **Status Endpoint** - Track escrow status in real-time
- ✅ **SDK Wrapper** - Drop-in middleware for Express applications
- ✅ **Demo UI** - Interactive web interface for testing the flow

## Architecture

### Components

1. **Clarity Smart Contract** (`contracts/timeout-escrow.clar`)
   - `deposit-escrow`: Create escrow with timeout
   - `claim-escrow`: Provider claims with receipt hash
   - `refund-escrow`: Payer reclaims after expiry
   - `get-escrow`: Query escrow status

2. **Express Server** (`server/index.js`)
   - Returns 402 challenges with refund policy
   - Verifies payment proofs
   - Provides status endpoint
   - Serves protected resources

3. **SDK/Middleware** (`sdk/index.js`)
   - `X402Client`: Create and broadcast transactions
   - `createX402Middleware`: Drop-in Express middleware

4. **Demo UI** (`public/index.html`)
   - Interactive payment flow demonstration
   - Status checking interface
   - Stacks wallet integration

## Quick Start

### Prerequisites

- Node.js v16 or higher
- Stacks wallet (Hiro Wallet recommended)
- Testnet STX for testing

### Installation

```bash
# Clone the repository
git clone https://github.com/wildhash/x402-refundshield-stacks.git
cd x402-refundshield-stacks

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings
```

### Deploy Smart Contract

1. Install Clarinet (Stacks smart contract development tool):
```bash
# Follow instructions at https://docs.hiro.so/clarinet/installation
```

2. Deploy the contract to testnet:
```bash
# Use Clarinet or deploy via Stacks Explorer
# Update CONTRACT_ADDRESS in .env with deployed address
```

### Start the Server

```bash
npm start
```

Server will start on http://localhost:3000

### Access the Demo UI

Open your browser to http://localhost:3000

## Usage

### Payment Flow

1. **Request Protected Resource**
   ```javascript
   GET /api/protected-resource
   ```
   
   Server responds with 402:
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

2. **Deposit to Escrow**
   ```javascript
   const { X402Client } = require('./sdk');
   
   const client = new X402Client({
     contractAddress: 'ST1...GZGM',
     contractName: 'timeout-escrow'
   });
   
   const tx = await client.createDepositTransaction(
     escrowId,
     providerAddress,
     amount,
     timeoutBlocks,
     senderPrivateKey
   );
   
   const result = await client.broadcastTransaction(tx);
   ```

3. **Access with Payment Proof**
   ```javascript
   GET /api/protected-resource
   Headers: {
     "x-payment-proof": '{"escrowId":"abc123...","txId":"0x...","network":"stacks-testnet"}'
   }
   ```
   
   Server responds with 200 and protected content.

4. **Provider Claims Payment**
   ```javascript
   POST /api/claim
   Body: {
     "escrowId": "abc123...",
     "receiptHash": "def456..."
   }
   ```

5. **Or Payer Gets Refund** (after timeout)
   ```javascript
   const tx = await client.createRefundTransaction(
     escrowId,
     payerPrivateKey
   );
   
   const result = await client.broadcastTransaction(tx);
   ```

### Check Escrow Status

```javascript
GET /api/status/:escrowId

Response:
{
  "escrowId": "abc123...",
  "status": "active|claimed|refunded|expired",
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

## SDK Integration

### As Express Middleware

```javascript
const express = require('express');
const { createX402Middleware } = require('./sdk');

const app = express();

// Apply to specific routes
app.get('/premium-content', 
  createX402Middleware({ serverUrl: 'http://localhost:3000' }),
  (req, res) => {
    res.json({ content: 'Premium content here' });
  }
);
```

### Client-Side Usage

```javascript
const { X402Client } = require('./sdk');

const client = new X402Client({
  contractAddress: 'ST1...GZGM',
  contractName: 'timeout-escrow',
  network: new StacksTestnet()
});

// Create deposit transaction
const depositTx = await client.createDepositTransaction(
  escrowId,
  providerAddress,
  1000000, // 1 STX in microSTX
  144, // ~24 hours
  privateKey
);

// Broadcast transaction
const result = await client.broadcastTransaction(depositTx);

// Create payment proof for API
const proof = client.createPaymentProof(escrowId, result.txId);

// Use proof in API requests
fetch('/api/protected-resource', {
  headers: {
    'x-payment-proof': proof
  }
});
```

## API Reference

### Server Endpoints

- `GET /api/health` - Health check
- `GET /api/protected-resource` - Protected resource (returns 402 or content)
- `GET /api/status/:escrowId` - Check escrow status
- `POST /api/claim` - Provider claims escrow
- `GET /api/escrows` - List all tracked escrows

### Contract Functions

**deposit-escrow**
- Creates new escrow with timeout
- Parameters: escrow-id, provider, amount, timeout-blocks
- Returns: escrow-id and expiry-height

**claim-escrow**
- Provider claims funds with receipt
- Parameters: escrow-id, receipt-hash
- Requires: Called before expiry by provider

**refund-escrow**
- Payer reclaims funds after timeout
- Parameters: escrow-id
- Requires: Called after expiry by payer

**get-escrow (read-only)**
- Query escrow details
- Parameters: escrow-id
- Returns: Full escrow object

## Configuration

Edit `.env` file:

```bash
# Server port
PORT=3000

# Deployed contract details
CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
CONTRACT_NAME=timeout-escrow

# Provider address (receives payments)
PROVIDER_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM

# Default escrow settings
TIMEOUT_BLOCKS=144  # ~24 hours on testnet
DEFAULT_AMOUNT=1000000  # 1 STX in microSTX
```

## Security Considerations

- **Testnet Only**: This is a testnet MVP, not audited for mainnet
- **Private Keys**: Never commit private keys or expose them in client code
- **Contract Audit**: Have the smart contract audited before production use
- **Rate Limiting**: Implement rate limiting on API endpoints
- **Input Validation**: Validate all inputs to prevent exploits

## Development

### Project Structure

```
x402-refundshield-stacks/
├── contracts/
│   └── timeout-escrow.clar    # Clarity smart contract
├── server/
│   └── index.js               # Express server
├── sdk/
│   └── index.js               # SDK and middleware
├── public/
│   └── index.html             # Demo UI
├── .env.example               # Environment template
├── package.json               # Dependencies
└── README.md                  # This file
```

### Testing

```bash
# Run tests (when implemented)
npm test

# Start development server
npm run dev
```

## Troubleshooting

**Server won't start:**
- Check if port 3000 is available
- Verify all dependencies are installed: `npm install`

**Contract calls fail:**
- Verify CONTRACT_ADDRESS is correct in .env
- Check Stacks testnet is accessible
- Ensure wallet has testnet STX

**Payment verification fails:**
- Confirm escrow was deposited on-chain
- Check escrow hasn't expired
- Verify payment proof format is correct

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

ISC

## Links

- [Stacks Documentation](https://docs.stacks.co/)
- [Clarity Language Reference](https://docs.stacks.co/clarity/)
- [HTTP 402 Specification](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402)

## Support

For issues or questions:
- Open a GitHub issue
- Check existing documentation
- Review the demo UI for examples
