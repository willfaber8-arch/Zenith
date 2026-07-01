'use client'

import { useState, useRef } from 'react'
import styles from './HelpView.module.css'

const BUG_AREAS = [
  'UI / Visual Bug',
  'AI Co-Pilot / Chat',
  'Calendar / Events',
  'Habits / Tracking',
  'Study Shield / Pomodoro',
  'Sync / Data Storage',
  'Performance / Loading',
  'Games / Arcade',
  'Settings / Themes',
  'Other',
] as const

type SubmitState = 'idle' | 'sending' | 'sent' | 'error'

export default function HelpView() {
  const [area, setArea]           = useState(BUG_AREAS[0])
  const [description, setDesc]    = useState('')
  const [email, setEmail]         = useState('')
  const [imageB64, setImageB64]   = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const [submitState, setSubmit]  = useState<SubmitState>('idle')
  const [errorMsg, setErrorMsg]   = useState('')
  const fileRef                   = useRef<HTMLInputElement>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg('Image must be under 3 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageB64(reader.result as string)
      setImageName(file.name)
      setErrorMsg('')
    }
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setImageB64(null)
    setImageName(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { setErrorMsg('Please describe the issue.'); return }
    if (!email.trim())        { setErrorMsg('Your email is required so we can follow up.'); return }
    setErrorMsg('')
    setSubmit('sending')

    const body: Record<string, string> = {
      // Web3Forms access key — maps to developer email server-side
      access_key: 'cde0e1e3-c90b-4b5b-89ab-e50d6dd31d3e',
      subject:    `[Zenith Beta Feedback] ${area}`,
      from_name:  'Zenith Feedback Bot',
      replyto:    email.trim(),
      'Bug Area':  area,
      Description: description.trim(),
      'Tester Email': email.trim(),
    }
    if (imageB64 && imageName) {
      body['Attachment Name'] = imageName
      // Include a note — Web3Forms free tier doesn't support file attachments,
      // so we mention the attachment was attempted and ask user to email directly
      body['Screenshot Note'] = `User attached: ${imageName} (see GitHub issue if image is needed)`
    }

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { success: boolean; message?: string }
      if (data.success) {
        setSubmit('sent')
      } else {
        setErrorMsg(data.message ?? 'Submission failed. Please try the GitHub issue link below.')
        setSubmit('error')
      }
    } catch {
      setErrorMsg('Network error. Please try the GitHub issue link below.')
      setSubmit('error')
    }
  }

  function buildGitHubIssueUrl() {
    const title  = encodeURIComponent(`[Beta Feedback] ${area}`)
    const body   = encodeURIComponent(
      `**Area:** ${area}\n\n**Description:**\n${description.trim() || '(no description)'}\n\n**Reported by:** ${email.trim() || 'anonymous'}`
    )
    return `https://github.com/willfaber8-arch/zenith/issues/new?title=${title}&body=${body}&labels=bug,beta-feedback`
  }

  return (
    <div className={styles.root}>

      <div className={styles.grid}>
        {/* ── Feedback form ─── */}
        <div className={styles.card}>
          <p className={styles.cardLabel}>Report an Issue</p>

          {submitState === 'sent' ? (
            <div className={styles.successState}>
              <span className={styles.successGlyph}>◎</span>
              <p className={styles.successTitle}>Feedback received.</p>
              <p className={styles.successBody}>
                Thanks for helping make Zenith better. We&apos;ll review your report and follow up via email if needed.
              </p>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={() => { setSubmit('idle'); setDesc(''); setImageB64(null); setImageName(null) }}
              >
                Submit another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <label className={styles.fieldLabel} htmlFor="help-area">
                Bug area
              </label>
              <select
                id="help-area"
                className={styles.select}
                value={area}
                onChange={e => setArea(e.target.value as typeof area)}
              >
                {BUG_AREAS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <label className={styles.fieldLabel} htmlFor="help-desc">
                Description <span className={styles.required}>*</span>
              </label>
              <textarea
                id="help-desc"
                className={styles.textarea}
                rows={5}
                placeholder="What happened? What did you expect to happen? Steps to reproduce…"
                value={description}
                onChange={e => setDesc(e.target.value)}
                required
              />

              <label className={styles.fieldLabel}>
                Screenshot <span className={styles.optional}>(optional, max 3 MB)</span>
              </label>
              {imageName ? (
                <div className={styles.imagePreview}>
                  <span className={styles.imageName}>◈ {imageName}</span>
                  <button type="button" className={styles.removeImage} onClick={removeImage} aria-label="Remove image">✕</button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.uploadBtn}
                  onClick={() => fileRef.current?.click()}
                >
                  Attach image
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className={styles.hiddenInput}
                onChange={handleImageChange}
                aria-label="Attach screenshot"
              />

              <label className={styles.fieldLabel} htmlFor="help-email">
                Your email <span className={styles.required}>*</span>
              </label>
              <input
                id="help-email"
                type="email"
                className={styles.input}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              {errorMsg && (
                <p className={styles.errorMsg} role="alert">{errorMsg}</p>
              )}

              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submitState === 'sending'}
                >
                  {submitState === 'sending' ? 'Sending…' : 'Send Report'}
                </button>

                <a
                  href={buildGitHubIssueUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.githubLink}
                >
                  Open GitHub issue ↗
                </a>
              </div>

              <p className={styles.privacyNote}>
                Your email is used only for follow-up — it&apos;s never stored in Zenith or shared publicly.
              </p>
            </form>
          )}
        </div>

        {/* ── Info panel ─── */}
        <div className={styles.infoCol}>
          <div className={styles.card}>
            <p className={styles.cardLabel}>Beta Program</p>
            <p className={styles.infoText}>
              Zenith is in active beta. Features are evolving fast and data should be considered experimental.
            </p>
            <p className={styles.infoText}>
              Your feedback shapes what gets built next — every report goes directly to the dev team.
            </p>
          </div>

          <div className={styles.card}>
            <p className={styles.cardLabel}>Quick Links</p>
            <ul className={styles.linkList}>
              <li>
                <a
                  href="https://github.com/willfaber8-arch/zenith/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.extLink}
                >
                  GitHub Issues ↗
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/willfaber8-arch/zenith"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.extLink}
                >
                  Source Repository ↗
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
