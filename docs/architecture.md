# Architecture

## Overview

x402 RefundShield implements a **refund-guaranteed payment layer** for HTTP APIs using:
- **HTTP 402 Payment Required** status codes
- **Stacks blockchain** for trustless escrow
- **Time-based escrow** for automatic refunds

## Components

### 1. Clarity Smart Contract (`refund-escrow.clar`)

A timeout-based escrow contract on Stacks blockchain:

**Key Functions:**
- `deposit`: Client locks STX into escrow for a specific provider and expiry height
- `claim`: Provider claims payment before expiry by submitting a receipt hash
- `refund`: Client reclaims funds after expiry if not claimed

**Payment States:**
- `0`: Deposited (funds locked in escrow)
- `1`: Claimed (provider received funds)
- `2`: Refunded (client received funds back)

### 2. Express Server

HTTP API server that implements the x402 payment protocol:

**Endpoints:**
- `GET /premium`: Protected resource that returns 402 with payment challenge or 200 with content
- `GET /status/:paymentId`: Query payment status (placeholder for v0)
- `GET /health`: Health check

**Payment Flow:**
1. Client requests resource without payment proof
2. Server returns 402 with `PaymentChallenge` object
3. Client deposits to escrow contract
4. Client retries request with `X402-Payment` header containing proof
5. Server verifies proof and returns resource with `receiptHash`

### 3. Static UI

Simple HTML/JS interface for testing the flow:
- Triggers 402 payment challenges
- Displays payment requirements
- Simulates payment proof submission

## Payment Challenge Structure

```typescript
{
  paymentId: string;          // Unique identifier (SHA256 hash)
  provider: string;           // Provider principal (who can claim)
  amountUstx: string;         // Amount in micro-STX
  network: "devnet" | "testnet" | "mainnet";
  escrow: {
    address: string;          // Contract deployer address
    name: string;             // Contract name
  };
  expiry: {
    seconds: number;          // Time until refund available
    note: string;
  };
  refundPolicy: {
    type: "escrow-timeout";
    expirySeconds: number;
    refundAfter: "expiry";
  };
}
```

## Security Model

### v0 (Current)
- **Trust model**: Server is trusted to provide receipt hash
- **Refund guarantee**: Time-based; funds automatically available after expiry
- **Proof verification**: Minimal (header presence check)

### v1 (Planned)
- **Receipt signatures**: Cryptographically signed receipts
- **On-chain verification**: Server posts receipt hash on-chain before claiming
- **Dispute resolution**: Client can challenge claims with counter-proof

## Deployment Architecture

```
┌─────────────┐         HTTP 402          ┌──────────────┐
│   Client    │ ◄──────────────────────── │    Server    │
│   (Browser) │                            │   (Express)  │
└─────┬───────┘                            └──────┬───────┘
      │                                           │
      │ Stacks TX                                 │ Stacks TX
      │ (deposit)                                 │ (claim)
      ▼                                           ▼
┌─────────────────────────────────────────────────────────┐
│           Stacks Blockchain (Testnet/Mainnet)           │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │      refund-escrow.clar Contract               │    │
│  │  - Holds escrowed STX                          │    │
│  │  - Enforces timeout refunds                    │    │
│  │  - Tracks payment states                       │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Trade-offs

### Why Timeout Escrow?
- **Simple**: No complex dispute resolution needed
- **Trustless refunds**: Guaranteed by blockchain, not server
- **Fast**: No waiting for claim verification

### Limitations
- **Capital efficiency**: Funds locked during escrow period
- **Timing risk**: Provider must claim before expiry
- **No partial fulfillment**: All-or-nothing payment

## Future Enhancements

1. **Batch payments**: Multiple resources in one escrow
2. **Dynamic pricing**: Adjust based on service quality
3. **Reputation system**: Track provider claim patterns
4. **Subscription model**: Recurring escrow deposits
5. **Cross-chain**: Support other chains via bridge contracts
