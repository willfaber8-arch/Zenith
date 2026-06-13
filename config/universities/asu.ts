import type { UniversityConfig } from './index'

export const ASU: UniversityConfig = {
  id:           'asu',
  name:         'Arizona State University',
  shortName:    'ASU',
  location:     'Tempe, AZ',
  gpaScale:     '4.0',
  currencyName: 'Sun Devil Dollars',

  categories: [

    // ── ACADEMICS & REGISTRATION ─────────────────────────────
    {
      id:    'academics',
      label: 'Academics & Registration',
      tab:   'academics',
      links: [
        {
          id:          'asu-myasu',
          title:       'MyASU Portal',
          tag:         'Portal',
          description: 'Central student portal for course registration, grades, financial aid, and degree progress. Primary hub for all academic and administrative tasks at ASU.',
          url:         'https://my.asu.edu',
        },
        {
          id:          'asu-canvas',
          title:       'Canvas LMS',
          tag:         'LMS',
          description: 'Access course materials, submit assignments, view announcements, and check grades for all enrolled ASU classes. Integrated with ASU\'s iCal feed for deadline tracking.',
          url:         'https://canvas.asu.edu',
        },
        {
          id:          'asu-registrar',
          title:       'Registrar',
          tag:         'Admin',
          description: 'Manage enrollment verification, official transcripts, add/drop requests, and academic record corrections. View key registration appointment times and holds that may block enrollment.',
          url:         'https://students.asu.edu/registration',
        },
        {
          id:          'asu-library',
          title:       'ASU Library',
          tag:         'Library',
          description: 'Access ASU\'s extensive digital collections, journal databases, research guides, and interlibrary loan services across all four campuses. Book study rooms and consult subject librarians online.',
          url:         'https://lib.asu.edu',
        },
        {
          id:          'asu-degreesearch',
          title:       'DegreeSearch Audit',
          tag:         'Planning',
          description: 'Audit your progress toward degree completion by reviewing completed and remaining requirements in real time. Use what-if analysis to explore the impact of changing your major or adding a certificate.',
          url:         'https://degreesearch.asu.edu',
        },
        {
          id:          'asu-academic-calendar',
          title:       'Academic Calendar',
          tag:         'Calendar',
          description: 'Official semester dates including first day of class, add/drop deadlines, spring break, finals week, and commencement. Bookmark this page at the start of each term to stay ahead of critical deadlines.',
          url:         'https://students.asu.edu/academic-calendar',
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
          id:          'asu-career',
          title:       'Career and Professional Development',
          tag:         'Career',
          description: 'Schedule one-on-one career coaching, resume reviews, and mock interviews with ASU career advisors. Access industry-specific resources for Sun Devils pursuing roles in technology, business, engineering, and the arts.',
          url:         'https://eoss.asu.edu/career',
        },
        {
          id:          'asu-handshake',
          title:       'Handshake at ASU',
          tag:         'Jobs',
          description: 'Browse thousands of internship and full-time job postings curated for Sun Devil students and alumni. Sign up for on-campus recruiting events and virtual employer info sessions through your ASU-linked profile.',
          url:         'https://asu.joinhandshake.com',
        },
        {
          id:          'asu-linkedin-learning',
          title:       'LinkedIn Learning',
          tag:         'Skills',
          description: 'Access thousands of professional development courses in technology, business, and creative fields at no cost with your ASU credentials. Earn shareable certificates to showcase new skills on your LinkedIn profile.',
          url:         'https://linkedin.com/learning',
        },
        {
          id:          'asu-careerlink',
          title:       'Sun Devil CareerLink',
          tag:         'Network',
          description: 'Connect with ASU alumni mentors who offer career advice, informational interviews, and industry referrals. Leverage the Sun Devil network across Arizona\'s largest university alumni community.',
          url:         'https://sundevilcareermanagement.asu.edu',
        },
        {
          id:          'asu-career-fairs',
          title:       'Career Fairs',
          tag:         'Events',
          description: 'View the schedule of ASU\'s semester career fairs, including engineering, business, education, and all-majors events. Pre-register, upload your resume, and research attending employers before fair day.',
          url:         'https://eoss.asu.edu/career/events',
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
          id:          'asu-fitness',
          title:       'Sun Devil Fitness',
          tag:         'Wellness',
          description: 'Reserve equipment, sign up for group fitness classes, and explore intramural sports at ASU\'s state-of-the-art recreation centers on the Tempe and other campuses. Membership is included in student fees.',
          url:         'https://fitness.asu.edu',
        },
        {
          id:          'asu-union',
          title:       'Memorial Union',
          tag:         'Union',
          description: 'Home to dining options, student organization offices, meeting rooms, and relaxation spaces at the heart of the Tempe campus. Check the event calendar for live entertainment, markets, and cultural programs.',
          url:         'https://union.asu.edu',
        },
        {
          id:          'asu-dining',
          title:       'Sun Devil Dining',
          tag:         'Dining',
          description: 'Browse dining hall menus, hours, and allergen information for all ASU dining locations across Tempe, Polytechnic, West, and Downtown campuses. Manage your meal plan and Sun Devil Dollar balance online.',
          url:         'https://sundevildining.asu.edu',
        },
        {
          id:          'asu-events',
          title:       'Student Events',
          tag:         'Events',
          description: 'Discover cultural events, lectures, performances, and Sun Devil Pride activities hosted by ASU\'s Event Services team throughout the semester. Many events offer free admission to currently enrolled students.',
          url:         'https://eoss.asu.edu/eventservices',
        },
        {
          id:          'asu-orgs',
          title:       'Student Organizations',
          tag:         'Orgs',
          description: 'Search and join from over 1,000 registered student organizations spanning academic, cultural, recreational, and service interests. Start your own organization through the campus engagement platform.',
          url:         'https://asu.campuslabs.com/engage',
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
          id:          'asu-health',
          title:       'ASU Health Services',
          tag:         'Health',
          description: 'Schedule medical appointments, access counseling and psychiatric services, and view immunization requirements at ASU\'s student health centers. Telehealth options are available for enrolled students.',
          url:         'https://eoss.asu.edu/health',
        },
        {
          id:          'asu-it',
          title:       'IT Help Desk',
          tag:         'IT',
          description: 'Submit support tickets, manage your ASURITE credentials, configure the campus VPN, and download licensed software including Microsoft 365 and Adobe Creative Cloud. Live chat and walk-in support are available.',
          url:         'https://uto.asu.edu/help',
        },
        {
          id:          'asu-housing',
          title:       'ASU Housing',
          tag:         'Housing',
          description: 'Apply for on-campus residence halls and apartments, view room assignments, and submit maintenance requests through the housing portal. Explore living-learning community options tailored to your academic interests.',
          url:         'https://housing.asu.edu',
        },
        {
          id:          'asu-financial-aid',
          title:       'Scholarships and Financial Aid',
          tag:         'Finance',
          description: 'View your financial aid package, accept awards, manage FAFSA, and explore ASU scholarship opportunities through the Scholarship Universe platform. Set up direct deposit for timely refund disbursement.',
          url:         'https://students.asu.edu/financial-aid',
        },
        {
          id:          'asu-parking',
          title:       'Parking and Transit',
          tag:         'Transit',
          description: 'Purchase and manage parking permits for Tempe and other campuses, view real-time garage availability, and access information on the free light-rail subsidy for Sun Devil students. Pay or appeal citations online.',
          url:         'https://cfo.asu.edu/pts',
        },
      ],
    },

  ],
}
