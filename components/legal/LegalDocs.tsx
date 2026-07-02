'use client'

/* ════════════════════════════════════════════════════════════════
   Zenith OS — Privacy Policy & Terms of Service
   ----------------------------------------------------------------
   Plain-content legal documents rendered in a portaled modal. These
   are presented at account creation (see AuthGate) and are reachable
   any time from Settings → Privacy & Data.

   NOTE: This is a good-faith, plain-language agreement tailored to
   Zenith's local-first architecture. It is not a substitute for
   advice from a licensed attorney.
   ════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './LegalDocs.module.css'

/** Bump when the substance of either document changes. */
export const LEGAL_VERSION  = '2026-07-02'
export const LEGAL_UPDATED  = 'July 2, 2026'
export const LEGAL_CONSENT_KEY = 'zenith_legal_agreed_v1'

/**
 * Contact method for the legal documents. Intentionally NOT a personal email
 * address — set NEXT_PUBLIC_LEGAL_CONTACT (e.g. a role-based support address
 * or contact-form URL) to override. When unset, the docs point users to the
 * project's public issue tracker so no personal information is exposed.
 */
export const LEGAL_CONTACT = process.env.NEXT_PUBLIC_LEGAL_CONTACT ?? ''

/** Renders the contact sentence without exposing any personal information. */
function ContactLine() {
  if (LEGAL_CONTACT) {
    const isEmail = LEGAL_CONTACT.includes('@') && !LEGAL_CONTACT.startsWith('http')
    return (
      <a href={isEmail ? `mailto:${LEGAL_CONTACT}` : LEGAL_CONTACT} target="_blank" rel="noopener noreferrer">
        {LEGAL_CONTACT}
      </a>
    )
  }
  return (
    <>
      the feedback form in the app&rsquo;s Help &amp; Tour section (available from
      Settings after signing in)
    </>
  )
}

export type LegalDocId = 'privacy' | 'terms'

/* ── Privacy Policy ─────────────────────────────────────────────── */

function PrivacyContent() {
  return (
    <>
      <p className={styles.updated}>Last updated: {LEGAL_UPDATED}</p>

      <p>
        This Privacy Policy explains how Zenith (&ldquo;Zenith,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
        or &ldquo;the Service&rdquo;) handles information when you use the Zenith web
        application. Zenith is a free, local-first personal dashboard. By using
        Zenith you agree to this Policy.
      </p>

      <h3>1. Local-first by design</h3>
      <p>
        Zenith is built to run in your web browser. The information you enter —
        habits, tasks, notes, calendar events, GPA data, workouts, meals, saved
        links, game progress, followed sports teams, counters, and similar
        content — is stored <strong>locally on your device</strong> (in your
        browser&rsquo;s IndexedDB and localStorage). We do not require an account
        on our servers to use Zenith, and by default your content is not
        transmitted to us.
      </p>

      <h3>2. Accounts and optional cloud sync</h3>
      <p>
        If cloud features are enabled for your deployment, you may create an
        account (email and password) and optionally sync selected data to a
        third-party cloud database (Supabase). If you use cloud sync, the data
        you choose to sync — for example your display name, habits, tasks, and
        workouts — is stored with that provider under its own security and
        privacy practices. If you do not create an account or enable sync, this
        does not apply to you.
      </p>

      <h3>3. Third-party services</h3>
      <p>
        Certain features send limited data to third parties solely to make the
        feature work. These may include:
      </p>
      <ul>
        <li><strong>Weather</strong> (Open-Meteo): your approximate location/coordinates to fetch a local forecast.</li>
        <li><strong>Sports</strong> (TheSportsDB): team names and league identifiers you request.</li>
        <li><strong>News</strong> (public RSS sources such as BBC, NPR, The Guardian): requests for public headlines.</li>
        <li><strong>AI features</strong> (Anthropic): text you submit to the AI Co-Pilot or generators is sent to the AI provider to produce a response.</li>
        <li><strong>Peer features</strong> (WebRTC/PeerJS): if you connect with a friend, data you choose to share is exchanged directly, peer-to-peer.</li>
        <li><strong>Embeds &amp; icons</strong> (YouTube, Google favicon service, OpenStreetMap): loaded to display media, site icons, or maps you request.</li>
        <li><strong>Analytics</strong> (Vercel Analytics &amp; Speed Insights): aggregate, privacy-friendly usage and performance metrics. We do not use these to build advertising profiles.</li>
      </ul>
      <p>
        We do not control third-party services and are not responsible for their
        practices. Review their policies for details on how they handle data.
      </p>

      <h3>4. Location data</h3>
      <p>
        Location is used only when you enable a feature that needs it (such as
        weather or the distance tracker) and is used to compute results on your
        device. Precise coordinates used by the distance tracker are not
        displayed on screen or stored on our servers.
      </p>

      <h3>5. Cookies and local storage</h3>
      <p>
        Zenith uses your browser&rsquo;s local storage and IndexedDB to save your
        settings and content, and to keep you signed in to your local session.
        These are essential to how the app functions.
      </p>

      <h3>6. Children&rsquo;s privacy</h3>
      <p>
        Zenith is not directed to children under 13, and we do not knowingly
        collect personal information from children under 13. If you believe a
        child under 13 has provided information through cloud features, contact
        us and we will take reasonable steps to delete it.
      </p>

      <h3>7. Your choices and control</h3>
      <p>
        Because your data lives in your browser, you can view, export, or delete
        it at any time — including via the export tools in Settings and by
        clearing your browser&rsquo;s site data. If you use cloud sync, you may
        request deletion of synced data by contacting us.
      </p>

      <h3>8. Security</h3>
      <p>
        We take reasonable measures to protect the Service, but no method of
        storage or transmission is completely secure. You are responsible for
        safeguarding your device and any account credentials.
      </p>

      <h3>9. Changes to this Policy</h3>
      <p>
        We may update this Policy from time to time. Material changes will be
        reflected by updating the &ldquo;Last updated&rdquo; date. Continued use of the
        Service after changes take effect constitutes acceptance.
      </p>

      <h3>10. Contact</h3>
      <p>
        Questions about this Policy? You can reach us through <ContactLine />.
      </p>
    </>
  )
}

/* ── Terms of Service ───────────────────────────────────────────── */

function TermsContent() {
  return (
    <>
      <p className={styles.updated}>Last updated: {LEGAL_UPDATED}</p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of Zenith
        (&ldquo;Zenith,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;the Service&rdquo;). By creating an
        account or otherwise using the Service, you agree to these Terms and to
        our Privacy Policy. If you do not agree, do not use the Service.
      </p>

      <h3>1. Eligibility</h3>
      <p>
        You must be at least 13 years old to use Zenith. If you are under the age
        of majority in your jurisdiction, you may use the Service only with the
        involvement of a parent or legal guardian who agrees to these Terms.
      </p>

      <h3>2. The Service</h3>
      <p>
        Zenith is a free, personal productivity dashboard provided on an
        &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We may add, change, suspend, or
        discontinue any part of the Service at any time without liability.
      </p>

      <h3>3. Your content and responsibility</h3>
      <p>
        You are solely responsible for the content and data you create in Zenith
        and for maintaining your own backups. Because Zenith is local-first, data
        stored only in your browser can be lost if you clear site data, switch
        devices, or experience a browser or device failure. We are not
        responsible for any loss of data.
      </p>

      <h3>4. Acceptable use</h3>
      <p>You agree not to:</p>
      <ul>
        <li>use the Service for any unlawful purpose or in violation of any applicable law;</li>
        <li>attempt to disrupt, reverse engineer, overload, or gain unauthorized access to the Service or its providers;</li>
        <li>use peer or sharing features to transmit unlawful, harmful, or infringing content; or</li>
        <li>misuse third-party services accessed through Zenith in violation of their terms.</li>
      </ul>

      <h3>5. Not professional advice</h3>
      <p>
        Zenith may present academic (e.g., GPA estimates), wellness, fitness,
        nutrition/meal, financial (e.g., budgets, subscriptions), and other
        information and tools. This content is for general informational and
        organizational purposes only and is <strong>not</strong> medical, mental
        health, legal, financial, or other professional advice. Always consult a
        qualified professional before making decisions based on it.
      </p>

      <h3>6. Third-party services and links</h3>
      <p>
        The Service integrates with and links to third-party services and
        websites. We do not endorse and are not responsible for third-party
        content, products, or practices. Your use of third-party services is
        governed by their terms and policies.
      </p>

      <h3>7. Intellectual property</h3>
      <p>
        The Service, including its design, code, and branding, is owned by Zenith
        and protected by applicable laws. You retain ownership of the content you
        create. We grant you a limited, personal, non-exclusive, non-transferable
        license to use the Service for your own personal use.
      </p>

      <h3>8. Disclaimer of warranties</h3>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo;
        AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
        IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS
        FOR A PARTICULAR PURPOSE, TITLE, ACCURACY, AND NON-INFRINGEMENT. WE DO NOT
        WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR
        THAT DATA WILL NOT BE LOST.
      </p>

      <h3>9. Limitation of liability</h3>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT WILL ZENITH OR ITS
        OPERATOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
        EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF DATA, PROFITS, OR
        GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF (OR INABILITY TO USE)
        THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. BECAUSE
        THE SERVICE IS PROVIDED FREE OF CHARGE, OUR TOTAL AGGREGATE LIABILITY FOR
        ALL CLAIMS WILL NOT EXCEED ONE HUNDRED U.S. DOLLARS (US$100). SOME
        JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS, SO SOME OF THE ABOVE MAY
        NOT APPLY TO YOU.
      </p>

      <h3>10. Indemnification</h3>
      <p>
        You agree to indemnify and hold harmless Zenith and its operator from any
        claims, damages, liabilities, and expenses (including reasonable legal
        fees) arising from your misuse of the Service or violation of these Terms
        or of any law or third-party right.
      </p>

      <h3>11. Termination</h3>
      <p>
        You may stop using the Service at any time. We may suspend or terminate
        access to the Service at any time, with or without notice, for any reason,
        including violation of these Terms.
      </p>

      <h3>12. Governing law</h3>
      <p>
        These Terms are governed by the laws of the State of Texas and the United
        States of America, without regard to conflict-of-laws rules, except that
        the Federal Arbitration Act governs the interpretation and enforcement of
        Section 13. Subject to Section 13, any court proceedings will be brought
        exclusively in the state or federal courts located in Texas, and you
        consent to their jurisdiction.
      </p>

      <h3>13. Dispute resolution, arbitration &amp; class-action waiver</h3>
      <p>
        <strong>Please read this section carefully — it affects your legal rights.</strong>
      </p>
      <p>
        Most concerns can be resolved informally. Before starting any formal
        proceeding, you agree to first contact us and attempt to resolve the
        dispute in good faith for at least 30 days.
      </p>
      <p>
        <strong>Binding arbitration.</strong> To the fullest extent permitted by
        law, any dispute, claim, or controversy arising out of or relating to the
        Service or these Terms that is not resolved informally will be settled by
        final and binding individual arbitration, rather than in court, except that
        you may bring claims in small-claims court if they qualify. The arbitration
        will be conducted by a recognized arbitration provider under its applicable
        rules, seated in Texas (or conducted remotely where the provider&rsquo;s rules
        allow). Judgment on the award may be entered in any court with jurisdiction.
      </p>
      <p>
        <strong>Class-action waiver.</strong> You and Zenith agree that each may
        bring claims against the other only in an individual capacity, and not as a
        plaintiff or class member in any purported class, collective,
        consolidated, or representative proceeding. The arbitrator may not
        consolidate more than one person&rsquo;s claims and may not preside over any
        form of class or representative proceeding.
      </p>
      <p>
        <strong>Opt-out.</strong> You may opt out of this arbitration agreement by
        notifying us within 30 days of first accepting these Terms; if you opt out,
        Section 12&rsquo;s governing-law and venue provisions apply instead. If the
        class-action waiver is found unenforceable as to a particular claim, that
        claim will proceed in court, but the remainder of this Section still
        applies. Nothing here prevents either party from seeking injunctive relief
        for intellectual-property misuse. Some jurisdictions do not permit
        mandatory arbitration or class-action waivers, in which case this Section
        may not apply to you.
      </p>

      <h3>14. Copyright &amp; DMCA policy</h3>
      <p>
        We respect intellectual-property rights and expect users to do the same.
        If you believe content made available through the Service infringes your
        copyright, send a notice via our contact method (Section 17) including:
        (a) your physical or electronic signature; (b) identification of the
        copyrighted work claimed to be infringed; (c) identification of the
        allegedly infringing material and information reasonably sufficient to
        locate it; (d) your contact information; (e) a statement that you have a
        good-faith belief the use is not authorized; and (f) a statement, under
        penalty of perjury, that the information is accurate and you are authorized
        to act on the owner&rsquo;s behalf. We will respond to valid notices as
        required by the U.S. Digital Millennium Copyright Act (DMCA), including by
        removing infringing material and, where appropriate, terminating repeat
        infringers. Note that most user content in Zenith is stored locally on your
        own device and is not hosted by us.
      </p>

      <h3>15. Changes to these Terms</h3>
      <p>
        We may modify these Terms from time to time. Material changes will be
        reflected by updating the &ldquo;Last updated&rdquo; date. Your continued use of
        the Service after changes take effect constitutes acceptance of the
        revised Terms.
      </p>

      <h3>16. Miscellaneous</h3>
      <p>
        If any provision of these Terms is found unenforceable, the remaining
        provisions remain in effect. Our failure to enforce any provision is not a
        waiver of it. You may not assign these Terms; we may assign them in
        connection with a transfer of the Service. These Terms, together with the
        Privacy Policy, are the entire agreement between you and Zenith regarding
        the Service and supersede any prior agreements.
      </p>

      <h3>17. Contact</h3>
      <p>
        Questions about these Terms? You can reach us through <ContactLine />.
      </p>
    </>
  )
}

/* ── Consent row (checkbox + links) for account creation ────────── */

export function LegalConsent({
  agreed,
  onAgreedChange,
}: {
  agreed: boolean
  onAgreedChange: (v: boolean) => void
}) {
  const [openDoc, setOpenDoc] = useState<LegalDocId | null>(null)
  return (
    <div className={styles.consentRow}>
      <label className={styles.consentLabel}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => onAgreedChange(e.target.checked)}
          aria-label="I agree to the Terms of Service and Privacy Policy"
        />
        <span>
          I am at least 13 and agree to the{' '}
          <button type="button" className={styles.consentLink} onClick={() => setOpenDoc('terms')}>
            Terms of Service
          </button>{' '}
          and{' '}
          <button type="button" className={styles.consentLink} onClick={() => setOpenDoc('privacy')}>
            Privacy Policy
          </button>.
        </span>
      </label>
      {openDoc && <LegalModal initial={openDoc} onClose={() => setOpenDoc(null)} />}
    </div>
  )
}

/** Record that the user accepted the current version of the agreements. */
export function recordLegalConsent() {
  try {
    localStorage.setItem(LEGAL_CONSENT_KEY, JSON.stringify({
      version: LEGAL_VERSION,
      agreedAt: new Date().toISOString(),
    }))
  } catch { /* storage unavailable — non-fatal */ }
}

/* ── Modal shell ────────────────────────────────────────────────── */

export function LegalModal({ initial, onClose }: { initial: LegalDocId; onClose: () => void }) {
  const [doc, setDoc]         = useState<LegalDocId>(initial)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div className={styles.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Legal documents">
        <div className={styles.header}>
          <div className={styles.tabs} role="tablist">
            <button
              type="button" role="tab" aria-selected={doc === 'privacy'}
              className={`${styles.tab} ${doc === 'privacy' ? styles.tabActive : ''}`}
              onClick={() => setDoc('privacy')}
            >Privacy Policy</button>
            <button
              type="button" role="tab" aria-selected={doc === 'terms'}
              className={`${styles.tab} ${doc === 'terms' ? styles.tabActive : ''}`}
              onClick={() => setDoc('terms')}
            >Terms of Service</button>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <h2 className={styles.docTitle}>{doc === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}</h2>
          <div className={styles.prose}>
            {doc === 'privacy' ? <PrivacyContent /> : <TermsContent />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
