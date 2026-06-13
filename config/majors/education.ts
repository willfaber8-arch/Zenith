/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Education Major Resource Map
 *
 * Loaded on-demand only when a user declares an Education major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Lesson Planning & Resources    — TPT, Khan Academy, Edutopia
 *   2. Classroom Technology           — Google Classroom, Kahoot, Nearpod
 *   3. Certification & Licensing      — Praxis, NASDTEC, edTPA
 *   4. Research & Professional Dev    — ERIC, ASCD, NEA, NAEYC
 *   5. Career Resources               — Teach.org, SchoolSpring, Handshake
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const EDUCATION: MajorConfig = {
  id:         'education',
  name:       'Education',
  shortName:  'Education',
  department: 'College of Education',
  categories: [

    /* ── 1. Lesson Planning & Resources ─────────────────────── */
    {
      id:    'lesson-planning-resources',
      label: 'Lesson Planning & Resources',
      links: [
        {
          id:          'teachers-pay-teachers',
          title:       'Teachers Pay Teachers',
          description: 'Peer-created marketplace with millions of lesson plans, worksheets, unit studies, and classroom activities across every grade level and subject area. A significant portion of resources are free; premium resources often save dozens of planning hours during student teaching.',
          url:         'https://www.teacherspayteachers.com',
          tag:         'Lesson Plans',
        },
        {
          id:          'khan-academy-teaching',
          title:       'Khan Academy — Teacher Tools',
          description: 'Free learning platform providing teacher dashboards, class assignment tools, and detailed student progress reports aligned to Common Core and state standards. The Khan Academy Teacher portal is widely integrated into both public school and student teaching placements as a differentiated instruction resource.',
          url:         'https://www.khanacademy.org',
          tag:         'Free Curriculum',
        },
        {
          id:          'edutopia',
          title:       'Edutopia — Teaching Strategies',
          description: 'George Lucas Educational Foundation\'s resource hub featuring research-backed articles, videos, and guides on project-based learning, social-emotional learning, and classroom management. An excellent source of practical, evidence-informed pedagogical strategies for education methods coursework.',
          url:         'https://www.edutopia.org',
          tag:         'Pedagogy',
        },
        {
          id:          'common-sense-education',
          title:       'Common Sense Education',
          description: 'Curated library of digital citizenship curricula, app reviews, and technology integration guides designed for K–12 classrooms. The digital citizenship scope and sequence is freely downloadable and covers online safety, privacy, and media literacy at every grade band.',
          url:         'https://www.commonsense.org/education',
          tag:         'Digital Citizenship',
        },
        {
          id:          'readwritethink',
          title:       'ReadWriteThink — Literacy Resources',
          description: 'NCTE and ILA-sponsored collection of K–12 English language arts lesson plans, interactive student tools, and printable activities aligned to literacy standards. All resources are free and peer-reviewed by practicing educators and literacy researchers.',
          url:         'https://www.readwritethink.org',
          tag:         'Literacy / ELA',
        },
      ],
    },

    /* ── 2. Classroom Technology ────────────────────────────── */
    {
      id:    'classroom-technology',
      label: 'Classroom Technology',
      links: [
        {
          id:          'google-classroom',
          title:       'Google Classroom',
          description: 'Free learning management system integrated with Google Workspace for Education that streamlines assignment distribution, grading, and student feedback. The most widely deployed LMS in U.S. K–12 schools, making familiarity with Classroom a baseline expectation for student teachers.',
          url:         'https://classroom.google.com',
          tag:         'LMS',
        },
        {
          id:          'kahoot',
          title:       'Kahoot! — Game-Based Learning',
          description: 'Interactive quiz and game platform that engages students through competitive, real-time trivia displayed on classroom screens. Free educator accounts support unlimited players and basic question types; premium plans add assignment mode and student-paced kahoots.',
          url:         'https://kahoot.com',
          tag:         'Gamification',
        },
        {
          id:          'nearpod',
          title:       'Nearpod — Interactive Lessons',
          description: 'Synchronous classroom platform that lets teachers push slides, polls, virtual field trips, and 3D models to every student device in real time. A Silver Nearpod account is free and sufficient for most student teaching presentations; Gold accounts are often provided by cooperating schools.',
          url:         'https://nearpod.com',
          tag:         'Interactive Lessons',
        },
        {
          id:          'padlet',
          title:       'Padlet — Collaborative Boards',
          description: 'Virtual bulletin board tool that enables collaborative brainstorming, digital portfolios, book clubs, and exit ticket activities through a visual, drag-and-drop interface. Free accounts support up to three active padlets — ideal for small-group collaborative learning activities during field placements.',
          url:         'https://padlet.com',
          tag:         'Collaboration',
        },
        {
          id:          'seesaw',
          title:       'Seesaw — Student Portfolio & Family App',
          description: 'Digital portfolio platform widely used in elementary and middle school classrooms where students capture, reflect on, and share their learning through photos, videos, and drawings. Seesaw\'s family communication feature makes it especially prevalent in PreK–5 placements.',
          url:         'https://web.seesaw.me',
          tag:         'Student Portfolio',
        },
      ],
    },

    /* ── 3. Certification & Licensing ───────────────────────── */
    {
      id:    'certification-licensing',
      label: 'Certification & Licensing',
      links: [
        {
          id:          'praxis',
          title:       'ETS Praxis — Teacher Licensing Tests',
          description: 'Educational Testing Service administers the Praxis Core Academic Skills assessments and Praxis Subject Assessments required for initial teacher licensure in most U.S. states. The Praxis website provides official study companions, interactive practice tests, and state-specific passing score requirements.',
          url:         'https://www.ets.org/praxis',
          tag:         'Licensure Exams',
        },
        {
          id:          'nasdtec',
          title:       'NASDTEC — Interstate Certification Compact',
          description: 'National Association of State Directors of Teacher Education and Certification manages the interstate reciprocity agreements that determine how teaching licenses transfer between states. The NASDTEC online map is essential for students planning to teach in a different state than where they completed their preparation program.',
          url:         'https://www.nasdtec.net',
          tag:         'Interstate Licensing',
        },
        {
          id:          'edtpa',
          title:       'edTPA — Performance-Based Assessment',
          description: 'Nationally used teacher performance assessment requiring candidates to plan, instruct, assess, and reflect on classroom teaching as captured in video submissions and written commentary. Required for licensure in over 40 states; the SCALE edTPA website provides official handbooks for each content area and grade band.',
          url:         'https://www.edtpa.com',
          tag:         'Performance Assessment',
        },
        {
          id:          'nasdtec-map',
          title:       'NASDTEC State Licensure Map',
          description: 'Interactive map tool showing each state\'s certification requirements, reciprocity agreements, and license endorsement structure side by side. An essential reference during student teaching and job placement to understand credential portability across state lines.',
          url:         'https://www.nasdtec.net/page/NASDTEC_Map',
          tag:         'State Requirements',
        },
        {
          id:          'pearson-teacher-prep',
          title:       'Pearson Teacher Education',
          description: 'Publisher of leading education textbooks and teacher preparation assessments including the Pearson RICA reading instruction assessment and NES subject area exams required in several states. The Pearson Practice for Educators portal provides test preparation for state-specific certification exams.',
          url:         'https://www.pearsonhighered.com/educator',
          tag:         'Prep Resources',
        },
      ],
    },

    /* ── 4. Research & Professional Development ─────────────── */
    {
      id:    'research-professional-development',
      label: 'Research & Professional Development',
      links: [
        {
          id:          'eric',
          title:       'ERIC — Education Research Information Center',
          description: 'U.S. Department of Education\'s free database of peer-reviewed education research journals, conference papers, and government reports covering K–12 and higher education. The primary literature search tool for education research papers, thesis work, and evidence-based practice assignments.',
          url:         'https://eric.ed.gov',
          tag:         'Research Database',
        },
        {
          id:          'ascd',
          title:       'ASCD — Educational Leadership',
          description: 'Professional learning community for educators at all levels publishing the influential Educational Leadership journal, professional development books, and online courses on instructional design, equity, and school leadership. ASCD membership provides full access to the journal archive and online PD library.',
          url:         'https://www.ascd.org',
          tag:         'Professional Learning',
        },
        {
          id:          'nea',
          title:       'National Education Association',
          description: 'Largest professional employee organization in the United States representing three million educators and advocating for public education funding, teacher working conditions, and educational equity. Student NEA membership is free through many university chapters and provides access to resources, scholarships, and professional networks.',
          url:         'https://www.nea.org',
          tag:         'Educator Advocacy',
        },
        {
          id:          'naeyc',
          title:       'NAEYC — Early Childhood Education',
          description: 'National Association for the Education of Young Children publishes the position statements, ethical code, and developmentally appropriate practice frameworks that define quality early childhood education. Essential reading for PreK and elementary tracks, and membership provides access to Young Children journal and professional development resources.',
          url:         'https://www.naeyc.org',
          tag:         'Early Childhood',
        },
        {
          id:          'what-works-clearinghouse',
          title:       'What Works Clearinghouse — IES',
          description: 'Institute of Education Sciences initiative that reviews the rigor of education research and publishes evidence-based practice guides on reading, math, science, behavior, and dropout prevention. The Practice Guides translate research into actionable recommendations for classroom instruction.',
          url:         'https://ies.ed.gov/ncee/wwc',
          tag:         'Evidence-Based Practice',
        },
      ],
    },

    /* ── 5. Career Resources ─────────────────────────────────── */
    {
      id:    'career-resources',
      label: 'Career Resources',
      links: [
        {
          id:          'teach-org',
          title:       'Teach.org — Teaching Career Hub',
          description: 'National initiative providing an overview of the path to becoming a teacher, including state-by-state preparation program finders, salary data, and testimonials from teachers in every grade level and subject. A useful starting resource for understanding teacher certification pathways before graduation.',
          url:         'https://www.teach.org',
          tag:         'Career Exploration',
        },
        {
          id:          'teachers-teachers',
          title:       'Teachers-Teachers.com — Job Board',
          description: 'Specialized teacher job board listing K–12 positions across the U.S. from both public and independent school districts, with filters by grade level, subject, and state. Updated regularly by school HR departments seeking certified candidates in specific content areas.',
          url:         'https://www.teachers-teachers.com',
          tag:         'Teaching Jobs',
        },
        {
          id:          'edweek-jobs',
          title:       'Education Week — EdWeek Jobs',
          description: 'Job board associated with the nation\'s leading education news publication featuring teaching positions, school administrative roles, and education policy positions across the public and nonprofit sectors. EdWeek\'s editorial content provides context on the policy and leadership landscape prospective teachers enter.',
          url:         'https://www.edweek.org/jobs',
          tag:         'Ed Jobs',
        },
        {
          id:          'schoolspring',
          title:       'SchoolSpring — K–12 Job Board',
          description: 'Large K–12 school hiring platform used by thousands of school districts to post teaching vacancies, upload applications, and manage candidate pipelines. Free to job seekers; many districts accept SchoolSpring applications in lieu of paper district applications.',
          url:         'https://www.schoolspring.com',
          tag:         'K–12 Hiring',
        },
        {
          id:          'handshake-education',
          title:       'Handshake',
          description: 'University-connected recruiting platform where school districts, charter networks, and education nonprofits post student teaching, substitute, and entry-level teaching positions directly to verified college students. Early-career virtual hiring events on Handshake frequently include education-specific employer sessions.',
          url:         'https://joinhandshake.com',
          tag:         'Campus Recruiting',
        },
      ],
    },

  ],
}
