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

  /* ── Expanded lexicon · A ──────────────────────────────────── */
  { word: 'Abase',           definition: 'To behave in a way that belittles or degrades someone' },
  { word: 'Aberrant',        definition: 'Departing from an accepted standard; deviating from the norm' },
  { word: 'Abeyance',        definition: 'A state of temporary disuse or suspension' },
  { word: 'Abjure',          definition: 'To solemnly renounce a belief, cause, or claim' },
  { word: 'Abnegation',      definition: 'The denial or renunciation of one\'s own interests' },
  { word: 'Abrogate',        definition: 'To repeal or do away with a law, right, or formal agreement' },
  { word: 'Abscond',         definition: 'To leave hurriedly and secretly, typically to avoid detection' },
  { word: 'Abstemious',      definition: 'Not self-indulgent, especially when eating and drinking' },
  { word: 'Accede',          definition: 'To agree to a demand, request, or treaty; to assume an office' },
  { word: 'Accolade',        definition: 'An award or expression of praise' },
  { word: 'Accretion',       definition: 'Growth or increase by gradual accumulation' },
  { word: 'Acerbic',         definition: 'Sharp and forthright in speech or tone' },
  { word: 'Acumen',          definition: 'The ability to make good judgements and quick decisions' },
  { word: 'Adamant',         definition: 'Refusing to be persuaded or to change one\'s mind' },
  { word: 'Admonish',        definition: 'To warn or reprimand someone firmly' },
  { word: 'Adroit',          definition: 'Clever or skilful in using the hands or mind' },
  { word: 'Adulterate',      definition: 'To render something poorer in quality by adding another substance' },
  { word: 'Adventitious',    definition: 'Coming from outside; not inherent; accidental' },
  { word: 'Affable',         definition: 'Friendly, good-natured, and easy to talk to' },
  { word: 'Affectation',     definition: 'Behaviour or speech that is artificial and designed to impress' },
  { word: 'Aggrandize',      definition: 'To increase the power, status, or wealth of' },
  { word: 'Alchemy',         definition: 'A seemingly magical process of transformation or combination' },
  { word: 'Allay',           definition: 'To diminish or put at rest a fear, suspicion, or worry' },
  { word: 'Alloy',           definition: 'To debase by mixing with something inferior; a mixture of metals' },
  { word: 'Amalgamate',      definition: 'To combine or unite to form one organization or structure' },
  { word: 'Amenable',        definition: 'Open and responsive to suggestion; easily persuaded' },
  { word: 'Amorphous',       definition: 'Without a clearly defined shape or form' },
  { word: 'Anathema',        definition: 'Something or someone intensely disliked or loathed' },
  { word: 'Ancillary',       definition: 'Providing necessary support to the primary activity; subordinate' },
  { word: 'Anomalous',       definition: 'Deviating from what is standard, normal, or expected' },
  { word: 'Antediluvian',    definition: 'Of or belonging to the time before the biblical Flood; very old' },
  { word: 'Antithetical',    definition: 'Directly opposed or contrasted; mutually incompatible' },
  { word: 'Aphorism',        definition: 'A pithy observation containing a general truth' },
  { word: 'Aplomb',          definition: 'Self-confidence or assurance, especially in a demanding situation' },
  { word: 'Apostate',        definition: 'A person who renounces a religious or political belief' },
  { word: 'Apposite',        definition: 'Apt in the circumstances or in relation to something' },
  { word: 'Apprise',         definition: 'To inform or tell someone' },
  { word: 'Arabesque',       definition: 'An ornate design of intertwined flowing lines' },
  { word: 'Archetype',       definition: 'A very typical example; an original model after which others are patterned' },
  { word: 'Arrant',          definition: 'Complete; utter (usually describing something bad)' },
  { word: 'Arrogate',        definition: 'To take or claim something for oneself without justification' },
  { word: 'Artifice',        definition: 'Clever or cunning devices used to trick or deceive' },
  { word: 'Ascetic',         definition: 'Characterized by severe self-discipline and abstention from indulgence' },
  { word: 'Ascribe',         definition: 'To attribute something to a cause, source, or author' },
  { word: 'Aspersion',       definition: 'An attack on the reputation or integrity of someone' },
  { word: 'Assail',          definition: 'To make a concerted or violent attack on' },
  { word: 'Assuage',         definition: 'To make an unpleasant feeling less intense; to soothe' },
  { word: 'Astringent',      definition: 'Sharp or severe in manner or style; causing contraction of tissues' },
  { word: 'Atrophy',         definition: 'To gradually decline or waste away through disuse' },
  { word: 'Audacious',       definition: 'Showing a willingness to take bold risks; impudent' },
  { word: 'Augment',         definition: 'To make something greater by adding to it' },
  { word: 'Auspicious',      definition: 'Conducive to success; favourable' },
  { word: 'Austerity',       definition: 'Sternness or severity of manner; extreme plainness' },
  { word: 'Autonomy',        definition: 'The right or condition of self-government; independence' },
  { word: 'Avaricious',      definition: 'Having or showing an extreme greed for wealth' },
  { word: 'Aver',            definition: 'To state or assert to be the case' },
  { word: 'Avuncular',       definition: 'Kind and friendly toward a younger or less experienced person' },

  /* ── Expanded lexicon · B ──────────────────────────────────── */
  { word: 'Baleful',         definition: 'Threatening harm; menacing' },
  { word: 'Banality',        definition: 'The fact or condition of being unoriginal and boring' },
  { word: 'Bedizen',         definition: 'To dress or decorate gaudily' },
  { word: 'Beguile',         definition: 'To charm or enchant, sometimes deceptively' },
  { word: 'Beleaguer',       definition: 'To beset with difficulties; to surround with troops' },
  { word: 'Bellicose',       definition: 'Demonstrating aggression and willingness to fight' },
  { word: 'Benighted',       definition: 'In a state of ignorance; intellectually or morally backward' },
  { word: 'Benevolent',      definition: 'Well meaning and kindly' },
  { word: 'Bequeath',        definition: 'To leave property to a person by a will; to hand down' },
  { word: 'Berate',          definition: 'To scold or criticize angrily' },
  { word: 'Beseech',         definition: 'To ask someone urgently and fervently to do something' },
  { word: 'Bilious',         definition: 'Spiteful or bad-tempered; affected by nausea' },
  { word: 'Blandishment',    definition: 'A flattering or pleasing statement used to persuade' },
  { word: 'Blasé',           definition: 'Unimpressed or indifferent due to overfamiliarity' },
  { word: 'Blithe',          definition: 'Showing a casual and cheerful indifference' },
  { word: 'Bombastic',       definition: 'High-sounding but with little meaning; inflated' },
  { word: 'Bovine',          definition: 'Sluggish, stolid, or dull, like an ox or cow' },
  { word: 'Brazen',          definition: 'Bold and without shame' },
  { word: 'Broach',          definition: 'To raise a sensitive subject for discussion' },
  { word: 'Bromide',         definition: 'A trite and unoriginal idea or remark, intended to soothe' },
  { word: 'Brook',           definition: 'To tolerate or allow (usually used in the negative)' },
  { word: 'Bucolic',         definition: 'Relating to the pleasant aspects of the countryside' },
  { word: 'Burgeon',         definition: 'To begin to grow or increase rapidly; to flourish' },
  { word: 'Burnish',         definition: 'To polish by rubbing; to enhance or perfect' },
  { word: 'Buttress',        definition: 'To increase the strength of or justify; a support structure' },

  /* ── Expanded lexicon · C ──────────────────────────────────── */
  { word: 'Cacophony',       definition: 'A harsh, discordant mixture of sounds' },
  { word: 'Cadge',           definition: 'To ask for or obtain something to which one is not strictly entitled' },
  { word: 'Cajole',          definition: 'To persuade someone by sustained coaxing or flattery' },
  { word: 'Callous',         definition: 'Showing an insensitive and cruel disregard for others' },
  { word: 'Canard',          definition: 'An unfounded rumour or story' },
  { word: 'Candor',          definition: 'The quality of being open and honest; frankness' },
  { word: 'Canon',           definition: 'A general law, rule, or body of accepted principles' },
  { word: 'Cant',            definition: 'Hypocritical and sanctimonious talk; jargon of a group' },
  { word: 'Capacious',       definition: 'Having a lot of space inside; roomy' },
  { word: 'Capitulate',      definition: 'To cease to resist an opponent or demand; to surrender' },
  { word: 'Capricious',      definition: 'Given to sudden and unaccountable changes of mood or behaviour' },
  { word: 'Cardinal',        definition: 'Of the greatest importance; fundamental' },
  { word: 'Castigate',       definition: 'To reprimand or criticize someone severely' },
  { word: 'Cavil',           definition: 'To make petty or unnecessary objections' },
  { word: 'Censorious',      definition: 'Severely critical of others' },
  { word: 'Censure',         definition: 'To express severe disapproval, often formally' },
  { word: 'Chary',           definition: 'Cautiously or suspiciously reluctant to do something' },
  { word: 'Chasten',         definition: 'To have a restraining or moderating effect on; to subdue' },
  { word: 'Chimerical',      definition: 'Hoped for but illusory or impossible to achieve; fanciful' },
  { word: 'Choleric',        definition: 'Bad-tempered or irritable' },
  { word: 'Churlish',        definition: 'Rude in a mean-spirited and surly way' },
  { word: 'Circuitous',      definition: 'Longer than the most direct way; roundabout' },
  { word: 'Circumlocution',  definition: 'The use of many words where fewer would do; evasive speech' },
  { word: 'Circumscribe',    definition: 'To restrict something within limits; to confine' },
  { word: 'Circumspect',     definition: 'Wary and unwilling to take risks; prudent' },
  { word: 'Clandestine',     definition: 'Kept secret or done secretively' },
  { word: 'Cloying',         definition: 'Disgusting or distasteful through excess; sickly sweet' },
  { word: 'Coalesce',        definition: 'To come together to form one mass or whole' },
  { word: 'Coda',            definition: 'A concluding section or event; the final part of something' },
  { word: 'Coalition',       definition: 'A temporary alliance for combined action' },
  { word: 'Coerce',          definition: 'To persuade an unwilling person by using force or threats' },
  { word: 'Cogitate',        definition: 'To think deeply about something; to meditate or reflect' },
  { word: 'Cognizant',       definition: 'Having knowledge or awareness' },
  { word: 'Commensurate',    definition: 'Corresponding in size or degree; in proportion' },
  { word: 'Compendium',      definition: 'A collection of concise but detailed information' },
  { word: 'Compunction',     definition: 'A feeling of guilt or moral scruple that prevents wrongdoing' },
  { word: 'Conciliatory',    definition: 'Intended to placate or pacify' },
  { word: 'Conflagration',   definition: 'An extensive and destructive fire' },
  { word: 'Confluence',      definition: 'The junction of two rivers; an act of merging' },
  { word: 'Congenial',       definition: 'Pleasant because of qualities similar to one\'s own; agreeable' },
  { word: 'Conjecture',      definition: 'An opinion formed on the basis of incomplete information' },
  { word: 'Connoisseur',     definition: 'An expert judge in matters of taste' },
  { word: 'Consecrate',      definition: 'To make or declare sacred; to dedicate formally' },
  { word: 'Consummate',      definition: 'Showing great skill and flair; complete or perfect' },
  { word: 'Contentious',     definition: 'Causing or likely to cause an argument; controversial' },
  { word: 'Contiguous',      definition: 'Sharing a common border; touching; adjacent' },
  { word: 'Contumacious',    definition: 'Stubbornly disobedient to authority' },
  { word: 'Conundrum',       definition: 'A confusing and difficult problem or question' },
  { word: 'Conviviality',    definition: 'The quality of being friendly and lively; festivity' },
  { word: 'Copious',         definition: 'Abundant in supply or quantity' },
  { word: 'Coquette',        definition: 'A woman who flirts; one who trifles with affections' },
  { word: 'Cornucopia',      definition: 'An abundant supply of good things' },
  { word: 'Cosmopolitan',    definition: 'Familiar with and at ease in many cultures; worldly' },
  { word: 'Coterie',         definition: 'A small, exclusive group of people with shared interests' },
  { word: 'Countenance',     definition: 'To admit as acceptable or possible; a person\'s face or expression' },
  { word: 'Covenant',        definition: 'A solemn agreement or binding promise' },
  { word: 'Covert',          definition: 'Not openly acknowledged or displayed; secret' },
  { word: 'Crapulous',       definition: 'Relating to or arising from excessive eating or drinking' },
  { word: 'Craven',          definition: 'Contemptibly lacking in courage; cowardly' },
  { word: 'Credulous',       definition: 'Having too great a readiness to believe things' },
  { word: 'Crepuscular',     definition: 'Resembling or relating to twilight; dim' },
  { word: 'Cryptic',         definition: 'Having a meaning that is mysterious or obscure' },
  { word: 'Culpable',        definition: 'Deserving blame' },
  { word: 'Cursory',         definition: 'Hasty and therefore not thorough or detailed' },
  { word: 'Curtail',         definition: 'To reduce in extent or quantity; to impose a restriction on' },

  /* ── Expanded lexicon · D ──────────────────────────────────── */
  { word: 'Dalliance',       definition: 'A casual romantic or sexual relationship; a brief involvement' },
  { word: 'Dauntless',       definition: 'Showing fearlessness and determination' },
  { word: 'Debase',          definition: 'To reduce in quality or value; to degrade' },
  { word: 'Debilitate',      definition: 'To make weak or infirm' },
  { word: 'Decorous',        definition: 'In keeping with good taste and propriety; polite and restrained' },
  { word: 'Decry',           definition: 'To publicly denounce; to express strong disapproval of' },
  { word: 'Deference',       definition: 'Humble submission and respect' },
  { word: 'Defile',          definition: 'To damage the purity or appearance of; to desecrate' },
  { word: 'Deft',            definition: 'Neatly skilful and quick in one\'s movements or actions' },
  { word: 'Deign',           definition: 'To do something that one considers beneath one\'s dignity' },
  { word: 'Delineate',       definition: 'To describe or portray something precisely; to indicate by outlining' },
  { word: 'Demur',           definition: 'To raise objections or show reluctance' },
  { word: 'Denigrate',       definition: 'To criticize unfairly; to disparage' },
  { word: 'Deprecate',       definition: 'To express disapproval of; to belittle' },
  { word: 'Deride',          definition: 'To express contempt for; to ridicule' },
  { word: 'Derivative',      definition: 'Imitative of the work of another; unoriginal' },
  { word: 'Desiccate',       definition: 'To remove the moisture from; to dry out thoroughly' },
  { word: 'Desultory',       definition: 'Lacking a plan, purpose, or enthusiasm; aimless' },
  { word: 'Diaphanous',      definition: 'Light, delicate, and translucent' },
  { word: 'Dichotomy',       definition: 'A division or contrast between two things represented as opposed' },
  { word: 'Diffuse',         definition: 'Spread out over a large area; lacking conciseness' },
  { word: 'Dilatory',        definition: 'Slow to act; intended to cause delay' },
  { word: 'Diminution',      definition: 'A reduction in the size, extent, or importance of something' },
  { word: 'Dirge',           definition: 'A lament for the dead; a mournful song' },
  { word: 'Disabuse',        definition: 'To persuade someone that an idea or belief is mistaken' },
  { word: 'Discern',         definition: 'To perceive or recognize something with difficulty' },
  { word: 'Disconcert',      definition: 'To disturb the composure of; to unsettle' },
  { word: 'Discordant',      definition: 'Disagreeing or incongruous; harsh-sounding' },
  { word: 'Discrete',        definition: 'Individually separate and distinct' },
  { word: 'Disingenuous',    definition: 'Not candid or sincere; pretending one knows less than one does' },
  { word: 'Disparage',       definition: 'To regard or represent as being of little worth' },
  { word: 'Disparate',       definition: 'Essentially different in kind; not allowing comparison' },
  { word: 'Dissemble',       definition: 'To conceal one\'s true motives or feelings by pretence' },
  { word: 'Disseminate',     definition: 'To spread or disperse something widely' },
  { word: 'Dissipate',       definition: 'To squander; to disperse or scatter' },
  { word: 'Dissolution',     definition: 'The closing down of an assembly; debauched living; disintegration' },
  { word: 'Dissuade',        definition: 'To persuade someone not to take a course of action' },
  { word: 'Distend',         definition: 'To swell or cause to swell by pressure from inside' },
  { word: 'Diurnal',         definition: 'Of or during the daytime; daily' },
  { word: 'Divergent',       definition: 'Tending to be different or develop in different directions' },
  { word: 'Divest',          definition: 'To deprive someone of power or rights; to rid oneself of' },
  { word: 'Doctrinaire',     definition: 'Seeking to impose a theory with little regard to practicality' },
  { word: 'Dolorous',        definition: 'Feeling or expressing great sorrow or distress' },
  { word: 'Dour',            definition: 'Relentlessly severe, stern, or gloomy in manner' },
  { word: 'Dross',           definition: 'Something regarded as worthless; rubbish' },
  { word: 'Dubious',         definition: 'Hesitating or doubting; not to be relied upon' },
  { word: 'Ductile',         definition: 'Able to be deformed without losing toughness; pliable; easily influenced' },
  { word: 'Dulcet',          definition: 'Sweet and soothing, especially to the ear' },
  { word: 'Duplicity',       definition: 'Deceitfulness; double-dealing' },

  /* ── Expanded lexicon · E ──────────────────────────────────── */
  { word: 'Ebullience',      definition: 'The quality of being cheerful and full of energy' },
  { word: 'Eclectic',        definition: 'Deriving ideas or style from a broad and diverse range of sources' },
  { word: 'Edify',           definition: 'To instruct or improve someone morally or intellectually' },
  { word: 'Efface',          definition: 'To erase from a surface; to make oneself inconspicuous' },
  { word: 'Effervescent',    definition: 'Vivacious and enthusiastic; giving off bubbles' },
  { word: 'Effete',          definition: 'Affected, overrefined, and ineffectual; no longer productive' },
  { word: 'Effrontery',      definition: 'Insolent or impertinent behaviour; audacity' },
  { word: 'Elicit',          definition: 'To draw out a response, answer, or fact from someone' },
  { word: 'Elucidate',       definition: 'To make something clear; to explain' },
  { word: 'Emaciate',        definition: 'To make abnormally thin or weak through lack of nourishment' },
  { word: 'Embellish',       definition: 'To make more attractive by adding decorative detail; to exaggerate' },
  { word: 'Emend',           definition: 'To make corrections and improvements to a text' },
  { word: 'Eminent',         definition: 'Famous and respected within a particular sphere; notable' },
  { word: 'Emolument',       definition: 'A salary, fee, or profit from employment or office' },
  { word: 'Empyrean',        definition: 'Relating to heaven or the sky; the highest reaches of something' },
  { word: 'Encomium',        definition: 'A speech or piece of writing that praises someone highly' },
  { word: 'Endemic',         definition: 'Regularly found among particular people or in a certain area' },
  { word: 'Engender',        definition: 'To cause or give rise to a feeling, situation, or condition' },
  { word: 'Enigmatic',       definition: 'Difficult to interpret or understand; mysterious' },
  { word: 'Ennui',           definition: 'A feeling of listlessness and dissatisfaction from lack of occupation' },
  { word: 'Ephemera',        definition: 'Things that exist or are used only for a short time' },
  { word: 'Epicure',         definition: 'A person who takes particular pleasure in fine food and drink' },
  { word: 'Epigram',         definition: 'A pithy saying or remark expressing an idea cleverly' },
  { word: 'Epitome',         definition: 'A perfect example of a quality or type' },
  { word: 'Equanimity',      definition: 'Mental calmness and composure, especially in a difficult situation' },
  { word: 'Equipoise',       definition: 'A balance of forces or interests; equilibrium' },
  { word: 'Eradicate',       definition: 'To destroy completely; to put an end to' },
  { word: 'Erudite',         definition: 'Having or showing great knowledge or learning' },
  { word: 'Eschew',          definition: 'To deliberately avoid using; to abstain from' },
  { word: 'Espouse',         definition: 'To adopt or support a cause, belief, or way of life' },
  { word: 'Ethereal',        definition: 'Extremely delicate and light; heavenly or spiritual' },
  { word: 'Etiolate',        definition: 'To make pale through lack of light; to deprive of vigour' },
  { word: 'Eulogy',          definition: 'A speech or piece of writing that praises someone highly, often the dead' },
  { word: 'Euphony',         definition: 'The quality of being pleasing to the ear' },
  { word: 'Evanescent',      definition: 'Soon passing out of sight, memory, or existence; fleeting' },
  { word: 'Evince',          definition: 'To reveal the presence of a quality or feeling; to indicate' },
  { word: 'Exacting',        definition: 'Making great demands on one\'s skill, attention, or effort' },
  { word: 'Exculpate',       definition: 'To show or declare that someone is not guilty of wrongdoing' },
  { word: 'Execrable',       definition: 'Extremely bad or unpleasant; abhorrent' },
  { word: 'Exhort',          definition: 'To strongly encourage or urge someone to do something' },
  { word: 'Exonerate',       definition: 'To absolve someone from blame for a fault or wrongdoing' },
  { word: 'Expedient',       definition: 'Convenient and practical though possibly improper or immoral' },
  { word: 'Expostulate',     definition: 'To express strong disapproval or disagreement; to reason earnestly' },
  { word: 'Expunge',         definition: 'To erase or remove completely' },
  { word: 'Extant',          definition: 'Still in existence; surviving' },
  { word: 'Extemporaneous',  definition: 'Spoken or done without preparation; impromptu' },
  { word: 'Extol',           definition: 'To praise enthusiastically' },
  { word: 'Extraneous',      definition: 'Irrelevant or unrelated to the subject being dealt with' },
  { word: 'Extricate',       definition: 'To free from a constraint or difficulty' },
  { word: 'Exuberant',       definition: 'Filled with or characterized by lively energy and excitement' },

  /* ── Expanded lexicon · F ──────────────────────────────────── */
  { word: 'Facetious',       definition: 'Treating serious issues with deliberately inappropriate humour' },
  { word: 'Facile',          definition: 'Appearing neat and comprehensive only by ignoring complexities; effortless' },
  { word: 'Fallacious',      definition: 'Based on a mistaken belief; misleading or unsound' },
  { word: 'Fastidiousness',  definition: 'Excessive concern with detail, accuracy, or cleanliness' },
  { word: 'Fatalism',        definition: 'The belief that all events are predetermined and inevitable' },
  { word: 'Fawn',            definition: 'To give a servile display of exaggerated flattery or affection' },
  { word: 'Felicitous',      definition: 'Well chosen or suited to the circumstances; pleasing' },
  { word: 'Fervent',         definition: 'Having or displaying passionate intensity' },
  { word: 'Fetid',           definition: 'Smelling extremely unpleasant' },
  { word: 'Fetter',          definition: 'To restrain with chains; to confine or restrict' },
  { word: 'Fickle',          definition: 'Changing frequently, especially in loyalties or affection' },
  { word: 'Fidelity',        definition: 'Faithfulness; the degree of exactness in reproduction' },
  { word: 'Filibuster',      definition: 'A prolonged speech that obstructs progress in a legislature' },
  { word: 'Flaccid',         definition: 'Soft and limp; lacking vigour or force' },
  { word: 'Florid',          definition: 'Excessively intricate or elaborate; having a red complexion' },
  { word: 'Flout',           definition: 'To openly disregard a rule, law, or convention' },
  { word: 'Foible',          definition: 'A minor weakness or eccentricity in someone\'s character' },
  { word: 'Foment',          definition: 'To instigate or stir up an undesirable sentiment or action' },
  { word: 'Forbearance',     definition: 'Patient self-control; restraint and tolerance' },
  { word: 'Forestall',       definition: 'To prevent or obstruct by taking action ahead of time' },
  { word: 'Forlorn',         definition: 'Pitifully sad and abandoned or lonely' },
  { word: 'Fortuitous',      definition: 'Happening by chance, often fortunate' },
  { word: 'Founder',         definition: 'To fail or come to nothing; to fill with water and sink' },
  { word: 'Fractious',       definition: 'Irritable and quarrelsome; unruly' },
  { word: 'Fraught',         definition: 'Filled with or destined to result in something undesirable; anxious' },
  { word: 'Frenetic',        definition: 'Fast and energetic in a rather wild and uncontrolled way' },
  { word: 'Frugal',          definition: 'Sparing or economical with regard to money or food' },
  { word: 'Fulminate',       definition: 'To express vehement protest; to explode violently' },
  { word: 'Fulsome',         definition: 'Complimentary to an excessive or insincere degree' },

  /* ── Expanded lexicon · G ──────────────────────────────────── */
  { word: 'Gainsay',         definition: 'To deny or contradict; to speak against' },
  { word: 'Gambol',          definition: 'To run or jump about playfully' },
  { word: 'Garner',          definition: 'To gather or collect something, especially information or approval' },
  { word: 'Genial',          definition: 'Friendly and cheerful' },
  { word: 'Germane',         definition: 'Relevant to a subject under consideration' },
  { word: 'Glower',          definition: 'To have an angry or sullen look on one\'s face; to scowl' },
  { word: 'Goad',            definition: 'To provoke or annoy someone so as to stimulate action' },
  { word: 'Gossamer',        definition: 'A fine, filmy substance; something light, thin, and insubstantial' },
  { word: 'Gratuitous',      definition: 'Uncalled for; lacking good reason; given free of charge' },
  { word: 'Gregarious',      definition: 'Fond of company; sociable' },
  { word: 'Grovel',          definition: 'To act in an obsequious manner to obtain forgiveness or favour' },
  { word: 'Guile',           definition: 'Sly or cunning intelligence' },
  { word: 'Gumption',        definition: 'Shrewd or spirited initiative and resourcefulness' },

  /* ── Expanded lexicon · H ──────────────────────────────────── */
  { word: 'Habituate',       definition: 'To make or become accustomed to something' },
  { word: 'Hackneyed',       definition: 'Lacking significance through having been overused; unoriginal' },
  { word: 'Halcyon',         definition: 'Denoting a period of time that was idyllically happy and peaceful' },
  { word: 'Harangue',        definition: 'A lengthy and aggressive speech' },
  { word: 'Harbinger',       definition: 'A person or thing that announces or signals the approach of another' },
  { word: 'Haughty',         definition: 'Arrogantly superior and disdainful' },
  { word: 'Hedonism',        definition: 'The pursuit of pleasure as the most important goal' },
  { word: 'Heterodox',       definition: 'Not conforming with accepted standards or beliefs' },
  { word: 'Hidebound',       definition: 'Unwilling to change because of attachment to tradition' },
  { word: 'Hoary',           definition: 'Greyish white with age; old and trite' },
  { word: 'Homily',          definition: 'A tedious moralizing lecture or talk' },
  { word: 'Hortatory',       definition: 'Tending or aiming to exhort; strongly encouraging' },

  /* ── Expanded lexicon · I ──────────────────────────────────── */
  { word: 'Idiosyncrasy',    definition: 'A distinctive or peculiar feature of an individual' },
  { word: 'Idolatry',        definition: 'Extreme admiration, love, or reverence for something or someone' },
  { word: 'Ignominious',     definition: 'Deserving or causing public disgrace or shame' },
  { word: 'Illicit',         definition: 'Forbidden by law, rules, or custom' },
  { word: 'Illusory',        definition: 'Based on illusion; not real' },
  { word: 'Imbroglio',       definition: 'An extremely confused, complicated, or embarrassing situation' },
  { word: 'Imbue',           definition: 'To inspire or permeate with a feeling or quality' },
  { word: 'Immaculate',      definition: 'Perfectly clean, neat, or tidy; free from flaws' },
  { word: 'Imminent',        definition: 'About to happen' },
  { word: 'Immure',          definition: 'To enclose or confine against one\'s will' },
  { word: 'Impassive',       definition: 'Not feeling or showing emotion' },
  { word: 'Impede',          definition: 'To delay or prevent by obstructing; to hinder' },
  { word: 'Imperious',       definition: 'Assuming power or authority without justification; arrogant' },
  { word: 'Impervious',      definition: 'Not allowing passage through; unable to be affected by' },
  { word: 'Impetuous',       definition: 'Acting or done quickly and without thought or care' },
  { word: 'Implacable',      definition: 'Unable to be appeased or placated; relentless' },
  { word: 'Implicit',        definition: 'Implied though not plainly expressed; unquestioning' },
  { word: 'Importune',       definition: 'To ask someone pressingly and persistently for something' },
  { word: 'Imprecation',     definition: 'A spoken curse' },
  { word: 'Impromptu',       definition: 'Done without being planned or rehearsed' },
  { word: 'Improvident',     definition: 'Not having or showing foresight; spendthrift' },
  { word: 'Impudent',        definition: 'Not showing due respect; bold and disrespectful' },
  { word: 'Inadvertent',     definition: 'Not resulting from or achieved through deliberate planning' },
  { word: 'Inane',           definition: 'Silly; stupid; lacking sense or meaning' },
  { word: 'Incandescent',    definition: 'Full of strong emotion; emitting light from being heated' },
  { word: 'Incarnadine',     definition: 'Of a bright crimson or pinkish colour; to make blood-red' },
  { word: 'Incendiary',      definition: 'Tending to stir up conflict; capable of causing fire' },
  { word: 'Inchoative',      definition: 'Denoting the beginning of an action or state; incipient' },
  { word: 'Incipient',       definition: 'In an initial stage; beginning to happen or develop' },
  { word: 'Incisive',        definition: 'Intelligently analytical and clear-thinking; sharp' },
  { word: 'Incommodious',    definition: 'Not affording enough space; inconvenient' },
  { word: 'Incongruous',     definition: 'Not in harmony or keeping with the surroundings' },
  { word: 'Incontrovertible',definition: 'Not able to be denied or disputed' },
  { word: 'Incorrigible',    definition: 'Not able to be corrected, improved, or reformed' },
  { word: 'Increment',       definition: 'An increase or addition, especially one of a series' },
  { word: 'Inculcate',       definition: 'To instil an idea or habit by persistent instruction' },
  { word: 'Indefatigable',   definition: 'Persisting tirelessly' },
  { word: 'Indelible',       definition: 'Making marks that cannot be removed; unforgettable' },
  { word: 'Indigent',        definition: 'Poor; needy' },
  { word: 'Indolent',        definition: 'Wanting to avoid activity or exertion; lazy' },
  { word: 'Indomitable',     definition: 'Impossible to subdue or defeat' },
  { word: 'Ineffable',       definition: 'Too great or extreme to be expressed in words' },
  { word: 'Ineluctable',     definition: 'Unable to be resisted or avoided; inescapable' },
  { word: 'Inept',           definition: 'Having or showing no skill; clumsy' },
  { word: 'Inert',           definition: 'Lacking the ability or strength to move; chemically inactive' },
  { word: 'Inexorable',      definition: 'Impossible to stop or prevent; relentless' },
  { word: 'Infelicitous',    definition: 'Unfortunate; inappropriate; awkward in expression' },
  { word: 'Ingenuous',       definition: 'Innocent and unsuspecting; frank and candid' },
  { word: 'Ingrate',         definition: 'An ungrateful person' },
  { word: 'Ingratiate',      definition: 'To bring oneself into favour by flattering or pleasing behaviour' },
  { word: 'Inimitable',      definition: 'So good or unusual as to be impossible to copy; unique' },
  { word: 'Iniquity',        definition: 'Immoral or grossly unfair behaviour; wickedness' },
  { word: 'Innocuous',       definition: 'Not harmful or offensive' },
  { word: 'Inscrutable',     definition: 'Impossible to understand or interpret' },
  { word: 'Insidious',       definition: 'Proceeding in a gradual, subtle way but with harmful effects' },
  { word: 'Insinuate',       definition: 'To suggest something bad in an indirect way; to manoeuvre subtly' },
  { word: 'Insolent',        definition: 'Showing a rude and arrogant lack of respect' },
  { word: 'Insouciant',      definition: 'Showing a casual lack of concern; carefree' },
  { word: 'Insular',         definition: 'Ignorant of or uninterested in ideas outside one\'s own experience' },
  { word: 'Insurgent',       definition: 'A rebel or revolutionary; rising in active revolt' },
  { word: 'Interloper',      definition: 'A person who becomes involved where they are not wanted' },
  { word: 'Interminable',    definition: 'Endless or apparently endless; tediously long' },
  { word: 'Interpolate',     definition: 'To insert something between fixed points; to alter a text by adding' },
  { word: 'Interregnum',     definition: 'A period when normal government is suspended; a gap in continuity' },
  { word: 'Intractable',     definition: 'Hard to control or deal with; stubborn' },
  { word: 'Intrepid',        definition: 'Fearless; adventurous' },
  { word: 'Inundate',        definition: 'To overwhelm with things to be dealt with; to flood' },
  { word: 'Inure',           definition: 'To accustom someone to something unpleasant; to harden' },
  { word: 'Invective',       definition: 'Insulting, abusive, or highly critical language' },
  { word: 'Inveigh',         definition: 'To speak or write about something with great hostility' },
  { word: 'Inveigle',        definition: 'To persuade someone by deception or flattery' },
  { word: 'Invidious',       definition: 'Likely to arouse resentment or anger in others; unfairly discriminating' },
  { word: 'Inviolable',      definition: 'Never to be broken, infringed, or dishonoured' },
  { word: 'Irascible',       definition: 'Having or showing a tendency to be easily angered' },
  { word: 'Ire',             definition: 'Anger' },
  { word: 'Irksome',         definition: 'Irritating; annoying' },
  { word: 'Itinerant',       definition: 'Travelling from place to place' },

  /* ── Expanded lexicon · J–K ────────────────────────────────── */
  { word: 'Jaded',           definition: 'Tired, bored, or lacking enthusiasm after overindulgence' },
  { word: 'Jaunty',          definition: 'Having a lively, cheerful, and self-confident manner' },
  { word: 'Jingoism',        definition: 'Extreme patriotism, especially in the form of aggressive foreign policy' },
  { word: 'Jubilant',        definition: 'Feeling or expressing great happiness and triumph' },
  { word: 'Juggernaut',      definition: 'A huge, powerful, and overwhelming force or institution' },
  { word: 'Juncture',        definition: 'A particular point in events or time; a place where things join' },
  { word: 'Junta',           definition: 'A military or political group ruling after seizing power' },
  { word: 'Juxtapose',       definition: 'To place close together for contrasting effect' },
  { word: 'Ken',             definition: 'One\'s range of knowledge or understanding' },
  { word: 'Kinetic',         definition: 'Relating to or resulting from motion' },
  { word: 'Kismet',          definition: 'Destiny; fate' },
  { word: 'Knell',           definition: 'The sound of a bell, especially for a death or funeral; an omen of doom' },

  /* ── Expanded lexicon · L ──────────────────────────────────── */
  { word: 'Labyrinthine',    definition: 'Irregular and twisting like a labyrinth; intricate and confusing' },
  { word: 'Lachrymose',      definition: 'Tearful or given to weeping; inducing sadness' },
  { word: 'Lambaste',        definition: 'To criticize harshly; to attack verbally' },
  { word: 'Lampoon',         definition: 'To publicly mock or ridicule with satire' },
  { word: 'Languid',         definition: 'Displaying a disinclination for physical exertion; slow and relaxed' },
  { word: 'Languish',        definition: 'To lose or lack vitality; to grow weak or feeble' },
  { word: 'Lassitude',       definition: 'A state of physical or mental weariness; lack of energy' },
  { word: 'Latent',          definition: 'Existing but not yet developed, manifest, or visible' },
  { word: 'Laud',            definition: 'To praise highly, especially in a public context' },
  { word: 'Lavish',          definition: 'Sumptuously rich or abundant; to bestow in generous quantities' },
  { word: 'Lethargic',       definition: 'Affected by sluggishness and lack of energy' },
  { word: 'Levity',          definition: 'The treatment of a serious matter with humour or lack of respect' },
  { word: 'Libertine',       definition: 'A person, especially a man, who behaves without moral principles' },
  { word: 'Licentious',      definition: 'Promiscuous and unprincipled in sexual matters' },
  { word: 'Limpid',          definition: 'Clear and transparent; free of obscurity; lucid' },
  { word: 'Lionize',         definition: 'To treat someone as a celebrity' },
  { word: 'Lissome',         definition: 'Thin, supple, and graceful' },
  { word: 'Listless',        definition: 'Lacking energy or enthusiasm' },
  { word: 'Litany',          definition: 'A tedious recital or repetitive series' },
  { word: 'Lithe',           definition: 'Thin, supple, and graceful' },
  { word: 'Livid',           definition: 'Furiously angry; of a dark, discoloured shade' },
  { word: 'Lout',            definition: 'An uncouth or aggressive man or boy' },
  { word: 'Lucid',           definition: 'Expressed clearly; easy to understand; showing clear thought' },
  { word: 'Lucre',           definition: 'Money, especially when regarded as sordid or distasteful' },
  { word: 'Luminous',        definition: 'Full of or shedding light; bright or shining' },
  { word: 'Lurid',           definition: 'Very vivid in colour; shockingly sensational' },

  /* ── Expanded lexicon · M ──────────────────────────────────── */
  { word: 'Maelstrom',       definition: 'A powerful whirlpool; a situation of confused or violent turmoil' },
  { word: 'Maladroit',       definition: 'Ineffective or bungling; clumsy' },
  { word: 'Malaise',         definition: 'A general feeling of discomfort, unease, or low spirits' },
  { word: 'Malapropism',     definition: 'The mistaken use of a word in place of a similar-sounding one' },
  { word: 'Malevolent',      definition: 'Having or showing a wish to do evil to others' },
  { word: 'Malfeasance',     definition: 'Wrongdoing, especially by a public official' },
  { word: 'Malinger',        definition: 'To pretend illness to escape duty or work' },
  { word: 'Malleable',       definition: 'Easily influenced; able to be hammered into shape' },
  { word: 'Marauder',        definition: 'One who roams in search of plunder; a raider' },
  { word: 'Martinet',        definition: 'A strict disciplinarian, especially in the armed forces' },
  { word: 'Maudlin',         definition: 'Self-pityingly or tearfully sentimental' },
  { word: 'Maverick',        definition: 'An unorthodox or independent-minded person' },
  { word: 'Mawkish',         definition: 'Sentimental in a feeble or sickly way' },
  { word: 'Maxim',           definition: 'A short statement expressing a general truth or rule of conduct' },
  { word: 'Mellifluous',     definition: 'Sweet or musical; pleasant to hear' },
  { word: 'Mendacity',       definition: 'Untruthfulness' },
  { word: 'Mendicant',       definition: 'A beggar; depending on alms for a living' },
  { word: 'Mercenary',       definition: 'Primarily concerned with making money at the expense of ethics' },
  { word: 'Mettle',          definition: 'A person\'s ability to cope well with difficulties; spirited courage' },
  { word: 'Miasma',          definition: 'An unpleasant or unhealthy vapour; an oppressive atmosphere' },
  { word: 'Mien',            definition: 'A person\'s look or manner, especially as indicating mood' },
  { word: 'Minatory',        definition: 'Expressing or conveying a threat' },
  { word: 'Misnomer',        definition: 'A wrong or inaccurate name or designation' },
  { word: 'Modicum',         definition: 'A small quantity of something, especially something desirable' },
  { word: 'Mordant',         definition: 'Having or showing a sharp or critical quality; biting' },
  { word: 'Moribund',        definition: 'At the point of death; lacking vitality or vigour' },
  { word: 'Morose',          definition: 'Sullen and ill-tempered' },
  { word: 'Multifarious',    definition: 'Having great variety; numerous and varied' },
  { word: 'Mundane',         definition: 'Lacking interest or excitement; dull; of this earthly world' },
  { word: 'Munificent',      definition: 'Larger or more generous than is usual or necessary' },
  { word: 'Myriad',          definition: 'A countless or extremely great number' },

  /* ── Expanded lexicon · N ──────────────────────────────────── */
  { word: 'Nascency',        definition: 'The process of coming into existence or being born' },
  { word: 'Nebulous',        definition: 'In the form of a cloud or haze; vague or ill-defined' },
  { word: 'Necromancy',      definition: 'The supposed practice of communicating with the dead; black magic' },
  { word: 'Nettle',          definition: 'To irritate or annoy someone' },
  { word: 'Nexus',           definition: 'A connection or series of connections; a central or focal point' },
  { word: 'Nicety',          definition: 'A fine detail or distinction; precision' },
  { word: 'Niggardly',       definition: 'Ungenerous with money, time, etc.; meagre' },
  { word: 'Noisome',         definition: 'Having an extremely offensive smell; disagreeable' },
  { word: 'Nominal',         definition: 'Existing in name only; very small in comparison to expectation' },
  { word: 'Nonchalant',      definition: 'Feeling or appearing casually calm and relaxed; indifferent' },
  { word: 'Nondescript',     definition: 'Lacking distinctive or interesting features; dull' },
  { word: 'Nonplussed',      definition: 'So surprised and confused that one is unsure how to react' },
  { word: 'Nostrum',         definition: 'A medicine or scheme of dubious effectiveness; a quack remedy' },
  { word: 'Noxious',         definition: 'Harmful, poisonous, or very unpleasant' },
  { word: 'Nugatory',        definition: 'Of no value or importance; useless or futile' },
  { word: 'Numinous',        definition: 'Having a strong spiritual or religious quality; mysterious' },

  /* ── Expanded lexicon · O ──────────────────────────────────── */
  { word: 'Obeisance',       definition: 'Deferential respect; a gesture expressing such respect' },
  { word: 'Objurgate',       definition: 'To rebuke or scold sharply' },
  { word: 'Oblique',         definition: 'Not expressed or done in a direct way; slanting' },
  { word: 'Oblivious',       definition: 'Not aware of or not concerned about what is happening around one' },
  { word: 'Obsequy',         definition: 'A funeral rite or ceremony' },
  { word: 'Obtrude',         definition: 'To become noticeable in an unwelcome way; to impose oneself' },
  { word: 'Obtuse',          definition: 'Annoyingly insensitive or slow to understand' },
  { word: 'Obviate',         definition: 'To remove a need or difficulty; to prevent' },
  { word: 'Odious',          definition: 'Extremely unpleasant; repulsive' },
  { word: 'Officious',       definition: 'Asserting authority or interfering in a domineering way' },
  { word: 'Ominous',         definition: 'Giving the impression that something bad is going to happen' },
  { word: 'Opaque',          definition: 'Not able to be seen through; hard to understand' },
  { word: 'Opulent',         definition: 'Ostentatiously rich and luxurious or lavish' },
  { word: 'Oscillate',       definition: 'To move or swing back and forth; to waver between extremes' },
  { word: 'Ossify',          definition: 'To turn into bone; to cease developing; to become rigid' },
  { word: 'Ostentatious',    definition: 'Characterized by vulgar or pretentious display; showy' },
  { word: 'Overt',           definition: 'Done or shown openly; not secret or hidden' },
  { word: 'Overweening',     definition: 'Showing excessive confidence or pride' },

  /* ── Expanded lexicon · P ──────────────────────────────────── */
  { word: 'Palatable',       definition: 'Pleasant to taste; acceptable or satisfactory' },
  { word: 'Palaver',         definition: 'Prolonged and idle discussion; fuss and trouble' },
  { word: 'Palindrome',      definition: 'A word or phrase that reads the same backward as forward' },
  { word: 'Pall',            definition: 'To become less appealing or interesting through familiarity' },
  { word: 'Palpable',        definition: 'Able to be touched or felt; so intense as to be almost tangible' },
  { word: 'Panacea',         definition: 'A solution or remedy for all difficulties or diseases' },
  { word: 'Panache',         definition: 'Flamboyant confidence of style or manner' },
  { word: 'Pandemic',        definition: 'Prevalent over a whole country or the world; widespread' },
  { word: 'Panegyric',       definition: 'A public speech or text in praise of someone or something' },
  { word: 'Paradigm',        definition: 'A typical example or pattern; a model' },
  { word: 'Paradox',         definition: 'A seemingly absurd statement that may prove to be well founded' },
  { word: 'Paragon',         definition: 'A person or thing regarded as a perfect example of a quality' },
  { word: 'Parochial',       definition: 'Having a limited or narrow outlook or scope' },
  { word: 'Parody',          definition: 'An imitation of a style with deliberate exaggeration for comic effect' },
  { word: 'Paroxysm',        definition: 'A sudden attack or violent expression of emotion or activity' },
  { word: 'Parsimonious',    definition: 'Unwilling to spend money or use resources; stingy' },
  { word: 'Partisan',        definition: 'A strong supporter of a party, cause, or person; prejudiced' },
  { word: 'Patent',          definition: 'Easily recognizable; obvious' },
  { word: 'Pathos',          definition: 'A quality that evokes pity or sadness' },
  { word: 'Patrician',       definition: 'An aristocrat or nobleman; refined in manners or taste' },
  { word: 'Peccadillo',      definition: 'A relatively minor fault or sin' },
  { word: 'Pellucid',        definition: 'Translucently clear; easy to understand' },
  { word: 'Penchant',        definition: 'A strong or habitual liking for something' },
  { word: 'Penitent',        definition: 'Feeling or showing sorrow and regret for wrongdoing' },
  { word: 'Pensive',         definition: 'Engaged in deep or serious thought' },
  { word: 'Penumbra',        definition: 'A partial shadow; a marginal or surrounding region' },
  { word: 'Peremptory',      definition: 'Insisting on immediate attention or obedience; brusque' },
  { word: 'Perennial',       definition: 'Lasting or existing for a long or apparently infinite time' },
  { word: 'Perfidy',         definition: 'Deceitfulness; untrustworthiness' },
  { word: 'Perimeter',       definition: 'The continuous line forming the boundary of a closed figure' },
  { word: 'Permeate',        definition: 'To spread throughout something; to pervade' },
  { word: 'Pertinacious',    definition: 'Holding firmly to an opinion or course of action; stubborn' },
  { word: 'Pertinent',       definition: 'Relevant or applicable to a particular matter' },
  { word: 'Perturb',         definition: 'To make someone anxious or unsettled' },
  { word: 'Peruse',          definition: 'To read or examine carefully and thoroughly' },
  { word: 'Pervade',         definition: 'To spread through and be perceived in every part of' },
  { word: 'Petrify',         definition: 'To make someone so frightened they are unable to move' },
  { word: 'Pithy',           definition: 'Concise and forcefully expressive' },
  { word: 'Pittance',        definition: 'A very small or inadequate amount of money' },
  { word: 'Placate',         definition: 'To make someone less angry or hostile' },
  { word: 'Placid',          definition: 'Not easily upset or excited; calm and peaceful' },
  { word: 'Plaintive',       definition: 'Sounding sad and mournful' },
  { word: 'Plangent',        definition: 'Loud and resounding, often with a mournful tone' },
  { word: 'Platitudinous',   definition: 'Characterized by trite, dull, or commonplace remarks' },
  { word: 'Plaudit',         definition: 'An expression of praise or approval' },
  { word: 'Plenary',         definition: 'Unqualified; absolute; attended by all members' },
  { word: 'Plumb',           definition: 'To explore or experience fully; to measure depth; exactly' },
  { word: 'Poignant',        definition: 'Evoking a keen sense of sadness or regret' },
  { word: 'Ponderous',       definition: 'Slow and clumsy because of great weight; dull and laborious' },
  { word: 'Portend',         definition: 'To be a sign or warning that something is likely to happen' },
  { word: 'Portent',         definition: 'A sign or warning that something momentous is likely to happen' },
  { word: 'Potentate',       definition: 'A monarch or ruler, especially an autocratic one' },
  { word: 'Pragmatic',       definition: 'Dealing with things sensibly and realistically' },
  { word: 'Prattle',         definition: 'To talk at length in a foolish or inconsequential way' },
  { word: 'Preamble',        definition: 'A preliminary or introductory statement' },
  { word: 'Precept',         definition: 'A general rule intended to regulate behaviour or thought' },
  { word: 'Precipitous',     definition: 'Dangerously high or steep; done suddenly without careful consideration' },
  { word: 'Preclude',        definition: 'To prevent from happening; to make impossible' },
  { word: 'Precocious',      definition: 'Having developed certain abilities at an earlier age than usual' },
  { word: 'Predilection',    definition: 'A preference or special liking for something' },
  { word: 'Preeminent',      definition: 'Surpassing all others; very distinguished' },
  { word: 'Premonition',     definition: 'A strong feeling that something is about to happen' },
  { word: 'Preponderance',   definition: 'The quality or fact of being greater in number or importance' },
  { word: 'Prerogative',     definition: 'A right or privilege exclusive to a particular person or class' },
  { word: 'Prescient',       definition: 'Having knowledge of events before they take place' },
  { word: 'Prestige',        definition: 'Widespread respect and admiration based on achievement or quality' },
  { word: 'Pretentious',     definition: 'Attempting to impress by affecting greater importance than is the case' },
  { word: 'Preternatural',   definition: 'Beyond what is normal or natural' },
  { word: 'Primordial',      definition: 'Existing at or from the beginning of time; primeval' },
  { word: 'Pristine',        definition: 'In its original condition; clean and fresh as if new' },
  { word: 'Probative',       definition: 'Affording proof or evidence' },
  { word: 'Proclivity',      definition: 'A tendency to choose or do something regularly; an inclination' },
  { word: 'Procrastinate',   definition: 'To delay or postpone action; to put off doing something' },
  { word: 'Prodigious',      definition: 'Remarkably or impressively great in extent, size, or degree' },
  { word: 'Profundity',      definition: 'Great depth of insight, knowledge, or thought' },
  { word: 'Profuse',         definition: 'Exuberantly plentiful; abundant' },
  { word: 'Promulgate',      definition: 'To promote or make widely known an idea or law' },
  { word: 'Propensity',      definition: 'An inclination or natural tendency to behave in a particular way' },
  { word: 'Propinquity',     definition: 'The state of being close to someone or something; proximity' },
  { word: 'Propitiate',      definition: 'To win or regain the favour of by doing something pleasing' },
  { word: 'Proscribe',       definition: 'To forbid, especially by law; to denounce or condemn' },
  { word: 'Protracted',      definition: 'Lasting for a long time or longer than expected' },
  { word: 'Provident',       definition: 'Making or showing provision for the future; prudent' },
  { word: 'Prudent',         definition: 'Acting with or showing care and thought for the future' },
  { word: 'Puerile',         definition: 'Childishly silly and trivial' },
  { word: 'Puissance',       definition: 'Great power, influence, or prowess' },
  { word: 'Pulchritude',     definition: 'Beauty' },
  { word: 'Punctilio',       definition: 'A fine or petty point of conduct or procedure' },
  { word: 'Pundit',          definition: 'An expert who frequently expresses opinions in public' },
  { word: 'Pungent',         definition: 'Having a sharply strong taste or smell; cutting in expression' },
  { word: 'Purloin',         definition: 'To steal something' },
  { word: 'Purport',         definition: 'To appear or claim to be or do something, especially falsely' },
  { word: 'Pusillanimous',   definition: 'Showing a lack of courage or determination; timid' },
  { word: 'Putative',        definition: 'Generally considered or reputed to be' },

  /* ── Expanded lexicon · Q–R ────────────────────────────────── */
  { word: 'Quaff',           definition: 'To drink heartily' },
  { word: 'Quagmire',        definition: 'A soft boggy area; a complex or hazardous situation' },
  { word: 'Quandary',        definition: 'A state of perplexity or uncertainty over a decision' },
  { word: 'Quell',           definition: 'To put an end to, typically by force; to suppress' },
  { word: 'Quibble',         definition: 'To argue about a trivial matter; a minor objection' },
  { word: 'Quiescent',       definition: 'In a state of inactivity or dormancy' },
  { word: 'Quintessential',  definition: 'Representing the most perfect or typical example of a quality' },
  { word: 'Quisling',        definition: 'A traitor who collaborates with an enemy' },
  { word: 'Quotidian',       definition: 'Of or occurring every day; ordinary or everyday' },
  { word: 'Rabid',           definition: 'Having or proceeding from an extreme or fanatical conviction' },
  { word: 'Rampant',         definition: 'Flourishing or spreading unchecked' },
  { word: 'Rancor',          definition: 'Bitterness or resentfulness, especially long-standing' },
  { word: 'Rapacious',       definition: 'Aggressively greedy or grasping' },
  { word: 'Rapprochement',   definition: 'The re-establishment of harmonious relations' },
  { word: 'Rarefied',        definition: 'Distant from the lives of ordinary people; lofty or exclusive' },
  { word: 'Raze',            definition: 'To completely destroy a building or town; to level to the ground' },
  { word: 'Rebuke',          definition: 'To express sharp disapproval or criticism of someone' },
  { word: 'Recant',          definition: 'To withdraw or renounce a prior belief or statement' },
  { word: 'Reciprocate',     definition: 'To respond to a gesture or action with a corresponding one' },
  { word: 'Reclusive',       definition: 'Avoiding the company of other people; solitary' },
  { word: 'Recompense',      definition: 'To make amends to someone for loss or harm; compensation' },
  { word: 'Recrimination',   definition: 'An accusation in response to one from someone else' },
  { word: 'Rectitude',       definition: 'Morally correct behaviour or thinking; righteousness' },
  { word: 'Redolent',        definition: 'Strongly reminiscent or suggestive of; fragrant' },
  { word: 'Redoubtable',     definition: 'Formidable, especially as an opponent; worthy of respect' },
  { word: 'Redress',         definition: 'To remedy or set right an undesirable situation' },
  { word: 'Refulgent',       definition: 'Shining brightly; radiant' },
  { word: 'Refute',          definition: 'To prove a statement or theory to be wrong or false' },
  { word: 'Relegate',        definition: 'To consign to an inferior rank or position' },
  { word: 'Remonstrate',     definition: 'To make a forcefully reproachful protest' },
  { word: 'Renege',          definition: 'To go back on a promise, undertaking, or contract' },
  { word: 'Replete',         definition: 'Filled or well supplied with something; sated' },
  { word: 'Reprehensible',   definition: 'Deserving censure or condemnation' },
  { word: 'Reprieve',        definition: 'To cancel or postpone punishment; a temporary relief' },
  { word: 'Reproach',        definition: 'To express disapproval or disappointment to someone' },
  { word: 'Reprove',         definition: 'To reprimand or censure someone' },
  { word: 'Repudiate',       definition: 'To refuse to accept; to deny the truth or validity of' },
  { word: 'Repugnant',       definition: 'Extremely distasteful; unacceptable' },
  { word: 'Rescind',         definition: 'To revoke, cancel, or repeal a law, order, or agreement' },
  { word: 'Resilient',       definition: 'Able to withstand or recover quickly from difficult conditions' },
  { word: 'Resolute',        definition: 'Admirably purposeful, determined, and unwavering' },
  { word: 'Resplendent',     definition: 'Attractive and impressive through being richly colourful' },
  { word: 'Reticent',        definition: 'Not revealing one\'s thoughts or feelings readily' },
  { word: 'Reverent',        definition: 'Feeling or showing deep and solemn respect' },
  { word: 'Rhapsodize',      definition: 'To speak or write about something with great enthusiasm' },
  { word: 'Ribald',          definition: 'Referring to sexual matters in an amusingly coarse way' },
  { word: 'Rife',            definition: 'Of common occurrence; widespread; abundant' },
  { word: 'Risible',         definition: 'Such as to provoke laughter; ludicrous' },
  { word: 'Rococo',          definition: 'Extravagantly or excessively ornate in style' },
  { word: 'Rotund',          definition: 'Round or plump; sonorous in speech' },
  { word: 'Rubicund',        definition: 'Having a healthy reddish colour; ruddy' },
  { word: 'Ruminate',        definition: 'To think deeply about something; to ponder' },
  { word: 'Ruse',            definition: 'An action intended to deceive someone; a trick' },
  { word: 'Rustic',          definition: 'Relating to the countryside; simple and unsophisticated' },

  /* ── Expanded lexicon · S ──────────────────────────────────── */
  { word: 'Saccharine',      definition: 'Excessively sweet or sentimental' },
  { word: 'Sacrosanct',      definition: 'Regarded as too important to be interfered with' },
  { word: 'Salient',         definition: 'Most noticeable or important; prominent' },
  { word: 'Sallow',          definition: 'Of an unhealthy yellow or pale brown colour' },
  { word: 'Salubrious',      definition: 'Health-giving; healthy; pleasant' },
  { word: 'Sanctimonious',   definition: 'Making a show of being morally superior; self-righteous' },
  { word: 'Sanction',        definition: 'To give official permission; a penalty for disobeying a rule' },
  { word: 'Sanguinary',      definition: 'Involving or causing much bloodshed; bloodthirsty' },
  { word: 'Sapient',         definition: 'Wise, or attempting to appear wise' },
  { word: 'Satiate',         definition: 'To satisfy fully; to gratify to or beyond capacity' },
  { word: 'Saturnine',       definition: 'Slow and gloomy in temperament; dark and brooding' },
  { word: 'Savant',          definition: 'A learned person, especially a distinguished scientist' },
  { word: 'Scabrous',        definition: 'Rough and covered with scabs; indecent or salacious' },
  { word: 'Scintilla',       definition: 'A tiny trace or spark of a specified quality or feeling' },
  { word: 'Scrupulous',      definition: 'Diligent, thorough, and extremely attentive to detail; principled' },
  { word: 'Scurrilous',      definition: 'Making or spreading scandalous claims to damage reputation' },
  { word: 'Sedition',        definition: 'Conduct or speech inciting rebellion against authority' },
  { word: 'Seminal',         definition: 'Strongly influencing later developments; highly original' },
  { word: 'Sententious',     definition: 'Given to pompous moralizing; expressing maxims affectedly' },
  { word: 'Sequester',       definition: 'To isolate or hide away; to take legal possession of assets' },
  { word: 'Servile',         definition: 'Having or showing an excessive willingness to serve; submissive' },
  { word: 'Shibboleth',      definition: 'A custom, principle, or belief distinguishing a class or group' },
  { word: 'Simulacrum',      definition: 'An image or representation; an unsatisfactory imitation' },
  { word: 'Sinecure',        definition: 'A position requiring little work but providing income' },
  { word: 'Sinuous',         definition: 'Having many curves and turns; moving lithely' },
  { word: 'Skeptic',         definition: 'A person inclined to question or doubt accepted opinions' },
  { word: 'Slake',           definition: 'To quench or satisfy a thirst or desire' },
  { word: 'Sobriquet',       definition: 'A person\'s nickname' },
  { word: 'Sodden',          definition: 'Saturated with liquid; dull or stupefied' },
  { word: 'Solicitous',      definition: 'Characterized by anxious care and attention; eager' },
  { word: 'Solipsism',       definition: 'The view that the self is all that can be known to exist' },
  { word: 'Soliloquy',       definition: 'An act of speaking one\'s thoughts aloud when alone' },
  { word: 'Somnolent',       definition: 'Sleepy or drowsy; inducing sleep' },
  { word: 'Sonorous',        definition: 'Imposingly deep and full in sound' },
  { word: 'Sophistry',       definition: 'The use of clever but false arguments intended to deceive' },
  { word: 'Sophomoric',      definition: 'Pretentious or juvenile; overconfident but immature' },
  { word: 'Sordid',          definition: 'Involving immoral or dishonourable actions; squalid' },
  { word: 'Spartan',         definition: 'Showing the indifference to comfort or luxury; austere' },
  { word: 'Splenetic',       definition: 'Bad-tempered; spiteful' },
  { word: 'Sporadic',        definition: 'Occurring at irregular intervals; scattered' },
  { word: 'Spurious',        definition: 'Not being what it purports to be; false or fake' },
  { word: 'Squalid',         definition: 'Extremely dirty and unpleasant; morally degraded' },
  { word: 'Squander',        definition: 'To waste in a reckless and foolish manner' },
  { word: 'Staid',           definition: 'Sedate, respectable, and unadventurous' },
  { word: 'Stalwart',        definition: 'Loyal, reliable, and hardworking; sturdily built' },
  { word: 'Stentorian',      definition: 'Of a person\'s voice, loud and powerful' },
  { word: 'Stigma',          definition: 'A mark of disgrace associated with a circumstance or quality' },
  { word: 'Stilted',         definition: 'Stiff and self-conscious or unnatural' },
  { word: 'Stipend',         definition: 'A fixed regular sum paid as a salary or allowance' },
  { word: 'Stoic',           definition: 'A person who endures pain or hardship without complaint' },
  { word: 'Stratagem',       definition: 'A plan or scheme to outwit an opponent or achieve an end' },
  { word: 'Striated',        definition: 'Marked with a series of ridges, furrows, or linear marks' },
  { word: 'Strident',        definition: 'Loud and harsh; presenting a point of view forcefully' },
  { word: 'Stringent',       definition: 'Strict, precise, and exacting' },
  { word: 'Stupefy',         definition: 'To make someone unable to think clearly; to astonish' },
  { word: 'Stymie',          definition: 'To prevent or hinder the progress of' },
  { word: 'Suave',           definition: 'Charming, confident, and elegant, sometimes superficially' },
  { word: 'Subjugate',       definition: 'To bring under domination or control, especially by force' },
  { word: 'Sublime',         definition: 'Of such excellence or beauty as to inspire great admiration' },
  { word: 'Subliminal',      definition: 'Below the threshold of conscious perception' },
  { word: 'Suborn',          definition: 'To bribe or induce someone to commit an unlawful act' },
  { word: 'Subterfuge',      definition: 'Deceit used to achieve one\'s goal' },
  { word: 'Subtle',          definition: 'So delicate or precise as to be difficult to analyze or describe' },
  { word: 'Subvert',         definition: 'To undermine the power and authority of an established system' },
  { word: 'Succinct',        definition: 'Briefly and clearly expressed' },
  { word: 'Succor',          definition: 'Assistance and support in times of hardship and distress' },
  { word: 'Sumptuous',       definition: 'Splendid and expensive-looking; lavish' },
  { word: 'Sunder',          definition: 'To split apart' },
  { word: 'Superannuated',   definition: 'Outdated or obsolete through age; retired with a pension' },
  { word: 'Supercilious',    definition: 'Behaving as though one is superior to others; haughty' },
  { word: 'Superfluous',     definition: 'Unnecessary, especially through being more than enough' },
  { word: 'Supersede',       definition: 'To take the place of a person or thing previously in authority' },
  { word: 'Supine',          definition: 'Lying face upward; failing to act through moral weakness' },
  { word: 'Supplant',        definition: 'To supersede and replace' },
  { word: 'Supplicate',      definition: 'To ask or beg for something earnestly or humbly' },
  { word: 'Surfeit',         definition: 'An excessive amount of something' },
  { word: 'Surmise',         definition: 'To suppose that something is true without evidence' },
  { word: 'Surreptitious',   definition: 'Kept secret because it would not be approved of' },
  { word: 'Sybarite',        definition: 'A person who is self-indulgent in their love of luxury' },
  { word: 'Synecdoche',      definition: 'A figure of speech in which a part represents the whole' },
  { word: 'Synthesis',       definition: 'The combination of components to form a connected whole' },

  /* ── Expanded lexicon · T ──────────────────────────────────── */
  { word: 'Tableau',         definition: 'A group of people or things forming a striking scene' },
  { word: 'Tacit',           definition: 'Understood or implied without being stated' },
  { word: 'Tangential',      definition: 'Diverging from a previous course; only superficially relevant' },
  { word: 'Tantamount',      definition: 'Equivalent in seriousness to; virtually the same as' },
  { word: 'Tautology',       definition: 'The saying of the same thing twice in different words' },
  { word: 'Tawdry',          definition: 'Showy but cheap and of poor quality; sordid' },
  { word: 'Temperance',      definition: 'Moderation or self-restraint, especially in eating and drinking' },
  { word: 'Tenable',         definition: 'Able to be maintained or defended against attack or objection' },
  { word: 'Tenacious',       definition: 'Tending to keep a firm hold of something; persistent' },
  { word: 'Tenebrous',       definition: 'Dark; shadowy or obscure' },
  { word: 'Tenuous',         definition: 'Very weak or slight; thin or fine in consistency' },
  { word: 'Tepid',           definition: 'Lukewarm; showing little enthusiasm' },
  { word: 'Terse',           definition: 'Sparing in the use of words; abrupt' },
  { word: 'Threnody',        definition: 'A lament; a poem or song of mourning' },
  { word: 'Timbre',          definition: 'The character or quality of a sound distinct from pitch and intensity' },
  { word: 'Tirade',          definition: 'A long, angry speech of criticism or accusation' },
  { word: 'Toady',           definition: 'A person who behaves obsequiously to gain favour; a sycophant' },
  { word: 'Tome',            definition: 'A book, especially a large, heavy, scholarly one' },
  { word: 'Torrid',          definition: 'Very hot and dry; full of intense emotion' },
  { word: 'Tractable',       definition: 'Easy to control or influence; manageable' },
  { word: 'Transient',       definition: 'Lasting only for a short time; impermanent' },
  { word: 'Transmute',       definition: 'To change in form, nature, or substance' },
  { word: 'Travesty',        definition: 'A false, absurd, or distorted representation of something' },
  { word: 'Treacle',         definition: 'Excessive sentimentality; cloying sweetness' },
  { word: 'Trenchant',       definition: 'Vigorous or incisive in expression or style' },
  { word: 'Trepidation',     definition: 'A feeling of fear or anxiety about something that may happen' },
  { word: 'Trite',           definition: 'Overused and consequently of little import; lacking originality' },
  { word: 'Truncate',        definition: 'To shorten by cutting off the top or the end' },
  { word: 'Tumult',          definition: 'A loud, confused noise; a state of confusion or disorder' },
  { word: 'Turbid',          definition: 'Cloudy, opaque, or thick with suspended matter; confused' },
  { word: 'Turgid',          definition: 'Swollen and distended; pompous or bombastic in language' },
  { word: 'Tutelage',        definition: 'Protection of or authority over someone; instruction' },
  { word: 'Tyro',            definition: 'A beginner or novice' },

  /* ── Expanded lexicon · U ──────────────────────────────────── */
  { word: 'Ubiquitous',      definition: 'Present, appearing, or found everywhere' },
  { word: 'Umbrageous',      definition: 'Shady; affording shade; inclined to take offence easily' },
  { word: 'Unassuming',      definition: 'Not pretentious or arrogant; modest' },
  { word: 'Undulate',        definition: 'To move with a smooth wavelike motion' },
  { word: 'Unfeigned',       definition: 'Genuine; sincere' },
  { word: 'Untenable',       definition: 'Not able to be maintained or defended against attack or objection' },
  { word: 'Untoward',        definition: 'Unexpected and inappropriate or inconvenient' },
  { word: 'Upbraid',         definition: 'To find fault with; to scold or reproach' },
  { word: 'Usurp',           definition: 'To take a position of power or importance illegally or by force' },
  { word: 'Usury',           definition: 'The illegal action of lending money at unreasonably high interest' },
  { word: 'Utilitarian',     definition: 'Designed to be useful or practical rather than attractive' },
  { word: 'Utopian',         definition: 'Modelled on or aiming for an ideal but impractical perfection' },

  /* ── Expanded lexicon · V ──────────────────────────────────── */
  { word: 'Vacillate',       definition: 'To waver between different opinions or actions; to be indecisive' },
  { word: 'Vainglorious',    definition: 'Excessively proud of oneself or one\'s achievements; boastful' },
  { word: 'Variegated',      definition: 'Exhibiting different colours; marked with patches or streaks' },
  { word: 'Vaunt',           definition: 'To boast about or praise something, especially excessively' },
  { word: 'Vehement',        definition: 'Showing strong feeling; forceful, passionate, or intense' },
  { word: 'Venerable',       definition: 'Accorded great respect because of age, wisdom, or character' },
  { word: 'Venerate',        definition: 'To regard with great respect; to revere' },
  { word: 'Venturesome',     definition: 'Willing to take risks or embark on difficult action' },
  { word: 'Veracious',       definition: 'Speaking or representing the truth; truthful' },
  { word: 'Verdant',         definition: 'Green with grass or other rich vegetation; inexperienced' },
  { word: 'Verisimilitude',  definition: 'The appearance of being true or real' },
  { word: 'Vernal',          definition: 'Relating to or occurring in spring' },
  { word: 'Vex',             definition: 'To make someone feel annoyed, frustrated, or worried' },
  { word: 'Viable',          definition: 'Capable of working successfully; feasible' },
  { word: 'Vicarious',       definition: 'Experienced in the imagination through another person' },
  { word: 'Vigilant',        definition: 'Keeping careful watch for possible danger or difficulties' },
  { word: 'Vignette',        definition: 'A brief evocative description, account, or episode' },
  { word: 'Vilify',          definition: 'To speak or write about in an abusively disparaging manner' },
  { word: 'Vindicate',       definition: 'To clear of blame or suspicion; to justify' },
  { word: 'Vindictive',      definition: 'Having or showing a strong desire for revenge' },
  { word: 'Virtuoso',        definition: 'A person highly skilled in a pursuit, especially music' },
  { word: 'Virulent',        definition: 'Extremely severe or harmful; bitterly hostile' },
  { word: 'Viscous',         definition: 'Having a thick, sticky consistency between solid and liquid' },
  { word: 'Visage',          definition: 'A person\'s face, with reference to its form or expression' },
  { word: 'Vituperative',    definition: 'Bitter and abusive' },
  { word: 'Vivacious',       definition: 'Attractively lively and animated' },
  { word: 'Vociferous',      definition: 'Expressing feelings or opinions in a loud and forceful way' },
  { word: 'Volatile',        definition: 'Liable to change rapidly and unpredictably, especially for the worse' },
  { word: 'Volition',        definition: 'The faculty or power of using one\'s will; a deliberate choice' },
  { word: 'Voracious',       definition: 'Wanting or devouring great quantities; insatiable' },
  { word: 'Votary',          definition: 'A devoted follower, adherent, or advocate' },

  /* ── Expanded lexicon · W–Z ────────────────────────────────── */
  { word: 'Waft',            definition: 'To pass or cause to pass gently through the air' },
  { word: 'Waive',           definition: 'To refrain from insisting on or using a right or claim' },
  { word: 'Wane',            definition: 'To decrease in vigour, power, or extent; to become weaker' },
  { word: 'Wary',            definition: 'Feeling or showing caution about possible dangers or problems' },
  { word: 'Welter',          definition: 'A large number of items in no order; a confused mass' },
  { word: 'Wheedle',         definition: 'To use flattery or coaxing to persuade someone to do something' },
  { word: 'Whet',            definition: 'To sharpen the blade of a tool; to excite or stimulate desire' },
  { word: 'Whimsical',       definition: 'Playfully quaint or fanciful, especially in an appealing way' },
  { word: 'Wily',            definition: 'Skilled at gaining an advantage, especially deceitfully' },
  { word: 'Winsome',         definition: 'Attractive or appealing in a fresh, innocent way' },
  { word: 'Wistful',         definition: 'Having or showing a feeling of vague or regretful longing' },
  { word: 'Wizened',         definition: 'Shrivelled or wrinkled with age' },
  { word: 'Wont',            definition: 'In the habit of doing something; one\'s customary behaviour' },
  { word: 'Wraith',          definition: 'A ghost or ghostlike image of someone' },
  { word: 'Wrest',           definition: 'To forcibly pull something from a person\'s grasp; to seize' },
  { word: 'Wry',             definition: 'Using or expressing dry, especially mocking, humour' },
  { word: 'Yoke',            definition: 'A burden or something that oppresses; to join or couple' },
  { word: 'Zaftig',          definition: 'Having a full, rounded figure; plump' },
  { word: 'Zealotry',        definition: 'Fanatical and uncompromising pursuit of ideals' },
  { word: 'Zephyr',          definition: 'A soft, gentle breeze' },

  /* ── Expanded lexicon · supplementary ──────────────────────── */
  { word: 'Abrade',          definition: 'To scrape or wear away by friction or erosion' },
  { word: 'Acquiesce',       definition: 'To accept something reluctantly but without protest' },
  { word: 'Acrid',           definition: 'Having an irritatingly strong and unpleasant taste or smell' },
  { word: 'Bane',            definition: 'A cause of great distress or annoyance; ruin' },
  { word: 'Bowdlerize',      definition: 'To remove material considered improper from a text' },
  { word: 'Cabal',           definition: 'A secret political clique or faction' },
  { word: 'Comport',         definition: 'To conduct oneself; to be in agreement or harmony with' },
  { word: 'Contrive',        definition: 'To create or bring about by deliberate effort or scheme' },
  { word: 'Daunt',           definition: 'To make someone feel intimidated or apprehensive' },
  { word: 'Demure',          definition: 'Reserved, modest, and shy' },
  { word: 'Dilapidated',     definition: 'In a state of disrepair or ruin as a result of neglect' },
  { word: 'Ductility',       definition: 'The capacity to be drawn out or deformed without breaking' },
  { word: 'Effable',         definition: 'Able to be described or expressed in words' },
  { word: 'Egress',          definition: 'The action of going out of or leaving a place; an exit' },
  { word: 'Fervid',          definition: 'Intensely enthusiastic or passionate, often to an excessive degree' },
  { word: 'Gauche',          definition: 'Lacking ease or grace; unsophisticated and socially awkward' },
  { word: 'Imperturbable',   definition: 'Unable to be upset or excited; calm' },
  { word: 'Lachrymal',       definition: 'Connected with weeping or tears' },
  { word: 'Largesse',        definition: 'Generosity in bestowing money or gifts upon others' },
  { word: 'Maunder',         definition: 'To talk or move in a rambling, aimless manner' },
  { word: 'Nonpareil',       definition: 'Having no match or equal; unrivalled' },
  { word: 'Obstinate',       definition: 'Stubbornly refusing to change one\'s opinion or course of action' },
  { word: 'Pellucidity',     definition: 'Transparency or clearness of expression' },
  { word: 'Quotient',        definition: 'A degree or amount of a specified quality or characteristic' },
  { word: 'Recidivism',      definition: 'The tendency of a convicted criminal to reoffend' },
  { word: 'Sagacity',        definition: 'The quality of being discerning, sound in judgement, and wise' },
  { word: 'Tactile',         definition: 'Connected with the sense of touch; perceptible by touch' },
  { word: 'Ulterior',        definition: 'Existing beyond what is obvious or admitted; hidden' },
  { word: 'Vituperation',    definition: 'Bitter and abusive language' },
  { word: 'Welkin',          definition: 'The sky or heaven' },

  /* ── Philosophy & epistemology ──────────────────────────────── */
  { word: 'Epistemology',   definition: 'The branch of philosophy concerned with the theory of knowledge' },
  { word: 'Ontology',       definition: 'The branch of metaphysics dealing with the nature of being' },
  { word: 'Dialectic',      definition: 'The art of investigating truth through logical argumentation' },
  { word: 'Teleology',      definition: 'The explanation of phenomena in terms of the purpose they serve' },
  { word: 'Hermeneutics',   definition: 'The branch of knowledge dealing with interpretation, especially of texts' },
  { word: 'Phenomenology',  definition: 'The philosophical study of the structures of experience and consciousness' },
  { word: 'Empiricism',     definition: 'The theory that knowledge comes only from sensory experience' },
  { word: 'Rationalism',    definition: 'The practice of treating reason as the basis for belief and knowledge' },
  { word: 'Solecism',       definition: 'A grammatical error; a breach of good manners or etiquette' },
  { word: 'Axiom',          definition: 'A statement accepted as true and from which others can be deduced' },
  { word: 'Aporia',         definition: 'An irresolvable internal contradiction or logical disjunction in a text' },
  { word: 'Semiotics',      definition: 'The study of signs and symbols and their use or interpretation' },
  { word: 'Heuristic',      definition: 'A problem-solving approach that employs practical shortcuts to find solutions' },
  { word: 'Zeitgeist',      definition: 'The defining spirit or mood of a particular period of history' },
  { word: 'Praxis',         definition: 'Practice, especially of a social or political nature; the application of theory' },
  { word: 'Exegesis',       definition: 'Critical explanation or interpretation of a text, especially scripture' },
  { word: 'Dogma',          definition: 'A principle laid down by an authority as incontrovertibly true' },
  { word: 'Eschatology',    definition: 'The part of theology concerned with death, judgment, and final destiny' },
  { word: 'Theodicy',       definition: 'The vindication of divine goodness in view of the existence of evil' },
  { word: 'Nominalism',     definition: 'The philosophical view that abstract concepts do not represent objective reality' },
  { word: 'Reductionism',   definition: 'The practice of analyzing complex phenomena in terms of simple components' },
  { word: 'Dualism',        definition: 'The division of something into two opposed aspects; the mind-body problem' },
  { word: 'Monism',         definition: 'The view that reality is fundamentally one unified thing' },

  /* ── Literary & rhetorical terms ───────────────────────────── */
  { word: 'Chiasmus',       definition: 'A rhetorical figure reversing the order of terms in the second clause' },
  { word: 'Litotes',        definition: 'Understatement using a negative to affirm a positive' },
  { word: 'Periphrasis',    definition: 'The use of indirect and circumlocutory speech or writing' },
  { word: 'Anaphora',       definition: 'The repetition of a word or phrase at the beginning of successive clauses' },
  { word: 'Apostrophe',     definition: 'A rhetorical device addressing an absent person or abstract idea' },
  { word: 'Assonance',      definition: 'The resemblance of vowel sounds in nearby words' },
  { word: 'Bathos',         definition: 'An abrupt, disappointing transition from the sublime to the trivial' },
  { word: 'Diegesis',       definition: 'A style of telling a story by narrating rather than showing' },
  { word: 'Ellipsis',       definition: 'The omission of words from speech or writing whose meaning can be inferred' },
  { word: 'Enjambment',     definition: 'The continuation of a sentence beyond the end of a line of verse' },
  { word: 'Epiphany',       definition: 'A moment of sudden and great revelation or realization' },
  { word: 'Hyperbole',      definition: 'Exaggerated statements or claims not meant to be taken literally' },
  { word: 'Irony',          definition: 'The expression of meaning through language that normally signifies the opposite' },
  { word: 'Juxtaposition',  definition: 'The placement of two contrasting things close together for effect' },
  { word: 'Metonymy',       definition: 'The substitution of the name of an attribute for the thing itself' },
  { word: 'Onomatopoeia',   definition: 'The formation of words imitating sounds associated with the named thing' },
  { word: 'Palimpsest',     definition: 'A manuscript where earlier writing shows beneath later writing; a layered text' },
  { word: 'Polysemy',       definition: 'The coexistence of many possible meanings for a word or phrase' },
  { word: 'Prosody',        definition: 'The patterns of rhythm and sound used in poetry' },
  { word: 'Stichomythia',   definition: 'Dialogue in which two characters speak in alternate single lines' },
  { word: 'Zeugma',         definition: 'A figure of speech in which a word applies to two others in different senses' },

  /* ── Scientific & medical ───────────────────────────────────── */
  { word: 'Calcify',        definition: 'To harden by conversion into calcium compounds; to become inflexible' },
  { word: 'Catalysis',      definition: 'The acceleration of a chemical reaction by a catalyst; a triggering force' },
  { word: 'Entropy',        definition: 'Lack of order or predictability; gradual decline into disorder' },
  { word: 'Homeostasis',    definition: 'The tendency of a system to maintain internal stability' },
  { word: 'Mutation',       definition: 'A change in the structure of a gene; an alteration in form or nature' },
  { word: 'Pathogen',       definition: 'A bacterium, virus, or microorganism that can cause disease' },
  { word: 'Symbiosis',      definition: 'Interaction between organisms living in close physical association; mutual benefit' },
  { word: 'Taxonomy',       definition: 'A classification system, especially of organisms' },
  { word: 'Prognosis',      definition: 'A forecast of the likely course of a disease or situation' },
  { word: 'Pathology',      definition: 'The scientific study of the causes and effects of diseases' },
  { word: 'Metabolism',     definition: 'The chemical processes that occur within a living organism to maintain life' },
  { word: 'Osmosis',        definition: 'The process of gradual absorption; movement of molecules across a membrane' },
  { word: 'Catalyst',       definition: 'A substance that increases the rate of a chemical reaction; a precipitating agent' },
  { word: 'Mitosis',        definition: 'A type of cell division resulting in two daughter cells with identical chromosomes' },
  { word: 'Diffusion',      definition: 'The spreading of something widely; the mixing of gases or liquids by molecular motion' },

  /* ── Law & political theory ─────────────────────────────────── */
  { word: 'Jurisprudence',  definition: 'The theory or philosophy of law; a body of law' },
  { word: 'Adjudicate',     definition: 'To make a formal judgment or decision about a problem or dispute' },
  { word: 'Imprimatur',     definition: 'Official approval; a license to print or publish something' },
  { word: 'Injunction',     definition: 'An authoritative warning or order; a judicial order restraining action' },
  { word: 'Fiduciary',      definition: 'Relating to a trust or duty to act in another\'s best interest' },
  { word: 'Indemnify',      definition: 'To compensate for harm or loss; to secure against legal responsibility' },
  { word: 'Statute',        definition: 'A written law passed by a legislative body' },
  { word: 'Tort',           definition: 'A wrongful act giving rise to civil legal liability' },
  { word: 'Sovereign',      definition: 'Possessing supreme or ultimate power; independent of outside authority' },
  { word: 'Polity',         definition: 'A form of political organization; a society organized as a state' },
  { word: 'Oligarchy',      definition: 'A small group of people having control of a country or organization' },
  { word: 'Autocracy',      definition: 'A system of government in which one person possesses absolute power' },
  { word: 'Bureaucracy',    definition: 'A system marked by complex procedures and strict adherence to rules' },
  { word: 'Perjury',        definition: 'The offense of willfully telling an untruth while under oath' },
  { word: 'Larceny',        definition: 'Theft of personal property' },
  { word: 'Subpoena',       definition: 'A writ ordering a person to appear before a court' },
  { word: 'Indictment',     definition: 'A formal charge or accusation of a serious crime' },
  { word: 'Inculpate',      definition: 'To make someone appear guilty; to incriminate' },
  { word: 'Extradite',      definition: 'To hand over a person accused of a crime to the jurisdiction requesting them' },

  /* ── Deception & manipulation ───────────────────────────────── */
  { word: 'Dissimulate',    definition: 'To conceal one\'s true thoughts, feelings, or character by pretence' },
  { word: 'Hoodwink',       definition: 'To deceive or trick someone' },
  { word: 'Pretext',        definition: 'A reason given to justify an action that conceals the true reason' },
  { word: 'Machination',    definition: 'A scheme or plot, especially one formed in secret and with harmful intent' },
  { word: 'Feign',          definition: 'To pretend to be affected by a feeling or condition' },
  { word: 'Bamboozle',      definition: 'To trick or confuse someone; to mystify or perplex' },
  { word: 'Legerdemain',    definition: 'Sleight of hand; artful deception; trickery' },
  { word: 'Counterfeit',    definition: 'Made in exact imitation with intent to deceive; to forge or fake' },

  /* ── Speech & argument ──────────────────────────────────────── */
  { word: 'Declaim',        definition: 'To recite a speech dramatically; to protest or condemn forcefully' },
  { word: 'Perorate',       definition: 'To speak at length; to sum up and conclude a speech' },
  { word: 'Vitriolic',      definition: 'Filled with bitter criticism or malice; caustic and scathing' },
  { word: 'Eloquence',      definition: 'Fluent or persuasive speaking or writing' },
  { word: 'Pleonasm',       definition: 'The use of more words than are necessary to express an idea' },

  /* ── Excess & scarcity ──────────────────────────────────────── */
  { word: 'Profusion',      definition: 'An abundance or large quantity of something' },
  { word: 'Superfluity',    definition: 'An unnecessarily large amount; a surplus beyond what is needed' },
  { word: 'Indigence',      definition: 'Extreme poverty; the state of being without financial resources' },
  { word: 'Privation',      definition: 'The state of being deprived of something essential; hardship' },
  { word: 'Destitution',    definition: 'Extreme poverty and deprivation of all necessities' },
  { word: 'Opulence',       definition: 'Great wealth or luxuriousness; ostentatious abundance' },
  { word: 'Munificence',    definition: 'More than sufficient generosity; great liberality in giving' },
  { word: 'Prodigality',    definition: 'Reckless extravagance; lavish or wasteful spending' },
  { word: 'Plenitude',      definition: 'A large or excessive amount; abundance; fullness' },
  { word: 'Ubiquity',       definition: 'The fact of appearing everywhere or being everywhere at the same time' },
  { word: 'Scarcity',       definition: 'The state of being rare or in short supply; insufficiency' },
  { word: 'Redundancy',     definition: 'The state of being superfluous or not needed; surplus to requirements' },
  { word: 'Amplitude',      definition: 'The extent or range of something; abundance; breadth' },

  /* ── Colour & visual quality adjectives ─────────────────────── */
  { word: 'Lambent',        definition: 'Softly bright or radiant; (of wit) gently brilliant' },
  { word: 'Liminal',        definition: 'Relating to a transitional stage; occupying a threshold position' },
  { word: 'Sempiternal',    definition: 'Eternal and unchanging; everlasting' },
  { word: 'Sidereal',       definition: 'Relating to the stars or constellations; measured by the stars' },
  { word: 'Sylvan',         definition: 'Consisting of or associated with woods; pleasantly rural' },
  { word: 'Vespertine',     definition: 'Relating to or occurring in the evening' },
  { word: 'Matutinal',      definition: 'Relating to or occurring in the morning; of the dawn' },
  { word: 'Fugacious',      definition: 'Tending to disappear quickly; transitory; fleeting' },
  { word: 'Aureate',        definition: 'Made of or having the color of gold; excessively elaborate in style' },
  { word: 'Cerulean',       definition: 'A deep sky-blue color' },
  { word: 'Viridian',       definition: 'A blue-green pigment; of a blue-green color' },
  { word: 'Umber',          definition: 'A dark brown earth pigment; of a dark brownish color' },
  { word: 'Sable',          definition: 'Black in color; a heraldic tincture of black' },
  { word: 'Amaranthine',    definition: 'Of a purplish-red color; everlasting; unfading' },
  { word: 'Opalescent',     definition: 'Showing luminous colors that shift with the angle of view; like opal' },
  { word: 'Hirsute',        definition: 'Covered with hair; shaggy; hairy' },

  /* ── Architecture ───────────────────────────────────────────── */
  { word: 'Baroque',        definition: 'Highly ornate and extravagant in style; characteristic of 17th-century art' },
  { word: 'Escarpment',     definition: 'A long steep slope or cliff at the edge of a plateau or ridge' },
  { word: 'Frieze',         definition: 'A broad horizontal band of carved or painted decoration on a building' },
  { word: 'Crenellation',   definition: 'A pattern of alternating gaps and raised sections on a battlement' },
  { word: 'Portico',        definition: 'A porch with columns and a pediment leading to the entrance of a building' },
  { word: 'Clerestory',     definition: 'A high section of wall containing windows above the level of an adjoining roof' },
  { word: 'Campanile',      definition: 'A bell tower, especially a free-standing one adjacent to a church' },
  { word: 'Tympanum',       definition: 'The triangular space enclosed by a pediment or arch above a door' },
  { word: 'Pilaster',       definition: 'A rectangular column projecting slightly from a wall' },
  { word: 'Balustrade',     definition: 'A railing supported by balusters; a low parapet' },
  { word: 'Colonnade',      definition: 'A row of evenly spaced columns supporting a roof or forming a walkway' },
  { word: 'Entablature',    definition: 'The upper part of a classical building supported by columns' },
  { word: 'Pediment',       definition: 'The triangular upper part of the front of a classical building' },
  { word: 'Loggia',         definition: 'A gallery or room with one or more open sides; a roofed arcade' },
  { word: 'Fenestration',   definition: 'The arrangement, proportioning, and design of windows in a building' },
  { word: 'Rustication',    definition: 'The cutting of masonry blocks to give a rough or deeply channeled effect' },
  { word: 'Volute',         definition: 'A spiral scroll characteristic of Ionic and Corinthian capitals' },
  { word: 'Spandrel',       definition: 'The triangular space between two arches or between an arch and a corner' },
  { word: 'Apse',           definition: 'A large semicircular or polygonal recess in a church, typically vaulted' },
  { word: 'Nave',           definition: 'The central part of a church building, intended for the congregation' },
  { word: 'Oculus',         definition: 'A round window or opening at the top of a dome' },
  { word: 'Rotunda',        definition: 'A round building or room, especially one with a dome' },
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

  /* Resolve (or create) the deck id */
  let deckId: string | null = null
  if (cached) {
    const exists = await db.vocab_decks.get(cached)
    if (exists) deckId = cached
  }
  if (!deckId) {
    const existing = await db.vocab_decks.where('languageName').equals(ENGLISH_DECK_NAME).first()
    if (existing) {
      deckId = existing.id
    } else {
      deckId = crypto.randomUUID()
      const deck: VocabDeck = {
        id: deckId,
        languageName: ENGLISH_DECK_NAME,
        description:  'Advanced English vocabulary — GRE & SAT level words for mastery.',
        createdAt:    Date.now(),
      }
      await db.vocab_decks.add(deck)
    }
    try { localStorage.setItem(ENGLISH_DECK_LS_KEY, deckId) } catch { /* noop */ }
  }

  /* Incremental top-up — add any words not yet present in the deck.
     Lets existing installs gain newly-added words without re-seeding. */
  const existingCards = await db.vocab_cards.where('deckId').equals(deckId).toArray()
  if (existingCards.length < ADVANCED_ENGLISH_WORDS.length) {
    const haveWords = new Set(existingCards.map(c => c.foreignWord.toLowerCase()))
    const now = Date.now()
    const newCards: VocabCard[] = ADVANCED_ENGLISH_WORDS
      .filter(w => !haveWords.has(w.word.toLowerCase()))
      .map(w => ({
        id:                   crypto.randomUUID(),
        deckId:               deckId!,
        foreignWord:          w.word,
        nativeTranslation:    w.definition,
        phoneticSpelling:     '',
        easeFactor:           2.5,
        reviewIntervalDays:   0,
        nextReviewTimestamp:  now,
        consecutiveSuccesses: 0,
        stabilityFactor:      0,
      }))
    if (newCards.length > 0) await db.vocab_cards.bulkAdd(newCards)
  }

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
