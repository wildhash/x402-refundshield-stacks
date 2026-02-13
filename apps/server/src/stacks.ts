import { cvToJSON, hexToCV } from "@stacks/transactions";

// Network configuration
const getApiBaseUrl = (network: "testnet" | "mainnet" = "testnet") => {
  return network === "mainnet"
    ? "https://api.mainnet.hiro.so"
    : "https://api.testnet.hiro.so";
};

/**
 * Fetches transaction details from the Stacks blockchain
 */
export async function getTransaction(txid: string, network: "testnet" | "mainnet" = "testnet") {
  const baseUrl = getApiBaseUrl(network);
  const url = `${baseUrl}/extended/v1/tx/${txid}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[stacks] API error: ${response.status} ${response.statusText}`);
      return null;
    }
    const tx = await response.json();
    return tx;
  } catch (error) {
    console.error(`[stacks] Failed to fetch transaction ${txid}:`, error);
    return null;
  }
}

/**
 * Parse contract call arguments from a transaction
 */
function parseContractCallArgs(tx: any): Record<string, any> | null {
  if (tx.tx_type !== "contract_call") {
    return null;
  }

  const args: Record<string, any> = {};
  
  try {
    if (tx.contract_call?.function_args) {
      for (const arg of tx.contract_call.function_args) {
        if (arg.name && arg.hex) {
          const cv = hexToCV(arg.hex);
          args[arg.name] = cvToJSON(cv);
        }
      }
    }
  } catch (error) {
    console.error("[stacks] Failed to parse contract call args:", error);
    return null;
  }

  return args;
}

/**
 * Verifies that a transaction is a valid deposit to the refund-escrow contract
 * 
 * @param txid - Transaction ID to verify
 * @param paymentId - Expected payment ID (hex string without 0x prefix)
 * @param amountUstx - Expected amount in micro-STX
 * @param contractAddress - Expected contract address
 * @param contractName - Expected contract name
 * @param network - Network to check (testnet or mainnet)
 * @returns true if the transaction is a valid deposit, false otherwise
 */
export async function verifyDeposit(
  txid: string,
  paymentId: string,
  amountUstx: number,
  contractAddress: string,
  contractName: string,
  network: "testnet" | "mainnet" = "testnet"
): Promise<boolean> {
  console.log(`[stacks] Verifying deposit: txid=${txid}, paymentId=${paymentId}`);

  // Fetch transaction
  const tx: any = await getTransaction(txid, network);
  if (!tx) {
    console.log(`[stacks] Transaction not found or failed to fetch`);
    return false;
  }

  // Check transaction status
  if (tx.tx_status !== "success") {
    console.log(`[stacks] Transaction status is not success: ${tx.tx_status}`);
    return false;
  }

  // Check transaction type
  if (tx.tx_type !== "contract_call") {
    console.log(`[stacks] Transaction is not a contract call: ${tx.tx_type}`);
    return false;
  }

  // Check contract identifier
  const expectedContract = `${contractAddress}.${contractName}`;
  const actualContract = tx.contract_call?.contract_id;
  if (actualContract !== expectedContract) {
    console.log(`[stacks] Contract mismatch: expected ${expectedContract}, got ${actualContract}`);
    return false;
  }

  // Check function name
  if (tx.contract_call?.function_name !== "deposit") {
    console.log(
      `[stacks] Function mismatch: expected deposit, got ${tx.contract_call?.function_name}`
    );
    return false;
  }

  // Parse and verify arguments
  const args = parseContractCallArgs(tx);
  if (!args) {
    console.log(`[stacks] Failed to parse contract call arguments`);
    return false;
  }

  // Verify payment-id
  // The payment-id is a (buff 32) which is represented as hex in the API
  const actualPaymentId = args["payment-id"]?.value;
  const normalizedPaymentId = paymentId.startsWith("0x") ? paymentId.slice(2) : paymentId;
  const normalizedActualPaymentId = actualPaymentId?.startsWith("0x")
    ? actualPaymentId.slice(2)
    : actualPaymentId;

  if (normalizedActualPaymentId !== normalizedPaymentId) {
    console.log(
      `[stacks] Payment ID mismatch: expected ${normalizedPaymentId}, got ${normalizedActualPaymentId}`
    );
    return false;
  }

  // Verify amount
  const actualAmount = args["amount"]?.value;
  if (Number(actualAmount) !== amountUstx) {
    console.log(`[stacks] Amount mismatch: expected ${amountUstx}, got ${actualAmount}`);
    return false;
  }

  console.log(`[stacks] Deposit verified successfully`);
  return true;
}
