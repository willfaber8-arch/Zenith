import type { UniversityConfig } from './index'

export const CORNELL: UniversityConfig = {
  id:           'cornell',
  name:         'Cornell University',
  shortName:    'Cornell',
  location:     'Ithaca, NY',
  gpaScale:     '4.3',
  currencyName: 'Big Red Bucks',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:    'student-center',
          title: 'Student Center',
          tag:   'Portal',
          description: 'Central hub for enrollment, bursar account, grade tracking, financial aid, and degree progress — the authoritative record of your academic standing.',
          url: 'https://studentcenter.cornell.edu',
        },
        {
          id:    'canvas',
          title: 'Canvas LMS',
          tag:   'LMS',
          description: 'Course pages, assignment submissions, grading rubrics, professor announcements, and syllabi in one centralised learning management workspace.',
          url: 'https://canvas.cornell.edu',
        },
        {
          id:    'registrar',
          title: 'Office of the Registrar',
          tag:   'Admin',
          description: 'Manage add/drop requests, order official transcripts, enrollment verification letters, and file academic forms such as late withdrawals.',
          url: 'https://registrar.cornell.edu',
        },
        {
          id:    'dars',
          title: 'Degree Audit (DARS)',
          tag:   'Audit',
          description: 'Real-time audit of graduation requirements — tracks major, minor, and distribution credits completed, remaining, and in-progress.',
          url: 'https://da.cornell.edu',
        },
        {
          id:    'chatter',
          title: 'Cornell Chatter',
          tag:   'Advising',
          description: 'Book academic advising appointments, request peer tutoring through the Learning Strategies Center, and manage advising cases or academic holds.',
          url: 'https://chatter.cornell.edu',
        },
        {
          id:    'academic-calendar',
          title: 'Academic Calendar',
          tag:   'Calendar',
          description: 'Semester timeline: first day, add/drop deadlines, mid-term and final exam schedules, university holidays, and tuition payment due dates.',
          url: 'https://registrar.cornell.edu/academic-calendar',
        },
        {
          id:    'library',
          title: 'Cornell Library',
          tag:   'Library',
          description: 'Access Olin, Uris, Mann and all Cornell digital library collections, journal databases, citation managers, and interlibrary loan services.',
          url: 'https://library.cornell.edu',
        },
        {
          id:    'class-roster',
          title: 'Class Roster',
          tag:   'Courses',
          description: 'Search and browse available course sections by term, department, instructor, and time slot. View syllabi and prerequisites before registration.',
          url: 'https://classes.cornell.edu',
        },
        {
          id:    'gradescope',
          title: 'Gradescope',
          tag:   'Grading',
          description: 'Submit assignments, receive annotated feedback, and view rubric-based grades. Widely adopted in STEM departments for problem sets, exams, and programming submissions.',
          url: 'https://www.gradescope.com',
        },
        {
          id:    'piazza',
          title: 'Piazza — Class Q&A',
          tag:   'Q&A',
          description: 'Asynchronous class discussion forum used across CS, ECE, and math courses. Ask questions, get peer and TA answers, and search solved problems from prior semesters.',
          url: 'https://piazza.com',
        },
      ],
    },

    // ── CAREER DEVELOPMENT ──────────────────────────────────
    {
      id:    'career',
      label: 'Career Development',
      tab:   'career',
      links: [
        {
          id:    'handshake',
          title: 'Cornell Handshake',
          tag:   'Jobs',
          description: 'Primary recruiting platform for internships, corporate engineering fairs, co-op listings, and full-time new-grad positions across every industry.',
          url: 'https://cornell.joinhandshake.com',
        },
        {
          id:    'career-services',
          title: 'Cornell Career Services',
          tag:   'Services',
          description: 'Resume reviews, mock interview sessions, employer info events, and the alumni career directory network.',
          url: 'https://careers.cornell.edu',
        },
        {
          id:    'cornell-tech',
          title: 'Cornell Tech Hub',
          tag:   'Innovation',
          description: 'Graduate technology programs, startup studio resources, and innovation ecosystem listings from the NYC Roosevelt Island campus.',
          url: 'https://tech.cornell.edu',
        },
        {
          id:    'linkedin-cornell',
          title: 'Cornell on LinkedIn',
          tag:   'Network',
          description: 'Connect with the 270 000+ Cornell alumni network for mentorship, referrals, and industry networking across every sector.',
          url: 'https://www.linkedin.com/school/cornell-university/',
        },
        {
          id:    'eship',
          title: 'eLab Entrepreneurship',
          tag:   'Startup',
          description: "Cornell's flagship startup accelerator — apply for funding, mentorship, and co-working space at the McGovern Family Center for Venture Development.",
          url: 'https://eship.cornell.edu',
        },
        {
          id:    'glassdoor-cornell',
          title: 'Glassdoor — Company Reviews',
          tag:   'Research',
          description: 'Research prospective employers with salary data, interview question reports, and employee culture reviews before applying or negotiating offers.',
          url: 'https://www.glassdoor.com',
        },
        {
          id:    'levels-fyi',
          title: 'Levels.fyi — Tech Salary Data',
          tag:   'Compensation',
          description: 'Crowdsourced compensation data at major tech companies — total compensation breakdowns by level, role, and location. Essential reference before your first offer negotiation.',
          url: 'https://www.levels.fyi',
        },
      ],
    },

    // ── CAMPUS LIFE ─────────────────────────────────────────
    {
      id:    'campus',
      label: 'Campus Life',
      tab:   'campus',
      links: [
        {
          id:    'dining',
          title: 'Cornell Dining',
          tag:   'Dining',
          description: 'Daily menus across all residential dining halls, café hours, allergen labels, and nutritional data with seasonal menu schedules.',
          url: 'https://dining.cornell.edu',
        },
        {
          id:    'hfs',
          title: 'Big Red Bucks (BRB)',
          tag:   'Account',
          description: 'Manage your BRB balance — add funds, review transactions, set up auto-reload, and monitor meal-plan allocations per semester.',
          url: 'https://hfs.cornell.edu',
        },
        {
          id:    'recreation',
          title: 'Cornell RecWell',
          tag:   'Fitness',
          description: 'Intramural sports, group fitness class schedules, fitness-centre open-swim hours, and club sport rosters.',
          url: 'https://recreation.cornell.edu',
        },
        {
          id:    'student-orgs',
          title: 'Student Organizations',
          tag:   'Orgs',
          description: 'Browse over 1 000 registered clubs and organisations. Find, join, or create a club through the Cornell Involvement Office.',
          url: 'https://orgsync.com/home/network/cornell',
        },
        {
          id:    'campus-groups',
          title: 'Campus Activities',
          tag:   'Events',
          description: 'Discover campus events, cultural programming, speaker series, and student-run performances through the Office of Campus Activities.',
          url: 'https://campusactivities.cornell.edu',
        },
        {
          id:    'cornell-athletics',
          title: 'Cornell Athletics',
          tag:   'Athletics',
          description: 'Men\'s and women\'s varsity sport schedules, club sport information, tickets for home events, and intramural recreation opportunities for all Cornell students.',
          url: 'https://cornellbigred.com',
        },
        {
          id:    'slope-day-cornell',
          title: 'Cornell Events Calendar',
          tag:   'Events',
          description: 'Complete university events feed — lectures, concerts, exhibitions, and department colloquia. Searchable by date, venue, and topic across all Cornell colleges.',
          url: 'https://events.cornell.edu',
        },
      ],
    },

    // ── ESSENTIALS ──────────────────────────────────────────
    {
      id:    'essentials',
      label: 'Essentials',
      tab:   'essentials',
      links: [
        {
          id:    'health',
          title: 'Cornell Health',
          tag:   'Health',
          description: 'Primary care, mental health counseling, and specialist appointments; immunisation records; and student health insurance enrollment and claims.',
          url: 'https://health.cornell.edu',
        },
        {
          id:    'cuinfo',
          title: 'CUinfo Directory',
          tag:   'Directory',
          description: 'University-wide reference: campus phone listings, building locations, department contacts, and emergency information.',
          url: 'https://cuinfo.cornell.edu',
        },
        {
          id:    'it-helpdesk',
          title: 'Cornell IT Help',
          tag:   'IT',
          description: 'Submit IT support tickets, access Cornell VPN, manage NetID password, set up two-step login (Duo), and download licensed software.',
          url: 'https://it.cornell.edu',
        },
        {
          id:    'tcat',
          title: 'TCAT Bus System',
          tag:   'Transit',
          description: 'Tompkins Consolidated Area Transit routes serving campus and Ithaca — free for Cornell students with your student ID on local routes.',
          url: 'https://tcatbus.com',
        },
        {
          id:    'housing',
          title: 'Campus Housing',
          tag:   'Housing',
          description: 'Apply for on-campus housing, view available residence halls, manage room assignments, and access maintenance requests.',
          url: 'https://housing.cornell.edu',
        },
        {
          id:    'financial-aid',
          title: 'Financial Aid Office',
          tag:   'Finance',
          description: 'Manage FAFSA, view scholarship and grant awards, set up direct deposit for refunds, and appeal aid packages.',
          url: 'https://finaid.cornell.edu',
        },
        {
          id:    'campus-safety',
          title: 'Cornell Campus Safety',
          tag:   'Safety',
          description: 'Cornell Police non-emergency line, Blue Light emergency station map, Escort Service (607-255-2802), and campus safety alerts. Safety resource for evenings on North Campus.',
          url: 'https://police.cornell.edu',
        },
        {
          id:    'cornell-store',
          title: 'Cornell Store & Textbooks',
          tag:   'Textbooks',
          description: 'Purchase and rent required course textbooks. Compare digital and physical options, look up your course booklist, and access Cornell branded merchandise.',
          url: 'https://www.cornellstore.com',
        },
      ],
    },

  ],
}
