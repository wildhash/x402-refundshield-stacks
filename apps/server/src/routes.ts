import express from "express";
import { build402Challenge, receiptHash } from "./refundshield.js";

export const router = express.Router();

// MVP: we accept a header proof format, but don't fully verify on-chain yet.
// Header: X402-Payment: {"paymentId":"...","txid":"..."}
router.get("/premium", (req, res) => {
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

  let proof: any;
  try {
    proof = JSON.parse(header);
  } catch {
    return res.status(400).json({ error: "Bad X402-Payment header JSON" });
  }

  if (String(process.env.SIMULATE_FAILURE).toLowerCase() === "true") {
    return res.status(503).json({ error: "Simulated failure: no fulfillment." });
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
router.get("/status/:paymentId", (req, res) => {
  res.json({
    paymentId: req.params.paymentId,
    status: "unknown",
    note: "v0: wire up chain reads next"
  });
});
