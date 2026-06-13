/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Nursing Major Resource Map
 *
 * Loaded on-demand only when a user declares a Nursing major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Clinical Reference         — Drug guides, Medscape, UpToDate
 *   2. NCLEX Preparation          — NCSBN, Kaplan, UWorld, ATI, Saunders
 *   3. Research & Evidence        — PubMed, CINAHL, Cochrane, AJN, AHRQ
 *   4. Professional Organizations — ANA, NSNA, NLN, AACN, Sigma
 *   5. Career & Licensing         — License verification, job boards
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const NURSING: MajorConfig = {
  id:         'nursing',
  name:       'Nursing',
  shortName:  'Nursing',
  department: 'College of Nursing',
  categories: [

    /* ── 1. Clinical Reference ──────────────────────────────── */
    {
      id:    'clinical-reference',
      label: 'Clinical Reference',
      links: [
        {
          id:          'nurses-pocket-guide',
          title:       'Nurse\'s Pocket Guide — Diagnoses & Interventions',
          description: 'Quick-reference guide to NANDA nursing diagnoses with associated outcomes and evidence-based interventions organized for rapid clinical decision-making. Widely used in clinical rotations to structure care plan documentation.',
          url:         'https://www.nursingpocketguide.com',
          tag:         'Diagnoses',
        },
        {
          id:          'davis-drug-guide',
          title:       'Davis\'s Drug Guide for Nurses',
          description: 'Comprehensive pharmacology reference covering drug classifications, mechanisms, dosing, contraindications, and nursing implications for thousands of medications. The online edition is updated continuously with FDA alerts and new drug approvals.',
          url:         'https://www.drugguide.com',
          tag:         'Pharmacology',
        },
        {
          id:          'medscape',
          title:       'Medscape — Clinical Reference',
          description: 'Free clinician reference covering drug interactions, disease monographs, clinical procedures, and medical news updated daily by physician editors. The drug interaction checker is particularly useful during medication administration review.',
          url:         'https://www.medscape.com',
          tag:         'Clinical Tools',
        },
        {
          id:          'uptodate',
          title:       'UpToDate — Evidence-Based Clinical Decisions',
          description: 'Gold-standard point-of-care clinical decision support used in hospitals worldwide, synthesizing the best available evidence into graded recommendations. Most university hospitals provide free access through their library systems.',
          url:         'https://www.uptodate.com',
          tag:         'Point-of-Care',
        },
        {
          id:          'nursing-central',
          title:       'Nursing Central — Unbound Medicine',
          description: 'Integrated mobile reference combining Davis\'s Drug Guide, Taber\'s Cyclopedic Medical Dictionary, and Diseases and Disorders into a single offline-capable app. The go-to clinical companion app during hospital and community health rotations.',
          url:         'https://www.unboundmedicine.com/nursingcentral',
          tag:         'Mobile Reference',
        },
      ],
    },

    /* ── 2. NCLEX Preparation ───────────────────────────────── */
    {
      id:    'nclex-preparation',
      label: 'NCLEX Preparation',
      links: [
        {
          id:          'ncsbn',
          title:       'NCSBN — National Council of State Boards of Nursing',
          description: 'Official governing body that develops and administers the NCLEX-RN and NCLEX-PN licensure examinations, publishing the current test plan, candidate bulletins, and Next Generation NCLEX specifications. The authoritative source for understanding exam structure and eligibility requirements.',
          url:         'https://www.ncsbn.org',
          tag:         'Official Body',
        },
        {
          id:          'kaplan-nclex',
          title:       'Kaplan NCLEX Review',
          description: 'Structured NCLEX prep course with a proprietary decision tree framework, thousands of practice questions categorized by client need, and detailed rationales for all answer choices. A widely recommended commercial prep resource for both first-time and repeat test-takers.',
          url:         'https://www.kaptest.com/nclex',
          tag:         'Test Prep',
        },
        {
          id:          'uworld-nursing',
          title:       'UWorld Nursing — NCLEX Question Bank',
          description: 'High-yield question bank with detailed, illustration-rich rationales and a performance dashboard that identifies weak content areas for targeted review. Research consistently shows UWorld usage correlates with NCLEX first-time pass rates.',
          url:         'https://nursing.uworld.com',
          tag:         'Question Bank',
        },
        {
          id:          'ati-testing',
          title:       'ATI Nursing Education',
          description: 'Comprehensive assessment and learning platform used by nursing programs nationwide to benchmark student readiness through proctored assessments and targeted remediation modules. Many programs require ATI modules as part of their curriculum.',
          url:         'https://www.atitesting.com',
          tag:         'Assessment',
        },
        {
          id:          'saunders-nclex',
          title:       'Saunders NCLEX-RN Examination Prep',
          description: 'Elsevier\'s Evolve online resource accompanying the Saunders Comprehensive Review textbook, offering over 5,000 practice questions with audio and video content. Organized by content area with adaptive quizzing to simulate NCLEX-style testing.',
          url:         'https://evolve.elsevier.com',
          tag:         'Comprehensive Review',
        },
      ],
    },

    /* ── 3. Research & Evidence ─────────────────────────────── */
    {
      id:    'research-evidence',
      label: 'Research & Evidence',
      links: [
        {
          id:          'pubmed',
          title:       'PubMed — Biomedical Literature',
          description: 'Free full-text and abstract database maintained by the National Library of Medicine covering over 35 million citations in biomedicine, nursing, and allied health. Essential for evidence-based practice literature searches and scholarly paper assignments.',
          url:         'https://pubmed.ncbi.nlm.nih.gov',
          tag:         'Literature Search',
        },
        {
          id:          'cinahl',
          title:       'CINAHL — Nursing & Allied Health Literature',
          description: 'The Cumulative Index to Nursing and Allied Health Literature is the premier database for nursing research, indexing over 5,000 journals not covered by PubMed. Accessible through most university library subscriptions and optimized for clinical nursing search queries.',
          url:         'https://www.ebsco.com/products/research-databases/cinahl',
          tag:         'Nursing Research',
        },
        {
          id:          'cochrane-library',
          title:       'Cochrane Library — Systematic Reviews',
          description: 'Internationally recognized repository of systematic reviews and meta-analyses that synthesize the highest levels of clinical evidence on health interventions. Cochrane reviews are foundational to evidence-based practice assignments and EBP project capstones.',
          url:         'https://www.cochranelibrary.com',
          tag:         'Systematic Reviews',
        },
        {
          id:          'ajn',
          title:       'American Journal of Nursing',
          description: 'The oldest and most widely read nursing journal in the United States, publishing peer-reviewed original research, continuing education articles, and clinical practice guidance. Many LWW articles are freely accessible through hospital and university library portals.',
          url:         'https://journals.lww.com/ajnonline',
          tag:         'Journal',
        },
        {
          id:          'ahrq',
          title:       'AHRQ — Agency for Healthcare Research and Quality',
          description: 'Federal agency producing evidence-based clinical practice guidelines, patient safety tools, and quality improvement resources that translate research into actionable hospital and community health protocols. The National Guideline Clearinghouse and AHRQ\'s PSNet safety resources are particularly relevant for clinical coursework.',
          url:         'https://www.ahrq.gov',
          tag:         'Clinical Guidelines',
        },
      ],
    },

    /* ── 4. Professional Organizations ─────────────────────── */
    {
      id:    'professional-organizations',
      label: 'Professional Organizations',
      links: [
        {
          id:          'ana',
          title:       'American Nurses Association',
          description: 'The professional organization representing the interests of the nation\'s 4.3 million registered nurses, setting the scope and standards of nursing practice and advocating for nursing workforce policy. ANA membership provides access to continuing education, ethical guidelines, and career resources.',
          url:         'https://www.nursingworld.org',
          tag:         'Professional Org',
        },
        {
          id:          'nsna',
          title:       'National Student Nurses\' Association',
          description: 'Pre-professional organization specifically for nursing students that offers mentorship, leadership development, and a national career fair connecting students with healthcare employers. NSNA membership is strongly recommended for networking and scholarship opportunities during nursing school.',
          url:         'https://www.nsna.org',
          tag:         'Student Org',
        },
        {
          id:          'nln',
          title:       'National League for Nursing',
          description: 'The premier organization for nurse educators, promoting excellence in nursing education through research, faculty development, and program accreditation. The NLN also publishes competency frameworks and testing resources aligned with prelicensure nursing curricula.',
          url:         'https://www.nln.org',
          tag:         'Nursing Education',
        },
        {
          id:          'aacn-nursing',
          title:       'American Association of Colleges of Nursing',
          description: 'National voice for baccalaureate and graduate nursing education, advocating for quality standards and publishing the Essentials framework that guides BSN and MSN curricula nationwide. AACN resources help students understand program accreditation and graduate education pathways.',
          url:         'https://www.aacnnursing.org',
          tag:         'Higher Education',
        },
        {
          id:          'sigma-theta-tau',
          title:       'Sigma Theta Tau — Nursing Honor Society',
          description: 'International nursing honor society recognizing academic achievement and leadership, inducting high-performing students into local chapters at over 700 academic institutions. Sigma membership provides access to nursing research funding, global networking, and leadership development programs.',
          url:         'https://www.sigmanursing.org',
          tag:         'Honor Society',
        },
      ],
    },

    /* ── 5. Career & Licensing ──────────────────────────────── */
    {
      id:    'career-licensing',
      label: 'Career & Licensing',
      links: [
        {
          id:          'ncsbn-license-verification',
          title:       'NCSBN Nursys — License Verification',
          description: 'Official interstate nursing license verification system maintained by NCSBN, covering participating Nurse Licensure Compact (NLC) states and enabling quick confirmation of licensure status for employers. Use this portal to verify your own license portability before applying to multi-state positions.',
          url:         'https://www.ncsbn.org/license-verification',
          tag:         'Licensing',
        },
        {
          id:          'ana-career-center',
          title:       'ANA Career Center',
          description: 'Job board hosted by the American Nurses Association featuring positions across clinical, administrative, education, and advanced practice nursing with salary benchmarking tools. Free to search; posting an ANA profile connects candidates with targeted employer outreach.',
          url:         'https://www.nursingworld.org/career',
          tag:         'Job Board',
        },
        {
          id:          'indeed-nursing',
          title:       'Indeed — Nursing Jobs',
          description: 'Aggregated nursing job listings spanning hospital bedside roles, outpatient clinic positions, school nursing, home health, and travel nursing contracts from employers nationwide. Indeed\'s salary estimation tool is useful for benchmarking compensation by specialty and geography.',
          url:         'https://www.indeed.com/q-nursing-jobs.html',
          tag:         'Job Aggregator',
        },
        {
          id:          'nurse-com',
          title:       'Nurse.com — Jobs & Continuing Education',
          description: 'Nursing-specific career platform combining a curated job board with a continuing education marketplace offering CE contact hours for license renewal. Speciality filter options help narrow searches to ED, ICU, OR, NICU, and other clinical environments.',
          url:         'https://www.nurse.com',
          tag:         'Nursing Career',
        },
        {
          id:          'bluepipes-travel',
          title:       'BluePipes — Travel Nursing Jobs',
          description: 'Platform connecting nurses with travel nursing agencies, offering side-by-side contract comparisons for pay, housing stipends, and shift details across hundreds of hospital systems. Free professional profile storage keeps credentials organized for multi-agency applications.',
          url:         'https://www.bluepipes.com',
          tag:         'Travel Nursing',
        },
      ],
    },

  ],
}
