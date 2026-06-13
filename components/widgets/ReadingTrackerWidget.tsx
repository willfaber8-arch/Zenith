'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db }           from '@/lib/db'
import { useNav }       from '@/lib/NavContext'
import wStyles from './Widget.module.css'

export default function ReadingTrackerWidget() {
  const { navigate } = useNav()

  const currentBooks = useLiveQuery(
    () => db.library_books?.where('readingStatus').equals('CURRENTLY_READING').toArray(),
    [],
  ) ?? []

  const tbrCount = useLiveQuery(
    () => db.library_books?.where('readingStatus').equals('TO_READ').count(),
    [],
  ) ?? 0

  const doneCount = useLiveQuery(
    () => db.library_books?.where('readingStatus').equals('COMPLETED').count(),
    [],
  ) ?? 0

  const book = currentBooks[0]
  const daysReading = book?.dateStarted
    ? Math.max(1, Math.ceil((Date.now() - book.dateStarted) / 86_400_000))
    : 0

  return (
    <div
      className={`${wStyles.card} ${wStyles.clickable}`}
      onClick={() => navigate('book-tracker', 'essentials')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('book-tracker', 'essentials') }}
    >
      <div className={wStyles.cardHeader}>
        <div>
          <div className={wStyles.eyebrow}>Library</div>
          <div className={wStyles.title}>Reading</div>
        </div>
        <span className={wStyles.navArrow} aria-hidden="true">→</span>
      </div>

      {book ? (
        <div className={wStyles.rtBook}>
          <div className={wStyles.rtTitle}>{book.title}</div>
          <div className={wStyles.rtAuthor}>by {book.author}</div>
          <div className={wStyles.rtProgress}>
            <div className={wStyles.rtProgressFill} style={{ width: '35%' }} />
          </div>
          <div className={wStyles.rtMeta}>
            <span className={wStyles.rtStat}>
              Day <span className={wStyles.rtStatVal}>{daysReading}</span>
            </span>
            {tbrCount > 0 && (
              <span className={wStyles.rtStat}>
                <span className={wStyles.rtStatVal}>{tbrCount}</span> in queue
              </span>
            )}
            {doneCount > 0 && (
              <span className={wStyles.rtStat}>
                <span className={wStyles.rtStatVal}>{doneCount}</span> read
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className={wStyles.empty}>
          {tbrCount > 0
            ? `${tbrCount} book${tbrCount !== 1 ? 's' : ''} in your queue — start one!`
            : 'No books tracked yet.'}
        </div>
      )}
    </div>
  )
}
