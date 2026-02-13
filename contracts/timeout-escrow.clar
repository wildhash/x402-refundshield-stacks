;; timeout-escrow.clar
;; Refund-guaranteed escrow for x402 payments on Stacks

;; Error codes
(define-constant ERR-NOT-FOUND (err u100))
(define-constant ERR-ALREADY-CLAIMED (err u101))
(define-constant ERR-NOT-EXPIRED (err u102))
(define-constant ERR-EXPIRED (err u103))
(define-constant ERR-UNAUTHORIZED (err u104))
(define-constant ERR-INVALID-AMOUNT (err u105))

;; Data maps
(define-map escrows
  { escrow-id: (buff 32) }
  {
    payer: principal,
    provider: principal,
    amount: uint,
    expiry-height: uint,
    claimed: bool,
    refunded: bool,
    receipt-hash: (optional (buff 32))
  }
)

;; Private functions
(define-private (is-expired (expiry-height uint))
  (>= block-height expiry-height)
)

;; Public functions

;; Create a new escrow deposit
(define-public (deposit-escrow
  (escrow-id (buff 32))
  (provider principal)
  (amount uint)
  (timeout-blocks uint))
  (let
    (
      (expiry-height (+ block-height timeout-blocks))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set escrows
      { escrow-id: escrow-id }
      {
        payer: tx-sender,
        provider: provider,
        amount: amount,
        expiry-height: expiry-height,
        claimed: false,
        refunded: false,
        receipt-hash: none
      }
    )
    (ok { escrow-id: escrow-id, expiry-height: expiry-height })
  )
)

;; Provider claims the escrow with receipt hash
(define-public (claim-escrow
  (escrow-id (buff 32))
  (receipt-hash (buff 32)))
  (let
    (
      (escrow (unwrap! (map-get? escrows { escrow-id: escrow-id }) ERR-NOT-FOUND))
    )
    (asserts! (is-eq tx-sender (get provider escrow)) ERR-UNAUTHORIZED)
    (asserts! (not (get claimed escrow)) ERR-ALREADY-CLAIMED)
    (asserts! (not (get refunded escrow)) ERR-ALREADY-CLAIMED)
    (asserts! (not (is-expired (get expiry-height escrow))) ERR-EXPIRED)
    
    (try! (as-contract (stx-transfer? (get amount escrow) tx-sender (get provider escrow))))
    (map-set escrows
      { escrow-id: escrow-id }
      (merge escrow { claimed: true, receipt-hash: (some receipt-hash) })
    )
    (ok true)
  )
)

;; Payer can refund after expiry
(define-public (refund-escrow (escrow-id (buff 32)))
  (let
    (
      (escrow (unwrap! (map-get? escrows { escrow-id: escrow-id }) ERR-NOT-FOUND))
    )
    (asserts! (is-eq tx-sender (get payer escrow)) ERR-UNAUTHORIZED)
    (asserts! (not (get claimed escrow)) ERR-ALREADY-CLAIMED)
    (asserts! (not (get refunded escrow)) ERR-ALREADY-CLAIMED)
    (asserts! (is-expired (get expiry-height escrow)) ERR-NOT-EXPIRED)
    
    (try! (as-contract (stx-transfer? (get amount escrow) tx-sender (get payer escrow))))
    (map-set escrows
      { escrow-id: escrow-id }
      (merge escrow { refunded: true })
    )
    (ok true)
  )
)

;; Read-only functions

;; Get escrow details
(define-read-only (get-escrow (escrow-id (buff 32)))
  (map-get? escrows { escrow-id: escrow-id })
)

;; Check if escrow is expired
(define-read-only (is-escrow-expired (escrow-id (buff 32)))
  (match (map-get? escrows { escrow-id: escrow-id })
    escrow (ok (is-expired (get expiry-height escrow)))
    ERR-NOT-FOUND
  )
)

;; Get current block height
(define-read-only (get-current-height)
  (ok block-height)
)
