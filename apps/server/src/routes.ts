import express from "express";
import { build402Challenge, receiptHash } from "./refundshield.js";
import { verifyDeposit } from "./stacks.js";

export const router = express.Router();

interface PaymentProof {
  paymentId: string;
  txid?: string;
}

// MVP: we accept a header proof format, but don't fully verify on-chain yet.
// Header: X402-Payment: {"paymentId":"...","txid":"..."}
router.get("/premium", async (req, res) => {
  const network = (process.env.NETWORK || "testnet") as "testnet" | "mainnet";
  const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS || "ST_TESTNET_ADDRESS";
  const escrowName = process.env.ESCROW_CONTRACT_NAME || "refund-escrow";
  const amountUstx = Number(process.env.PRICE_USTX || 100000);
  const expirySeconds = Number(process.env.EXPIRY_SECONDS || 90);

  const header = req.header("X402-Payment");
  if (!header) {
    const challenge = build402Challenge({
      route: "/premium",
      amountUstx,
      expirySeconds,
      network,
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

  // Check for simulated failure
  if (String(process.env.SIMULATE_FAILURE).toLowerCase() === "true") {
    return res.status(503).json({ error: "Simulated failure: no fulfillment." });
  }

  // Verify deposit on-chain if txid is provided and verification is not disabled
  const skipVerification = String(process.env.SKIP_VERIFICATION).toLowerCase() === "true";
  
  if (proof.txid && !skipVerification) {
    console.log(`[premium] Verifying deposit for payment ${proof.paymentId}`);
    
    const isValid = await verifyDeposit(
      proof.txid,
      proof.paymentId,
      amountUstx,
      escrowAddress,
      escrowName,
      network
    );

    if (!isValid) {
      console.log(`[premium] Deposit verification failed for ${proof.paymentId}`);
      return res.status(402).json({
        error: "Payment verification failed",
        message: "The provided transaction does not match the expected deposit",
        paymentId: proof.paymentId,
        txid: proof.txid
      });
    }

    console.log(`[premium] Deposit verified for ${proof.paymentId}`);
  } else if (!proof.txid && !skipVerification) {
    console.log(`[premium] No txid provided for ${proof.paymentId}`);
    return res.status(402).json({
      error: "Transaction ID required",
      message: "Please provide a txid in the X402-Payment header",
      paymentId: proof.paymentId
    });
  }

  const payload = {
    premium: true,
    message: "✅ fulfilled",
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

  const network = (process.env.NETWORK || "testnet") as "testnet" | "mainnet";
  const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS || "ST_TESTNET_ADDRESS";
  const escrowName = process.env.ESCROW_CONTRACT_NAME || "refund-escrow";
  const amountUstx = Number(process.env.PRICE_USTX || 100000);

  console.log(`[status] Checking deposit for payment ${paymentId}`);

  const isDeposited = await verifyDeposit(
    txid,
    paymentId,
    amountUstx,
    escrowAddress,
    escrowName,
    network
  );

  if (isDeposited) {
    return res.json({
      paymentId,
      status: "deposited",
      txid,
      verified: true,
    });
  } else {
    return res.json({
      paymentId,
      status: "unknown",
      txid,
      verified: false,
      note: "Transaction not found or does not match expected deposit",
    });
  }
});
