# Monetization and ECPay rollout

The public GitHub Pages build is intentionally **not** allowed to grant paid points. It has no trusted server, account identity, or tamper-resistant ledger. Any JavaScript-only implementation could expose merchant secrets and let users forge balances or payment callbacks.

## Safe first release

- The existing ECPay URL is presented as an external support link.
- The page states that support payments do not grant points.
- Card and bank information are entered only on ECPay; this site does not receive or store it.
- Earned points, equipment, elements, solutions, and progress remain device-local.

## Configure voluntary support now

The current site uses one public ECPay collection URL in `supportConfig.ecpayUrl`
inside `app/page.tsx`. A public collection URL is not a credential and may be
linked from the browser. Never add MerchantID, HashKey, HashIV, or API keys to
this public repository.

Recommended ECPay setup:

1. Sign in to the ECPay seller console and complete seller/bank verification.
2. Open **Collection tools > Collection links** (or the streamer support tool
   if that is the approved service on the account).
3. Use a clear title such as **Support SoC RTL Lab development** and describe
   the payment as voluntary support with no automatic points or merchandise.
4. Use a practical minimum such as NT$50 because very small amounts may remove
   payment methods and are inefficient after minimum processing fees.
5. Enable only the payment methods approved for the seller account, create the
   reusable link, then replace `supportConfig.ecpayUrl` with that public URL.
6. Keep transaction review, disputes, refunds, and income records in the ECPay
   console. Do not call it a tax-deductible charitable donation.

If the existing URL remains active and belongs to the verified account, no
additional front-end integration is required for voluntary support.

## Required architecture for paid points

1. A signed-in user asks the server to create a point-pack order.
2. The server generates the unique order number and ECPay `CheckMacValue` using secrets that never reach the browser or repository.
3. ECPay accepts payment and POSTs the result to a server-side `ReturnURL`.
4. The server validates `CheckMacValue`, amount, merchant ID, payment status, and order uniqueness.
5. One idempotent database transaction marks the order paid and credits the user's entitlement ledger.
6. The browser reads the server balance; it never decides that a payment succeeded.
7. Refunds reverse the corresponding ledger entry. Gift codes are server-issued, one-time, expiring, and redeemable only once.

A small Cloudflare Worker plus D1, or another HTTPS backend with a transactional database, can provide this layer while the learning UI remains on GitHub Pages.

## Commercial design recommendation

- Keep the proposed exchange rate of **NT$1 = 10 paid points**, but sell packs instead of NT$1 microtransactions.
- Suggested packs: NT$50 / 500 points, NT$100 / 1,050 points, NT$200 / 2,200 points.
- Keep earned points and paid points separate in the ledger and interface.
- Cosmetics and attack effects should not change judging results, hints, rankings, or access to essential teaching content.
- Gifts should transfer a purchased pack or code, not permit cash withdrawal or player-to-player resale.

Small payments are poor fits for card processing because ECPay lists percentage fees plus minimum and per-order charges. Pack pricing also makes refunds and support easier to reconcile.

## Launch checklist

- Complete ECPay seller, identity, bank, beneficiary, and collection review.
- Publish seller/contact information, product contents, prices, payment and delivery method, refund/contact process, and whether the statutory cancellation right applies.
- For immediately delivered digital content or one-time online services, obtain the buyer's prior consent before relying on the digital-content cancellation exception.
- Publish Terms of Sale, Privacy Notice, point validity/refund rules, and a clear statement that points are non-transferable and not redeemable for cash.
- Keep only the minimum account and transaction data, protect it with access controls, and define retention/deletion procedures.
- Record online-service revenue and declare income. Review tax registration once monthly online service sales reach the applicable threshold.
- Confirm ECPay's current merchant rules, fees, order limits, invoicing requirements, and prohibited categories before production.
- Run sandbox payments, duplicate callbacks, wrong-amount callbacks, refunds, expired gift codes, and account-recovery tests before enabling sales.

This checklist is an engineering and product risk summary, not individual legal or tax advice. Confirm the final terms with ECPay, the tax authority, and a qualified Taiwan professional before accepting paid-point orders.
