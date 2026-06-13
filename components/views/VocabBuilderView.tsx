'use client'

import { useState, useMemo, useCallback, useEffect }  from 'react'
import { useLiveQuery }                                from 'dexie-react-hooks'
import { db }                                          from '@/lib/db'
import type { VocabDeck, VocabCard }                   from '@/types/vocabulary'
import ZenHeading                                      from '@/components/ui/ZenHeading'
import VocabStudySession                               from '@/components/VocabStudySession'
import { useToast }                                    from '@/lib/ToastContext'
import styles                                          from './VocabBuilderView.module.css'

/* ════════════════════════════════════════════════════════════════
   English Vocabulary — static word bank (GRE / advanced level)
   ════════════════════════════════════════════════════════════════ */

const ENGLISH_DECK_NAME = 'Advanced English'
const ENGLISH_DECK_LS_KEY = 'zenith_english_deck_id_v1'
const ENGLISH_STREAK_KEY  = 'zenith_english_vocab_streak_v1'

const ADVANCED_ENGLISH_WORDS: Array<{ word: string; definition: string }> = [
  { word: 'Abstruse',        definition: 'Difficult to understand; obscure or esoteric' },
  { word: 'Acrimony',        definition: 'Bitterness or ill feeling; sharpness of manner' },
  { word: 'Adumbrate',       definition: 'To outline or sketch; to foreshadow vaguely' },
  { word: 'Aetiology',       definition: 'The cause, set of causes, or manner of causation of a condition' },
  { word: 'Alacrity',        definition: 'Brisk and cheerful readiness' },
  { word: 'Ambiguous',       definition: 'Open to more than one interpretation; inexact' },
  { word: 'Ameliorate',      definition: 'To make something bad or unsatisfactory better' },
  { word: 'Anachronism',     definition: 'Something misplaced in time; belonging to a period other than that depicted' },
  { word: 'Anodyne',         definition: 'Not likely to provoke dissent; painkilling' },
  { word: 'Antipathy',       definition: 'A deep-seated feeling of dislike; aversion' },
  { word: 'Apocryphal',      definition: 'Of doubtful authenticity, although widely circulated as being true' },
  { word: 'Apotheosis',      definition: 'The highest point in the development of something; the elevation to divine status' },
  { word: 'Approbation',     definition: 'Approval or praise; official sanction' },
  { word: 'Arcane',          definition: 'Understood by few; mysterious or secret' },
  { word: 'Arduous',         definition: 'Involving or requiring strenuous effort; difficult and tiring' },
  { word: 'Asperity',        definition: 'Harshness of tone or manner; roughness of surface' },
  { word: 'Assiduous',       definition: 'Showing great care, attention, and effort' },
  { word: 'Atavism',         definition: 'Recurrence of a trait after several generations; reversion to an earlier type' },
  { word: 'Attenuate',       definition: 'To reduce the force, effect, or value of; to weaken' },
  { word: 'Austere',         definition: 'Severe or strict in manner; having no comforts or luxuries' },
  { word: 'Avarice',         definition: 'Extreme greed for wealth or material gain' },
  { word: 'Banal',           definition: 'So lacking in originality as to be obvious and boring' },
  { word: 'Belligerent',     definition: 'Hostile and aggressive; engaged in a war or conflict' },
  { word: 'Bifurcate',       definition: 'To divide into two branches or forks' },
  { word: 'Boorish',         definition: 'Rough and bad-mannered; coarse' },
  { word: 'Calumny',         definition: 'The making of false and defamatory statements; slander' },
  { word: 'Captious',        definition: 'Tending to find fault; making trivial objections' },
  { word: 'Catharsis',       definition: 'The release of emotional tensions, especially through art or drama' },
  { word: 'Caustic',         definition: 'Sarcastic in a scathing way; corrosive to living tissue' },
  { word: 'Chicanery',       definition: 'The use of trickery to achieve a political, financial, or legal purpose' },
  { word: 'Cogent',          definition: 'Clear, logical, and convincing' },
  { word: 'Complaisant',     definition: 'Willing to please others; obliging' },
  { word: 'Concomitant',     definition: 'Naturally accompanying or associated; a phenomenon that accompanies another' },
  { word: 'Contrite',        definition: 'Feeling or expressing remorse for wrongdoing' },
  { word: 'Convolution',     definition: 'A thing that is complex and difficult to follow; a coil or twist' },
  { word: 'Corroborate',     definition: 'To confirm or give support to a statement, theory, or finding' },
  { word: 'Cupidity',        definition: 'Greed for money or possessions' },
  { word: 'Dearth',          definition: 'A scarcity or lack of something' },
  { word: 'Debacle',         definition: 'A sudden disastrous collapse or defeat; a complete fiasco' },
  { word: 'Deleterious',     definition: 'Causing harm or damage' },
  { word: 'Demagogue',       definition: 'A political leader who seeks support by appealing to emotions and prejudices' },
  { word: 'Denouement',      definition: 'The final resolution of a plot; the outcome of a complex sequence of events' },
  { word: 'Diatribe',        definition: 'A forceful and bitter verbal attack against someone or something' },
  { word: 'Didactic',        definition: 'Intended to teach, particularly in a moralistic way' },
  { word: 'Diffidence',      definition: 'Modesty or shyness resulting from a lack of self-confidence' },
  { word: 'Dilettante',      definition: 'A person who cultivates an area of interest without commitment or expertise' },
  { word: 'Dissonance',      definition: 'Lack of harmony among musical notes; tension or clash between ideas' },
  { word: 'Dogmatic',        definition: 'Inclined to lay down principles as incontrovertibly true' },
  { word: 'Ebullient',       definition: 'Cheerful and full of energy; exuberant' },
  { word: 'Effulgent',       definition: 'Radiant; shining brightly' },
  { word: 'Egregious',       definition: 'Outstandingly bad; flagrant' },
  { word: 'Elegy',           definition: 'A mournful poem or song; a lament for the dead' },
  { word: 'Emollient',       definition: 'Softening or soothing; tending to avoid confrontation' },
  { word: 'Empirical',       definition: 'Based on observation or experience rather than theory' },
  { word: 'Enervate',        definition: 'To weaken; to make someone feel drained of energy' },
  { word: 'Ephemeral',       definition: 'Lasting for a very short time' },
  { word: 'Equivocate',      definition: 'To use ambiguous language to conceal the truth or avoid commitment' },
  { word: 'Esoteric',        definition: 'Intended for or understood by only a small group with specialist knowledge' },
  { word: 'Exacerbate',      definition: 'To make a problem, bad situation, or negative feeling worse' },
  { word: 'Excoriate',       definition: 'To censure or criticize severely; to strip off the skin' },
  { word: 'Exigent',         definition: 'Pressing; requiring immediate attention; demanding' },
  { word: 'Expiate',         definition: 'To make amends or reparation for guilt or wrongdoing' },
  { word: 'Fastidious',      definition: 'Very attentive to detail; very careful about accuracy' },
  { word: 'Fatuous',         definition: 'Silly and pointless; self-complacently foolish' },
  { word: 'Fecund',          definition: 'Producing or capable of producing an abundance of offspring or new growth' },
  { word: 'Fell',            definition: 'Of terrible evil; fierce and cruel' },
  { word: 'Flagrant',        definition: 'Conspicuously or obviously offensive; blatant' },
  { word: 'Furtive',         definition: 'Attempting to avoid notice or attention; secretive' },
  { word: 'Garrulous',       definition: 'Excessively talkative, especially on trivial matters' },
  { word: 'Grandiloquent',   definition: 'Pompous or extravagant in language or style' },
  { word: 'Hapless',         definition: 'Unfortunate; having no luck' },
  { word: 'Hegemony',        definition: 'Leadership or dominance, especially of one country or social group over others' },
  { word: 'Heretical',       definition: 'Going against accepted or mainstream beliefs; unorthodox' },
  { word: 'Histrionic',      definition: 'Overly theatrical or melodramatic in character' },
  { word: 'Hubris',          definition: 'Excessive pride or self-confidence; arrogance that leads to downfall' },
  { word: 'Iconoclast',      definition: 'A person who attacks cherished beliefs or institutions' },
  { word: 'Immutable',       definition: 'Unchanging over time or unable to be changed' },
  { word: 'Impecunious',     definition: 'Having little or no money' },
  { word: 'Impugn',          definition: 'To dispute the truth, validity, or honesty of' },
  { word: 'Inchoate',        definition: 'Just begun and not fully formed or developed; underdeveloped' },
  { word: 'Inimical',        definition: 'Tending to obstruct or harm; unfriendly; hostile' },
  { word: 'Insipid',         definition: 'Lacking vigour or interest; lacking strong flavour' },
  { word: 'Intransigent',    definition: 'Refusing to change one\'s views or to agree about something' },
  { word: 'Inveterate',      definition: 'Having a particular habit, activity, or interest deeply established' },
  { word: 'Jejune',          definition: 'Naive, simplistic, and superficial; dry and uninteresting' },
  { word: 'Jocular',         definition: 'Fond of or characterised by joking; humorous' },
  { word: 'Laconic',         definition: 'Using very few words; brief and concise' },
  { word: 'Loquacious',      definition: 'Tending to talk a great deal; talkative' },
  { word: 'Lugubrious',      definition: 'Looking or sounding sad and dismal; mournful' },
  { word: 'Machiavellian',   definition: 'Cunning, scheming, and unscrupulous, especially in politics' },
  { word: 'Magnanimous',     definition: 'Very generous or forgiving, especially toward a rival or less powerful person' },
  { word: 'Malediction',     definition: 'A curse; the utterance of a curse' },
  { word: 'Mendacious',      definition: 'Not telling the truth; lying' },
  { word: 'Mercurial',       definition: 'Subject to sudden or unpredictable changes of mood or mind' },
  { word: 'Meretricious',    definition: 'Apparently attractive but having in reality no value or integrity' },
  { word: 'Meticulous',      definition: 'Showing great attention to detail or being very careful and precise' },
  { word: 'Misanthrope',     definition: 'A person who dislikes humankind and avoids human society' },
  { word: 'Mitigate',        definition: 'To make less severe, serious, or painful' },
  { word: 'Mollify',         definition: 'To appease the anger or anxiety of someone; to reduce in intensity' },
  { word: 'Nadir',           definition: 'The lowest or most unsuccessful point; the lowest point in the sky' },
  { word: 'Nascent',         definition: 'Just coming into existence and beginning to display signs of future potential' },
  { word: 'Nefarious',       definition: 'Wicked or criminal; notorious for wickedness' },
  { word: 'Nihilism',        definition: 'The rejection of all religious and moral principles; extreme scepticism' },
  { word: 'Obdurate',        definition: 'Stubbornly refusing to change one\'s opinion or course of action' },
  { word: 'Obfuscate',       definition: 'To render obscure, unclear, or unintelligible' },
  { word: 'Obloquy',         definition: 'Strong public condemnation; abuse or vilification' },
  { word: 'Obsequious',      definition: 'Obedient or attentive to an excessive or servile degree' },
  { word: 'Obstreperous',    definition: 'Noisy and difficult to control; unruly' },
  { word: 'Occlude',         definition: 'To stop, close up, or obstruct an opening, passage, or vessel' },
  { word: 'Onerous',         definition: 'Involving an amount of effort and difficulty that is oppressively burdensome' },
  { word: 'Opprobrious',     definition: 'Expressing scorn or criticism; bringing shame or disgrace' },
  { word: 'Ostensible',      definition: 'Stated or appearing to be true, but not necessarily so' },
  { word: 'Palliate',        definition: 'To make the effects of a disease or condition less severe; to alleviate' },
  { word: 'Pariah',          definition: 'An outcast; a person or animal that is rejected or avoided by others' },
  { word: 'Paucity',         definition: 'The presence of something in only small or insufficient quantities' },
  { word: 'Pedantic',        definition: 'Overly concerned with minor details or rules; unimaginative' },
  { word: 'Penurious',       definition: 'Excessively unwilling to spend; stingy; extremely poor' },
  { word: 'Perfidious',      definition: 'Guilty of betrayal or treachery; deceitful and untrustworthy' },
  { word: 'Perfunctory',     definition: 'Carried out with a minimum of effort or reflection; superficial' },
  { word: 'Peripatetic',     definition: 'Travelling from place to place; working in various locations' },
  { word: 'Pernicious',      definition: 'Having a harmful effect, especially in a gradual or subtle way' },
  { word: 'Perspicacious',   definition: 'Having a ready insight into things; shrewd' },
  { word: 'Petulant',        definition: 'Childishly sulky or bad-tempered' },
  { word: 'Philistine',      definition: 'Hostile or indifferent to culture and the arts; a person of such a kind' },
  { word: 'Phlegmatic',      definition: 'Having an unemotional and stolidly calm disposition' },
  { word: 'Picaresque',      definition: 'Relating to an episodic style of fiction dealing with rogues and adventurers' },
  { word: 'Platitude',       definition: 'A remark or statement that is used so often it has become meaningless' },
  { word: 'Plethora',        definition: 'An excess of something; an overabundance' },
  { word: 'Polemical',       definition: 'Of or involving strongly critical or controversial writing or speech' },
  { word: 'Precipitate',     definition: 'To cause something to happen suddenly or prematurely; hasty' },
  { word: 'Presumptuous',    definition: 'Failing to observe the limits of what is permitted or appropriate; arrogant' },
  { word: 'Prevaricate',     definition: 'To speak or act in an evasive way; to be deliberately ambiguous' },
  { word: 'Probity',         definition: 'The quality of having strong moral principles; complete honesty' },
  { word: 'Prodigal',        definition: 'Spending money or resources freely; wasteful; lavishly generous' },
  { word: 'Profligate',      definition: 'Recklessly extravagant; licentious; dissolute' },
  { word: 'Propitious',      definition: 'Giving or indicating a good chance of success; favourable' },
  { word: 'Prosaic',         definition: 'Having the style of prose; lacking poetic beauty; commonplace' },
  { word: 'Protean',         definition: 'Tending or able to change frequently or easily; versatile' },
  { word: 'Punctilious',     definition: 'Showing great attention to detail or correct behaviour; precise' },
  { word: 'Pugnacious',      definition: 'Eager or quick to argue, quarrel, or fight; combative' },
  { word: 'Querulous',       definition: 'Complaining in a petulant or whining manner' },
  { word: 'Quixotic',        definition: 'Exceedingly idealistic; unrealistic and impractical' },
  { word: 'Raconteur',       definition: 'A person who tells anecdotes in a skilful and amusing way' },
  { word: 'Recalcitrant',    definition: 'Having an obstinately uncooperative attitude towards authority' },
  { word: 'Recondite',       definition: 'Not known by many people; obscure; dealing with obscure subject matter' },
  { word: 'Refractory',      definition: 'Stubborn or unmanageable; resistant to treatment' },
  { word: 'Reprobate',       definition: 'An unprincipled person; morally depraved' },
  { word: 'Restive',         definition: 'Unable to remain still, silent, or submissive; restless' },
  { word: 'Sagacious',       definition: 'Having or showing keen mental discernment and good judgement; wise' },
  { word: 'Salutary',        definition: 'Producing good effects; beneficial' },
  { word: 'Sanguine',        definition: 'Optimistic, especially in a difficult situation; blood-red in colour' },
  { word: 'Sardonic',        definition: 'Grimly mocking or cynical' },
  { word: 'Sedulously',      definition: 'In a hardworking and diligent manner; assiduously' },
  { word: 'Sentious',        definition: 'Given to moralising in a pompous or affected manner' },
  { word: 'Soporific',       definition: 'Tending to induce drowsiness or sleep; sleep-inducing' },
  { word: 'Specious',        definition: 'Superficially plausible but actually wrong; misleading' },
  { word: 'Stolid',          definition: 'Calm, dependable, and showing little emotion or animation' },
  { word: 'Sycophant',       definition: 'A person who acts obsequiously towards someone important' },
  { word: 'Taciturn',        definition: 'Reserved or uncommunicative in speech; saying little' },
  { word: 'Temerity',        definition: 'Excessive confidence or boldness; audacity' },
  { word: 'Tendentious',     definition: 'Promoting a particular cause or point of view; biased' },
  { word: 'Timorous',        definition: 'Showing or suffering from nervousness or lack of confidence' },
  { word: 'Torpid',          definition: 'Mentally or physically inactive; lethargic' },
  { word: 'Tortuous',        definition: 'Full of twists and turns; excessively lengthy and complex' },
  { word: 'Truculent',       definition: 'Eager or quick to argue or fight; aggressively defiant' },
  { word: 'Turpitude',       definition: 'Wickedness and moral depravity; baseness' },
  { word: 'Umbrage',         definition: 'Offence or annoyance; take umbrage = to be offended' },
  { word: 'Unctuous',        definition: 'Excessively flattering or ingratiating; oily or greasy' },
  { word: 'Vacuous',         definition: 'Having or showing a lack of thought or intelligence; mindless' },
  { word: 'Vapid',           definition: 'Offering nothing that is stimulating or challenging; bland' },
  { word: 'Venal',           definition: 'Showing or motivated by susceptibility to bribery; corrupt' },
  { word: 'Verbose',         definition: 'Using or expressed in more words than are needed; wordy' },
  { word: 'Vestige',         definition: 'A trace of something that is disappearing or no longer exists' },
  { word: 'Vicissitude',     definition: 'A change of circumstances or fortune; uncertainty of fortune' },
  { word: 'Vituperate',      definition: 'To blame or insult in strong or violent language; to abuse' },
  { word: 'Voluble',         definition: 'Talking fluently, readily, or incessantly; talkative' },
  { word: 'Wanton',          definition: 'Deliberate and unprovoked; gratuitous; sexually immodest' },
  { word: 'Xenophobia',      definition: 'Intense or irrational dislike or fear of people from other countries' },
  { word: 'Zealot',          definition: 'A person who is fanatical and uncompromising in pursuit of their ideals' },
  { word: 'Zenith',          definition: 'The time at which something is most powerful or successful; the highest point' },
]

/* ── English vocab streak helpers ──────────────────────────── */
interface EngStreak { lastStudiedDate: string; streak: number }

function readEngStreak(): EngStreak {
  try {
    const raw = localStorage.getItem(ENGLISH_STREAK_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* noop */ }
  return { lastStudiedDate: '', streak: 0 }
}

function bumpEngStreak(): number {
  const today = new Date().toISOString().slice(0, 10)
  const cur   = readEngStreak()
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  let streak = 1
  if (cur.lastStudiedDate === today)      streak = cur.streak
  else if (cur.lastStudiedDate === yesterday) streak = cur.streak + 1
  try { localStorage.setItem(ENGLISH_STREAK_KEY, JSON.stringify({ lastStudiedDate: today, streak })) } catch { /* noop */ }
  return streak
}

/* ── English vocab seed function ────────────────────────────── */
async function seedEnglishDeck(): Promise<string> {
  const cached = (() => { try { return localStorage.getItem(ENGLISH_DECK_LS_KEY) } catch { return null } })()
  if (cached) {
    const exists = await db.vocab_decks.get(cached)
    if (exists) return cached
  }

  const existing = await db.vocab_decks.where('languageName').equals(ENGLISH_DECK_NAME).first()
  if (existing) {
    try { localStorage.setItem(ENGLISH_DECK_LS_KEY, existing.id) } catch { /* noop */ }
    return existing.id
  }

  const deckId = crypto.randomUUID()
  const deck: VocabDeck = {
    id: deckId,
    languageName: ENGLISH_DECK_NAME,
    description:  'Advanced English vocabulary — GRE & SAT level words for mastery.',
    createdAt:    Date.now(),
  }
  await db.vocab_decks.add(deck)

  const now   = Date.now()
  const cards: VocabCard[] = ADVANCED_ENGLISH_WORDS.map(w => ({
    id:                    crypto.randomUUID(),
    deckId,
    foreignWord:           w.word,
    nativeTranslation:     w.definition,
    phoneticSpelling:      '',
    easeFactor:            2.5,
    reviewIntervalDays:    0,
    nextReviewTimestamp:   now,
    consecutiveSuccesses:  0,
    stabilityFactor:       0,
  }))
  await db.vocab_cards.bulkAdd(cards)

  try { localStorage.setItem(ENGLISH_DECK_LS_KEY, deckId) } catch { /* noop */ }
  return deckId
}

/* ════════════════════════════════════════════════════════════════
   EnglishVocabTab — advanced English vocabulary study
   ════════════════════════════════════════════════════════════════ */

function EnglishVocabTab() {
  const [deckId,     setDeckId]     = useState<string | null>(null)
  const [sessionKey, setSessionKey] = useState(0)
  const [streak,     setStreak]     = useState(0)
  const [tab,        setTab]        = useState<'study' | 'progress'>('study')

  /* Bootstrap — seed deck if not present */
  useEffect(() => {
    seedEnglishDeck().then(id => {
      setDeckId(id)
      setStreak(readEngStreak().streak)
    })
  }, [])

  const cards = (useLiveQuery(
    () => deckId ? db.vocab_cards.where('deckId').equals(deckId).toArray() : Promise.resolve([] as VocabCard[]),
    [deckId],
  ) ?? []) as VocabCard[]

  const stats = useMemo(() => computeStats(cards), [cards])

  if (!deckId) {
    return (
      <div className={styles.engLoading}>
        <span className={styles.engLoadingGlyph}>◈</span>
        <p className={styles.engLoadingText}>[ INITIALISING LEXICON... ]</p>
      </div>
    )
  }

  return (
    <div className={styles.engWrap}>

      {/* ── Stats strip ─────────────────────────────────────── */}
      <div className={styles.engStatRow}>
        <div className={styles.engStat}>
          <span className={`${styles.engStatVal} ${styles.engStatValGreen}`}>{stats.mastered}</span>
          <span className={styles.engStatLabel}>Mastered</span>
        </div>
        <div className={styles.engStat}>
          <span className={`${styles.engStatVal} ${stats.due > 0 ? styles.engStatValRose : ''}`}>{stats.due}</span>
          <span className={styles.engStatLabel}>Due Today</span>
        </div>
        <div className={styles.engStat}>
          <span className={styles.engStatVal}>{stats.total}</span>
          <span className={styles.engStatLabel}>Total Words</span>
        </div>
        <div className={styles.engStat}>
          <span className={`${styles.engStatVal} ${styles.engStatValPurple}`}>{streak > 0 ? `🔥 ${streak}` : '—'}</span>
          <span className={styles.engStatLabel}>Day Streak</span>
        </div>
      </div>

      {/* ── Distribution bars ───────────────────────────────── */}
      {stats.total > 0 && (
        <div className={styles.engProgress}>
          {[
            { label: 'New',      count: stats.newCards, cls: styles.engBarNew },
            { label: 'Learning', count: stats.learning, cls: styles.engBarLearning },
            { label: 'Good',     count: stats.good,     cls: styles.engBarGood },
            { label: 'Mastered', count: stats.mastered, cls: styles.engBarMastered },
          ].map(({ label, count, cls }) => (
            <div key={label} className={styles.engProgressRow}>
              <span className={styles.engProgressLabel}>{label}</span>
              <div className={styles.engProgressBar}>
                <div
                  className={`${styles.engProgressFill} ${cls}`}
                  style={{ width: `${(count / stats.total) * 100}%` }}
                />
              </div>
              <span className={styles.engProgressCount}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <div className={styles.engTabBar}>
        {(['study', 'progress'] as const).map(t => (
          <button
            key={t}
            className={`${styles.engTab} ${tab === t ? styles.engTabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'study' ? '◈ Study Session' : '◫ Full Word List'}
          </button>
        ))}
      </div>

      {/* ── Study session ────────────────────────────────────── */}
      {tab === 'study' && (
        <div className={styles.engStudyWrap}>
          <VocabStudySession
            key={`eng-${sessionKey}`}
            deckId={deckId}
            languageName="Advanced English"
            onRestart={() => {
              setSessionKey(k => k + 1)
              setStreak(bumpEngStreak())
            }}
          />
        </div>
      )}

      {/* ── Word list ────────────────────────────────────────── */}
      {tab === 'progress' && (
        <div className={styles.engWordList}>
          {cards
            .slice()
            .sort((a, b) => b.reviewIntervalDays - a.reviewIntervalDays)
            .map(card => {
              const { label, isDue } = formatNextReview(card.nextReviewTimestamp)
              const isMastered = card.reviewIntervalDays >= 21
              return (
                <div key={card.id} className={`${styles.engWordRow} ${isMastered ? styles.engWordRowMastered : ''}`}>
                  <div className={styles.engWordFront}>{card.foreignWord}</div>
                  <div className={styles.engWordBack}>{card.nativeTranslation}</div>
                  <span className={`${styles.engWordDue} ${isDue ? styles.engWordDueNow : ''}`}>{label}</span>
                </div>
              )
            })}
        </div>
      )}

    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Constants & helpers
   ════════════════════════════════════════════════════════════════ */

const LANG_EMOJI: Record<string, string> = {
  spanish: '🇪🇸', french: '🇫🇷', german: '🇩🇪', italian: '🇮🇹',
  portuguese: '🇧🇷', japanese: '🇯🇵', korean: '🇰🇷', chinese: '🇨🇳',
  mandarin: '🇨🇳', arabic: '🇸🇦', russian: '🇷🇺', hindi: '🇮🇳',
  dutch: '🇳🇱', swedish: '🇸🇪', norwegian: '🇳🇴', polish: '🇵🇱',
  turkish: '🇹🇷', greek: '🇬🇷', hebrew: '🇮🇱', latin: '🏛️',
  english: '🇬🇧',  vietnamese: '🇻🇳', thai: '🇹🇭', indonesian: '🇮🇩',
}

function getLangEmoji(name: string): string {
  return LANG_EMOJI[name.trim().toLowerCase()] ?? '📖'
}

/**
 * Format how long until a card is next due.
 * Returns a short human-readable string for the cards list.
 */
function formatNextReview(ts: number): { label: string; isDue: boolean } {
  const now    = Date.now()
  const diffMs = ts - now

  if (diffMs <= 0) return { label: 'Due now', isDue: true }

  const diffDays = Math.ceil(diffMs / 86_400_000)
  if (diffDays === 1) return { label: 'Tomorrow', isDue: false }
  if (diffDays < 7)   return { label: `In ${diffDays}d`,  isDue: false }
  if (diffDays < 21)  return { label: `In ${Math.ceil(diffDays / 7)}w`,  isDue: false }
  return { label: 'Mastered', isDue: false }
}

/** Returns a CSS module class key for the stability dot indicator. */
function stabilityClass(
  card: VocabCard,
  css: Record<string, string>,
): string {
  if (card.consecutiveSuccesses === 0) return css.stabilityNew
  if (card.stabilityFactor < 0.3)      return css.stabilityLearning
  if (card.reviewIntervalDays >= 21)   return css.stabilityMastered
  return css.stabilityGood
}

/* ── Per-deck statistics ────────────────────────────────────── */
interface DeckStats {
  total:    number
  due:      number
  mastered: number
  avgEF:    number
  newCards: number
  learning: number
  good:     number
}

function computeStats(cards: VocabCard[]): DeckStats {
  const now = Date.now()
  let due = 0, mastered = 0, newCards = 0, learning = 0, good = 0, efSum = 0

  for (const c of cards) {
    if (c.nextReviewTimestamp <= now)  due++
    if (c.reviewIntervalDays >= 21)    mastered++
    if (c.consecutiveSuccesses === 0)  newCards++
    else if (c.stabilityFactor < 0.3)  learning++
    else if (c.reviewIntervalDays < 21) good++
    efSum += c.easeFactor
  }

  return {
    total:    cards.length,
    due,
    mastered,
    avgEF:    cards.length > 0 ? efSum / cards.length : 0,
    newCards,
    learning,
    good,
  }
}

/* ── Modal types ────────────────────────────────────────────── */
type ModalMode =
  | { kind: 'none' }
  | { kind: 'new-deck' }
  | { kind: 'add-card';  deckId: string }
  | { kind: 'edit-card'; card: VocabCard }

type DeckTab = 'study' | 'cards' | 'progress'

/* ════════════════════════════════════════════════════════════════
   Sub-components
   ════════════════════════════════════════════════════════════════ */

/* ── Deck modal (create new deck) ───────────────────────────── */
function NewDeckModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void
  onCreated: (deck: VocabDeck) => void
}) {
  const [lang, setLang]    = useState('')
  const [desc, setDesc]    = useState('')
  const [saving, setSaving] = useState(false)

  const canSave = lang.trim().length > 0 && !saving

  async function handleSubmit() {
    if (!canSave) return
    setSaving(true)
    const deck: VocabDeck = {
      id:           crypto.randomUUID(),
      languageName: lang.trim(),
      description:  desc.trim(),
      createdAt:    Date.now(),
    }
    await db.vocab_decks.add(deck)
    onCreated(deck)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSubmit()
  }

  return (
    <div className={styles.modalBackdrop} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} onKeyDown={onKeyDown}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>New Language Deck</span>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Language Name *</label>
            <input
              className={styles.fieldInput}
              placeholder="e.g. Spanish, Japanese, French…"
              value={lang}
              onChange={e => setLang(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Description</label>
            <input
              className={styles.fieldInput}
              placeholder="e.g. A1 core vocabulary, travel phrases…"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
            <span className={styles.fieldHint}>Optional — shown below the deck name in the list.</span>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.submitBtn} onClick={handleSubmit} disabled={!canSave}>
            Create Deck
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Card modal (add or edit a card) ────────────────────────── */
function CardModal({
  mode,
  onClose,
}: {
  mode:    { kind: 'add-card'; deckId: string } | { kind: 'edit-card'; card: VocabCard }
  onClose: () => void
}) {
  const editing = mode.kind === 'edit-card' ? mode.card : null

  const [foreign,   setForeign]   = useState(editing?.foreignWord        ?? '')
  const [native,    setNative]    = useState(editing?.nativeTranslation   ?? '')
  const [phonetic,  setPhonetic]  = useState(editing?.phoneticSpelling    ?? '')
  const [saving,    setSaving]    = useState(false)

  const { toast } = useToast()
  const canSave = foreign.trim().length > 0 && native.trim().length > 0 && !saving

  async function handleSubmit() {
    if (!canSave) return
    setSaving(true)

    if (editing) {
      await db.vocab_cards.update(editing.id, {
        foreignWord:       foreign.trim(),
        nativeTranslation: native.trim(),
        phoneticSpelling:  phonetic.trim(),
      })
      toast('Card updated.', 'success')
    } else {
      const deckId = (mode as { kind: 'add-card'; deckId: string }).deckId
      const card: VocabCard = {
        id:                    crypto.randomUUID(),
        deckId,
        foreignWord:           foreign.trim(),
        nativeTranslation:     native.trim(),
        phoneticSpelling:      phonetic.trim(),
        stabilityFactor:       0,
        easeFactor:            2.5,
        reviewIntervalDays:    1,
        consecutiveSuccesses:  0,
        nextReviewTimestamp:   0,   // 0 = immediately due
      }
      await db.vocab_cards.add(card)
      toast('Card added.', 'success')
    }

    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSubmit()
  }

  return (
    <div className={styles.modalBackdrop} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} onKeyDown={onKeyDown}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{editing ? 'Edit Card' : 'Add Card'}</span>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Foreign Word / Phrase *</label>
            <input
              className={styles.fieldInput}
              placeholder="The word in the target language"
              value={foreign}
              onChange={e => setForeign(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Native Translation *</label>
            <input
              className={styles.fieldInput}
              placeholder="The meaning in your language"
              value={native}
              onChange={e => setNative(e.target.value)}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Phonetic Spelling</label>
            <input
              className={styles.fieldInput}
              placeholder="IPA or romanization (optional)"
              value={phonetic}
              onChange={e => setPhonetic(e.target.value)}
            />
            <span className={styles.fieldHint}>Displayed on the card back. Leave empty if not needed.</span>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.submitBtn} onClick={handleSubmit} disabled={!canSave}>
            {editing ? 'Save Changes' : 'Add Card'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Cards tab ──────────────────────────────────────────────── */
function CardsTab({
  cards,
  deckId,
  onAddCard,
}: {
  cards:     VocabCard[]
  deckId:    string
  onAddCard: () => void
}) {
  const { toast } = useToast()
  const [editCard, setEditCard] = useState<VocabCard | null>(null)

  async function handleDelete(card: VocabCard) {
    await db.vocab_cards.delete(card.id)
    toast('Card deleted.', 'info')
  }

  return (
    <div className={styles.cardsTab}>
      <div className={styles.cardsToolbar}>
        <span className={styles.cardsCount}>
          {cards.length} {cards.length === 1 ? 'card' : 'cards'}
        </span>
        <button className={styles.addCardBtn} onClick={onAddCard}>
          + Add Card
        </button>
      </div>

      {cards.length === 0 ? (
        <div className={styles.emptyCards}>
          <span className={styles.emptyCardsGlyph}>◈</span>
          <p className={styles.emptyCardsText}>
            No cards yet. Add vocabulary entries to start building your deck.
          </p>
          <button className={styles.emptyCardsBtn} onClick={onAddCard}>
            Add First Card
          </button>
        </div>
      ) : (
        <div className={styles.cardsList}>
          {cards.map(card => {
            const { label: reviewLabel, isDue } = formatNextReview(card.nextReviewTimestamp)
            const dotClass = stabilityClass(card, styles)

            return (
              <div key={card.id} className={styles.cardRow}>
                <div className={styles.cardRowBody}>
                  <span className={styles.cardForeignWord}>{card.foreignWord}</span>
                  <span className={styles.cardTranslation}>{card.nativeTranslation}</span>
                  {card.phoneticSpelling && (
                    <span className={styles.cardPhonetic}>/{card.phoneticSpelling}/</span>
                  )}
                </div>

                <div className={styles.cardRowMeta}>
                  <span className={`${styles.stabilityDot} ${dotClass}`} title={`Stability: ${(card.stabilityFactor * 100).toFixed(0)}%`} />
                  <span className={`${styles.nextReviewLabel} ${isDue ? styles.nextReviewDue : ''}`}>
                    {reviewLabel}
                  </span>
                </div>

                <div className={styles.cardRowActions}>
                  <button
                    className={styles.cardActionBtn}
                    onClick={() => setEditCard(card)}
                    aria-label="Edit card"
                  >
                    Edit
                  </button>
                  <button
                    className={`${styles.cardActionBtn} ${styles.cardDeleteBtn}`}
                    onClick={() => void handleDelete(card)}
                    aria-label="Delete card"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editCard && (
        <CardModal
          mode={{ kind: 'edit-card', card: editCard }}
          onClose={() => setEditCard(null)}
        />
      )}
    </div>
  )
}

/* ── Progress tab ───────────────────────────────────────────── */
function ProgressTab({ cards }: { cards: VocabCard[] }) {
  const stats = useMemo(() => computeStats(cards), [cards])
  const total  = stats.total || 1   // guard against division by zero in bars

  const rows: { label: string; count: number; fillClass: string }[] = [
    { label: 'New',      count: stats.newCards, fillClass: styles.fillNew      },
    { label: 'Learning', count: stats.learning, fillClass: styles.fillLearning },
    { label: 'Good',     count: stats.good,     fillClass: styles.fillGood     },
    { label: 'Mastered', count: stats.mastered, fillClass: styles.fillMastered },
  ]

  return (
    <div className={styles.progressTab}>
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} anim-scale-in`} style={{ animationDelay: '0ms' }}>
          <span className={`${styles.statValue} ${styles.statValueAccent}`}>{stats.total}</span>
          <span className={styles.statLabel}>Total Cards</span>
        </div>
        <div className={`${styles.statCard} anim-scale-in`} style={{ animationDelay: '60ms' }}>
          <span className={`${styles.statValue} ${styles.statValueRose}`}>{stats.due}</span>
          <span className={styles.statLabel}>Due Today</span>
        </div>
        <div className={`${styles.statCard} anim-scale-in`} style={{ animationDelay: '120ms' }}>
          <span className={`${styles.statValue} ${styles.statValueGreen}`}>{stats.mastered}</span>
          <span className={styles.statLabel}>Mastered</span>
        </div>
        <div className={`${styles.statCard} anim-scale-in`} style={{ animationDelay: '180ms' }}>
          <span className={styles.statValue}>{stats.avgEF.toFixed(2)}</span>
          <span className={styles.statLabel}>Avg Ease Factor</span>
        </div>
      </div>

      {stats.total > 0 && (
        <div className={styles.distributionSection}>
          <p className={styles.distributionTitle}>Learning Distribution</p>
          {rows.map(({ label, count, fillClass }) => (
            <div key={label} className={styles.distributionRow}>
              <span className={styles.distributionLabel}>{label}</span>
              <div className={styles.distributionBar}>
                <div
                  className={`${styles.distributionFill} ${fillClass}`}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              </div>
              <span className={styles.distributionCount}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   VocabBuilderView — main view
   ════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════
   Outer wrapper — Language Builder vs English Vocabulary subtabs
   ════════════════════════════════════════════════════════════════ */

export default function VocabBuilderView() {
  const [mainTab, setMainTab] = useState<'language' | 'english'>('language')

  return (
    <div className={styles.outerWrap}>
      {/* ── Outer tab bar ──────────────────────────────────────── */}
      <div className={styles.outerTabBar}>
        <button
          className={`${styles.outerTab} ${mainTab === 'language' ? styles.outerTabActive : ''}`}
          onClick={() => setMainTab('language')}
        >
          🌐 Language Builder
        </button>
        <button
          className={`${styles.outerTab} ${mainTab === 'english' ? styles.outerTabActive : ''}`}
          onClick={() => setMainTab('english')}
        >
          ✦ English Vocabulary
        </button>
      </div>

      {/* ── Tab panels ─────────────────────────────────────────── */}
      <div className={mainTab === 'language' ? styles.outerPane : styles.outerPaneHidden}>
        <LanguageBuilderTab />
      </div>
      <div className={mainTab === 'english' ? styles.outerPane : styles.outerPaneHidden}>
        <EnglishVocabTab />
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Language Builder — existing spaced-repetition deck system
   ════════════════════════════════════════════════════════════════ */

function LanguageBuilderTab() {
  const { toast } = useToast()

  // ── Live IDB queries ─────────────────────────────────────────
  const decks    = useLiveQuery(() => db.vocab_decks.orderBy('createdAt').toArray()) ?? []
  const allCards = useLiveQuery(() => db.vocab_cards.toArray())                       ?? []

  // ── Per-deck statistics (memoized from allCards) ─────────────
  const deckStatsMap = useMemo(() => {
    const now  = Date.now()
    const map  = new Map<string, { total: number; due: number }>()
    for (const card of allCards) {
      const s = map.get(card.deckId) ?? { total: 0, due: 0 }
      s.total++
      if (card.nextReviewTimestamp <= now) s.due++
      map.set(card.deckId, s)
    }
    return map
  }, [allCards])

  // ── Selection & tab state ────────────────────────────────────
  const [selectedId,    setSelectedId]    = useState<string | null>(null)
  const [activeTab,     setActiveTab]     = useState<DeckTab>('study')
  const [modal,         setModal]         = useState<ModalMode>({ kind: 'none' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [sessionKey,    setSessionKey]    = useState(0)   // increment to restart session

  // Auto-select first deck when list is populated
  useEffect(() => {
    if (!selectedId && decks.length > 0) {
      setSelectedId(decks[0].id)
    }
  }, [decks, selectedId])

  // Dismiss delete confirmation if user clicks away
  useEffect(() => {
    if (!deleteConfirm) return
    function dismiss(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-delete-btn]')) {
        setDeleteConfirm(null)
      }
    }
    document.addEventListener('click', dismiss)
    return () => document.removeEventListener('click', dismiss)
  }, [deleteConfirm])

  // ── Deck operations ──────────────────────────────────────────
  const handleDeleteDeck = useCallback(async (deckId: string) => {
    if (deleteConfirm !== deckId) {
      setDeleteConfirm(deckId)
      return
    }
    setDeleteConfirm(null)
    await db.transaction('rw', [db.vocab_decks, db.vocab_cards], async () => {
      await db.vocab_cards.where('deckId').equals(deckId).delete()
      await db.vocab_decks.delete(deckId)
    })
    if (selectedId === deckId) setSelectedId(null)
    toast('Deck deleted.', 'info')
  }, [deleteConfirm, selectedId, toast])

  // ── Derived state ────────────────────────────────────────────
  const selectedDeck  = decks.find(d => d.id === selectedId) ?? null
  const selectedCards = useMemo(
    () => (selectedId ? allCards.filter(c => c.deckId === selectedId) : []),
    [allCards, selectedId],
  )

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className={styles.wrapper}>
      <ZenHeading
        eyebrow="Scholastic · Language Lab"
        title="Polyglot Vault."
        subtitle="Build vocabulary decks and let spaced repetition surface the right cards at the right time."
        size="md"
      />

      <div className={styles.layout}>

        {/* ── Left: Deck list ───────────────────────────────── */}
        <aside className={styles.deckPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>My Decks</span>
            <button
              className={styles.newDeckBtn}
              onClick={() => setModal({ kind: 'new-deck' })}
            >
              + New Deck
            </button>
          </div>

          <div className={styles.deckList}>
            {decks.length === 0 ? (
              <div className={styles.noDecks}>
                <span className={styles.noDeckGlyph}>◈</span>
                <p className={styles.noDeckText}>
                  No decks yet. Create one to begin studying a new language.
                </p>
              </div>
            ) : (
              decks.map(deck => {
                const s   = deckStatsMap.get(deck.id) ?? { total: 0, due: 0 }
                const isActive = deck.id === selectedId

                return (
                  <div
                    key={deck.id}
                    className={`${styles.deckItem} ${isActive ? styles.deckItemActive : ''}`}
                    onClick={() => {
                      setSelectedId(deck.id)
                      setActiveTab('study')
                      setSessionKey(k => k + 1)
                    }}
                  >
                    <span className={styles.deckEmoji}>{getLangEmoji(deck.languageName)}</span>
                    <div className={styles.deckInfo}>
                      <span className={styles.deckLang}>{deck.languageName}</span>
                      <div className={styles.deckMetaRow}>
                        <span className={styles.deckStatChip}>{s.total} cards</span>
                        {s.due > 0 && (
                          <span className={`${styles.deckStatChip} ${styles.deckStatChipDue}`}>
                            {s.due} due
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* ── Right: Content panel ──────────────────────────── */}
        <section className={styles.contentPanel}>
          {!selectedDeck ? (
            <div className={styles.selectPrompt}>
              <span className={styles.selectPromptGlyph}>◇</span>
              <p className={styles.selectPromptText}>
                {decks.length === 0
                  ? '[ CREATE A DECK TO BEGIN ]'
                  : '[ SELECT A DECK TO STUDY ]'}
              </p>
            </div>
          ) : (
            <>
              {/* Deck header */}
              <div className={styles.contentHeader}>
                <span className={styles.contentLangEmoji}>{getLangEmoji(selectedDeck.languageName)}</span>
                <span className={styles.contentLangName}>{selectedDeck.languageName}</span>
                {selectedDeck.description && (
                  <span className={styles.contentDesc}>{selectedDeck.description}</span>
                )}
                <div className={styles.headerActions}>
                  <button
                    data-delete-btn=""
                    className={`${styles.deleteDeckBtn} ${
                      deleteConfirm === selectedDeck.id ? styles.deleteDeckBtnConfirm : ''
                    }`}
                    onClick={() => void handleDeleteDeck(selectedDeck.id)}
                  >
                    {deleteConfirm === selectedDeck.id ? '⚠ Confirm Delete' : 'Delete Deck'}
                  </button>
                </div>
              </div>

              {/* Tab bar */}
              <div className={styles.tabBar}>
                {(['study', 'cards', 'progress'] as DeckTab[]).map(tab => (
                  <button
                    key={tab}
                    className={`${styles.tabItem} ${activeTab === tab ? styles.tabItemActive : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'study'    ? 'Study'    :
                     tab === 'cards'    ? 'Cards'    :
                     'Progress'}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className={styles.tabContent}>
                {activeTab === 'study' && (
                  <VocabStudySession
                    key={`${selectedDeck.id}-${sessionKey}`}
                    deckId={selectedDeck.id}
                    languageName={selectedDeck.languageName}
                    onRestart={() => setSessionKey(k => k + 1)}
                  />
                )}

                {activeTab === 'cards' && (
                  <CardsTab
                    cards={selectedCards}
                    deckId={selectedDeck.id}
                    onAddCard={() => setModal({ kind: 'add-card', deckId: selectedDeck.id })}
                  />
                )}

                {activeTab === 'progress' && (
                  <ProgressTab cards={selectedCards} />
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      {modal.kind === 'new-deck' && (
        <NewDeckModal
          onClose={() => setModal({ kind: 'none' })}
          onCreated={deck => {
            setSelectedId(deck.id)
            setActiveTab('cards')
          }}
        />
      )}

      {(modal.kind === 'add-card' || modal.kind === 'edit-card') && (
        <CardModal
          mode={modal as { kind: 'add-card'; deckId: string } | { kind: 'edit-card'; card: VocabCard }}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}
    </div>
  )
}
