import type { MajorConfig } from './index'

export const ARCHITECTURE: MajorConfig = {
  id:         'architecture',
  name:       'Architecture',
  shortName:  'Architecture',
  department: 'School of Architecture',
  categories: [
    {
      id:    'cad-bim',
      label: 'CAD & BIM Software',
      links: [
        {
          id:          'autocad-student',
          title:       'AutoCAD Student License',
          description: 'Free 1-year Autodesk education license for AutoCAD. The industry standard for 2D drafting, floor plans, and technical drawings.',
          url:         'https://www.autodesk.com/education/edu-software/overview',
          tag:         'CAD',
        },
        {
          id:          'revit-student',
          title:       'Revit (BIM)',
          description: 'Free Autodesk Revit for students — the leading building information modeling (BIM) tool for parametric 3D architectural design.',
          url:         'https://www.autodesk.com/education/edu-software/overview',
          tag:         'BIM',
        },
        {
          id:          'rhino3d',
          title:       'Rhino 3D',
          description: 'Powerful NURBS-based 3D modeler for complex curved geometries, parametric design, and fabrication-ready models. Student pricing available.',
          url:         'https://www.rhino3d.com/educational/',
          tag:         '3D Model',
        },
        {
          id:          'sketchup-edu',
          title:       'SketchUp for Education',
          description: 'Browser-based and desktop 3D modeling tool for rapid concept massing, site studies, and client presentations. Free for students.',
          url:         'https://www.sketchup.com/plans-and-pricing/sketchup-for-education',
          tag:         'SketchUp',
        },
      ],
    },
    {
      id:    'rendering-visualization',
      label: 'Rendering & Visualization',
      links: [
        {
          id:          'lumion-student',
          title:       'Lumion Student License',
          description: 'Real-time architectural visualization and rendering software. Free student license for photorealistic environments, walkthroughs, and animations.',
          url:         'https://lumion.com/lumion-for-students.html',
          tag:         'Render',
        },
        {
          id:          'vray-student',
          title:       'V-Ray (Chaos Education)',
          description: 'Industry-leading rendering engine for photorealistic architectural visualization. Free education license integrates with Rhino, SketchUp, and Revit.',
          url:         'https://chaos.com/education',
          tag:         'V-Ray',
        },
        {
          id:          'adobe-cc',
          title:       'Adobe Creative Cloud',
          description: 'Photoshop, Illustrator, and InDesign for rendering post-production, portfolio layouts, and design presentation boards. Student discount available.',
          url:         'https://www.adobe.com/creativecloud/plans.html?plan=edu',
          tag:         'Adobe',
        },
      ],
    },
    {
      id:    'research-history',
      label: 'Research & History',
      links: [
        {
          id:          'archdaily',
          title:       'ArchDaily',
          description: 'World\'s most visited architecture website. Explore precedent studies, building typologies, materials, and contemporary projects for research.',
          url:         'https://www.archdaily.com',
          tag:         'Precedents',
        },
        {
          id:          'dezeen',
          title:       'Dezeen',
          description: 'Leading architecture and design magazine featuring contemporary projects, product design, and emerging practice profiles worldwide.',
          url:         'https://www.dezeen.com',
          tag:         'Design',
        },
        {
          id:          'jstor-arch',
          title:       'JSTOR Architecture',
          description: 'Academic journal archive for architectural history, theory, and criticism. Peer-reviewed papers essential for thesis and seminar research.',
          url:         'https://www.jstor.org/action/doBasicSearch?Query=architecture',
          tag:         'Journals',
        },
      ],
    },
    {
      id:    'structure-systems',
      label: 'Structures & Systems',
      links: [
        {
          id:          'engineering-toolbox',
          title:       'Engineering Toolbox',
          description: 'Reference database for structural loads, material properties, thermal performance values, and building physics formulas.',
          url:         'https://www.engineeringtoolbox.com',
          tag:         'Structures',
        },
        {
          id:          'ashrae',
          title:       'ASHRAE Standards',
          description: 'Authoritative standards for building mechanical systems, HVAC design, ventilation requirements, and energy efficiency code compliance.',
          url:         'https://www.ashrae.org/technical-resources/free-resources',
          tag:         'MEP',
        },
        {
          id:          'structurae',
          title:       'Structurae — Engineering Database',
          description: 'Global database of notable structures — bridges, towers, stadiums — with engineering data, photos, and construction details useful for structural precedent studies.',
          url:         'https://structurae.net',
          tag:         'Structures',
        },
        {
          id:          'skyciv',
          title:       'SkyCiv Structural Engineering',
          description: 'Free browser-based structural analysis and beam calculator. Covers moment diagrams, deflection, and truss analysis for architecture structures coursework.',
          url:         'https://skyciv.com/free-structural-software/',
          tag:         'Analysis',
        },
      ],
    },
    {
      id:    'portfolio-presentation',
      label: 'Portfolio & Presentation',
      links: [
        {
          id:          'behance-arch',
          title:       'Behance Architecture',
          description: 'Browse thousands of student and professional architecture portfolios. Study layout conventions, board composition, and visual narrative strategies before preparing your own portfolio.',
          url:         'https://www.behance.net/search/projects?field=architecture',
          tag:         'Portfolio',
        },
        {
          id:          'issuu-arch',
          title:       'Issuu Architecture Portfolios',
          description: 'Host and share publication-quality digital portfolios and zines. Free tier supports unlimited uploads — the preferred format for PDF portfolio submissions.',
          url:         'https://issuu.com',
          tag:         'Publishing',
        },
        {
          id:          'blender-arch',
          title:       'Blender (Architectural Viz)',
          description: 'Free, open-source 3D modeling and rendering suite. Increasingly used in architecture for artistic visualization, animation flythroughs, and Cycles photorealistic renders.',
          url:         'https://www.blender.org',
          tag:         '3D / Render',
        },
        {
          id:          'canva-arch',
          title:       'Canva for Presentations',
          description: 'Fast template-based design for client presentation decks, pin-up boards, and competition entry layouts. Free for students with education sign-up.',
          url:         'https://www.canva.com',
          tag:         'Presentations',
        },
      ],
    },
  ],
}
