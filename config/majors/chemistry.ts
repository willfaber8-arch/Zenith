/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Chemistry Major Resource Map
 *
 * Loaded on-demand only when a user declares a Chemistry major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Lab & Safety Reference     — NIST WebBook, PubChem, ChemSpider
 *   2. Research Databases         — SciFinder, ACS Publications, RSC
 *   3. Learning Resources         — Khan Academy, MIT OCW, ChemLibreTexts
 *   4. Professional Organizations — ACS, RSC, AIC
 *   5. Career Resources           — C&EN Jobs, ChemJobs, Handshake
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const CHEMISTRY: MajorConfig = {
  id:         'chemistry',
  name:       'Chemistry',
  shortName:  'Chem',
  department: 'College of Natural Sciences',
  categories: [

    /* ── 1. Lab & Safety Reference ──────────────────────────── */
    {
      id:    'lab-safety-reference',
      label: 'Lab & Safety Reference',
      links: [
        {
          id:          'nist-chemistry-webbook',
          title:       'NIST Chemistry WebBook',
          description: 'Authoritative free database of thermochemical, thermophysical, and spectroscopic data for thousands of chemical compounds including IR, MS, UV-Vis spectra, and phase change properties. Maintained by the National Institute of Standards and Technology and used universally for compound identification and literature validation.',
          url:         'https://webbook.nist.gov',
          tag:         'Thermodynamic Data',
        },
        {
          id:          'pubchem',
          title:       'PubChem — Chemical Database',
          description: 'NIH\'s open chemistry database aggregating structural data, biological activities, safety information, patent links, and literature citations for over 100 million chemical compounds. The Compound Summary pages provide MSDS data, GHS hazard classifications, and downloadable 2D/3D structure files.',
          url:         'https://pubchem.ncbi.nlm.nih.gov',
          tag:         'Chemical Database',
        },
        {
          id:          'chemspider',
          title:       'ChemSpider — Royal Society of Chemistry',
          description: 'Free chemical structure search engine aggregating compound data from hundreds of data sources with links to predicted and experimental spectra, properties, and literature references. Useful for cross-referencing compound identifiers, CAS numbers, and synonyms during literature and lab prep work.',
          url:         'https://www.chemspider.com',
          tag:         'Structure Search',
        },
        {
          id:          'msds-online',
          title:       'MSDS Online — Safety Data Sheets',
          description: 'Repository of Safety Data Sheets (SDS/MSDS) for hundreds of thousands of chemical products from manufacturers worldwide, searchable by product name, CAS number, or manufacturer. Reviewing SDS sheets before handling new reagents is a core lab safety practice in all chemistry courses.',
          url:         'https://www.msdsonline.com',
          tag:         'Lab Safety',
        },
        {
          id:          'chemdraw',
          title:       'PerkinElmer ChemDraw',
          description: 'Industry-standard chemical structure drawing and analysis software used in academic and pharmaceutical research for 2D and 3D structure generation, NMR prediction, and MS fragmentation. Many universities provide free ChemDraw Prime or Professional licenses through academic agreements — check your department\'s IT resources.',
          url:         'https://www.perkinelmer.com/category/chemdraw',
          tag:         'Structure Drawing',
        },
      ],
    },

    /* ── 2. Research Databases ──────────────────────────────── */
    {
      id:    'research-databases',
      label: 'Research Databases',
      links: [
        {
          id:          'scifinder',
          title:       'CAS SciFinder Discovery Platform',
          description: 'The most comprehensive chemistry literature and substance database, indexing over 200 million substances and 80 million document records from journals, patents, and conference proceedings. University access is nearly universal for chemistry programs; SciFinder proficiency is expected in graduate school and industrial research.',
          url:         'https://www.cas.org/solutions/cas-scifinder-discovery-platform',
          tag:         'Literature Search',
        },
        {
          id:          'acs-publications',
          title:       'ACS Publications',
          description: 'Online portal for the American Chemical Society\'s suite of peer-reviewed journals including JACS, Organic Letters, Analytical Chemistry, and ACS Nano — among the most-cited chemistry journals worldwide. University library subscriptions typically provide full-text access to all ACS journals.',
          url:         'https://pubs.acs.org',
          tag:         'ACS Journals',
        },
        {
          id:          'rsc-journals',
          title:       'Royal Society of Chemistry — Journals',
          description: 'Portal for RSC\'s portfolio of high-impact journals including Chemical Communications, Dalton Transactions, Green Chemistry, and The Analyst. RSC offers free access to many older articles and an open-access pathway; browsing the journal home pages is useful for understanding subfield trends.',
          url:         'https://www.rsc.org',
          tag:         'RSC Journals',
        },
        {
          id:          'pubmed-chemistry',
          title:       'PubMed — Biochemistry & Medicinal Chemistry',
          description: 'NIH\'s free biomedical literature database covering biochemistry, medicinal chemistry, chemical biology, and pharmacology — areas where chemistry research intersects with biology and medicine. The full-text availability through PubMed Central makes it an excellent complement to SciFinder for biochemistry literature reviews.',
          url:         'https://pubmed.ncbi.nlm.nih.gov',
          tag:         'Biochemistry',
        },
        {
          id:          'web-of-science',
          title:       'Web of Science — Citation Analysis',
          description: 'Multidisciplinary citation indexing database providing impact factor data, h-index metrics, and cited reference searching across chemistry, materials science, biochemistry, and chemical engineering. University library access enables cross-disciplinary literature mapping and journal ranking analysis for graduate school preparation.',
          url:         'https://www.webofscience.com',
          tag:         'Citation Analysis',
        },
      ],
    },

    /* ── 3. Learning Resources ──────────────────────────────── */
    {
      id:    'learning-resources',
      label: 'Learning Resources',
      links: [
        {
          id:          'khan-academy-chemistry',
          title:       'Khan Academy — Chemistry',
          description: 'Free video lessons and practice exercises covering atomic structure, chemical bonding, stoichiometry, thermodynamics, kinetics, acids and bases, and electrochemistry at the general and organic chemistry level. Khan Academy\'s step-by-step problem explanations are particularly helpful for mastering stoichiometry and equilibrium calculations.',
          url:         'https://www.khanacademy.org/science/chemistry',
          tag:         'Fundamentals',
        },
        {
          id:          'mit-ocw-chemistry',
          title:       'MIT OCW — Chemistry',
          description: 'Complete lecture notes, problem sets, and exams from MIT\'s chemistry curriculum including Principles of Chemical Science, Organic Chemistry I and II, and Physical Chemistry freely downloadable online. The rigorous problem sets from MIT\'s 5.111 and 5.12 courses are an excellent preparation resource for the chemistry GRE.',
          url:         'https://ocw.mit.edu/courses/chemistry',
          tag:         'MIT Courseware',
        },
        {
          id:          'chem-libretexts',
          title:       'ChemLibreTexts — Open Chemistry Textbooks',
          description: 'Collaboratively authored open-access chemistry textbooks covering general chemistry, organic chemistry, analytical chemistry, physical chemistry, inorganic chemistry, and biochemistry. Free, modular, and frequently updated — many professors assign LibreTexts chapters as a free alternative to commercial textbooks.',
          url:         'https://chem.libretexts.org',
          tag:         'Open Textbooks',
        },
        {
          id:          'coursera-chemistry',
          title:       'Coursera — Chemistry Courses',
          description: 'University-taught chemistry courses from Duke, University of Kentucky, and other institutions covering general chemistry, analytical chemistry, and materials science topics. Free audit access is available for most courses; verified certificates can be earned for a fee or through financial aid.',
          url:         'https://www.coursera.org/browse/physical-science-and-engineering/chemistry',
          tag:         'Online Courses',
        },
        {
          id:          'tyler-dewitt',
          title:       'Tyler DeWitt — Chemistry YouTube',
          description: 'Engaging YouTube channel producing approachable video explanations of general chemistry concepts with a focus on building intuition before tackling formal mathematical treatments. Tyler\'s videos on naming ionic compounds, balancing equations, and acid-base chemistry are among the most-watched chemistry tutorials on the platform.',
          url:         'https://www.youtube.com/tylerdewitt',
          tag:         'Video Tutorials',
        },
      ],
    },

    /* ── 4. Professional Organizations ─────────────────────── */
    {
      id:    'professional-organizations',
      label: 'Professional Organizations',
      links: [
        {
          id:          'acs',
          title:       'American Chemical Society',
          description: 'The world\'s largest scientific society focused on chemistry, publishing over 70 peer-reviewed journals and hosting the ACS National Meeting twice yearly. ACS student membership provides access to C&EN news, the SciFinder scholarship program, networking with local sections, and career resources.',
          url:         'https://www.acs.org',
          tag:         'Professional Society',
        },
        {
          id:          'rsc-org',
          title:       'Royal Society of Chemistry',
          description: 'UK-based international professional body for chemical scientists, engineers, and technologists publishing leading journals and offering professional accreditation pathways. RSC Affiliate membership is available to students and provides access to the RSC journal portfolio and career development resources.',
          url:         'https://www.rsc.org',
          tag:         'International Society',
        },
        {
          id:          'nist-chem',
          title:       'NIST — Chemical Sciences Division',
          description: 'National Institute of Standards and Technology\'s chemical sciences research programs producing reference data, measurement standards, and calibration services used across the chemical industry and academia. NIST internships through the SURF and PREP programs are highly competitive and prestigious for undergraduate researchers.',
          url:         'https://www.nist.gov',
          tag:         'Standards & Research',
        },
        {
          id:          'aic',
          title:       'American Institute of Chemists',
          description: 'Professional organization focused on the professional development and recognition of chemists and chemical engineers through the AIC Fellow and Certified Chemist designations. The AIC Foundation provides scholarships and awards for undergraduate chemistry students demonstrating excellence and professional promise.',
          url:         'https://www.theaic.org',
          tag:         'Professional Certification',
        },
        {
          id:          'acs-careers',
          title:       'ACS Career Resources',
          description: 'American Chemical Society career hub featuring salary surveys, career development articles, job hunting advice, and the ACS Careers job board with postings from pharmaceutical, materials, government, and academic employers. The biennial ACS Salary Survey is the benchmark compensation reference for chemistry professionals at all experience levels.',
          url:         'https://www.acs.org/careers',
          tag:         'ACS Career Hub',
        },
      ],
    },

    /* ── 5. Career Resources ─────────────────────────────────── */
    {
      id:    'career-resources',
      label: 'Career Resources',
      links: [
        {
          id:          'acs-chemcensus',
          title:       'ACS ChemCensus — Salary Survey',
          description: 'Biennial ACS survey reporting comprehensive salary data for chemists and chemical engineers broken down by degree level, industry sector, years of experience, and geographic region. The most authoritative compensation benchmark available for chemistry professionals at every career stage.',
          url:         'https://www.acs.org/content/acs/en/careers/college-to-career/chemistry-career-information.html',
          tag:         'Salary Data',
        },
        {
          id:          'cen-jobs',
          title:       'C&EN Jobs — ACS Chemistry Job Board',
          description: 'Chemical & Engineering News job board aggregating positions in pharmaceutical, biotech, materials, analytical, and academic chemistry from leading global employers. Postings include both full-time roles and undergraduate and graduate internship opportunities at companies ranging from Fortune 500 firms to startups.',
          url:         'https://cen.acs.org/careers.html',
          tag:         'Chemistry Jobs',
        },
        {
          id:          'chemjobs',
          title:       'ChemJobs — Specialized Chemistry Board',
          description: 'Niche job board dedicated to chemistry, biochemistry, and chemical engineering positions across pharmaceutical R&D, quality assurance, environmental testing, and materials science. Employer listings frequently include smaller CROs and analytical labs that do not post on general boards.',
          url:         'https://www.chemjobs.com',
          tag:         'Specialized Jobs',
        },
        {
          id:          'glassdoor-chemistry',
          title:       'Glassdoor — Chemistry & Pharma Salaries',
          description: 'Company review platform with salary submissions and interview reports for chemist, research scientist, and laboratory analyst roles at pharmaceutical, biotech, and chemical manufacturing companies. Glassdoor\'s interview question archives for pharma companies are valuable preparation for behavioral and technical interview rounds.',
          url:         'https://www.glassdoor.com',
          tag:         'Salary Research',
        },
        {
          id:          'handshake-chemistry',
          title:       'Handshake',
          description: 'University-connected recruiting platform where pharmaceutical companies, national labs, environmental testing firms, and chemical manufacturers post internship and co-op positions targeting chemistry students. On-campus chemistry company information sessions and career fairs listed on Handshake are among the highest-yield early recruiting touchpoints.',
          url:         'https://joinhandshake.com',
          tag:         'Campus Recruiting',
        },
      ],
    },

  ],
}
