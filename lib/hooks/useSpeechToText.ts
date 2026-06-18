'use client'

/**
 * lib/hooks/useSpeechToText.ts — reusable Web Speech API dictation hook.
 *
 * Wraps `SpeechRecognition` / `webkitSpeechRecognition` for push-to-talk voice
 * input. Returns `isListening`, live `interim` transcript, an `isSupported`
 * flag, and `start` / `stop` / `toggle` controls.
 *
 * The `onFinal` callback is stored in a ref that is refreshed every render, so
 * the recognition handlers always invoke the latest closure (no stale state)
 * without re-creating the recognition instance.
 *
 * SSR-safe: `isSupported` resolves to false on the server and re-evaluates on
 * the client after mount.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSpeechToTextOptions {
  /** Called with the trimmed final transcript each time a phrase is finalised. */
  onFinal: (text: string) => void
  /** BCP-47 language tag. Defaults to the browser locale, then 'en-US'. */
  lang?: string
}

interface UseSpeechToTextResult {
  isListening: boolean
  interim:     string
  isSupported: boolean
  start:  () => void
  stop:   () => void
  toggle: () => void
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function useSpeechToText(
  { onFinal, lang }: UseSpeechToTextOptions,
): UseSpeechToTextResult {
  const [isListening, setIsListening] = useState(false)
  const [interim,     setInterim]     = useState('')
  const [isSupported, setIsSupported] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const onFinalRef      = useRef(onFinal)
  onFinalRef.current    = onFinal

  /* Resolve support after mount (window is unavailable during SSR). */
  useEffect(() => {
    setIsSupported(!!getSpeechRecognition())
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop?.()
  }, [])

  const start = useCallback(() => {
    if (recognitionRef.current) return            // already listening
    const SR = getSpeechRecognition()
    if (!SR) return

    const rec = new SR()
    rec.lang =
      lang ??
      (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US')
    rec.interimResults = true
    rec.continuous     = false

    rec.onstart = () => setIsListening(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let interimText = ''
      let finalText   = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) finalText += transcript
        else                          interimText += transcript
      }
      if (finalText) {
        onFinalRef.current(finalText.trim())
        setInterim('')
      } else {
        setInterim(interimText)
      }
    }

    const reset = () => {
      setIsListening(false)
      setInterim('')
      recognitionRef.current = null
    }
    rec.onend   = reset
    rec.onerror = reset

    recognitionRef.current = rec
    rec.start()
  }, [lang])

  const toggle = useCallback(() => {
    if (recognitionRef.current) stop()
    else                        start()
  }, [start, stop])

  /* Stop any in-flight recognition when the consumer unmounts. */
  useEffect(() => () => { recognitionRef.current?.stop?.() }, [])

  return { isListening, interim, isSupported, start, stop, toggle }
}
