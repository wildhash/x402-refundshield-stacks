import crypto from "node:crypto";
import type { StacksNetwork } from "./stacks.js";

export type RefundPolicy = {
  type: "escrow-timeout";
  expirySeconds: number;
  refundAfter: "expiry";
};

export type PaymentChallenge = {
  paymentId: string;          // hex
  provider: string;
  amountUstx: string;
  network: StacksNetwork;
  escrow: { address: string; name: string };
  expiry: { seconds: number; note: string };
  refundPolicy: RefundPolicy;
};

export function makePaymentId(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function build402Challenge(args: {
  route: string;
  providerAddress: string;
  amountUstx: number;
  expirySeconds: number;
  network: StacksNetwork;
  escrowAddress: string;
  escrowName: string;
}): PaymentChallenge {
  const paymentId = makePaymentId(`${args.route}|${Date.now()}|${crypto.randomUUID()}`);
  return {
    paymentId,
    provider: args.providerAddress,
    amountUstx: String(args.amountUstx),
    network: args.network,
    escrow: { address: args.escrowAddress, name: args.escrowName },
    expiry: { seconds: args.expirySeconds, note: "Client deposits to escrow; refund available after expiry." },
    refundPolicy: { type: "escrow-timeout", expirySeconds: args.expirySeconds, refundAfter: "expiry" }
  };
}

export function receiptHash(obj: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}
