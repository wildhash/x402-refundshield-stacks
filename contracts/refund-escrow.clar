;; refund-escrow.clar
;; MVP: timeout escrow for STX with claim-before-expiry, refund-after-expiry.
;; payment-id is (buff 32) (client-generated hash).

(define-constant ERR_ALREADY_EXISTS u100)
(define-constant ERR_NOT_FOUND u101)
(define-constant ERR_NOT_PAYER u102)
(define-constant ERR_NOT_PROVIDER u103)
(define-constant ERR_NOT_DEPOSITED u104)
(define-constant ERR_EXPIRED u105)
(define-constant ERR_NOT_EXPIRED u106)
(define-constant ERR_BAD_AMOUNT u107)
(define-constant ERR_INVALID_EXPIRY u108)

;; Status constants for payment state
(define-constant STATUS_DEPOSITED u0)
(define-constant STATUS_CLAIMED u1)
(define-constant STATUS_REFUNDED u2)

(define-data-var protocol-version (string-ascii 16) "v0-escrow-timeout")

(define-map payments
  { payment-id: (buff 32) }
  {
    payer: principal,
    provider: principal,
    amount: uint,
    expiry: uint,          ;; burn height
    status: uint,          ;; 0=deposited, 1=claimed, 2=refunded
    meta-hash: (buff 32),
    receipt-hash: (optional (buff 32))
  }
)

(define-read-only (get-payment (payment-id (buff 32)))
  (map-get? payments {payment-id: payment-id})
)

(define-private (is-deposited (p (tuple (payer principal) (provider principal) (amount uint) (expiry uint) (status uint) (meta-hash (buff 32)) (receipt-hash (optional (buff 32))))))
  (= (get status p) STATUS_DEPOSITED)
)

(define-public (deposit (payment-id (buff 32)) (provider principal) (amount uint) (expiry uint) (meta-hash (buff 32)))
  (begin
    (asserts! (> amount u0) (err ERR_BAD_AMOUNT))
    (asserts! (> expiry burn-block-height) (err ERR_INVALID_EXPIRY))
    (asserts! (is-none (map-get? payments {payment-id: payment-id})) (err ERR_ALREADY_EXISTS))
    ;; transfer STX from tx-sender into this contract
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set payments
      {payment-id: payment-id}
      {
        payer: tx-sender,
        provider: provider,
        amount: amount,
        expiry: expiry,
        status: STATUS_DEPOSITED,
        meta-hash: meta-hash,
        receipt-hash: none
      }
    )
    (ok true)
  )
)

(define-public (claim (payment-id (buff 32)) (receipt-hash (buff 32)))
  (let ((p (map-get? payments {payment-id: payment-id})))
    (begin
      (asserts! (is-some p) (err ERR_NOT_FOUND))
      (let ((pv (unwrap-panic p)))
        (begin
          (asserts! (is-deposited pv) (err ERR_NOT_DEPOSITED))
          (asserts! (= tx-sender (get provider pv)) (err ERR_NOT_PROVIDER))
          (asserts! (<= burn-block-height (get expiry pv)) (err ERR_EXPIRED))
          ;; send STX to provider
          (try! (as-contract (stx-transfer? (get amount pv) tx-sender (get provider pv))))
          (map-set payments
            {payment-id: payment-id}
            (merge pv { status: STATUS_CLAIMED, receipt-hash: (some receipt-hash) })
          )
          (ok true)
        )
      )
    )
  )
)

(define-public (refund (payment-id (buff 32)))
  (let ((p (map-get? payments {payment-id: payment-id})))
    (begin
      (asserts! (is-some p) (err ERR_NOT_FOUND))
      (let ((pv (unwrap-panic p)))
        (begin
          (asserts! (is-deposited pv) (err ERR_NOT_DEPOSITED))
          (asserts! (= tx-sender (get payer pv)) (err ERR_NOT_PAYER))
          (asserts! (> burn-block-height (get expiry pv)) (err ERR_NOT_EXPIRED))
          ;; send STX back to payer
          (try! (as-contract (stx-transfer? (get amount pv) tx-sender (get payer pv))))
          (map-set payments {payment-id: payment-id} (merge pv { status: STATUS_REFUNDED }))
          (ok true)
        )
      )
    )
  )
)
