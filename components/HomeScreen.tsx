'use client'

import { useState, useEffect } from 'react'
import { getUrgentTasks, type Task } from '@/lib/db'
import { fetchWeather, type WeatherData } from '@/lib/weather'
import styles from './HomeScreen.module.css'

function getGreeting(date: Date): string {
  const h = date.getHours()
  if (h < 5) return 'Good night.'
  if (h < 12) return 'Good morning.'
  if (h < 17) return 'Good afternoon.'
  if (h < 21) return 'Good evening.'
  return 'Good night.'
}

function formatDue(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
}

export default function HomeScreen() {
  const [now, setNow] = useState<Date | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherState, setWeatherState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksReady, setTasksReady] = useState(false)

  // Live clock — initialised client-side to avoid hydration mismatch
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Weather via browser geolocation + Open-Meteo (no API key required)
  useEffect(() => {
    if (!navigator.geolocation) {
      setWeatherState('error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const data = await fetchWeather(pos.coords.latitude, pos.coords.longitude)
        if (data) {
          setWeather(data)
          setWeatherState('ok')
        } else {
          setWeatherState('error')
        }
      },
      () => setWeatherState('error'),
      { timeout: 8000 },
    )
  }, [])

  // Urgent tasks from IndexedDB
  useEffect(() => {
    getUrgentTasks()
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setTasksReady(true))
  }, [])

  const formattedTime = now?.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const formattedDate = now?.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const weatherText =
    weatherState === 'ok' && weather
      ? `${weather.tempF}°F  ·  ${weather.condition}`
      : weatherState === 'error'
        ? 'Weather unavailable'
        : ''

  return (
    <main className={styles.root}>
      <div className={styles.container}>

        <p className={styles.greeting}>{now ? getGreeting(now) : ' '}</p>

        <div className={styles.timeBlock}>
          <time className={styles.time} suppressHydrationWarning>
            {formattedTime ?? ''}
          </time>
          <p className={styles.date} suppressHydrationWarning>
            {formattedDate ?? ''}
          </p>
          <p className={styles.weather}>{weatherText}</p>
        </div>

        <div className={styles.divider} />

        <section className={styles.tasksSection}>
          <h2 className={styles.tasksLabel}>Urgent</h2>

          {!tasksReady ? (
            <p className={styles.tasksEmpty}>&mdash;</p>
          ) : tasks.length === 0 ? (
            <p className={styles.tasksEmpty}>Nothing urgent.</p>
          ) : (
            <ul className={styles.tasksList}>
              {tasks.map((task) => (
                <li key={task.id} className={styles.taskItem}>
                  <span className={styles.taskDot} aria-hidden />
                  <span className={styles.taskTitle}>{task.title}</span>
                  {task.dueDate && (
                    <span className={styles.taskDue}>{formatDue(task.dueDate)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className={styles.divider} />

        <button type="button" className={styles.studyButton}>
          Enter Study Mode
        </button>

      </div>
    </main>
  )
}
