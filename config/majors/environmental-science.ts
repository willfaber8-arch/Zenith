/**
 * ════════════════════════════════════════════════════════════════
 * Zenith OS — Environmental Science Major Resource Map
 *
 * Loaded on-demand only when a user declares an Environmental Science major.
 * Never included in the main bundle.
 *
 * Categories:
 *   1. Research & Data          — EPA, NOAA, NASA, USGS, GCP
 *   2. GIS & Remote Sensing     — ArcGIS, QGIS, Google Earth Engine
 *   3. Learning Resources       — Khan Academy, Yale OCW, MIT OCW
 *   4. Career & Organizations   — TNC, NRDC, EPA Careers, EDF Jobs
 * ════════════════════════════════════════════════════════════════
 */

import type { MajorConfig } from './index'

export const ENVIRONMENTAL_SCIENCE: MajorConfig = {
  id:         'environmental-science',
  name:       'Environmental Science',
  shortName:  'Env Sci',
  department: 'College of Natural Resources',
  categories: [

    /* ── 1. Research & Data ─────────────────────────────────── */
    {
      id:    'research-data',
      label: 'Research & Data',
      links: [
        {
          id:          'epa-data',
          title:       'EPA Environmental Data',
          description: 'The U.S. Environmental Protection Agency\'s open data portal aggregates air quality, water quality, toxics release, and climate datasets collected across the country. An essential starting point for environmental research, policy analysis, and scientific literature searches.',
          url:         'https://www.epa.gov/data',
          tag:         'Government Data',
        },
        {
          id:          'noaa',
          title:       'NOAA — National Oceanic and Atmospheric Administration',
          description: 'Authoritative source for atmospheric, oceanic, and climate data including weather observations, sea surface temperatures, and long-term climate records. NOAA datasets underpin the majority of peer-reviewed atmospheric and marine science research.',
          url:         'https://www.noaa.gov',
          tag:         'Climate & Ocean',
        },
        {
          id:          'nasa-earth',
          title:       'NASA Earth — Earthdata Portal',
          description: 'Gateway to NASA\'s full suite of remote sensing, satellite imagery, and Earth observation datasets spanning decades of land use, vegetation, sea ice, and aerosol measurements. Freely accessible after creating a free Earthdata account.',
          url:         'https://earth.nasa.gov',
          tag:         'Remote Sensing',
        },
        {
          id:          'usgs',
          title:       'USGS — U.S. Geological Survey',
          description: 'Primary federal repository for geology, hydrology, topography, and natural hazard data across the United States. The National Water Information System and National Map portals provide downloadable GIS layers and streamflow records.',
          url:         'https://www.usgs.gov',
          tag:         'Geology & Hydrology',
        },
        {
          id:          'global-carbon-project',
          title:       'Global Carbon Project',
          description: 'International research initiative that publishes the authoritative annual Global Carbon Budget tracking CO₂ and methane emissions, land-use changes, and ocean carbon uptake at country and global scales. Essential for climate policy coursework and carbon cycle research.',
          url:         'https://www.globalcarbonproject.org',
          tag:         'Carbon & Climate',
        },
      ],
    },

    /* ── 2. GIS & Remote Sensing ────────────────────────────── */
    {
      id:    'gis-remote-sensing',
      label: 'GIS & Remote Sensing',
      links: [
        {
          id:          'arcgis-online',
          title:       'ESRI ArcGIS Online',
          description: 'Industry-standard cloud GIS platform for creating, sharing, and analyzing geographic data through interactive maps and spatial analysis tools. Many universities provide free student licenses through the ESRI education program.',
          url:         'https://www.esri.com/en-us/arcgis/products/arcgis-online/overview',
          tag:         'GIS Platform',
        },
        {
          id:          'qgis',
          title:       'QGIS — Open-Source GIS',
          description: 'Free and open-source desktop GIS that supports vector, raster, and database formats with a robust plugin ecosystem. A full-featured ArcGIS alternative widely adopted in academic environmental research and government agencies.',
          url:         'https://qgis.org',
          tag:         'Open-Source GIS',
        },
        {
          id:          'google-earth-engine',
          title:       'Google Earth Engine',
          description: 'Cloud-based geospatial analysis platform with a petabyte-scale catalog of satellite imagery and geospatial datasets accessible through a JavaScript or Python API. Ideal for large-scale land cover classification, vegetation index analysis, and time-series change detection.',
          url:         'https://earthengine.google.com',
          tag:         'Cloud Analysis',
        },
        {
          id:          'earthexplorer',
          title:       'USGS EarthExplorer',
          description: 'USGS portal for downloading Landsat, MODIS, SRTM elevation, and aerial photography imagery spanning decades of Earth observation. Supports polygon, coordinate, and place-name searches for targeted scene acquisition.',
          url:         'https://earthexplorer.usgs.gov',
          tag:         'Satellite Imagery',
        },
        {
          id:          'mapbox',
          title:       'Mapbox — Mapping Platform',
          description: 'Developer-focused mapping platform for building custom interactive maps with real-time data layers and high-performance vector tile rendering. Free tier is sufficient for academic projects and environmental data visualization apps.',
          url:         'https://www.mapbox.com',
          tag:         'Visualization',
        },
      ],
    },

    /* ── 3. Learning Resources ──────────────────────────────── */
    {
      id:    'learning-resources',
      label: 'Learning Resources',
      links: [
        {
          id:          'khan-env-science',
          title:       'Khan Academy — Environmental Science',
          description: 'Free, self-paced modules covering ecology, biogeochemical cycles, human population dynamics, and environmental policy with embedded exercises and mastery tracking. Well-suited for reviewing foundational concepts before exams.',
          url:         'https://www.khanacademy.org/science/biology/ecology',
          tag:         'Fundamentals',
        },
        {
          id:          'yale-open-courses',
          title:       'Yale Open Courses — Environment',
          description: 'Free lecture recordings from Yale\'s "Environmental Politics and Law" and related courses taught by leading faculty. Covers environmental law, economics, and governance at a rigorous university level.',
          url:         'https://oyc.yale.edu',
          tag:         'Open Courseware',
        },
        {
          id:          'mit-ocw-eaps',
          title:       'MIT OCW — Earth, Atmospheric & Planetary Sciences',
          description: 'Full MIT course materials including lecture notes, problem sets, and exams for atmospheric science, climate physics, oceanography, and planetary science courses. Freely available without registration.',
          url:         'https://ocw.mit.edu/courses/earth-atmospheric-and-planetary-sciences',
          tag:         'MIT Courseware',
        },
        {
          id:          'openstax-env-sci',
          title:       'OpenStax — Environmental Science',
          description: 'Peer-reviewed, freely available open textbook covering ecosystems, biodiversity, human impacts, and sustainability aligned with introductory environmental science curricula. Available as PDF, web, or low-cost print.',
          url:         'https://openstax.org',
          tag:         'Open Textbook',
        },
        {
          id:          'ipcc-reports',
          title:       'IPCC Assessment Reports',
          description: 'Comprehensive scientific assessments of climate change published by the Intergovernmental Panel on Climate Change, synthesizing thousands of peer-reviewed studies into Working Group reports on the physical science basis, impacts, and mitigation. Required reading for any climate-adjacent research or policy course.',
          url:         'https://www.ipcc.ch',
          tag:         'Climate Policy',
        },
      ],
    },

    /* ── 4. Career & Organizations ──────────────────────────── */
    {
      id:    'career-organizations',
      label: 'Career & Organizations',
      links: [
        {
          id:          'environmental-career-center',
          title:       'Environmental Career Center',
          description: 'Specialized job board for environmental science, conservation, sustainability, and natural resource management positions across government, nonprofit, and private sectors. Listings are curated specifically for environmental professionals.',
          url:         'https://www.environmentalcareer.com',
          tag:         'Job Board',
        },
        {
          id:          'the-nature-conservancy-careers',
          title:       'The Nature Conservancy — Careers',
          description: 'Career portal for one of the world\'s largest conservation organizations offering roles in field science, policy, GIS, fundraising, and operations across six continents. Internships and early-career positions are regularly posted.',
          url:         'https://www.nature.org/en-us/about-us/careers/',
          tag:         'Conservation',
        },
        {
          id:          'nrdc',
          title:       'NRDC — Natural Resources Defense Council',
          description: 'Leading U.S. environmental advocacy organization working on clean energy, climate, clean water, and wildlife protection through litigation, legislation, and science. The NRDC careers page lists staff positions, fellowships, and externships for law and science graduates.',
          url:         'https://www.nrdc.org',
          tag:         'Advocacy',
        },
        {
          id:          'epa-careers',
          title:       'EPA Careers',
          description: 'Official U.S. EPA employment portal listing federal positions in environmental science, engineering, enforcement, and policy at offices across the country. Student internship programs including the Pathways Internship are also listed here.',
          url:         'https://www.epa.gov/careers',
          tag:         'Federal Jobs',
        },
        {
          id:          'edf-jobs',
          title:       'Environmental Defense Fund — Jobs',
          description: 'Career listings at EDF, a science-driven nonprofit working on climate, ecosystems, and oceans. Positions span economics, communications, science, policy, and technology fields with opportunities for recent graduates.',
          url:         'https://jobs.edf.org',
          tag:         'Nonprofit Jobs',
        },
      ],
    },

  ],
}
