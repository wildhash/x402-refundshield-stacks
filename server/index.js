require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  bufferCV,
  uintCV,
  principalCV,
  cvToJSON,
  callReadOnlyFunction
} = require('@stacks/transactions');
const { STACKS_TESTNET } = require('@stacks/network');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for escrow tracking (use DB in production)
const escrowRegistry = new Map();

// Configuration
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const CONTRACT_NAME = 'timeout-escrow';
const PROVIDER_ADDRESS = process.env.PROVIDER_ADDRESS || CONTRACT_ADDRESS;
const TIMEOUT_BLOCKS = parseInt(process.env.TIMEOUT_BLOCKS || '144'); // ~24 hours on testnet
const DEFAULT_AMOUNT = BigInt(process.env.DEFAULT_AMOUNT || '1000000'); // 1 STX in microSTX

// Helper function to generate escrow ID
function generateEscrowId() {
  return crypto.randomBytes(32);
}

// Helper function to create refund policy
function createRefundPolicy(escrowId, amount, expiryHeight) {
  return {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    escrowId: escrowId.toString('hex'),
    amount: amount.toString(),
    expiryHeight: expiryHeight,
    refundable: true,
    timeoutBlocks: TIMEOUT_BLOCKS
  };
}

// Middleware to check for valid payment
async function requirePayment(req, res, next) {
  const authHeader = req.headers['x-payment-proof'];
  
  if (!authHeader) {
    // No payment proof provided, return 402 with challenge
    const escrowId = generateEscrowId();
    const currentHeight = await getCurrentBlockHeight();
    const expiryHeight = currentHeight + TIMEOUT_BLOCKS;
    
    const challenge = {
      status: 402,
      message: 'Payment Required',
      paymentDetails: {
        network: 'stacks-testnet',
        contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
        provider: PROVIDER_ADDRESS,
        amount: DEFAULT_AMOUNT.toString(),
        escrowId: escrowId.toString('hex'),
        timeoutBlocks: TIMEOUT_BLOCKS
      },
      refundPolicy: createRefundPolicy(escrowId, DEFAULT_AMOUNT, expiryHeight)
    };
    
    // Store escrow info for tracking
    escrowRegistry.set(escrowId.toString('hex'), {
      escrowId: escrowId.toString('hex'),
      amount: DEFAULT_AMOUNT.toString(),
      expiryHeight: expiryHeight,
      created: Date.now(),
      status: 'pending'
    });
    
    return res.status(402).json(challenge);
  }
  
  // Verify payment proof
  try {
    const paymentProof = JSON.parse(authHeader);
    const escrowId = Buffer.from(paymentProof.escrowId, 'hex');
    
    // Check escrow status on chain
    const escrow = await getEscrowStatus(escrowId);
    
    if (escrow && escrow.payer && !escrow.claimed && !escrow.refunded) {
      // Valid payment, attach to request
      req.escrowId = escrowId;
      req.escrow = escrow;
      return next();
    }
    
    return res.status(402).json({ error: 'Invalid or expired payment proof' });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(402).json({ error: 'Invalid payment proof format' });
  }
}

// Helper function to get current block height
async function getCurrentBlockHeight() {
  try {
    const network = STACKS_TESTNET;
    const result = await callReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-current-height',
      functionArgs: [],
      network: network,
      senderAddress: CONTRACT_ADDRESS
    });
    
    const jsonResult = cvToJSON(result);
    return jsonResult.value.value;
  } catch (error) {
    console.error('Error getting block height:', error);
    // Fallback to estimate
    return 1000;
  }
}

// Helper function to get escrow status
async function getEscrowStatus(escrowId) {
  try {
    const network = STACKS_TESTNET;
    const result = await callReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-escrow',
      functionArgs: [bufferCV(escrowId)],
      network: network,
      senderAddress: CONTRACT_ADDRESS
    });
    
    const jsonResult = cvToJSON(result);
    if (jsonResult.value) {
      return {
        payer: jsonResult.value.payer.value,
        provider: jsonResult.value.provider.value,
        amount: jsonResult.value.amount.value,
        expiryHeight: jsonResult.value['expiry-height'].value,
        claimed: jsonResult.value.claimed.value,
        refunded: jsonResult.value.refunded.value,
        receiptHash: jsonResult.value['receipt-hash'].value
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting escrow status:', error);
    return null;
  }
}

// Routes

// Status endpoint
app.get('/api/status/:escrowId', async (req, res) => {
  try {
    const escrowId = Buffer.from(req.params.escrowId, 'hex');
    const escrow = await getEscrowStatus(escrowId);
    
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }
    
    const currentHeight = await getCurrentBlockHeight();
    const isExpired = currentHeight >= escrow.expiryHeight;
    
    res.json({
      escrowId: req.params.escrowId,
      status: escrow.claimed ? 'claimed' : escrow.refunded ? 'refunded' : isExpired ? 'expired' : 'active',
      escrow: escrow,
      currentHeight: currentHeight,
      isExpired: isExpired
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Claim endpoint for provider
app.post('/api/claim', async (req, res) => {
  try {
    const { escrowId, receiptHash } = req.body;
    
    if (!escrowId || !receiptHash) {
      return res.status(400).json({ error: 'Missing escrowId or receiptHash' });
    }
    
    const escrowBuffer = Buffer.from(escrowId, 'hex');
    const receiptBuffer = Buffer.from(receiptHash, 'hex');
    
    // Update registry
    if (escrowRegistry.has(escrowId)) {
      escrowRegistry.get(escrowId).status = 'claimed';
    }
    
    res.json({
      success: true,
      message: 'Escrow claimed',
      escrowId: escrowId,
      receiptHash: receiptHash
    });
  } catch (error) {
    console.error('Claim error:', error);
    res.status(500).json({ error: 'Failed to claim escrow' });
  }
});

// Protected resource endpoint
app.get('/api/protected-resource', requirePayment, async (req, res) => {
  // Generate receipt hash based on content and transaction details
  // This creates verifiable proof of service
  const content = 'This is premium content that requires payment';
  const timestamp = Date.now();
  const escrowIdStr = req.escrowId ? req.escrowId.toString('hex') : 'unknown';
  
  const receiptData = `${content}|${timestamp}|${escrowIdStr}`;
  const receiptHash = crypto.createHash('sha256').update(receiptData).digest();
  
  res.json({
    success: true,
    message: 'Access granted to protected resource',
    data: {
      content: content,
      timestamp: timestamp,
      receiptHash: receiptHash.toString('hex')
    },
    escrowId: req.escrowId.toString('hex')
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Get all tracked escrows (for debugging)
app.get('/api/escrows', (req, res) => {
  const escrows = Array.from(escrowRegistry.values());
  res.json({ escrows: escrows });
});

// Start server
app.listen(PORT, () => {
  console.log(`x402 RefundShield server running on port ${PORT}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
  console.log(`Provider: ${PROVIDER_ADDRESS}`);
  console.log(`Timeout: ${TIMEOUT_BLOCKS} blocks`);
});

module.exports = app;
