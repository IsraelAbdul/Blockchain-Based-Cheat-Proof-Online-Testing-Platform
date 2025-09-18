(define-constant ERR-NOT-STUDENT u300)
(define-constant ERR-SESSION-EXISTS u301)
(define-constant ERR-NOT-AUTHORIZED u302)
(define-constant ERR-SESSION-NOT-FOUND u303)
(define-constant ERR-SESSION-NOT-ACTIVE u304)
(define-constant ERR-INVALID-TEST u305)
(define-constant ERR-INVALID-START-TIME u306)
(define-constant ERR-INVALID-END-TIME u307)
(define-constant ERR-INVALID-STATUS u308)
(define-constant ERR-INVALID-ATTEMPTS u309)
(define-constant ERR-INVALID-PROCTOR-SCORE u310)
(define-constant ERR-MAX-ATTEMPTS-EXCEEDED u311)
(define-constant ERR-SESSION-UPDATE-NOT-ALLOWED u312)
(define-constant ERR-INVALID-UPDATE-PARAM u313)
(define-constant ERR-MAX-SESSIONS-EXCEEDED u314)
(define-constant ERR-INVALID-PROCTOR u315)
(define-constant ERR-INVALID-DURATION u316)
(define-constant ERR-INVALID-LOCATION u317)
(define-constant ERR-INVALID-DEVICE u318)
(define-constant ERR-INVALID-VERIFICATION u319)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u320)
(define-constant ERR-INVALID-MIN-SCORE u321)
(define-constant ERR-INVALID-MAX-DURATION u322)

(define-data-var next-session-id uint u0)
(define-data-var max-sessions uint u10000)
(define-data-var session-fee uint u500)
(define-data-var authority-contract (optional principal) none)
(define-data-var max-attempts uint u3)
(define-data-var min-proctor-score uint u70)

(define-map sessions
  uint
  {
    student: principal,
    test-id: uint,
    start-time: uint,
    end-time: (optional uint),
    active: bool,
    attempts: uint,
    proctor-score: uint,
    status: (string-ascii 20),
    proctor: principal,
    duration: uint,
    location: (string-ascii 100),
    device: (string-ascii 50),
    verification: bool,
    min-score: uint,
    max-duration: uint
  }
)

(define-map sessions-by-student-test
  { student: principal, test-id: uint }
  uint
)

(define-map session-updates
  uint
  {
    update-start-time: uint,
    update-end-time: (optional uint),
    update-attempts: uint,
    update-proctor-score: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-session (id uint))
  (map-get? sessions id)
)

(define-read-only (get-session-updates (id uint))
  (map-get? session-updates id)
)

(define-read-only (is-session-registered (student principal) (test-id uint))
  (is-some (map-get? sessions-by-student-test { student: student, test-id: test-id }))
)

(define-private (validate-student (student principal))
  (contract-call? .UserRegistry get-user-role student)
)

(define-private (validate-test (test-id uint))
  (contract-call? .TestBank get-test test-id)
)

(define-private (validate-start-time (ts uint))
  (if (>= ts block-height)
    (ok true)
    (err ERR-INVALID-START-TIME))
)

(define-private (validate-end-time (ts (optional uint)))
  (match ts time
    (if (>= time block-height)
      (ok true)
      (err ERR-INVALID-END-TIME))
    (ok true))
)

(define-private (validate-status (status (string-ascii 20)))
  (if (or (is-eq status "pending") (is-eq status "active") (is-eq status "completed") (is-eq status "failed"))
    (ok true)
    (err ERR-INVALID-STATUS))
)

(define-private (validate-attempts (attempts uint))
  (if (and (> attempts u0) (<= attempts (var-get max-attempts)))
    (ok true)
    (err ERR-INVALID-ATTEMPTS))
)

(define-private (validate-proctor-score (score uint))
  (if (and (>= score (var-get min-proctor-score)) (<= score u100))
    (ok true)
    (err ERR-INVALID-PROCTOR-SCORE))
)

(define-private (validate-proctor (proctor principal))
  (if (is-eq (unwrap! (contract-call? .UserRegistry get-user-role proctor) (err ERR-INVALID-PROCTOR)) "proctor")
    (ok true)
    (err ERR-INVALID-PROCTOR))
)

(define-private (validate-duration (duration uint))
  (if (> duration u0)
    (ok true)
    (err ERR-INVALID-DURATION))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
    (ok true)
    (err ERR-INVALID-LOCATION))
)

(define-private (validate-device (dev (string-ascii 50)))
  (if (and (> (len dev) u0) (<= (len dev) u50))
    (ok true)
    (err ERR-INVALID-DEVICE))
)

(define-private (validate-verification (ver bool))
  (ok true)
)

(define-private (validate-min-score (score uint))
  (if (and (> score u0) (<= score u100))
    (ok true)
    (err ERR-INVALID-MIN-SCORE))
)

(define-private (validate-max-duration (dur uint))
  (if (> dur u0)
    (ok true)
    (err ERR-INVALID-MAX-DURATION))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
    (ok true)
    (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-sessions (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-sessions new-max)
    (ok true)
  )
)

(define-public (set-session-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set session-fee new-fee)
    (ok true)
  )
)

(define-public (set-max-attempts (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-attempts new-max)
    (ok true)
  )
)

(define-public (set-min-proctor-score (new-min uint))
  (begin
    (asserts! (and (> new-min u0) (<= new-min u100)) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set min-proctor-score new-min)
    (ok true)
  )
)

(define-public (start-session
  (test-id uint)
  (student principal)
  (proctor principal)
  (duration uint)
  (location (string-ascii 100))
  (device (string-ascii 50))
  (min-score uint)
  (max-duration uint)
)
  (let (
    (next-id (var-get next-session-id))
    (current-max (var-get max-sessions))
    (authority (var-get authority-contract))
    (caller tx-sender)
  )
    (asserts! (< next-id current-max) (err ERR-MAX-SESSIONS-EXCEEDED))
    (asserts! (is-eq caller student) (err ERR-NOT-AUTHORIZED))
    (try! (validate-student student))
    (try! (validate-test test-id))
    (try! (validate-proctor proctor))
    (try! (validate-duration duration))
    (try! (validate-location location))
    (try! (validate-device device))
    (try! (validate-min-score min-score))
    (try! (validate-max-duration max-duration))
    (asserts! (not (is-session-registered student test-id)) (err ERR-SESSION-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get session-fee) tx-sender authority-recipient))
    )
    (map-set sessions next-id
      {
        student: student,
        test-id: test-id,
        start-time: block-height,
        end-time: none,
        active: true,
        attempts: u1,
        proctor-score: u0,
        status: "active",
        proctor: proctor,
        duration: duration,
        location: location,
        device: device,
        verification: false,
        min-score: min-score,
        max-duration: max-duration
      }
    )
    (map-set sessions-by-student-test { student: student, test-id: test-id } next-id)
    (var-set next-session-id (+ next-id u1))
    (print { event: "session-started", id: next-id })
    (ok next-id)
  )
)

(define-public (end-session (session-id uint))
  (let ((session (map-get? sessions session-id)))
    (match session
      s
        (begin
          (asserts! (is-eq (get student s) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (get active s) (err ERR-SESSION-NOT-ACTIVE))
          (asserts! (<= (- block-height (get start-time s)) (get max-duration s)) (err ERR-INVALID-END-TIME))
          (map-set sessions session-id
            (merge s
              {
                end-time: (some block-height),
                active: false,
                status: "completed"
              }
            )
          )
          (print { event: "session-ended", id: session-id })
          (ok true)
        )
      (err ERR-SESSION-NOT-FOUND)
    )
  )
)

(define-public (update-session
  (session-id uint)
  (update-attempts uint)
  (update-proctor-score uint)
)
  (let ((session (map-get? sessions session-id)))
    (match session
      s
        (begin
          (asserts! (is-eq (get proctor s) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-attempts update-attempts))
          (try! (validate-proctor-score update-proctor-score))
          (asserts! (<= update-attempts (var-get max-attempts)) (err ERR-MAX-ATTEMPTS-EXCEEDED))
          (map-set sessions session-id
            (merge s
              {
                attempts: update-attempts,
                proctor-score: update-proctor-score,
                verification: (>= update-proctor-score (get min-score s))
              }
            )
          )
          (map-set session-updates session-id
            {
              update-start-time: (get start-time s),
              update-end-time: (get end-time s),
              update-attempts: update-attempts,
              update-proctor-score: update-proctor-score,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "session-updated", id: session-id })
          (ok true)
        )
      (err ERR-SESSION-NOT-FOUND)
    )
  )
)

(define-public (retry-session (session-id uint))
  (let ((session (map-get? sessions session-id)))
    (match session
      s
        (begin
          (asserts! (is-eq (get student s) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get active s)) (err ERR-SESSION-NOT-ACTIVE))
          (asserts! (< (get attempts s) (var-get max-attempts)) (err ERR-MAX-ATTEMPTS-EXCEEDED))
          (map-set sessions session-id
            (merge s
              {
                start-time: block-height,
                end-time: none,
                active: true,
                attempts: (+ (get attempts s) u1),
                status: "active"
              }
            )
          )
          (print { event: "session-retried", id: session-id })
          (ok true)
        )
      (err ERR-SESSION-NOT-FOUND)
    )
  )
)

(define-public (verify-session (session-id uint))
  (let ((session (map-get? sessions session-id)))
    (match session
      s
        (begin
          (asserts! (is-eq (get proctor s) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get active s)) (err ERR-SESSION-NOT-ACTIVE))
          (asserts! (>= (get proctor-score s) (get min-score s)) (err ERR-INVALID-VERIFICATION))
          (map-set sessions session-id
            (merge s { verification: true })
          )
          (print { event: "session-verified", id: session-id })
          (ok true)
        )
      (err ERR-SESSION-NOT-FOUND)
    )
  )
)

(define-public (get-session-count)
  (ok (var-get next-session-id))
)

(define-public (check-session-existence (student principal) (test-id uint))
  (ok (is-session-registered student test-id))
)