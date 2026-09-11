# Monetization and support-link rollout

The public GitHub Pages build is intentionally **not** allowed to grant paid points. It has no trusted server, account identity, or tamper-resistant ledger. Any JavaScript-only implementation could expose merchant secrets and let users forge balances or payment callbacks.

## Current voluntary-support release

- A PayPal.Me URL is presented as the only public voluntary-support option.
- The user-supplied personal JKO Pay QR is intentionally excluded from the public repository because it exposes stable recipient/account identifiers.
- The page states that support payments do not grant points.
- This site does not receive or store card or bank information.
- Earned points, equipment, elements, solutions, and progress remain device-local.

## Configure voluntary support now

The current site uses `supportConfig.paypalUrl` inside `app/page.tsx`. A public
collection link is not a merchant API credential, but no API keys or merchant
signing secrets may be added to this repository. A personal JKO Pay QR should
remain outside the repository; add JKO Pay only after obtaining an approved
merchant QR or hosted payment link that is appropriate for public commercial
use.

PayPal.Me is useful for international supporters. Treat public support as a
commercial payment where applicable, keep the original transaction records,
and expect receiving and currency-conversion fees. For Taiwan withdrawals,
E.SUN Global Pass can withdraw a TWD PayPal balance to a TWD E.SUN account
without a PayPal withdrawal fee when no currency conversion is involved;
converting a foreign-currency balance adds conversion cost.

JKO Pay's personal collection flow supports account-to-account transfers and
publishes transaction limits. It is not the same as a merchant acquiring
agreement. The safer long-term setup is an approved JKO commercial collection
agreement and merchant QR/link with transaction records. JKO Pay currently
lists a 2.5% standard fee for both physical-store and online-platform merchant
collection, subject to account-specific changes.

Recommended JKO Pay migration:

1. Apply as a JKO Pay partner using the account type and business description
   that accurately match the site.
2. Review the commercial collection agreement and the current fee schedule.
3. Add only the approved merchant QR or hosted link; never commit a personal
   transfer image containing the recipient's stable account identifiers.
4. Keep transaction review, disputes, refunds, and income records.
5. Describe the payment as voluntary support with no automatic points or
   merchandise. Do not call it a tax-deductible charitable donation.

Calling revenue a "donation" or "support" does not automatically remove tax or
payment-service obligations. Taiwan's Ministry of Finance expressly includes
viewer tips and similar online-creator income in its income-tax framework. Keep
records and declare applicable income; evaluate tax registration if the activity
becomes regular or commercial.

## Required architecture for paid points

1. A signed-in user asks the server to create a point-pack order.
2. The server creates a unique order through a contracted payment provider using secrets that never reach the browser or repository.
3. The provider accepts payment and sends a signed result to a server-side callback.
4. The server validates the signature, amount, merchant identity, payment status, and order uniqueness.
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

Small payments are inefficient after processing fees. Pack pricing also makes refunds and support easier to reconcile.

## Launch checklist

- Complete the selected provider's seller, identity, bank, beneficiary, and collection review.
- Publish seller/contact information, product contents, prices, payment and delivery method, refund/contact process, and whether the statutory cancellation right applies.
- For immediately delivered digital content or one-time online services, obtain the buyer's prior consent before relying on the digital-content cancellation exception.
- Publish Terms of Sale, Privacy Notice, point validity/refund rules, and a clear statement that points are non-transferable and not redeemable for cash.
- Keep only the minimum account and transaction data, protect it with access controls, and define retention/deletion procedures.
- Record online-service revenue and declare income. Review tax registration once monthly online service sales reach the applicable threshold.
- Confirm JKO Pay and PayPal's current merchant rules, fees, order limits, invoicing requirements, and prohibited categories before production.
- Run sandbox payments, duplicate callbacks, wrong-amount callbacks, refunds, expired gift codes, and account-recovery tests before enabling sales.

This checklist is an engineering and product risk summary, not individual legal or tax advice. Confirm the final terms with JKO Pay, PayPal, the tax authority, and a qualified Taiwan professional before accepting paid-point orders.
