# On-Chain Verification Guide

This document explains how the server verifies deposits on the Stacks blockchain.

## Overview

As of the latest version, the server includes **on-chain transaction verification** that checks:
1. The transaction exists and is successful
2. The transaction is a contract call to the refund-escrow contract
3. The contract function called is `deposit`
4. The payment ID matches the expected value
5. The amount matches the expected price

This prevents clients from providing fake transaction IDs and ensures payment is actually deposited.

## How It Works

### Payment Flow with Verification

```
1. Client → GET /premium
   Server → 402 + PaymentChallenge {paymentId, amountUstx, escrow, ...}

2. Client → Deposits STX on-chain
   Calls: refund-escrow.deposit(paymentId, provider, amount, expiry, metaHash)
   Gets: Transaction ID (txid)

3. Client → GET /premium with X402-Payment header
   Header: {"paymentId": "abc123...", "txid": "0x1234..."}

4. Server → Verifies transaction on-chain via Stacks API
   - Fetches transaction from blockchain
   - Validates all parameters match
   
5a. If valid → 200 OK + Resource + receiptHash
5b. If invalid → 402 Payment verification failed
```

## API Endpoints

### GET /premium (with verification)

**Without payment:**
```bash
curl http://localhost:4020/premium
```
Returns 402 with payment challenge.

**With payment proof:**
```bash
curl -H 'X402-Payment: {"paymentId":"abc123","txid":"0x1234abcd..."}' \
     http://localhost:4020/premium
```

If `txid` is provided and verification is enabled:
- ✅ Valid deposit → Returns 200 with resource
- ❌ Invalid/missing deposit → Returns 402 with error

### GET /status/:paymentId

Check if a payment has been verified.

**Without txid:**
```bash
curl http://localhost:4020/status/abc123
```
Returns: `{"status": "unknown", "note": "Provide txid query parameter..."}`

**With txid:**
```bash
curl 'http://localhost:4020/status/abc123?txid=0x1234abcd...'
```

Response if verified:
```json
{
  "paymentId": "abc123",
  "status": "deposited",
  "txid": "0x1234abcd...",
  "verified": true
}
```

Response if not verified:
```json
{
  "paymentId": "abc123",
  "status": "unknown",
  "txid": "0x1234abcd...",
  "verified": false,
  "note": "Transaction not found or does not match expected deposit"
}
```

## Configuration

### Environment Variables

In `apps/server/.env`:

```bash
# Network to check transactions on
NETWORK=testnet  # or mainnet

# Deployed contract details
ESCROW_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
ESCROW_CONTRACT_NAME=refund-escrow

# Payment parameters
PRICE_USTX=100000
EXPIRY_SECONDS=90

# Verification settings
SKIP_VERIFICATION=false  # Set to true to disable on-chain verification
```

### Disabling Verification

During development, you may want to test without on-chain verification:

```bash
SKIP_VERIFICATION=true
```

When enabled, the server will accept any payment header without checking the blockchain.

## Verification Logic

The `verifyDeposit` function in `apps/server/src/stacks.ts` performs these checks:

### 1. Transaction Exists
```typescript
const tx = await getTransaction(txid, network);
if (!tx) return false;
```

### 2. Transaction Succeeded
```typescript
if (tx.tx_status !== "success") return false;
```

### 3. Correct Contract Call
```typescript
if (tx.tx_type !== "contract_call") return false;
if (tx.contract_call?.contract_id !== `${contractAddress}.${contractName}`) return false;
if (tx.contract_call?.function_name !== "deposit") return false;
```

### 4. Correct Arguments
```typescript
// Parse contract call arguments
const args = parseContractCallArgs(tx);

// Verify payment-id matches
if (args["payment-id"]?.value !== paymentId) return false;

// Verify amount matches
if (Number(args["amount"]?.value) !== amountUstx) return false;
```

## Stacks API Integration

The server uses the **Stacks Blockchain API** to fetch transaction data:

- **Testnet**: `https://api.testnet.hiro.so`
- **Mainnet**: `https://api.mainnet.hiro.so`

### Transaction Endpoint
```
GET /extended/v1/tx/{txid}
```

Returns full transaction details including:
- Transaction status
- Transaction type
- Contract call information
- Function arguments
- And more...

## Error Handling

### Transaction Not Found
```json
{
  "error": "Payment verification failed",
  "message": "The provided transaction does not match the expected deposit",
  "paymentId": "abc123",
  "txid": "0x1234"
}
```

### Transaction Pending
If the transaction is still pending, `tx_status` won't be "success", so verification fails.
The client should wait for confirmation and retry.

### Wrong Contract/Function
If the transaction calls a different contract or function, verification fails.

### Amount Mismatch
If the deposited amount doesn't match `PRICE_USTX`, verification fails.

## Testing

### Manual Testing with Real Transactions

1. Deploy the contract to testnet (see `docs/testnet.md`)
2. Configure the server with the deployed contract address
3. Make a real deposit transaction using a wallet
4. Copy the transaction ID
5. Call `/premium` with the txid in the header
6. Verify the server accepts it

### Testing Without Verification

For rapid development, disable verification:

```bash
SKIP_VERIFICATION=true npm run dev
```

Then any payment header will work:
```bash
curl -H 'X402-Payment: {"paymentId":"test","txid":"anything"}' \
     http://localhost:4020/premium
```

## Security Considerations

### Why Verification Matters

Without on-chain verification, a client could:
- ❌ Provide fake transaction IDs
- ❌ Reuse old transaction IDs
- ❌ Use someone else's transaction ID

With verification:
- ✅ Only real, successful deposits are accepted
- ✅ Payment ID must match
- ✅ Amount must be correct

### Current Limitations

The current implementation does NOT check:
- [ ] Whether the deposit has already been claimed
- [ ] Whether the deposit has been refunded
- [ ] Replay attacks (same txid used multiple times)

**Recommendation**: For production, add a database to track:
- Which payment IDs have been fulfilled
- Which txids have been used
- Expiry tracking

### Rate Limiting

The Stacks API has rate limits. For high-traffic applications, consider:
- Caching transaction results
- Using a local Stacks node
- Implementing exponential backoff for API calls

**Important**: The current server implementation does not include rate limiting on the API endpoints. For production deployment, you should add rate limiting middleware to prevent abuse:

```bash
npm install express-rate-limit
```

Example rate limiting configuration:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

app.use('/premium', limiter);
app.use('/status', limiter);
```

## Future Enhancements

### Planned Improvements

1. **Read contract state directly**
   - Use `get-payment` read-only function
   - Verify deposit hasn't been claimed/refunded
   
2. **Database tracking**
   - Store fulfilled payments
   - Prevent replay attacks
   
3. **Webhook support**
   - Listen for deposit events
   - Proactive notification to clients
   
4. **Multiple payment support**
   - Accept multiple txids for the same paymentId
   - Aggregate payments

## Troubleshooting

### "Transaction not found"

**Cause**: The txid doesn't exist on the blockchain or hasn't been mined yet.

**Solution**: 
- Verify the txid is correct
- Wait for the transaction to confirm
- Check you're using the correct network (testnet vs mainnet)

### "Contract mismatch"

**Cause**: The transaction calls a different contract than expected.

**Solution**:
- Verify `ESCROW_CONTRACT_ADDRESS` matches your deployed contract
- Verify `ESCROW_CONTRACT_NAME` is correct
- Make sure the deposit was made to the right contract

### "Amount mismatch"

**Cause**: The deposited amount doesn't match `PRICE_USTX`.

**Solution**:
- Check the amount in the deposit transaction
- Verify `PRICE_USTX` is set correctly in the server
- Make sure client is using the amount from the payment challenge

### "Payment ID mismatch"

**Cause**: The payment ID in the deposit doesn't match the payment ID in the header.

**Solution**:
- Verify the client is using the exact paymentId from the 402 response
- Check for encoding issues (hex vs string)

## Additional Resources

- [Stacks API Documentation](https://docs.hiro.so/api)
- [Stacks.js Documentation](https://docs.stacks.co/stacks.js)
- [Clarity Language Reference](https://docs.stacks.co/clarity)
