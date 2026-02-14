# Testnet Deployment Guide

This guide walks you through deploying the `refund-escrow` smart contract to the Stacks testnet.

## Prerequisites

1. **Install Clarinet**: Follow the installation guide at [https://docs.hiro.so/clarinet](https://docs.hiro.so/clarinet)
2. **Testnet STX**: Get testnet STX from the [Stacks Testnet Faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet)
3. **Stacks Wallet**: Install [Leather Wallet](https://leather.io/) or [Xverse](https://www.xverse.app/) for testnet transactions

## Configuration

### 1. Set up your testnet deployer account

You have two options:

**Option A: Environment Variable (Recommended)**

```bash
export CLARINET_TESTNET_DEPLOYER_MNEMONIC="your twelve word mnemonic phrase here"
```

**Option B: Edit settings/Testnet.toml**

Replace the mnemonic placeholder in `settings/Testnet.toml`:

```toml
[accounts.deployer]
mnemonic = "your twelve word mnemonic phrase here"
```

⚠️ **Security Warning**: Never commit real mnemonics or private keys to version control!

### 2. Verify your contract

Before deploying, check your contract for syntax errors:

```bash
clarinet check
```

## Deployment Steps

### Deploy to Testnet

```bash
clarinet deploy --testnet
```

This command will:
1. Compile the `refund-escrow.clar` contract
2. Deploy it to the Stacks testnet
3. Output the deployed contract identifier

### Expected Output

```
✔ refund-escrow deployed
  Transaction ID: 0x1234...abcd
  Contract: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.refund-escrow
```

## Configure the Server

After deployment, update your server environment variables with the deployed contract details:

### For apps/server/.env

Create or update `apps/server/.env`:

```bash
# Network configuration
NETWORK=testnet

# Deployed contract details
ESCROW_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
ESCROW_CONTRACT_NAME=refund-escrow

# Payment settings
PRICE_USTX=100000
EXPIRY_SECONDS=90

# Server configuration
PORT=4020
SIMULATE_FAILURE=false
```

**Important**: Replace `ESCROW_CONTRACT_ADDRESS` with your actual deployer address from the deployment output.

## Verification

### 1. Check contract on explorer

Visit the Stacks Testnet Explorer:
```
https://explorer.hiro.so/txid/[YOUR_TX_ID]?chain=testnet
```

### 2. Verify contract functions

You can interact with your deployed contract using Clarinet console:

```bash
clarinet console --testnet
```

Then test read-only functions:

```clarity
(contract-call? .refund-escrow get-payment 0x1234...)
```

### 3. Test with the server

Start the server:

```bash
cd apps/server
npm run dev
```

Test the health endpoint:

```bash
curl http://localhost:4020/health
```

Test the payment challenge:

```bash
curl http://localhost:4020/premium
```

## Troubleshooting

### Deployment fails with "insufficient balance"

Ensure your deployer account has enough testnet STX. Request more from the faucet.

### Contract already exists

If you need to redeploy, you must either:
- Use a different account (different mnemonic)
- Deploy with a different contract name in `Clarinet.toml`

### Transaction pending for too long

Testnet can be slow. Check the transaction status on the explorer. If stuck, you may need to wait or increase the deployment fee in `settings/Testnet.toml`.

## Local Development (Devnet)

For local testing without deploying to testnet:

```bash
# Start local devnet
clarinet integrate

# In another terminal, deploy to local devnet
clarinet deploy --devnet
```

Use these local devnet settings in your server:

```bash
NETWORK=devnet
ESCROW_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
ESCROW_CONTRACT_NAME=refund-escrow
```

## Next Steps

1. Update the UI to connect to testnet
2. Test deposit, claim, and refund flows
3. Implement on-chain verification in the server
4. Monitor transactions on the explorer

## Useful Links

- [Stacks Testnet Explorer](https://explorer.hiro.so/?chain=testnet)
- [Stacks Testnet Faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet)
- [Clarinet Documentation](https://docs.hiro.so/clarinet)
- [Stacks Documentation](https://docs.stacks.co/)
