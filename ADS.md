# Advertising configuration

The lab supports one optional, manually placed responsive Google AdSense unit
below all interactive content. It does not use Auto ads, anchor ads, vignette
ads, side rails, pop-ups, rewarded ads, or advertisements beside the editor,
Run button, hints, game shop, waveform, or result controls.

## Current behavior

- Ads are disabled unless both production variables are valid.
- Ads never load on localhost or preview hosts.
- The ad script loads only when the footer approaches the viewport and the
  browser has idle time.
- A blocked or failed ad request is ignored and cannot block the lab.
- No ad view or click grants coins, items, hints, progress, or other rewards.

## GitHub Pages setup

After the site is approved by AdSense, create one responsive **Display ad**
unit. In the repository, open **Settings → Secrets and variables → Actions →
Variables** and add:

| Variable | Example format |
| --- | --- |
| `ADSENSE_CLIENT_ID` | `ca-pub-1191948823193656` (already used as the checked-in default) |
| `ADSENSE_FOOTER_SLOT_ID` | `1234567890` |

Both values are public identifiers embedded in the final page; do not put API
keys, passwords, payment secrets, or service-account credentials in these
variables.

The publisher ID and ownership-verification meta tag are already configured.
Only `ADSENSE_FOOTER_SLOT_ID` is still required to activate the ad unit. The
page deliberately does not paste the verification script into the document
head because doing so would download the advertising runtime during initial
page load; the equivalent publisher meta tag has no runtime cost.

The AdSense site should be registered as `xizhuwang.github.io`. If AdSense asks
for `ads.txt`, it must be published at `https://xizhuwang.github.io/ads.txt`
through the root portfolio repository, not only under the
`/rtl-interview-lab/` project path.

Use Google's Privacy & messaging settings or another Google-certified consent
management platform before serving personalized ads in regions where consent
is required. Keep Auto ads and every overlay format disabled; this repository
intentionally controls the only permitted placement.

## Safe testing

Do not click live advertisements yourself and do not ask visitors, testers,
friends, or users to click ads or view them in exchange for game rewards. Test
the page layout while the publisher variables are absent, and use the AdSense
console's preview tools after approval.
