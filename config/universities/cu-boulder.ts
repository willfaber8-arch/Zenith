import type { UniversityConfig } from './index'

export const CU_BOULDER: UniversityConfig = {
  id:           'cu-boulder',
  name:         'University of Colorado Boulder',
  shortName:    'CU Boulder',
  location:     'Boulder, CO',
  gpaScale:     '4.0',
  currencyName: 'Buff OneCard Dining Dollars',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'cu-mycuinfo',
          title:       'MyCUInfo Portal',
          tag:         'Portal',
          description: 'Central student portal for course registration, grade reporting, financial aid tracking, and Buff OneCard management at CU Boulder. Access enrollment holds, academic history, and tuition statements from one authenticated dashboard.',
          url:         'https://mycuinfo.colorado.edu',
        },
        {
          id:          'cu-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Access course materials, submit assignments, join discussion boards, and view instructor feedback for all enrolled CU Boulder classes. Canvas integrates with Zoom for virtual office hours and with the Media Library for lecture recordings.',
          url:         'https://canvas.colorado.edu',
        },
        {
          id:          'cu-registrar',
          title:       'Registrar',
          tag:         'Admin',
          description: 'Request official transcripts, obtain enrollment verification letters, and manage add/drop and withdrawal requests through the Office of the Registrar. Key registration appointment times, holds, and academic standing information are all accessible here.',
          url:         'https://registrar.colorado.edu',
        },
        {
          id:          'cu-library',
          title:       'CU Libraries',
          tag:         'Library',
          description: 'Search CU Boulder\'s digital and print collections, access research databases including Scopus, Web of Science, and JSTOR, and request interlibrary loans from Norlin Library. Subject librarians are available for research consultations by appointment or drop-in.',
          url:         'https://libraries.colorado.edu',
        },
        {
          id:          'cu-degree-planner',
          title:       'Degree Audit',
          tag:         'Planning',
          description: 'Track your progress toward graduation by reviewing completed and remaining degree requirements in real time through CU Boulder\'s degree planning tool. Use what-if scenarios to evaluate how adding a minor or changing your major would affect your timeline.',
          url:         'https://degreeplanner.colorado.edu',
        },
        {
          id:          'cu-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Official semester dates including the first day of classes, add/drop deadlines, fall and spring break, finals week, and commencement ceremonies. Bookmark this page at the start of each term to stay ahead of critical registration and withdrawal windows.',
          url:         'https://colorado.edu/registrar/calendars',
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
          id:          'cu-career-services',
          title:       'Career Services',
          tag:         'Career',
          description: 'Schedule career coaching appointments, resume and cover letter reviews, and mock interviews with CU Boulder career advisors who specialize by college and industry sector. The Career Services office also coordinates on-campus recruiting and employer information sessions.',
          url:         'https://colorado.edu/career',
        },
        {
          id:          'cu-handshake',
          title:       'Handshake at CU',
          tag:         'Jobs',
          description: 'Browse thousands of internship and full-time job postings targeting Buff students and alumni, with strong representation from Colorado-based tech, outdoor industry, aerospace, and energy employers. Register for career fairs and on-campus recruiting events directly through Handshake.',
          url:         'https://cu.joinhandshake.com',
        },
        {
          id:          'cu-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Skills',
          description: 'Access thousands of professionally produced courses in data science, software development, business strategy, and creative fields at no cost with your CU IdentiKey. Completed courses generate shareable certificates that integrate directly with your LinkedIn profile.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'cu-buffs-career-board',
          title:       'Buffs Career Board',
          tag:         'Jobs',
          description: 'CU Boulder\'s curated job and internship board featuring postings from Colorado and national employers who specifically target Buff talent. Listings are updated daily and filtered by college, experience level, and location for streamlined browsing.',
          url:         'https://colorado.edu/career/students/jobs-internships',
        },
        {
          id:          'cu-career-fairs',
          title:       'Career Fairs',
          tag:         'Events',
          description: 'View the schedule for CU Boulder\'s semester career fairs, including engineering, business, environmental science, and all-majors events drawing regional and national employers. Pre-register and upload your resume through Handshake before the fair to maximize recruiter visibility.',
          url:         'https://colorado.edu/career/events',
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
          id:          'cu-recreation',
          title:       'CU Recreation',
          tag:         'Wellness',
          description: 'Reserve equipment, sign up for group fitness classes, and join intramural sports or outdoor adventure programs at the CU Recreation Center. Students receive free access to the Rec Center facilities with their paid student fees.',
          url:         'https://recreation.colorado.edu',
        },
        {
          id:          'cu-umc',
          title:       'UMC Student Union',
          tag:         'Union',
          description: 'The University Memorial Center is the social heart of CU Boulder, housing dining options, student organization offices, meeting rooms, and a multicultural lounge. Check the UMC events calendar for film screenings, concerts, and student-organized cultural programming.',
          url:         'https://colorado.edu/umc',
        },
        {
          id:          'cu-dining',
          title:       'CU Dining',
          tag:         'Dining',
          description: 'Browse daily menus, allergen filters, and hours for all CU Boulder dining halls and retail locations including the Village Center and C4C. Manage your Buff OneCard Dining Dollar balance and track your meal plan usage from the CU Cuisine portal.',
          url:         'https://cucuisine.com',
        },
        {
          id:          'cu-orgs',
          title:       'Student Organizations',
          tag:         'Orgs',
          description: 'Search and join from over 600 registered student organizations at CU Boulder spanning academic, cultural, service, and recreational interests. Start or re-register a student organization through the Student Affairs office each academic year.',
          url:         'https://colorado.edu/studentaffairs/orgs',
        },
        {
          id:          'cu-events',
          title:       'CU Events',
          tag:         'Events',
          description: 'Browse the university-wide events calendar for lectures, art performances, athletics, and cultural celebrations taking place across the Boulder campus. Many events are free for currently enrolled CU students with a valid Buff OneCard.',
          url:         'https://colorado.edu/events',
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
          id:          'cu-health',
          title:       'Wardenburg Health Center',
          tag:         'Health',
          description: 'Schedule medical, counseling, and psychiatric appointments at CU Boulder\'s Wardenburg Health Center located on the east side of campus. Telehealth visits and after-hours nurse advice lines are available to enrolled students.',
          url:         'https://colorado.edu/health',
        },
        {
          id:          'cu-it',
          title:       'OIT Help Desk',
          tag:         'IT',
          description: 'Submit support tickets, manage your CU IdentiKey, access the campus VPN for off-campus research database use, and download Microsoft 365 and other licensed software at no charge. Walk-in support is available at the OIT Help Desk in the UMC.',
          url:         'https://colorado.edu/oit',
        },
        {
          id:          'cu-housing',
          title:       'CU Housing',
          tag:         'Housing',
          description: 'Apply for on-campus residence halls and apartments, manage your room assignment and meal plan, and submit maintenance requests through the CU Housing portal. Explore residential academic programs that connect your living community with your field of study.',
          url:         'https://colorado.edu/living',
        },
        {
          id:          'cu-financial-aid',
          title:       'Financial Aid',
          tag:         'Finance',
          description: 'View your financial aid award, accept or decline offers, and manage your FAFSA status through the Office of Financial Aid. Explore CU-specific scholarships through the scholarship search tool and set up direct deposit for timely refund disbursements.',
          url:         'https://colorado.edu/financialaid',
        },
        {
          id:          'cu-parking',
          title:       'Parking Services',
          tag:         'Transit',
          description: 'Purchase and manage parking permits for CU Boulder lots and garages, view real-time availability, and access information on the Buff Bus and RTD Eco Pass student transit subsidy. Pay or contest parking citations and report accessibility needs through Parking Services.',
          url:         'https://colorado.edu/pts',
        },
      ],
    },

  ],
}
