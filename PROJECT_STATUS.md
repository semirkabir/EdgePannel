# EdgePannel Project Status

## Current Visual State & Achievements
* **Dynamic Desktop CTA & Release notes:** Integrated platform-aware macOS/Windows/Linux app installer CTAs and a dynamic v2.4.0 release notes timeline inside `SettingsModal.tsx`.
* **Telemetry Feeds Integrated:** successfully ported 3 high-fidelity real-time intelligence feeds from the parent Worldmonitor repo:
  1. *USNI Navy Strike Groups tracker:* draws Carrier Strike Groups (USS Eisenhower, USS Gerald R. Ford, etc.) with blue glows and symbol icons on the 3D globe and 2D map.
  2. *Celestrak Satellite Orbit Tracker:* client-side orbital mechanics simulation tracking live spacecraft orbits (ISS, Hubble, Tiangong) with cyanish trails.
  3. *GPS Jamming Exclusion Radar:* aggregates flight spoofing indicators and draws red/orange warnings over hot geographic corridors.

## Active Sprint Tasks (UI/UX Polishes)
* **Goal:** Polish the HUD visual aesthetics to match high-fidelity military "cockpit glass-cockpit" tactical aesthetics.
* **Target 1: AI Market Insights Radar Spinner**
  * Replace the simple circular loading spinner in `CommandCenter.tsx` with a rotating radar sweeper grid + monospace ticker coordinates.
* **Target 2: Glassmorphic Live News Capsule Toggles**
  * Redesign tracked accounts active badges in `NewsFeed.tsx` to sleek glassmorphic capsule segmented buttons with glowing boundaries.
* **Target 3: Cyber-Amber Sidebar Checklists**
  * Style feed controls menu list in `FeedControls.tsx` with custom checkboxes, glowing amber fills, and glass-sliding hover micro-animations.
* **Target 4: Sliding Map 2D/3D Capsule Controller**
  * Refactor the single Map/Globe toggle in `EdgeUI.tsx` to a high-end sliding capsule segmented controller showing both 2D and 3D states.
