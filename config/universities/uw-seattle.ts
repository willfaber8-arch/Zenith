import type { UniversityConfig } from './index'

export const UW_SEATTLE: UniversityConfig = {
  id:           'uw-seattle',
  name:         'University of Washington',
  shortName:    'UW',
  location:     'Seattle, WA',
  gpaScale:     '4.0',
  currencyName: 'Husky Card Dining Dollars',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'uw-myuw',
          title:       'MyUW Portal',
          tag:         'Portal',
          description: 'Central student portal for course registration, grade reporting, financial aid tracking, and degree planning at the University of Washington. Access your class schedule, holds, and academic history from a single authenticated dashboard.',
          url:         'https://myuw.uw.edu',
        },
        {
          id:          'uw-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Access course materials, submit assignments, participate in discussions, and view instructor feedback for all enrolled UW classes. Canvas integrates with Zoom and Panopto for lecture recordings and virtual office hours.',
          url:         'https://canvas.uw.edu',
        },
        {
          id:          'uw-registrar',
          title:       'Registrar',
          tag:         'Admin',
          description: 'Request official transcripts, manage enrollment verification, and review registration time schedules and add/drop deadlines for each quarter. The UW Registrar also handles graduation applications and transfer credit evaluations.',
          url:         'https://registrar.uw.edu',
        },
        {
          id:          'uw-library',
          title:       'UW Libraries',
          tag:         'Library',
          description: 'Search UW\'s extensive digital and print collections, access research databases like PubMed and JSTOR, and request interlibrary loans from any of the 18 UW library locations. Subject librarians are available for in-depth research consultations.',
          url:         'https://lib.uw.edu',
        },
        {
          id:          'uw-myplan',
          title:       'Degree Audit (MyPlan)',
          tag:         'Planning',
          description: 'Map your quarterly course plan, audit degree requirement completion, and explore alternative major pathways using UW\'s MyPlan tool. Use what-if scenarios to evaluate the impact of adding a minor or double major.',
          url:         'https://myplan.uw.edu',
        },
        {
          id:          'uw-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Official quarterly calendar with key dates including the first day of instruction, registration periods, final exam schedules, and UW holidays. UW operates on a quarter system — bookmark this page to track the faster-paced academic cycle.',
          url:         'https://registrar.uw.edu/calendars',
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
          id:          'uw-career-center',
          title:       'UW Career Center',
          tag:         'Career',
          description: 'Schedule career coaching, resume reviews, and interview prep with UW career advisors specializing in your college or industry. The Career Center also runs Husky Career Connections, linking students with alumni mentors in their field.',
          url:         'https://careers.uw.edu',
        },
        {
          id:          'uw-handshake',
          title:       'Handshake at UW',
          tag:         'Jobs',
          description: 'Browse internship and full-time job postings curated for Husky students and UW alumni, with strong representation from Seattle-area tech, healthcare, and aerospace employers. Register for on-campus recruiting events and virtual employer information sessions.',
          url:         'https://uw.joinhandshake.com',
        },
        {
          id:          'uw-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Skills',
          description: 'Access thousands of on-demand courses in software engineering, data analysis, product management, and leadership at no cost with your UW NetID. Completed courses produce shareable certificates that integrate directly with your LinkedIn profile.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'uw-husky-jobs',
          title:       'Husky Jobs',
          tag:         'Jobs',
          description: 'UW\'s dedicated job and internship board featuring on-campus employment, work-study postings, and positions from Pacific Northwest employers who actively recruit Huskies. Listings are updated daily and searchable by major, location, and experience level.',
          url:         'https://careers.uw.edu/students/jobs-internships',
        },
        {
          id:          'uw-career-fairs',
          title:       'Career Fairs',
          tag:         'Events',
          description: 'View the schedule for UW\'s quarterly career fairs, including engineering, health sciences, business, and all-majors events drawing top Pacific Northwest and national employers. Pre-registration opens two weeks before each fair.',
          url:         'https://careers.uw.edu/events',
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
          id:          'uw-recreation',
          title:       'UW Recreation',
          tag:         'Wellness',
          description: 'Reserve equipment, sign up for group fitness classes, and join intramural sports leagues at the UW Intramural Activities Building and Waterfront Activities Center. Students receive free access to the IMA with their student activity fee.',
          url:         'https://recreation.uw.edu',
        },
        {
          id:          'uw-hub',
          title:       'Husky Union Building (HUB)',
          tag:         'Union',
          description: 'The social hub of the UW Seattle campus, housing dining options, event spaces, student organization offices, a movie theater, and recreation facilities. Check the HUB events calendar for cultural programs, performances, and student-run activities.',
          url:         'https://hfs.uw.edu/hub',
        },
        {
          id:          'uw-dining',
          title:       'UW Dining',
          tag:         'Dining',
          description: 'Browse daily menus, hours, and allergen information for UW\'s residential dining halls and retail locations across the Seattle campus. Manage your Husky Card Dining Dollars balance and meal plan from the Housing and Food Services portal.',
          url:         'https://hfs.uw.edu/dining',
        },
        {
          id:          'uw-student-activities',
          title:       'Student Activities',
          tag:         'Life',
          description: 'Discover over 1,000 registered student organizations, leadership programs, and cultural events coordinated by UW\'s Division of Student Life. Connect with clubs spanning academic societies, cultural groups, outdoor adventures, and community service.',
          url:         'https://dso.uw.edu',
        },
        {
          id:          'uw-events',
          title:       'UW Events',
          tag:         'Events',
          description: 'Browse the university-wide calendar for lectures, performances, art exhibitions, and athletic events taking place across the Seattle campus and Burke Museum. Many events are free for currently enrolled UW students with their Husky Card.',
          url:         'https://washington.edu/events',
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
          id:          'uw-health',
          title:       'Hall Health',
          tag:         'Health',
          description: 'Schedule medical appointments, access mental health counseling, and receive immunization services at UW\'s Hall Health Primary Care Center. Telehealth options are available for enrolled students who prefer virtual consultations.',
          url:         'https://depts.washington.edu/hhpccweb',
        },
        {
          id:          'uw-it',
          title:       'UW-IT Help',
          tag:         'IT',
          description: 'Submit support tickets, manage your UW NetID, access the Husky OnNet VPN for off-campus research database access, and download Microsoft 365 and other licensed software at no cost. The UW-IT Service Center offers walk-in and chat support.',
          url:         'https://itconnect.uw.edu',
        },
        {
          id:          'uw-housing',
          title:       'Housing and Food Services',
          tag:         'Housing',
          description: 'Apply for on-campus residence halls and apartments, manage your room assignment and meal plan, and submit maintenance requests through UW\'s Housing and Food Services portal. Explore themed living communities that connect housing with academic interests.',
          url:         'https://hfs.uw.edu',
        },
        {
          id:          'uw-financial-aid',
          title:       'Financial Aid',
          tag:         'Finance',
          description: 'View your financial aid package, accept awards, manage your FAFSA, and explore UW scholarship opportunities through the Office of Student Financial Aid. Set up direct deposit to receive refund disbursements directly to your bank account.',
          url:         'https://washington.edu/financialaid',
        },
        {
          id:          'uw-parking',
          title:       'Parking Services',
          tag:         'Transit',
          description: 'Purchase and manage UW parking permits, view real-time garage availability, and access information on the U-PASS transit subsidy that provides unlimited access to King County Metro, Sound Transit Link light rail, and other regional transit. Pay or appeal citations online.',
          url:         'https://transportation.uw.edu',
        },
      ],
    },

  ],
}
