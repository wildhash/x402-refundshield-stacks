import { cvToJSON, hexToCV } from "@stacks/transactions";

export type StacksNetwork = "devnet" | "testnet" | "mainnet";

export function parseStacksNetwork(value: string | undefined): StacksNetwork {
  if (value === "devnet" || value === "testnet" || value === "mainnet") return value;
  if (value) {
    console.warn(`[stacks] Unknown NETWORK value '${value}', defaulting to testnet`);
  }
  return "testnet";
}

// Network configuration
const getApiBaseUrl = (network: StacksNetwork): string => {
  const override = process.env.STACKS_API_BASE_URL;
  if (override) return override;

  if (network === "devnet") return "http://localhost:3999";
  return network === "mainnet" ? "https://api.mainnet.hiro.so" : "https://api.testnet.hiro.so";
};

type FetchJsonResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: "timeout" | "not-found" | "rate-limited" | "api-error";
      status?: number;
    };

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<FetchJsonResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
    });

    if (response.status === 404) {
      return { ok: false, reason: "not-found", status: response.status };
    }

    if (response.status === 429) {
      return { ok: false, reason: "rate-limited", status: response.status };
    }

    if (!response.ok) {
      return { ok: false, reason: "api-error", status: response.status };
    }

    return { ok: true, value: (await response.json()) as T };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }

    console.error("[stacks] fetchJsonWithTimeout error", { url, error });
    return { ok: false, reason: "api-error" };
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  return typeof value === "string" ? value : null;
}

type HiroContractCallArg = { name: string; hex: string };

type HiroContractCallTx = {
  tx_status: string;
  tx_type: "contract_call";
  contract_call: {
    contract_id: string;
    function_name: string;
    function_args: HiroContractCallArg[];
  };
};

function isHiroContractCallTx(tx: unknown): tx is HiroContractCallTx {
  if (!isRecord(tx)) return false;
  if (tx.tx_type !== "contract_call") return false;

  const txStatus = getStringField(tx, "tx_status");
  if (!txStatus) return false;

  const contractCall = tx.contract_call;
  if (!isRecord(contractCall)) return false;
  if (typeof contractCall.contract_id !== "string") return false;
  if (typeof contractCall.function_name !== "string") return false;
  if (!Array.isArray(contractCall.function_args)) return false;

  for (const arg of contractCall.function_args) {
    if (!isRecord(arg)) return false;
    if (typeof arg.name !== "string") return false;
    if (typeof arg.hex !== "string") return false;
  }

  return true;
}

type VerifyDepositOk = { ok: true };
type VerifyDepositErr = {
  ok: false;
  reason: "not-found" | "pending" | "mismatch" | "timeout" | "rate-limited" | "api-error";
  note?: string;
};

export type VerifyDepositResult = VerifyDepositOk | VerifyDepositErr;

/**
 * Fetches transaction details from the Stacks blockchain
 */
export async function getTransaction(txid: string, network: StacksNetwork = "testnet") {
  const baseUrl = getApiBaseUrl(network);
  const url = `${baseUrl}/extended/v1/tx/${txid}`;
  const timeoutMs = Number(process.env.STACKS_API_TIMEOUT_MS || 5000);

  return fetchJsonWithTimeout<unknown>(url, timeoutMs);
}

type ClarityValueJson = { type: string; value?: unknown };

function isClarityValueJson(value: unknown): value is ClarityValueJson {
  return isRecord(value) && typeof value.type === "string";
}

function getClarityStringValue(value: unknown): string | null {
  if (!isClarityValueJson(value)) return null;
  return typeof value.value === "string" ? value.value : null;
}

function normalizeHex(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

/**
 * Parse contract call arguments from a transaction
 */
function parseContractCallArgs(tx: HiroContractCallTx): Record<string, unknown> | null {
  const args: Record<string, unknown> = {};
  try {
    for (const arg of tx.contract_call.function_args) {
      const cv = hexToCV(arg.hex);
      args[arg.name] = cvToJSON(cv);
    }
    return args;
  } catch (error) {
    console.error("[stacks] Failed to parse contract call args:", error);
    return null;
  }
}

/**
* Verifies that a transaction is a valid deposit to the refund-escrow contract.
*
* @param txid - Transaction ID to verify
* @param paymentId - Expected payment ID (hex string without 0x prefix)
* @param provider - Expected provider principal
* @param amountUstx - Expected amount in micro-STX
* @param contractAddress - Expected contract address
* @param contractName - Expected contract name
* @param network - Network to check (devnet, testnet, or mainnet)
* @returns Verification result: `{ ok: true }` on success, or `{ ok: false, reason }` on failure.
*   Current reasons: `not-found`, `pending`, `mismatch`, `timeout`, `rate-limited`, `api-error`.
*/
export async function verifyDeposit(
  txid: string,
  paymentId: string,
  provider: string,
  amountUstx: number,
  contractAddress: string,
  contractName: string,
  network: StacksNetwork = "testnet"
): Promise<VerifyDepositResult> {
  console.log(`[stacks] Verifying deposit: txid=${txid}, paymentId=${paymentId}`);

  // Fetch transaction
  const txResult = await getTransaction(txid, network);
  if (!txResult.ok) {
    if (txResult.reason === "not-found") return { ok: false, reason: "not-found" };
    if (txResult.reason === "timeout") return { ok: false, reason: "timeout" };
    if (txResult.reason === "rate-limited") return { ok: false, reason: "rate-limited" };
    return { ok: false, reason: "api-error" };
  }

  const tx = txResult.value;
  if (!isHiroContractCallTx(tx)) {
    return { ok: false, reason: "mismatch", note: "unexpected tx shape or tx type" };
  }

  // Check transaction status
  if (tx.tx_status === "pending") {
    return { ok: false, reason: "pending" };
  }

  if (tx.tx_status !== "success") {
    return { ok: false, reason: "mismatch", note: `tx_status=${tx.tx_status}` };
  }

  // Check contract identifier
  const expectedContract = `${contractAddress}.${contractName}`;
  const actualContract = tx.contract_call.contract_id;
  if (actualContract !== expectedContract) {
    return { ok: false, reason: "mismatch", note: "contract_id mismatch" };
  }

  // Check function name
  if (tx.contract_call.function_name !== "deposit") {
    return { ok: false, reason: "mismatch", note: "function_name mismatch" };
  }

  // Parse and verify arguments
  const args = parseContractCallArgs(tx);
  if (!args) {
    return { ok: false, reason: "mismatch", note: "failed to parse contract args" };
  }

  // Verify payment-id
  // The payment-id is a (buff 32) which is represented as hex in the API
  const actualPaymentId = getClarityStringValue(args["payment-id"]);
  if (!actualPaymentId) {
    return { ok: false, reason: "mismatch", note: "missing payment-id" };
  }

  const normalizedPaymentId = normalizeHex(paymentId);
  const normalizedActualPaymentId = normalizeHex(actualPaymentId);

  if (normalizedActualPaymentId !== normalizedPaymentId) {
    return { ok: false, reason: "mismatch", note: "payment-id mismatch" };
  }

  // Verify provider
  const actualProvider = getClarityStringValue(args["provider"]);
  if (!actualProvider) {
    return { ok: false, reason: "mismatch", note: "missing provider" };
  }

  if (actualProvider !== provider) {
    return { ok: false, reason: "mismatch", note: "provider mismatch" };
  }

  // Verify amount
  const actualAmount = getClarityStringValue(args["amount"]);
  if (!actualAmount) {
    return { ok: false, reason: "mismatch", note: "missing amount" };
  }

  if (Number(actualAmount) !== amountUstx) {
    return { ok: false, reason: "mismatch", note: "amount mismatch" };
  }

  const actualExpiry = getClarityStringValue(args["expiry"]);
  if (!actualExpiry || !Number.isFinite(Number(actualExpiry))) {
    return { ok: false, reason: "mismatch", note: "missing/invalid expiry" };
  }

  const actualMetaHash = getClarityStringValue(args["meta-hash"]);
  if (!actualMetaHash) {
    return { ok: false, reason: "mismatch", note: "missing meta-hash" };
  }

  console.log(`[stacks] Deposit verified successfully`);
  return { ok: true };
}
