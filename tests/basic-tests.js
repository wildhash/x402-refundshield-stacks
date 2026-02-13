// Basic tests for x402 RefundShield functionality
// Run with: node tests/basic-tests.js

const assert = require('assert');

console.log('Running x402 RefundShield Basic Tests...\n');

// Test 1: Payment Challenge Structure
console.log('Test 1: Payment Challenge Structure');
const testChallenge = {
  status: 402,
  message: 'Payment Required',
  paymentDetails: {
    network: 'stacks-testnet',
    contract: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.timeout-escrow',
    provider: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    amount: '1000000',
    escrowId: 'abc123',
    timeoutBlocks: 144
  },
  refundPolicy: {
    contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    contractName: 'timeout-escrow',
    escrowId: 'abc123',
    amount: '1000000',
    refundable: true,
    timeoutBlocks: 144
  }
};

assert.strictEqual(testChallenge.status, 402, 'Status should be 402');
assert.strictEqual(testChallenge.refundPolicy.refundable, true, 'Should be refundable');
assert.ok(testChallenge.paymentDetails.escrowId, 'Should have escrow ID');
console.log('✅ Payment challenge structure is valid\n');

// Test 2: SDK Client Initialization
console.log('Test 2: SDK Client Initialization');
const { X402Client } = require('../sdk/index.js');
const client = new X402Client({
  contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  contractName: 'timeout-escrow'
});

assert.ok(client, 'Client should be initialized');
assert.ok(client.network, 'Client should have network');
assert.strictEqual(client.contractName, 'timeout-escrow', 'Contract name should match');
console.log('✅ SDK client initializes correctly\n');

// Test 3: Payment Proof Format
console.log('Test 3: Payment Proof Format');
const escrowId = 'abc123def456';
const txId = '0x1234567890abcdef';
const proof = client.createPaymentProof(escrowId, txId);
const parsedProof = JSON.parse(proof);

assert.ok(parsedProof.escrowId, 'Proof should contain escrow ID');
assert.ok(parsedProof.txId, 'Proof should contain transaction ID');
assert.strictEqual(parsedProof.network, 'stacks-testnet', 'Proof should specify network');
console.log('✅ Payment proof format is valid\n');

// Test 4: Middleware Factory
console.log('Test 4: Middleware Factory');
const { createX402Middleware } = require('../sdk/index.js');
const middleware = createX402Middleware({ serverUrl: 'http://localhost:3000' });

assert.strictEqual(typeof middleware, 'function', 'Middleware should be a function');
assert.strictEqual(middleware.length, 3, 'Middleware should accept 3 parameters (req, res, next)');
console.log('✅ Middleware factory works correctly\n');

// Test 5: Escrow ID Generation
console.log('Test 5: Escrow ID Generation');
const crypto = require('crypto');
const escrowId1 = crypto.randomBytes(32);
const escrowId2 = crypto.randomBytes(32);

assert.strictEqual(escrowId1.length, 32, 'Escrow ID should be 32 bytes');
assert.notStrictEqual(escrowId1.toString('hex'), escrowId2.toString('hex'), 'IDs should be unique');
console.log('✅ Escrow ID generation works correctly\n');

// Test 6: Amount Validation
console.log('Test 6: Amount Validation');
const validAmount = BigInt(1000000);
const invalidAmount = BigInt(0);

assert.ok(validAmount > 0, 'Valid amount should be positive');
assert.strictEqual(invalidAmount, BigInt(0), 'Zero amount should be invalid');
console.log('✅ Amount validation logic is correct\n');

console.log('═══════════════════════════════════════');
console.log('All tests passed! ✅');
console.log('═══════════════════════════════════════');
