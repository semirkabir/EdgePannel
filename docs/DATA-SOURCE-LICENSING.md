# Data source licensing audit

**Status: first pass, 2026-08-06. Not legal advice.**

EdgePannel is now proprietary and sells a subscription. That changes the licensing
question for every upstream data source: terms that were satisfied by a free,
open-source project are not necessarily satisfied by a commercial product.

This audit covers the 36 providers registered in `src/app/source-status.ts` plus
the two finance sources that are not registered there (Finnhub, Yahoo Finance).
It does **not** cover the ~680 news RSS feeds, which raise a different question
(syndication and attribution rather than data licensing) and need their own pass.

## The structural finding

The restricted providers below are reached through **server-side environment
variables**, not per-user keys:

| Provider | Key | Read from |
|---|---|---|
| ACLED | `ACLED_ACCESS_TOKEN` | `server/_shared/acled.ts:47` |
| Finnhub | `FINNHUB_API_KEY` | `api/market-data.js:3` |
| OpenSanctions | `OPENSANCTIONS_API_KEY` | `api/sanctions.js` |
| Windy | `WINDY_API_KEY` | `api/cameras.js` |

In a hosted deployment those are **your** credentials serving every visitor, which
makes the operator — not the end user — the party doing the commercial use. The
same providers also appear in `src/services/settings-constants.ts` as user-supplied
keys, which is how the desktop build works: the user brings their own key and
carries their own licence obligation.

That gives a clean remediation: **do not set the restricted keys in the hosted
deployment.** The code already degrades gracefully — ACLED returns `[]` when the
token is absent (`acled.ts:48`), and Finnhub returns an explicit "not configured —
add in Settings" response (`market-data.js:13`). Features become bring-your-own-key
rather than disappearing.

## A. Commercial licence required — resolve before charging

| Provider | Terms | Exposure |
|---|---|---|
| **ACLED** | "Commercial entities may not access or use the Content and/or Platforms without first obtaining a corporate license." Terms explicitly target monetising products built on ACLED data. | Server key. Highest — the prohibition is on *access*, not just redistribution. |
| **OpenSanctions** | CC BY-NC 4.0. Commercial use requires a paid licence (Screening API, Screening Licence, or Reseller/OEM). | Server key. NC clause is unambiguous. |
| **Finnhub** | Free tier is non-commercial; a monetised or redistributing app needs a paid plan. Data must also be deleted when a subscription ends. | Server key. |
| **Open-Meteo** | Free API is non-commercial. Terms name "websites or apps that have subscriptions" as commercial. Data itself is CC BY 4.0. | No key needed, so removing a credential does not stop the calls — needs a code change or a paid plan. |
| **OpenSky Network** | For-profit use requires a written licence. Separately, *any* operational integration into a live product requires a prior written agreement, even for non-profits. | Called via the relay (`api/opensky.js`), unauthenticated. Both conditions apply. |

## B. No licence available at any price

| Provider | Terms |
|---|---|
| **Yahoo Finance** | The public API was retired in 2017. `api/market-data.js` calls the undocumented `query1.finance.yahoo.com` endpoints and fetches a crumb token (`market-data.js:256`) to satisfy an access control. Yahoo's ToS prohibit automated access without written permission and prohibit republication. There is no commercial tier to buy. |

Worth deciding deliberately: replace it with a licensed quote source, or accept a
known ToS breach on a paid product. Note the crumb fetch is the part that is hard
to characterise as incidental scraping.

## C. Permitted, with conditions to meet

| Provider | Licence | Condition |
|---|---|---|
| **UCDP** | CC BY 4.0 | Attribution plus citation of the per-dataset publications. Commercial use and redistribution are permitted, which also covers seeding events into Convex (`.github/workflows/seed-ucdp-events.yml`). |
| **Windy webcams** | Free tier | The free version may not be placed *solely* behind your paywall. Currently satisfied — webcams are not gated and `pricing.html` does not list them. Re-check before making them a paid feature. Attribution to Windy required. |
| **Nominatim / OSM** | ODbL | Public instance: max 1 req/s across all users, caching mandatory, reselling geocoding results prohibited. Verify our rate limiting and cache actually meet this, or self-host. |

## D. Low risk — public sector and open data

FRED, EIA, USGS, NOAA (NWS / SWPC / Aviation Weather), CISA KEV, US Treasury,
USAspending, WHO GHO, ECB, WTO, BIS, Eurostat, ReliefWeb (OCHA), UNHCR, WorldPop,
OCHA HDX HAPI. Generally public domain or permissive; attribution still expected.

## E. Not yet verified

Wingbits, AISStream, Polymarket, Manifold Markets, GDELT, NASA FIRMS,
abuse.ch / ThreatFox, DefiLlama, GPSJam, Georgia Tech IODA, GLEIF, CourtListener,
SEC EDGAR, and the news RSS feeds.

Wingbits and AISStream are commercial ADS-B/AIS vendors and should be treated as
likely-restricted until checked.

## Recommended order

1. Unset `ACLED_ACCESS_TOKEN`, `FINNHUB_API_KEY` and `OPENSANCTIONS_API_KEY` in the
   hosted environment, so nothing is being consumed commercially while this is open.
2. Decide on Open-Meteo and OpenSky — both need a code change or an agreement,
   since neither is switched off by removing a credential.
3. Decide on Yahoo Finance.
4. Add attribution for UCDP, Windy and OSM if not already surfaced in the UI.
5. Work through section E.

## Sources

- [ACLED EULA](https://acleddata.com/eula) · [Terms of Use](https://acleddata.com/terms-use)
- [OpenSanctions licensing](https://www.opensanctions.org/licensing/)
- [Finnhub FAQ](https://finnhub.io/faq)
- [Open-Meteo terms](https://open-meteo.com/en/terms)
- [OpenSky terms of use](https://opensky-network.org/about/terms-of-use)
- [Yahoo Developer API terms](https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apiforydn/index.html)
- [UCDP download centre](https://ucdp.uu.se/downloads/)
- [Windy webcams API terms](https://account.windy.com/agreements/windy-api-webcams-terms-of-use)
- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
