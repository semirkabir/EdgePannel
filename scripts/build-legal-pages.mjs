#!/usr/bin/env node
/**
 * One-shot scaffolder for the legal/support pages (privacy, terms, contact).
 *
 * These are generated once and then committed as ordinary editable HTML — they
 * are NOT rebuilt on every build like /docs is, because their wording must be
 * reviewed and amended by a human, not regenerated. This script exists so the
 * three pages start out sharing byte-identical nav/footer chrome with the rest
 * of the marketing site; after that, edit the HTML directly.
 *
 * Run: node scripts/build-legal-pages.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://edgepannel.com';

const src = readFileSync(resolve(ROOT, 'resources.html'), 'utf8');
const nav = src.match(/( {4}<header class="lp-nav"[\s\S]*?<\/header>\n)/)[1];
const footer = src.match(/( {4}<footer class="lp-footer">[\s\S]*?<\/footer>\n)/)[1];

const head = ({ title, desc, slug, glow, crumb, h1a, h1b, sub, body }) => `<!DOCTYPE html>
<html lang="en" data-page="landing">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} | EdgePannel</title>
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${SITE}/${slug}" />
    <meta name="theme-color" content="#04080a" />
    <meta name="robots" content="index, follow" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="${SITE}/${slug}" />
    <meta property="og:site_name" content="EdgePannel" />
    <meta property="og:title" content="${title} | EdgePannel" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${SITE}/favico/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />

    <link rel="icon" href="/favico/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favico/favicon-32x32.png" />
    <link rel="apple-touch-icon" href="/favico/apple-touch-icon.png" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;650;800&family=JetBrains+Mono:wght@400;600&display=swap"
      rel="stylesheet"
    />

    <link rel="stylesheet" href="/src/landing/landing.css" />
    <script type="module" src="/src/landing/landing.ts"></script>

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "${SITE}/" },
        { "@type": "ListItem", "position": 2, "name": "${crumb}", "item": "${SITE}/${slug}" }
      ]
    }
    </script>
  </head>
  <body>
    <a class="lp-skip" href="#main">Skip to content</a>

${nav}
    <main id="main">
      <section class="lp-subhero" style="--lp-subhero-glow: ${glow}">
        <div class="lp-container lp-container-narrow">
          <nav class="lp-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Home</a><span aria-hidden="true">›</span><span class="lp-crumb-here">${crumb}</span>
          </nav>
          <h1 class="lp-h1 lp-reveal lp-in">
            ${h1a}<br /><span class="lp-h1-accent">${h1b}</span>
          </h1>
          <p class="lp-hero-sub lp-reveal lp-in">${sub}</p>
        </div>
      </section>

      <section class="lp-section" style="padding-top: 40px">
        <div class="lp-container lp-container-narrow lp-legal lp-reveal">
${body}
        </div>
      </section>
    </main>

${footer}  </body>
</html>
`;

// A placeholder that is impossible to miss in a rendered page.
const TODO = (t) => `<span class="lp-todo">[${t}]</span>`;
const DRAFT = `          <p class="lp-draft-banner" role="note">
            <strong>Draft — not yet legally reviewed.</strong> Every
            ${TODO('BRACKETED')} value below must be completed, and the whole
            document reviewed by a qualified adviser, before this site accepts a
            single payment.
          </p>`;

// ── Privacy ────────────────────────────────────────────────────────────────
// Written from what the code actually does — the processor list below was read
// out of the source, not copied from a template.
const privacy = head({
  title: 'Privacy Policy',
  desc: 'What EdgePannel collects, what it does not, and which processors touch your data.',
  slug: 'privacy',
  glow: 'rgba(122, 168, 255, 0.09)',
  crumb: 'Privacy',
  h1a: 'What we collect,',
  h1b: 'and what we do not.',
  sub: 'The dashboard works with no account and no personal data at all. This page describes what changes when you sign in, pay, or hit an error.',
  body: `${DRAFT}
          <p class="lp-legal-meta">Last updated ${TODO('DATE')} · Controller: ${TODO('LEGAL ENTITY')}, ${TODO('REGISTERED ADDRESS')}</p>

          <h2>The short version</h2>
          <p>
            You can use the entire map, every feed and every lens without an account,
            without a cookie banner, and without us storing anything about you on our
            servers. Your layout and preferences live in your own browser. We start
            processing personal data only if you choose to sign in or subscribe.
          </p>

          <h2>Using EdgePannel without an account</h2>
          <p>
            Panel layout, active map layers, language, theme, saved workspaces and
            custom feeds are written to your browser's <code>localStorage</code> and
            <code>IndexedDB</code>. They never leave your device, we cannot read them,
            and clearing your browser data erases them permanently.
          </p>
          <p>
            Requests to our API are served from our own servers and CDN. Standard
            server logs (IP address, timestamp, requested path, user agent) are
            processed to deliver the service, mitigate abuse and enforce rate limits.
            Retention: ${TODO('LOG RETENTION PERIOD')}.
          </p>

          <h2>If you create an account</h2>
          <p>
            Sign-in is handled by Google via Firebase Authentication. We receive your
            email address and a user identifier so we can sync preferences and
            watchlists across devices. We never receive your Google password.
          </p>

          <h2>If you subscribe</h2>
          <p>
            Payments are processed by Stripe. Card details are submitted directly to
            Stripe and never reach our servers. We store the subscription status and
            billing identifiers needed to grant access to paid features and to handle
            renewals, cancellation and refunds.
          </p>

          <h2>Analytics and error reporting</h2>
          <p>These are the only third parties that receive data from your browser:</p>
          <div class="lp-table-wrap">
            <table>
              <thead><tr><th>Processor</th><th>Purpose</th><th>What it receives</th></tr></thead>
              <tbody>
                <tr><td>Sentry</td><td>Crash and error monitoring</td><td>Error details, stack traces, IP address and, when signed in, a user identifier. A 10% sample of performance traces.</td></tr>
                <tr><td>Vercel Analytics</td><td>Aggregate page-view counts</td><td>Page views without cookies or cross-site identifiers.</td></tr>
                <tr><td>Firebase Authentication (Google)</td><td>Sign-in</td><td>Only if you choose to sign in.</td></tr>
                <tr><td>Stripe</td><td>Payments</td><td>Only if you subscribe.</td></tr>
                <tr><td>Vercel, Upstash, Convex</td><td>Hosting, caching, live data</td><td>Infrastructure processors handling requests on our behalf.</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            We do not sell personal data, we do not run advertising, and we do not
            operate cross-site tracking or advertising pixels.
          </p>

          <h2>Your rights</h2>
          <p>
            If you are in the UK, EEA or California you have rights of access,
            correction, deletion, portability and objection over any personal data we
            hold. Because anonymous use produces no account, these rights are only
            meaningful once you have signed in. To exercise them, contact
            ${TODO('PRIVACY CONTACT EMAIL')}; we respond within ${TODO('RESPONSE WINDOW')}.
          </p>
          <p>Our legal basis for processing is ${TODO('LEGAL BASIS')}, and data is stored in ${TODO('DATA LOCATION')}.</p>

          <h2>Children</h2>
          <p>EdgePannel is not directed at children under ${TODO('AGE')} and we do not knowingly collect their data.</p>

          <h2>Changes</h2>
          <p>Material changes will be announced on this page with a revised date above.</p>

          <p class="lp-legal-foot">Questions: <a href="/contact">contact us</a>. Security issues: see <a href="/.well-known/security.txt">security.txt</a>.</p>`,
});

// ── Terms ──────────────────────────────────────────────────────────────────
const terms = head({
  title: 'Terms of Service',
  desc: 'The terms covering use of EdgePannel, its subscriptions, and the limits of the intelligence it provides.',
  slug: 'terms',
  glow: 'rgba(61, 255, 162, 0.08)',
  crumb: 'Terms',
  h1a: 'The terms,',
  h1b: 'in plain language.',
  sub: 'What you may do with EdgePannel, what we promise, and — importantly for a product like this — what you must not rely on it for.',
  body: `${DRAFT}
          <p class="lp-legal-meta">Last updated ${TODO('DATE')} · Provider: ${TODO('LEGAL ENTITY')}, ${TODO('REGISTERED ADDRESS')} · Governing law: ${TODO('JURISDICTION')}</p>

          <h2>1. Using the service</h2>
          <p>
            The dashboard is free to use without an account. You agree not to disrupt
            the service, circumvent rate limits, resell access, or use it to break any
            applicable law. We may suspend access that threatens the service or other
            users.
          </p>

          <h2>2. Accuracy, and what this is not</h2>
          <p>
            EdgePannel aggregates public sources and computes scores from them. Feeds
            go down, upstream data is wrong sometimes, and every score is an estimate
            with a published methodology, not a fact. Nothing here is financial,
            legal, security or safety advice.
          </p>
          <p class="lp-legal-callout">
            Do not use EdgePannel as a sole basis for decisions affecting personal
            safety, emergency response, regulatory compliance or investment. Verify
            independently before acting.
          </p>

          <h2>3. Subscriptions and billing</h2>
          <p>
            Every data feed, map layer and lens is free. Paid plans add AI analysis,
            alerting, and tracking &amp; history. Subscriptions are billed in advance
            through Stripe, monthly or yearly, and renew automatically until cancelled.
          </p>
          <p>
            You may cancel at any time; access continues to the end of the paid period
            and you return to the free tier. Refund policy: ${TODO('REFUND POLICY')}.
            Prices may change on ${TODO('NOTICE PERIOD')} notice, never mid-term.
          </p>

          <h2>4. The API</h2>
          <p>
            API access is subject to the published rate limits. Do not use it to
            reconstruct a competing bulk feed of our aggregated data, and keep any
            credentials confidential — you are responsible for use under your key.
          </p>

          <h2>5. Licence and your content</h2>
          <p>
            EdgePannel is proprietary software. Your subscription grants access to the
            hosted service, not any right to the source code, and nothing here permits
            copying, modifying or redistributing it. Underlying data belongs to its
            original sources under their own terms. Anything you create in the
            product — workspaces, monitors, alert rules — remains yours.
          </p>

          <h2>6. Warranties and liability</h2>
          <p>
            The service is provided "as is", without warranty of any kind. To the
            fullest extent permitted by law, our aggregate liability is limited to
            ${TODO('LIABILITY CAP')}. Nothing here excludes liability that cannot
            lawfully be excluded.
          </p>

          <h2>7. Changes and contact</h2>
          <p>
            We may update these terms; material changes will be posted here with a
            revised date, and continued use after that constitutes acceptance.
            Questions: ${TODO('LEGAL CONTACT EMAIL')}.
          </p>

          <p class="lp-legal-foot">See also the <a href="/privacy">Privacy Policy</a>.</p>`,
});

// ── Contact ────────────────────────────────────────────────────────────────
const contact = head({
  title: 'Contact',
  desc: 'How to reach EdgePannel for support, security disclosures, press and billing.',
  slug: 'contact',
  glow: 'rgba(255, 180, 84, 0.09)',
  crumb: 'Contact',
  h1a: 'Get in touch.',
  h1b: 'A human replies.',
  sub: 'Support routes by topic, so your message reaches the right place first time.',
  body: `          <p class="lp-draft-banner" role="note">
            <strong>Draft.</strong> Every ${TODO('BRACKETED')} address below must be a
            real, monitored inbox before this page goes live — a contact page that
            bounces is worse than none.
          </p>

          <h2>Support</h2>
          <p>
            Something broken, a feed wrong, or a question about the product:
            ${TODO('SUPPORT EMAIL')}. Paid plans include priority support; mention your
            account email so we can find your subscription.
          </p>

          <h2>Billing</h2>
          <p>
            Invoices, cancellation, refunds or plan changes: ${TODO('BILLING EMAIL')}.
            You can also manage or cancel a subscription yourself from the billing
            portal linked in your account.
          </p>

          <h2>Security</h2>
          <p>
            Please report vulnerabilities privately rather than opening a public issue.
            Our disclosure policy and contact are published at
            <a href="/.well-known/security.txt">/.well-known/security.txt</a>. We
            acknowledge reports within ${TODO('ACK WINDOW')} and credit researchers who
            ask to be named.
          </p>

          <h2>Data and privacy requests</h2>
          <p>
            Access, correction or deletion requests: ${TODO('PRIVACY CONTACT EMAIL')}.
            See the <a href="/privacy">Privacy Policy</a> for what we hold.
          </p>

          <h2>Press and partnerships</h2>
          <p>${TODO('PRESS EMAIL')}.</p>

          <p class="lp-legal-foot">
            EdgePannel is operated by ${TODO('LEGAL ENTITY')}, ${TODO('REGISTERED ADDRESS')}.
          </p>`,
});

for (const [file, content] of [['privacy.html', privacy], ['terms.html', terms], ['contact.html', contact]]) {
  writeFileSync(resolve(ROOT, file), content);
  console.log(`wrote ${file}`);
}
