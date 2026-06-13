import type { UniversityConfig } from './index'

export const VIRGINIA_TECH: UniversityConfig = {
  id:           'virginia-tech',
  name:         'Virginia Tech',
  shortName:    'Virginia Tech',
  location:     'Blacksburg, VA',
  gpaScale:     '4.0',
  currencyName: 'Flex Dollars',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'vt-hokiespa',
          title:       'HokieSPA Portal',
          tag:         'Portal',
          description: 'Central student portal for course registration, grade reporting, financial aid management, and schedule viewing at Virginia Tech. All academic administration tasks including holds review and enrollment verification flow through HokieSPA.',
          url:         'https://hokiespa.cavcs.vt.edu',
        },
        {
          id:          'vt-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Access course materials, submit assignments, participate in discussions, and review instructor feedback for all enrolled Virginia Tech classes. Canvas integrates with Zoom for virtual lectures and office hours and with VT\'s lecture capture system.',
          url:         'https://canvas.vt.edu',
        },
        {
          id:          'vt-registrar',
          title:       'Registrar',
          tag:         'Admin',
          description: 'Request official transcripts, obtain enrollment verification letters, and review add/drop deadlines and course withdrawal policies. The Office of the University Registrar also manages graduation applications and transfer credit evaluation.',
          url:         'https://registrar.vt.edu',
        },
        {
          id:          'vt-library',
          title:       'VT Libraries',
          tag:         'Library',
          description: 'Search Virginia Tech\'s digital and print collections through the Newman Library catalog, access research databases including Web of Science and IEEE Xplore, and request interlibrary loans. Subject librarians are available for in-depth research consultations by appointment.',
          url:         'https://lib.vt.edu',
        },
        {
          id:          'vt-degree-audit',
          title:       'Degree Audit',
          tag:         'Planning',
          description: 'Track your progress toward degree completion by reviewing completed coursework against remaining requirements in real time through the Degree Audit system. Use the what-if tool to explore how a major change or additional minor would affect your graduation timeline.',
          url:         'https://checkmydegree.vt.edu',
        },
        {
          id:          'vt-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Official semester dates including the first day of classes, add/drop deadlines, fall and spring break, finals week, and commencement ceremonies. Bookmark this page at the start of each term to stay ahead of critical registration windows and exam schedules.',
          url:         'https://registrar.vt.edu/academic-calendar',
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
          id:          'vt-career',
          title:       'Career and Professional Development',
          tag:         'Career',
          description: 'Schedule career coaching, resume reviews, and mock interviews with VT career advisors who specialize by college and industry. The Career and Professional Development office also facilitates on-campus recruiting and connects students with Hokie alumni mentors.',
          url:         'https://career.vt.edu',
        },
        {
          id:          'vt-handshake',
          title:       'Handshake at VT',
          tag:         'Jobs',
          description: 'Browse internship and full-time job postings curated for Hokie students and alumni, with strong representation from defense, technology, engineering, and government employers who actively recruit at Virginia Tech. Register for on-campus interviews and virtual info sessions.',
          url:         'https://vt.joinhandshake.com',
        },
        {
          id:          'vt-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Skills',
          description: 'Access thousands of professionally produced courses in software development, data analysis, project management, and design at no cost with your VT PID credentials. Completed courses generate shareable certificates that connect directly to your LinkedIn profile.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'vt-hokie-jobs',
          title:       'HokieJobs',
          tag:         'Jobs',
          description: 'Virginia Tech\'s dedicated job and internship board featuring on-campus employment, co-op postings, and positions from employers with a strong Hokie hiring track record. Listings are filtered by major, location, and experience level for efficient browsing.',
          url:         'https://career.vt.edu/students/jobs-internships',
        },
        {
          id:          'vt-career-fairs',
          title:       'Career Fairs',
          tag:         'Events',
          description: 'View the schedule for Virginia Tech\'s semester career fairs, including the large Engineering and Business Career Fair drawing hundreds of national employers each fall. Pre-register through Handshake and upload your resume at least one week before the event.',
          url:         'https://career.vt.edu/events',
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
          id:          'vt-recsports',
          title:       'VT Rec Sports',
          tag:         'Wellness',
          description: 'Reserve equipment, sign up for group fitness and aquatics classes, and join intramural sports leagues at the War Memorial Hall and McComas Hall recreation facilities. Students receive free access to all Rec Sports facilities with their paid student activity fee.',
          url:         'https://recsports.vt.edu',
        },
        {
          id:          'vt-squires',
          title:       'Squires Student Center',
          tag:         'Union',
          description: 'The social hub of the Virginia Tech campus, housing dining options, the Hokie Grill, student organization offices, a movie theater, and event spaces. Check the Squires events calendar for cultural programs, comedy shows, and Gobblerfest weekend activities.',
          url:         'https://squires.vt.edu',
        },
        {
          id:          'vt-dining',
          title:       'Dining Services',
          tag:         'Dining',
          description: 'Browse daily menus, allergen information, and hours for all Virginia Tech dining halls and retail locations across the Blacksburg campus. Manage your Flex Dollar balance and meal plan usage through the Dining Services portal.',
          url:         'https://dining.vt.edu',
        },
        {
          id:          'vt-student-activities',
          title:       'Student Activities',
          tag:         'Life',
          description: 'Discover over 800 registered student organizations at Virginia Tech spanning academic, cultural, service, and recreational interests through the Student Activities office. Explore leadership development programs and campus traditions like the annual Ring Dance and Senior Sendoff.',
          url:         'https://saa.vt.edu',
        },
        {
          id:          'vt-events',
          title:       'VT Events Calendar',
          tag:         'Events',
          description: 'Browse the university-wide events calendar for lectures, performances, athletics, and cultural celebrations taking place across the Blacksburg campus. Many events are free for currently enrolled Virginia Tech students with a valid Hokie ID.',
          url:         'https://calendar.vt.edu',
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
          id:          'vt-health',
          title:       'Schiffert Health Center',
          tag:         'Health',
          description: 'Schedule medical, counseling, and psychiatry appointments at Virginia Tech\'s Schiffert Health Center located in the heart of campus. After-hours urgent care and telehealth services are available to enrolled students when the clinic is closed.',
          url:         'https://healthcenter.vt.edu',
        },
        {
          id:          'vt-it',
          title:       '4Help IT Support',
          tag:         'IT',
          description: 'Submit IT support tickets, reset your VT PID password, access the GlobalProtect campus VPN for secure off-campus connectivity, and download Microsoft 365 and other licensed software at no cost. Walk-in support is available at the 4Help desk in Newman Library.',
          url:         'https://4help.vt.edu',
        },
        {
          id:          'vt-housing',
          title:       'VT Housing',
          tag:         'Housing',
          description: 'Apply for on-campus residence halls, manage your room assignment and meal plan, and submit maintenance requests through the Housing and Residence Life portal. Explore living-learning communities that pair housing with academic programs in engineering, business, and the sciences.',
          url:         'https://housing.vt.edu',
        },
        {
          id:          'vt-financial-aid',
          title:       'University Scholarships and Financial Aid',
          tag:         'Finance',
          description: 'View your financial aid award package, accept or decline offers, and manage your FAFSA status through the Office of University Scholarships and Financial Aid. Explore Virginia Tech scholarships and set up direct deposit for timely refund disbursements.',
          url:         'https://finaid.vt.edu',
        },
        {
          id:          'vt-parking',
          title:       'Parking',
          tag:         'Parking',
          description: 'Purchase and manage parking permits for Virginia Tech lots and garages around the Blacksburg campus, view real-time garage availability, and access information on the Blacksburg Transit bus pass included in student fees. Pay or contest citations and report accessibility needs online.',
          url:         'https://parking.vt.edu',
        },
      ],
    },

  ],
}
