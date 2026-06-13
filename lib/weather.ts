export type WeatherData = {
  tempF:     number
  condition: string
  highF:     number
  lowF:      number
  forecast:  DayForecast[]
}

export type DayForecast = {
  date:      string   // ISO "YYYY-MM-DD"
  condition: string
  highF:     number
  lowF:      number
}

const WMO_CONDITIONS: Record<number, string> = {
  0:  'Clear sky',
  1:  'Mainly clear',
  2:  'Partly cloudy',
  3:  'Overcast',
  45: 'Foggy',
  48: 'Icy fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm w/ hail',
  99: 'Thunderstorm w/ heavy hail',
}

export function conditionToLabel(code: number): string {
  return WMO_CONDITIONS[code] ?? 'Unknown'
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=7` +
      `&temperature_unit=fahrenheit` +
      `&timezone=auto`

    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()

    const tempF     = Math.round(json.current.temperature_2m as number)
    const condition = conditionToLabel(json.current.weather_code as number)

    const dailyDates: string[]  = json.daily.time
    const dailyCodes: number[]  = json.daily.weather_code
    const dailyMaxs:  number[]  = json.daily.temperature_2m_max
    const dailyMins:  number[]  = json.daily.temperature_2m_min

    const forecast: DayForecast[] = dailyDates.map((date, i) => ({
      date,
      condition: conditionToLabel(dailyCodes[i] ?? 0),
      highF:     Math.round(dailyMaxs[i] ?? tempF),
      lowF:      Math.round(dailyMins[i] ?? tempF),
    }))

    return {
      tempF,
      condition,
      highF: forecast[0]?.highF ?? tempF,
      lowF:  forecast[0]?.lowF  ?? tempF,
      forecast,
    }
  } catch {
    return null
  }
}
