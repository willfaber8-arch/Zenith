'use client'

import { useState, useEffect } from 'react'
import { fetchWeather, type WeatherData, type DayForecast } from '@/lib/weather'
import { useNav } from '@/lib/NavContext'
import styles from './WeatherWidget.module.css'

type Status = 'idle' | 'loading' | 'ok' | 'denied' | 'error'

/* ── Weather icon map ─────────────────────────────────────── */
const CONDITION_ICON: Record<string, string> = {
  'Clear sky':                  '☀️',
  'Mainly clear':               '🌤️',
  'Partly cloudy':              '⛅',
  'Overcast':                   '☁️',
  'Foggy':                      '🌫️',
  'Icy fog':                    '🌫️',
  'Light drizzle':              '🌦️',
  'Drizzle':                    '🌦️',
  'Heavy drizzle':              '🌧️',
  'Light rain':                 '🌦️',
  'Rain':                       '🌧️',
  'Heavy rain':                 '🌧️',
  'Light snow':                 '🌨️',
  'Snow':                       '❄️',
  'Heavy snow':                 '❄️',
  'Snow grains':                '🌨️',
  'Rain showers':               '🌦️',
  'Showers':                    '🌧️',
  'Heavy showers':              '🌧️',
  'Snow showers':               '🌨️',
  'Heavy snow showers':         '❄️',
  'Thunderstorm':               '⛈️',
  'Thunderstorm w/ hail':       '⛈️',
  'Thunderstorm w/ heavy hail': '⛈️',
}

function getIcon(condition: string): string {
  return CONDITION_ICON[condition] ?? '🌡️'
}

/* ── Day abbreviation ─────────────────────────────────────── */
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function dayLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const today = new Date()
  if (iso === today.toISOString().slice(0, 10)) return 'Today'
  return DAY_SHORT[d.getDay()]
}

/* ── Forecast strip ───────────────────────────────────────── */
function ForecastStrip({ forecast }: { forecast: DayForecast[] }) {
  return (
    <div className={styles.forecastStrip}>
      {forecast.map(day => (
        <div key={day.date} className={styles.forecastDay}>
          <span className={styles.forecastDayLabel}>{dayLabel(day.date)}</span>
          <span className={styles.forecastIcon}>{getIcon(day.condition)}</span>
          <span className={styles.forecastHigh}>{day.highF}°</span>
          <span className={styles.forecastLow}>{day.lowF}°</span>
        </div>
      ))}
    </div>
  )
}

/* ── Main widget ──────────────────────────────────────────── */
export default function WeatherWidget() {
  const [status,  setStatus]  = useState<Status>('idle')
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [city,    setCity]    = useState<string | null>(null)
  const { navigate } = useNav()

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('denied')
      return
    }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        /* Reverse-geocode city */
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
        } catch { /* city is optional */ }

        const data = await fetchWeather(coords.latitude, coords.longitude)
        if (data) { setWeather(data); setStatus('ok') }
        else        setStatus('error')
      },
      () => setStatus('denied'),
      { timeout: 8000 },
    )
  }, [])

  const isLoading  = status === 'idle' || status === 'loading'
  const hasFailed  = status === 'denied' || status === 'error'

  return (
    <div
      className={`${styles.widget} ${styles.clickable}`}
      onClick={() => navigate('calendar', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate('calendar', 'essentials')}
      aria-label="Weather — go to Calendar"
    >
      {/* ── Header: eyebrow + location ────────────────────── */}
      <div className={styles.widgetHeader}>
        <span className={styles.eyebrow}>Current Conditions</span>
        {city && <span className={styles.location}>{city}</span>}
      </div>

      {isLoading && (
        <div className={styles.loadingBody}>
          <div className={styles.spinnerSmall} />
          <span className={styles.loadingText}>Locating…</span>
        </div>
      )}

      {hasFailed && (
        <div className={styles.errorBody}>
          <span className={styles.errorIcon}>{status === 'denied' ? '⊘' : '✕'}</span>
          <p className={styles.errorText}>
            {status === 'denied'
              ? 'Location access denied.\nEnable in browser settings.'
              : 'Weather unavailable.'}
          </p>
        </div>
      )}

      {status === 'ok' && weather && (
        <>
          {/* ── Current conditions ──────────────────────── */}
          <div className={styles.currentRow}>
            <span className={styles.weatherIcon}>{getIcon(weather.condition)}</span>
            <div className={styles.tempBlock}>
              <span className={styles.tempMain}>{weather.tempF}<span className={styles.deg}>°F</span></span>
              <span className={styles.conditionLabel}>{weather.condition}</span>
              <span className={styles.hiLo}>
                <span className={styles.hiLabel}>H:</span>{weather.highF}°
                {'  '}
                <span className={styles.loLabel}>L:</span>{weather.lowF}°
              </span>
            </div>
          </div>

          {/* ── 7-day forecast ──────────────────────────── */}
          {weather.forecast.length > 1 && (
            <ForecastStrip forecast={weather.forecast.slice(0, 7)} />
          )}
        </>
      )}
    </div>
  )
}
