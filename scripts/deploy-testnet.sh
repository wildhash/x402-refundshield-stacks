#!/bin/bash
set -e

echo "🚀 Deploying refund-escrow to Stacks Testnet"
echo ""

# Check if Clarinet is installed
if ! command -v clarinet &> /dev/null; then
    echo "❌ Error: Clarinet is not installed"
    echo "Please install Clarinet: https://docs.hiro.so/clarinet"
    exit 1
fi

# Check if mnemonic is set
if [ -z "$CLARINET_TESTNET_DEPLOYER_MNEMONIC" ]; then
    echo "⚠️  Warning: CLARINET_TESTNET_DEPLOYER_MNEMONIC is not set"
    echo "Please set your testnet deployer mnemonic:"
    echo "  export CLARINET_TESTNET_DEPLOYER_MNEMONIC='your mnemonic phrase'"
    echo ""
    echo "Or edit settings/Testnet.toml directly (not recommended for security)"
    exit 1
fi

# Verify contract syntax
echo "📝 Checking contract syntax..."
clarinet check

if [ $? -ne 0 ]; then
    echo "❌ Contract check failed"
    exit 1
fi

echo "✅ Contract syntax is valid"
echo ""

# Deploy to testnet
echo "📦 Deploying to testnet..."
echo "This may take a few moments..."
echo ""

clarinet deploy --testnet

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Copy the contract address from the output above"
    echo "2. Update apps/server/.env with:"
    echo "   ESCROW_CONTRACT_ADDRESS=<your-deployer-address>"
    echo "   ESCROW_CONTRACT_NAME=refund-escrow"
    echo "   NETWORK=testnet"
    echo ""
    echo "3. Verify deployment on explorer:"
    echo "   https://explorer.hiro.so/?chain=testnet"
else
    echo "❌ Deployment failed"
    exit 1
fi
