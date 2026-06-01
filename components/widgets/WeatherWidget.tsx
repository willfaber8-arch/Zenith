'use client'

import { useState, useEffect } from 'react'
import { fetchWeather, type WeatherData } from '@/lib/weather'
import styles from './Widget.module.css'

type Status = 'idle' | 'loading' | 'ok' | 'denied' | 'error'

const WMO_ICONS: Record<string, string> = {
  'Clear sky':                  '☀',
  'Mainly clear':               '🌤',
  'Partly cloudy':              '⛅',
  'Overcast':                   '☁',
  'Foggy':                      '🌫',
  'Icy fog':                    '🌫',
  'Light drizzle':              '🌦',
  'Drizzle':                    '🌦',
  'Heavy drizzle':              '🌧',
  'Light rain':                 '🌦',
  'Rain':                       '🌧',
  'Heavy rain':                 '🌧',
  'Light snow':                 '🌨',
  'Snow':                       '❄',
  'Heavy snow':                 '❄',
  'Snow grains':                '🌨',
  'Rain showers':               '🌦',
  'Showers':                    '🌧',
  'Heavy showers':              '🌧',
  'Snow showers':               '🌨',
  'Heavy snow showers':         '❄',
  'Thunderstorm':               '⛈',
  'Thunderstorm w/ hail':       '⛈',
  'Thunderstorm w/ heavy hail': '⛈',
}

export default function WeatherWidget() {
  const [status,  setStatus]  = useState<Status>('idle')
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [city,    setCity]    = useState<string | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('denied')
      return
    }

    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        /* Reverse-geocode city name (no API key — Open-Meteo bundle) */
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } },
          )
          if (geoRes.ok) {
            const geo = await geoRes.json()
            setCity(
              geo?.address?.city ??
              geo?.address?.town ??
              geo?.address?.village ??
              null,
            )
          }
        } catch { /* city display is optional */ }

        const data = await fetchWeather(coords.latitude, coords.longitude)
        if (data) {
          setWeather(data)
          setStatus('ok')
        } else {
          setStatus('error')
        }
      },
      () => setStatus('denied'),
      { timeout: 7000 },
    )
  }, [])

  const icon = weather ? (WMO_ICONS[weather.condition] ?? '·') : null

  return (
    <div
      className={styles.widget}
      style={{ '--widget-accent': 'var(--accent-green)' } as React.CSSProperties}
    >
      <div className={styles.widgetHeader}>
        <p className={styles.widgetEyebrow}>
          {city ? `Weather · ${city}` : 'Weather · Local'}
        </p>
      </div>

      <p className={styles.widgetTitle}>Current Conditions</p>

      <div className={styles.widgetBody}>
        {status === 'loading' && (
          <div className={styles.weatherBody}>
            <p className={styles.weatherLoading}>Locating…</p>
          </div>
        )}

        {status === 'ok' && weather && (
          <div className={styles.weatherBody}>
            <p className={styles.weatherTemp} aria-label={`${weather.tempC} degrees Celsius`}>
              {icon && (
                <span style={{ marginRight: 'var(--sp-2)', fontSize: '0.7em' }} aria-hidden="true">
                  {icon}
                </span>
              )}
              {weather.tempC}
              <span className={styles.weatherDeg}>°C</span>
            </p>
            <p className={styles.weatherCondition}>{weather.condition}</p>
            <p className={styles.weatherMeta}>Open-Meteo · updated now</p>
          </div>
        )}

        {(status === 'denied' || status === 'error') && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden="true">
              {status === 'denied' ? '⊘' : '✕'}
            </span>
            <p className={styles.emptyText}>
              {status === 'denied'
                ? 'Location access denied.\nEnable in browser settings.'
                : 'Weather unavailable.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
