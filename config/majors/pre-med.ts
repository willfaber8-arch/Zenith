/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Pre-Medicine Major Resource Map
 *
 * Loaded on-demand only when a user declares a Pre-Medicine track.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. MCAT Preparation         — AAMC, Khan Academy, Princeton Review, Kaplan, Magoosh
 *   2. Medical School Admissions — AMCAS, MSAR, AACOMAS, PreMed Advising, Med School HQ
 *   3. Clinical Resources        — UpToDate, AMBOSS, Lecturio, Osmosis, Sketchy Medical
 *   4. Research & Publications   — PubMed, NEJM, JAMA, The Lancet, BMJ
 *   5. Volunteering & Shadowing  — VolunteerMatch, AAMC Enrichment, Doximity, SDN, AMA
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const PRE_MED: MajorConfig = {
  id:         'pre-med',
  name:       'Pre-Medicine',
  shortName:  'Pre-Med',
  department: 'Pre-Health Advising',
  categories: [

    /* ── 1. MCAT Preparation ────────────────────────────────── */
    {
      id:    'mcat-prep',
      label: 'MCAT Preparation',
      links: [
        {
          id:          'aamc-mcat',
          title:       'AAMC — Official MCAT Preparation',
          description: 'The Association of American Medical Colleges provides the most authoritative MCAT study materials including official practice exams, section banks, and question packs. Content created directly by the test makers is the highest-fidelity preparation available.',
          url:         'https://www.aamc.org/students/applying/mcat',
          tag:         'Official',
        },
        {
          id:          'khan-mcat',
          title:       'Khan Academy — MCAT Review (Free)',
          description: 'Free comprehensive MCAT content review videos developed in partnership with AAMC covering biology, biochemistry, psychology, chemistry, physics, and critical analysis. An ideal foundation before purchasing additional practice resources.',
          url:         'https://www.khanacademy.org/test-prep/mcat',
          tag:         'Free Review',
        },
        {
          id:          'princeton-review-mcat',
          title:       'Princeton Review — MCAT Prep Courses',
          description: 'Structured MCAT prep courses, tutoring, and self-paced study programs with score improvement guarantees. Offers full-length practice tests and detailed analytics to identify weak content areas.',
          url:         'https://www.princetonreview.com/medical-school-advice/mcat',
          tag:         'Courses',
        },
        {
          id:          'kaplan-mcat',
          title:       'Kaplan — MCAT Prep & Practice',
          description: 'Comprehensive MCAT preparation including live and on-demand courses, Qbank with 3,000+ questions, and full-length practice tests. Kaplan\'s 7-book subject review series is widely used for content coverage.',
          url:         'https://www.kaptest.com/mcat',
          tag:         'Qbank',
        },
        {
          id:          'magoosh-mcat',
          title:       'Magoosh — MCAT Video Lessons & Practice',
          description: 'Affordable MCAT preparation platform with 200+ video lessons, 750+ practice questions, and detailed answer explanations. Magoosh offers email support from expert tutors and score prediction tools.',
          url:         'https://magoosh.com/mcat/',
          tag:         'Video Lessons',
        },
      ],
    },

    /* ── 2. Medical School Admissions ───────────────────────── */
    {
      id:    'medical-school-admissions',
      label: 'Medical School Admissions',
      links: [
        {
          id:          'amcas',
          title:       'AMCAS — MD Application Portal',
          description: 'The American Medical College Application Service is the centralized application used by 140+ MD-granting medical schools. Manages primary application submission, transcript verification, letters of recommendation, and activity entries.',
          url:         'https://students-residents.aamc.org/apply-medical-school/applying-medical-school-amcas',
          tag:         'MD Application',
        },
        {
          id:          'msar',
          title:       'MSAR — Medical School Admission Requirements',
          description: 'AAMC\'s interactive data tool providing accepted applicant GPA and MCAT ranges, application deadlines, tuition, and program details for every AMCAS-participating medical school. Essential for building a balanced school list.',
          url:         'https://students-residents.aamc.org/medical-school-admission-requirements',
          tag:         'School Data',
        },
        {
          id:          'aacomas',
          title:       'AACOMAS — DO Application Portal',
          description: 'The American Association of Colleges of Osteopathic Medicine Application Service is the centralized application for osteopathic medical schools. Required for applying to any of the 36 accredited DO-granting institutions in the US.',
          url:         'https://aacomas.aamc.org/',
          tag:         'DO Application',
        },
        {
          id:          'aamc-premed',
          title:       'AAMC — PreMed Advising Resources',
          description: 'The AAMC\'s official guidance for pre-med students covering core competencies, clinical experience recommendations, MCAT timing, and advice for building a competitive application.',
          url:         'https://www.aamc.org/students',
          tag:         'Advising',
        },
        {
          id:          'med-school-hq',
          title:       'Medical School HQ — Application Strategy',
          description: 'Resource hub with podcast, blog, and community for pre-med students navigating the application process. Covers personal statement writing, interview preparation, and school selection strategy.',
          url:         'https://medicalschoolhq.net/',
          tag:         'Strategy',
        },
      ],
    },

    /* ── 3. Clinical Resources ──────────────────────────────── */
    {
      id:    'clinical-resources',
      label: 'Clinical Resources',
      links: [
        {
          id:          'uptodate',
          title:       'UpToDate — Clinical Decision Support',
          description: 'The gold-standard physician reference tool providing evidence-based clinical recommendations for diagnosis, treatment, and prevention. Many universities and teaching hospitals provide free student access.',
          url:         'https://www.uptodate.com/',
          tag:         'Clinical Reference',
        },
        {
          id:          'amboss',
          title:       'AMBOSS — Medical Knowledge Platform',
          description: 'Integrated medical knowledge library and Qbank designed for USMLE preparation and clinical decision support. Features a unique dual-pane design linking high-yield learning objectives to exam-style practice questions.',
          url:         'https://www.amboss.com/',
          tag:         'USMLE Prep',
        },
        {
          id:          'lecturio',
          title:       'Lecturio — Medical Education Platform',
          description: 'Video-based medical education platform covering preclinical sciences and board preparation with 2,000+ videos and an adaptive Qbank. Widely used by medical students for Step 1 and Step 2 CK preparation.',
          url:         'https://www.lecturio.com/',
          tag:         'Video',
        },
        {
          id:          'osmosis',
          title:       'Osmosis — Visual Medical Learning',
          description: 'Multimedia medical education platform using visual learning, spaced repetition flashcards, and video summaries aligned to Step 1 high-yield topics. Osmosis notes are frequently shared in medical school study communities.',
          url:         'https://www.osmosis.org/',
          tag:         'Visual Learning',
        },
        {
          id:          'sketchy',
          title:       'Sketchy Medical — Mnemonic Video Learning',
          description: 'Mnemonic-based video learning system using richly illustrated scenes to encode microbiology, pharmacology, and pathology concepts for long-term retention. A favorite resource for board exam preparation in medical school.',
          url:         'https://www.sketchy.com/',
          tag:         'Mnemonics',
        },
      ],
    },

    /* ── 4. Research & Publications ─────────────────────────── */
    {
      id:    'research-publications',
      label: 'Research & Publications',
      links: [
        {
          id:          'pubmed-premed',
          title:       'PubMed — Biomedical Literature',
          description: 'NIH\'s free database of over 35 million biomedical citations spanning all medical and life science disciplines. A pre-med student\'s primary tool for identifying peer-reviewed sources for research projects and clinical volunteering reports.',
          url:         'https://pubmed.ncbi.nlm.nih.gov/',
          tag:         'Peer-Reviewed',
        },
        {
          id:          'nejm',
          title:       'NEJM — New England Journal of Medicine',
          description: 'The most cited medical journal in the world publishing landmark clinical trials, review articles, and case reports. Reading NEJM regularly demonstrates intellectual engagement with medicine and provides excellent talking points for interviews.',
          url:         'https://www.nejm.org/',
          tag:         'Top Journal',
        },
        {
          id:          'jama',
          title:       'JAMA — Journal of the American Medical Association',
          description: 'High-impact general medical journal publishing original research, systematic reviews, and clinical guidelines across all medical specialties. JAMA Network also includes subspecialty journals like JAMA Cardiology and JAMA Oncology.',
          url:         'https://jamanetwork.com/',
          tag:         'General Medicine',
        },
        {
          id:          'lancet',
          title:       'The Lancet — International Medicine',
          description: 'One of the world\'s oldest and most respected general medical journals with strong international focus and influential global health reporting. A key source for public health and epidemiology research papers.',
          url:         'https://www.thelancet.com/',
          tag:         'Global Health',
        },
        {
          id:          'bmj',
          title:       'BMJ — British Medical Journal',
          description: 'International peer-reviewed medical journal covering research, editorial commentary, and clinical practice guidance. BMJ publishes a substantial volume of open-access content freely readable without a subscription.',
          url:         'https://www.bmj.com/',
          tag:         'Open Access',
        },
      ],
    },

    /* ── 5. Volunteering & Shadowing ────────────────────────── */
    {
      id:    'volunteering-shadowing',
      label: 'Volunteering & Shadowing',
      links: [
        {
          id:          'volunteermatch',
          title:       'VolunteerMatch — Clinical & Community Volunteering',
          description: 'National database of volunteer opportunities searchable by location and cause area, including hospitals, free clinics, and health-focused nonprofits. A practical starting point for finding meaningful clinical volunteering hours.',
          url:         'https://www.volunteermatch.org/',
          tag:         'Volunteering',
        },
        {
          id:          'aamc-enrichment',
          title:       'AAMC — Summer Enrichment Programs',
          description: 'AAMC\'s directory of post-baccalaureate, summer research, and academic enrichment programs designed to help students from underrepresented backgrounds prepare for medical school applications.',
          url:         'https://www.aamc.org/students/financial/enrichment',
          tag:         'Programs',
        },
        {
          id:          'doximity',
          title:       'Doximity — Physician Network',
          description: 'Professional network for physicians and medical students with a directory useful for identifying potential shadowing physicians in a local area. Doximity also offers a free news digest curated for physicians.',
          url:         'https://www.doximity.com/',
          tag:         'Shadowing',
        },
        {
          id:          'student-doctor-network',
          title:       'Student Doctor Network — Pre-Med Community',
          description: 'Large online forum for pre-med and medical students sharing advice on applications, shadowing, volunteering, and navigating the medical school journey. SDN\'s school-specific forums contain applicant data going back many years.',
          url:         'https://www.studentdoctor.net/',
          tag:         'Community',
        },
        {
          id:          'ama-premed',
          title:       'AMA — Pre-Med Resources',
          description: 'The American Medical Association\'s resources for pre-medical students including guidance on building a strong application, finding mentors, and understanding the evolving landscape of medical education and practice.',
          url:         'https://www.ama-assn.org/education/accelerating-change-medical-education/premed-resources',
          tag:         'AMA',
        },
      ],
    },

  ],
}
