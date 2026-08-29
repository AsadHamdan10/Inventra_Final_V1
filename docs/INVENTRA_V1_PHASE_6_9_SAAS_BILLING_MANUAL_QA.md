
# INVENTRA V1 — PHASE 6.9 MANUAL QA

## Scope
SaaS Platform Billing, Manual Payment Processing, and Revenue Tracking for INVENTRA Super Admin.

## Security Controls Tested
- [x] Normal Tenant Users cannot access platform `SaaSPlan` data
- [x] Normal Tenant Users cannot hit any `/api/v1/admin/subscriptions` or revenue endpoints
- [x] Explicit assertion: NO automatic payment integrations (Stripe, Razorpay) are connected.

## Application Workflow Tests
- [x] Backend Plan Retrieval: Verified that `TRADING_ANNUAL` costs 3499, and `TRADING_MANUFACTURING_ANNUAL` costs 4699.
- [x] Subscription Instantiation: Super admin creates subscription. The system captures the snapshot of the plan price safely into `listPrice`.
- [x] Partial Payment: Successfully recorded manual payment of 2000. Verified `amountReceived` is saved safely as an internal receipt. Subscription status correctly became `PARTIALLY_PAID`.
- [x] Overpayment Restriction: Attempted to pay an amount greater than the outstanding balance. System successfully blocked it with HTTP 400.
- [x] Full Payment: Paid remaining balance, verified subscription status flipped to `PAID`.
- [x] Marketer Commission: Correctly assigned a 500 INR marketer commission onto the payment receipt without over-stretching bounds.

## Financial Calculations Tests
- [x] Total Gross Collections equals the sum of all manually recorded payments.
- [x] Commission totals equal the sum of all recorded commissions.
- [x] Net Platform Revenue mathematically balances to `Gross - Commissions`.

