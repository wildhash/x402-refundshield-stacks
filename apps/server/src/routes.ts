import express from "express";
import { build402Challenge, receiptHash } from "./refundshield.js";
import { parseStacksNetwork, verifyDeposit } from "./stacks.js";

export const router = express.Router();

interface PaymentProof {
  paymentId: string;
  txid?: string;
}

// MVP: we accept a header proof format, but don't fully verify on-chain yet.
// Header: X402-Payment: {"paymentId":"...","txid":"..."}
router.get("/premium", async (req, res) => {
  const network = parseStacksNetwork(process.env.NETWORK);
  const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS || "ST_TESTNET_ADDRESS";
  const escrowName = process.env.ESCROW_CONTRACT_NAME || "refund-escrow";
  const providerAddress = process.env.PROVIDER_ADDRESS || escrowAddress;
  const amountUstx = Number(process.env.PRICE_USTX || 100000);
  const expirySeconds = Number(process.env.EXPIRY_SECONDS || 90);

  const header = req.header("X402-Payment");
  if (!header) {
    const challenge = build402Challenge({
      route: "/premium",
      amountUstx,
      expirySeconds,
      network,
      providerAddress,
      escrowAddress,
      escrowName
    });
    return res.status(402).json({ paymentRequired: true, ...challenge });
  }

  let proof: PaymentProof;
  try {
    proof = JSON.parse(header);
  } catch {
    return res.status(400).json({ error: "Bad X402-Payment header JSON" });
  }

  if (typeof proof.paymentId !== "string" || !/^[0-9a-f]{64}$/i.test(proof.paymentId)) {
    return res.status(400).json({ error: "Invalid paymentId" });
  }

  if (proof.txid !== undefined && typeof proof.txid !== "string") {
    return res.status(400).json({ error: "Bad txid" });
  }

  // Check for simulated failure
  if (String(process.env.SIMULATE_FAILURE).toLowerCase() === "true") {
    return res.status(503).json({ error: "Simulated failure: no fulfillment." });
  }

  // Require a txid; if verification is enabled, verify the deposit on-chain.
  const skipVerification = String(process.env.SKIP_VERIFICATION).toLowerCase() === "true";

  if (!proof.txid) {
    return res.status(402).json({
      error: "Transaction ID required",
      message: "Please provide a txid in the X402-Payment header",
      paymentId: proof.paymentId
    });
  }

  if (!skipVerification) {
    console.log(`[premium] Verifying deposit for payment ${proof.paymentId}`);

    const result = await verifyDeposit(
      proof.txid,
      proof.paymentId,
      providerAddress,
      amountUstx,
      escrowAddress,
      escrowName,
      network
    );

    if (!result.ok) {
      if (result.reason === "pending") {
        return res.status(409).json({
          error: "Transaction pending",
          message: "Deposit transaction is still pending confirmation; retry shortly",
          paymentId: proof.paymentId,
          txid: proof.txid,
        });
      }

      if (result.reason === "timeout" || result.reason === "rate-limited" || result.reason === "api-error") {
        return res.status(503).json({
          error: "Verification unavailable",
          message: "Stacks API verification unavailable; retry shortly",
          paymentId: proof.paymentId,
          txid: proof.txid,
        });
      }

      return res.status(402).json({
        error: "Payment verification failed",
        message: "The provided transaction does not match the expected deposit",
        paymentId: proof.paymentId,
        txid: proof.txid,
      });
    }
  }

  const payload = {
    premium: true,
    message: "fulfilled",
    paymentId: proof.paymentId,
    txid: proof.txid ?? null,
    ts: new Date().toISOString()
  };

  const rHash = receiptHash(payload);
  return res.json({ ...payload, receiptHash: rHash });
});

// placeholder; later we'll back this by Stacks API reads
router.get("/status/:paymentId", async (req, res) => {
  const { paymentId } = req.params;
  const txid = req.query.txid as string | undefined;

  if (!txid) {
    return res.json({
      paymentId,
      status: "unknown",
      note: "Provide txid query parameter to verify deposit",
    });
  }

  const network = parseStacksNetwork(process.env.NETWORK);
  const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS || "ST_TESTNET_ADDRESS";
  const escrowName = process.env.ESCROW_CONTRACT_NAME || "refund-escrow";
  const providerAddress = process.env.PROVIDER_ADDRESS || escrowAddress;
  const amountUstx = Number(process.env.PRICE_USTX || 100000);

  console.log(`[status] Checking deposit for payment ${paymentId}`);

  const result = await verifyDeposit(
    txid,
    paymentId,
    providerAddress,
    amountUstx,
    escrowAddress,
    escrowName,
    network
  );

  if (result.ok) {
    return res.json({
      paymentId,
      status: "deposited",
      txid,
      verified: true,
    });
  }

  if (result.reason === "pending") {
    return res.json({
      paymentId,
      status: "pending",
      txid,
      verified: false,
      note: "Transaction pending confirmation; retry shortly",
    });
  }

  if (result.reason === "timeout" || result.reason === "rate-limited" || result.reason === "api-error") {
    return res.status(503).json({
      paymentId,
      status: "verification-unavailable",
      txid,
      verified: false,
      note: "Stacks API verification unavailable; retry shortly",
    });
  }

  return res.json({
    paymentId,
    status: "unknown",
    txid,
    verified: false,
    note: "Transaction not found or does not match expected deposit",
  });
});
