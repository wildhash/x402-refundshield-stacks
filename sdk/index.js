const {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  bufferCV,
  uintCV,
  principalCV,
  makeStandardSTXPostCondition,
  FungibleConditionCode
} = require('@stacks/transactions');
const { STACKS_TESTNET } = require('@stacks/network');

class X402Client {
  constructor(options = {}) {
    this.network = options.network || STACKS_TESTNET;
    this.contractAddress = options.contractAddress || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    this.contractName = options.contractName || 'timeout-escrow';
    this.defaultFee = options.defaultFee || BigInt(10000);
  }

  /**
   * Create a deposit transaction for an escrow
   */
  async createDepositTransaction(escrowId, providerAddress, amount, timeoutBlocks, senderKey, options = {}) {
    const escrowIdBuffer = Buffer.from(escrowId, 'hex');
    
    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'deposit-escrow',
      functionArgs: [
        bufferCV(escrowIdBuffer),
        principalCV(providerAddress),
        uintCV(amount),
        uintCV(timeoutBlocks)
      ],
      senderKey: senderKey,
      validateWithAbi: false,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: options.fee || this.defaultFee
    };

    const transaction = await makeContractCall(txOptions);
    return transaction;
  }

  /**
   * Broadcast a transaction to the network
   */
  async broadcastTransaction(transaction) {
    const broadcastResponse = await broadcastTransaction(transaction, this.network);
    return broadcastResponse;
  }

  /**
   * Create a claim transaction for a provider
   */
  async createClaimTransaction(escrowId, receiptHash, senderKey, options = {}) {
    const escrowIdBuffer = Buffer.from(escrowId, 'hex');
    const receiptHashBuffer = Buffer.from(receiptHash, 'hex');
    
    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'claim-escrow',
      functionArgs: [
        bufferCV(escrowIdBuffer),
        bufferCV(receiptHashBuffer)
      ],
      senderKey: senderKey,
      validateWithAbi: false,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: options.fee || this.defaultFee
    };

    const transaction = await makeContractCall(txOptions);
    return transaction;
  }

  /**
   * Create a refund transaction for a payer
   */
  async createRefundTransaction(escrowId, senderKey, options = {}) {
    const escrowIdBuffer = Buffer.from(escrowId, 'hex');
    
    const txOptions = {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'refund-escrow',
      functionArgs: [bufferCV(escrowIdBuffer)],
      senderKey: senderKey,
      validateWithAbi: false,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: options.fee || this.defaultFee
    };

    const transaction = await makeContractCall(txOptions);
    return transaction;
  }

  /**
   * Create payment proof object for x-payment-proof header
   */
  createPaymentProof(escrowId, txId) {
    return JSON.stringify({
      escrowId: escrowId,
      txId: txId,
      network: 'stacks-testnet',
      contract: `${this.contractAddress}.${this.contractName}`
    });
  }
}

/**
 * Express middleware factory for x402 payment protection
 */
function createX402Middleware(options = {}) {
  const serverUrl = options.serverUrl || 'http://localhost:3000';
  
  return async function x402Middleware(req, res, next) {
    const paymentProof = req.headers['x-payment-proof'];
    
    if (!paymentProof) {
      // Make a request to the server to get payment challenge
      try {
        const response = await fetch(`${serverUrl}${req.path}`, {
          method: req.method,
          headers: req.headers
        });
        
        if (response.status === 402) {
          const challenge = await response.json();
          return res.status(402).json(challenge);
        }
      } catch (error) {
        console.error('Error getting payment challenge:', error);
      }
      
      return res.status(402).json({
        status: 402,
        message: 'Payment Required',
        error: 'No payment proof provided'
      });
    }
    
    // Payment proof provided, verify it
    try {
      const proof = JSON.parse(paymentProof);
      // In a real implementation, verify the proof here
      req.paymentProof = proof;
      next();
    } catch (error) {
      return res.status(402).json({
        status: 402,
        message: 'Invalid payment proof',
        error: error.message
      });
    }
  };
}

module.exports = {
  X402Client,
  createX402Middleware
};
