/**
 * components/SetLogger.tsx — logging one set at a time.
 *
 * Designed for the worst conditions this app will face: standing up,
 * sweating, one hand, possibly with a rest timer running. Everything
 * about it follows from that.
 *
 *   · one set on screen, never a table — a grid of inputs is unusable
 *     while holding a phone in one hand
 *   · reps and weight move with big steppers, never a keyboard; a number
 *     pad between sets is the failure mode this exists to avoid
 *   · the primary action is full width and low on the screen, where a
 *     thumb actually reaches
 *   · weight defaults to the previous set, because most sets do not
 *     change weight and the ones that do are two taps
 *   · nothing destructive is anywhere near the button pressed forty
 *     times an hour
 */

'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Icon from '@/components/ui/Icon'
import {
  nextSet, suggestedWeight, sessionSetCounts, sessionVolumeKg,
  type StrengthSession, type WeightUnit,
} from '@/types/weightroom'
import styles from './SetLogger.module.css'

interface Props {
  session: StrengthSession
  onLogSet: (exerciseId: string, setId: string, patch: {
    reps: number; weight: number | null; unit: WeightUnit; completed: true
  }) => void
  onFinish: () => void
  onClose:  () => void
}

/** Steps that match how plates actually go on a bar. */
const WEIGHT_STEP_KG = 2.5
const WEIGHT_STEP_LB = 5

export default function SetLogger({ session, onLogSet, onFinish, onClose }: Props) {
  const current = useMemo(() => nextSet(session), [session])
  const counts  = sessionSetCounts(session)

  const [reps,   setReps]   = useState(0)
  const [weight, setWeight] = useState<number | null>(null)
  const [unit,   setUnit]   = useState<WeightUnit>('kg')

  /* Rest timer. Epoch-based so it survives a backgrounded tab — a phone
     screen locking mid-rest must not stop the clock. */
  const [restFrom, setRestFrom] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (restFrom == null) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [restFrom])

  /* Seed the controls whenever the set changes. */
  const seededFor = useRef<string | null>(null)
  useEffect(() => {
    if (!current || seededFor.current === current.set.id) return
    seededFor.current = current.set.id
    setReps(current.set.targetReps)
    const prior = suggestedWeight(session, current.exerciseIndex, current.setIndex)
    setWeight(current.set.weight ?? prior?.weight ?? null)
    setUnit(current.set.unit ?? prior?.unit ?? 'kg')
  }, [current, session])

  if (!current) {
    const volume = sessionVolumeKg(session)
    return (
      <div className={styles.root}>
        <div className={styles.doneCard}>
          <Icon name="check" size={30} />
          <h3 className={styles.doneTitle}>{session.title} complete</h3>
          <p className={styles.doneStat}>
            {counts.total} sets · {volume.toLocaleString()} kg moved
          </p>
          <button className={styles.primaryBtn} onClick={onFinish}>Save session</button>
          <button className={styles.quietBtn} onClick={onClose}>Back</button>
        </div>
      </div>
    )
  }

  const { exercise, set, setIndex } = current
  const step = unit === 'kg' ? WEIGHT_STEP_KG : WEIGHT_STEP_LB
  const restLeft = restFrom != null && set.restSeconds
    ? Math.max(0, set.restSeconds - Math.floor((now - restFrom) / 1000))
    : null

  const logIt = () => {
    onLogSet(exercise.id, set.id, { reps, weight, unit, completed: true })
    setRestFrom(set.restSeconds ? Date.now() : null)
  }

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <button className={styles.iconBtn} onClick={onClose} aria-label="Close logger">
          <Icon name="chevronLeft" />
        </button>
        <div className={styles.headText}>
          <p className={styles.headTitle}>{session.title}</p>
          <p className={styles.headSub}>{counts.done} of {counts.total} sets</p>
        </div>
      </header>

      <div className={styles.progressTrack} aria-hidden="true">
        <div
          className={styles.progressFill}
          style={{ width: `${counts.total ? (counts.done / counts.total) * 100 : 0}%` }}
        />
      </div>

      <div className={styles.card}>
        <p className={styles.exerciseName}>{exercise.name}</p>
        <p className={styles.setLabel}>
          Set {setIndex + 1} of {exercise.sets.length}
          <span className={styles.target}> · target {set.targetReps}</span>
        </p>
        {exercise.cue && <p className={styles.cue}>{exercise.cue}</p>}

        {/* Reps */}
        <div className={styles.stepperRow}>
          <span className={styles.stepperLabel}>Reps</span>
          <div className={styles.stepper}>
            <button
              className={styles.stepBtn}
              onClick={() => setReps(r => Math.max(0, r - 1))}
              aria-label="One fewer rep"
            ><Icon name="minus" size={22} /></button>
            <span className={styles.stepValue}>{reps}</span>
            <button
              className={styles.stepBtn}
              onClick={() => setReps(r => r + 1)}
              aria-label="One more rep"
            ><Icon name="plus" size={22} /></button>
          </div>
        </div>

        {/* Weight */}
        <div className={styles.stepperRow}>
          <span className={styles.stepperLabel}>
            Weight
            <button
              className={styles.unitBtn}
              onClick={() => setUnit(u => (u === 'kg' ? 'lb' : 'kg'))}
              aria-label={`Switch to ${unit === 'kg' ? 'pounds' : 'kilograms'}`}
            >{unit}</button>
          </span>
          <div className={styles.stepper}>
            <button
              className={styles.stepBtn}
              onClick={() => setWeight(w => Math.max(0, (w ?? 0) - step))}
              aria-label={`Reduce by ${step} ${unit}`}
            ><Icon name="minus" size={22} /></button>
            <span className={styles.stepValue}>
              {weight == null ? '—' : Number(weight.toFixed(1))}
            </span>
            <button
              className={styles.stepBtn}
              onClick={() => setWeight(w => (w ?? 0) + step)}
              aria-label={`Add ${step} ${unit}`}
            ><Icon name="plus" size={22} /></button>
          </div>
        </div>

        {restLeft != null && restLeft > 0 && (
          <p className={styles.rest} role="status">
            <Icon name="clock" size={15} />
            Rest {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
          </p>
        )}
      </div>

      {/* Low on the screen, full width, nothing competing with it. */}
      <button className={styles.primaryBtn} onClick={logIt}>
        <Icon name="check" size={20} />
        Log set
      </button>
    </div>
  )
}
