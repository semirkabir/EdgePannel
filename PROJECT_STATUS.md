# Project Status: Geopolitical News & OSINT Enhancements

## Current State
*   **Geopolitical News default regional feeds expansion:** Completed. Added highly requested regional sources to reduce Western bias (*TRT World*, *Times of Oman*, *PTI*, and *LiveMint*).
*   **Custom Intelligence Sources:** Completed. Unified custom sources manager in the **Sources** tab of `UnifiedSettings` supporting RSS feeds, Telegram handles, and X (Twitter) usernames. Custom feeds are persistent in `localStorage`.
*   **AI Market Insights clickable stories:** Completed. Clicks on breaking, confirmed, and ML-detected stories reactively open the right-hand entity detail panel. Refactored from `MutationObserver` to a highly robust **delegated click listener** on `this.content` in `InsightsPanel.ts` to solve race conditions, timing issues, and URL filtering.

## Active Status
*   Compilation type checking passes successfully across all 5 site variants (`npm run typecheck:all`).
*   RSS feed validator passes successfully (`npm run test:feeds`).
