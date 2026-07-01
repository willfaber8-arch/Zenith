/**
 * Zenith OS — Curated Sports Team Directory
 *
 * A large, local, hand-curated list of teams the user can browse and follow
 * without hitting the API for discovery. Team names use the full official
 * form so they resolve cleanly against TheSportsDB `searchteams.php`.
 *
 * Pro teams (NBA / NFL) ship with accurate official website URLs. College
 * teams omit `website` — it is resolved from the API (strWebsite) at follow
 * time, since college site domains are less stable.
 *
 * Follow flow: user picks a directory team → the view calls
 * /api/sports?action=search&q=<name>&sport=<sportId> to obtain the real
 * TheSportsDB id + badge (+ website) → then follows it.
 */

import type { SportId } from '@/types/sports'

export interface DirectoryTeam {
  name:       string
  sportId:    SportId
  /** Conference / division grouping label used for rendering. */
  conference: string
  /** Official website (pro teams). Omitted for college — resolved via API. */
  website?:   string
}

/* ════════════════════════════════════════════════════════════════
   NBA — all 30 teams (grouped by conference · division)
   ════════════════════════════════════════════════════════════════ */

const NBA: readonly DirectoryTeam[] = [
  // Eastern Conference — Atlantic
  { name: 'Boston Celtics',        sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/celtics' },
  { name: 'Brooklyn Nets',         sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/nets' },
  { name: 'New York Knicks',       sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/knicks' },
  { name: 'Philadelphia 76ers',    sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/sixers' },
  { name: 'Toronto Raptors',       sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/raptors' },
  // Eastern Conference — Central
  { name: 'Chicago Bulls',         sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/bulls' },
  { name: 'Cleveland Cavaliers',   sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/cavaliers' },
  { name: 'Detroit Pistons',       sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/pistons' },
  { name: 'Indiana Pacers',        sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/pacers' },
  { name: 'Milwaukee Bucks',       sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/bucks' },
  // Eastern Conference — Southeast
  { name: 'Atlanta Hawks',         sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/hawks' },
  { name: 'Charlotte Hornets',     sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/hornets' },
  { name: 'Miami Heat',            sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/heat' },
  { name: 'Orlando Magic',         sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/magic' },
  { name: 'Washington Wizards',    sportId: 'basketball', conference: 'NBA · East', website: 'https://www.nba.com/wizards' },
  // Western Conference — Northwest
  { name: 'Denver Nuggets',        sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/nuggets' },
  { name: 'Minnesota Timberwolves',sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/timberwolves' },
  { name: 'Oklahoma City Thunder', sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/thunder' },
  { name: 'Portland Trail Blazers',sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/blazers' },
  { name: 'Utah Jazz',             sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/jazz' },
  // Western Conference — Pacific
  { name: 'Golden State Warriors', sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/warriors' },
  { name: 'Los Angeles Clippers',  sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/clippers' },
  { name: 'Los Angeles Lakers',    sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/lakers' },
  { name: 'Phoenix Suns',          sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/suns' },
  { name: 'Sacramento Kings',      sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/kings' },
  // Western Conference — Southwest
  { name: 'Dallas Mavericks',      sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/mavericks' },
  { name: 'Houston Rockets',       sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/rockets' },
  { name: 'Memphis Grizzlies',     sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/grizzlies' },
  { name: 'New Orleans Pelicans',  sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/pelicans' },
  { name: 'San Antonio Spurs',     sportId: 'basketball', conference: 'NBA · West', website: 'https://www.nba.com/spurs' },
]

/* ════════════════════════════════════════════════════════════════
   NFL — all 32 teams (grouped by conference · division)
   ════════════════════════════════════════════════════════════════ */

const NFL: readonly DirectoryTeam[] = [
  // AFC East
  { name: 'Buffalo Bills',         sportId: 'football', conference: 'AFC East',  website: 'https://www.buffalobills.com' },
  { name: 'Miami Dolphins',        sportId: 'football', conference: 'AFC East',  website: 'https://www.miamidolphins.com' },
  { name: 'New England Patriots',  sportId: 'football', conference: 'AFC East',  website: 'https://www.patriots.com' },
  { name: 'New York Jets',         sportId: 'football', conference: 'AFC East',  website: 'https://www.newyorkjets.com' },
  // AFC North
  { name: 'Baltimore Ravens',      sportId: 'football', conference: 'AFC North', website: 'https://www.baltimoreravens.com' },
  { name: 'Cincinnati Bengals',    sportId: 'football', conference: 'AFC North', website: 'https://www.bengals.com' },
  { name: 'Cleveland Browns',      sportId: 'football', conference: 'AFC North', website: 'https://www.clevelandbrowns.com' },
  { name: 'Pittsburgh Steelers',   sportId: 'football', conference: 'AFC North', website: 'https://www.steelers.com' },
  // AFC South
  { name: 'Houston Texans',        sportId: 'football', conference: 'AFC South', website: 'https://www.houstontexans.com' },
  { name: 'Indianapolis Colts',    sportId: 'football', conference: 'AFC South', website: 'https://www.colts.com' },
  { name: 'Jacksonville Jaguars',  sportId: 'football', conference: 'AFC South', website: 'https://www.jaguars.com' },
  { name: 'Tennessee Titans',      sportId: 'football', conference: 'AFC South', website: 'https://www.tennesseetitans.com' },
  // AFC West
  { name: 'Denver Broncos',        sportId: 'football', conference: 'AFC West',  website: 'https://www.denverbroncos.com' },
  { name: 'Kansas City Chiefs',    sportId: 'football', conference: 'AFC West',  website: 'https://www.chiefs.com' },
  { name: 'Las Vegas Raiders',     sportId: 'football', conference: 'AFC West',  website: 'https://www.raiders.com' },
  { name: 'Los Angeles Chargers',  sportId: 'football', conference: 'AFC West',  website: 'https://www.chargers.com' },
  // NFC East
  { name: 'Dallas Cowboys',        sportId: 'football', conference: 'NFC East',  website: 'https://www.dallascowboys.com' },
  { name: 'New York Giants',       sportId: 'football', conference: 'NFC East',  website: 'https://www.giants.com' },
  { name: 'Philadelphia Eagles',   sportId: 'football', conference: 'NFC East',  website: 'https://www.philadelphiaeagles.com' },
  { name: 'Washington Commanders', sportId: 'football', conference: 'NFC East',  website: 'https://www.commanders.com' },
  // NFC North
  { name: 'Chicago Bears',         sportId: 'football', conference: 'NFC North', website: 'https://www.chicagobears.com' },
  { name: 'Detroit Lions',         sportId: 'football', conference: 'NFC North', website: 'https://www.detroitlions.com' },
  { name: 'Green Bay Packers',     sportId: 'football', conference: 'NFC North', website: 'https://www.packers.com' },
  { name: 'Minnesota Vikings',     sportId: 'football', conference: 'NFC North', website: 'https://www.vikings.com' },
  // NFC South
  { name: 'Atlanta Falcons',       sportId: 'football', conference: 'NFC South', website: 'https://www.atlantafalcons.com' },
  { name: 'Carolina Panthers',     sportId: 'football', conference: 'NFC South', website: 'https://www.panthers.com' },
  { name: 'New Orleans Saints',    sportId: 'football', conference: 'NFC South', website: 'https://www.neworleanssaints.com' },
  { name: 'Tampa Bay Buccaneers',  sportId: 'football', conference: 'NFC South', website: 'https://www.buccaneers.com' },
  // NFC West
  { name: 'Arizona Cardinals',     sportId: 'football', conference: 'NFC West',  website: 'https://www.azcardinals.com' },
  { name: 'Los Angeles Rams',      sportId: 'football', conference: 'NFC West',  website: 'https://www.therams.com' },
  { name: 'San Francisco 49ers',   sportId: 'football', conference: 'NFC West',  website: 'https://www.49ers.com' },
  { name: 'Seattle Seahawks',      sportId: 'football', conference: 'NFC West',  website: 'https://www.seahawks.com' },
]

/* ════════════════════════════════════════════════════════════════
   College Football — SEC, Big Ten, Big 12, ACC, Pac-12, Ivy League
   Full official names as TheSportsDB stores them.
   ════════════════════════════════════════════════════════════════ */

const NCAAF: readonly DirectoryTeam[] = [
  // SEC
  { name: 'Alabama Crimson Tide',       sportId: 'college-football', conference: 'SEC' },
  { name: 'Arkansas Razorbacks',        sportId: 'college-football', conference: 'SEC' },
  { name: 'Auburn Tigers',              sportId: 'college-football', conference: 'SEC' },
  { name: 'Florida Gators',             sportId: 'college-football', conference: 'SEC' },
  { name: 'Georgia Bulldogs',           sportId: 'college-football', conference: 'SEC' },
  { name: 'Kentucky Wildcats',          sportId: 'college-football', conference: 'SEC' },
  { name: 'LSU Tigers',                 sportId: 'college-football', conference: 'SEC' },
  { name: 'Mississippi State Bulldogs', sportId: 'college-football', conference: 'SEC' },
  { name: 'Missouri Tigers',            sportId: 'college-football', conference: 'SEC' },
  { name: 'Oklahoma Sooners',           sportId: 'college-football', conference: 'SEC' },
  { name: 'Ole Miss Rebels',            sportId: 'college-football', conference: 'SEC' },
  { name: 'South Carolina Gamecocks',   sportId: 'college-football', conference: 'SEC' },
  { name: 'Tennessee Volunteers',       sportId: 'college-football', conference: 'SEC' },
  { name: 'Texas Longhorns',            sportId: 'college-football', conference: 'SEC' },
  { name: 'Texas A&M Aggies',           sportId: 'college-football', conference: 'SEC' },
  { name: 'Vanderbilt Commodores',      sportId: 'college-football', conference: 'SEC' },
  // Big Ten
  { name: 'Illinois Fighting Illini',   sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Indiana Hoosiers',           sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Iowa Hawkeyes',              sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Maryland Terrapins',         sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Michigan Wolverines',        sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Michigan State Spartans',    sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Minnesota Golden Gophers',   sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Nebraska Cornhuskers',       sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Northwestern Wildcats',      sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Ohio State Buckeyes',        sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Oregon Ducks',               sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Penn State Nittany Lions',   sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Purdue Boilermakers',        sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Rutgers Scarlet Knights',    sportId: 'college-football', conference: 'Big Ten' },
  { name: 'UCLA Bruins',                sportId: 'college-football', conference: 'Big Ten' },
  { name: 'USC Trojans',                sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Washington Huskies',         sportId: 'college-football', conference: 'Big Ten' },
  { name: 'Wisconsin Badgers',          sportId: 'college-football', conference: 'Big Ten' },
  // Big 12
  { name: 'Arizona Wildcats',           sportId: 'college-football', conference: 'Big 12' },
  { name: 'Arizona State Sun Devils',   sportId: 'college-football', conference: 'Big 12' },
  { name: 'Baylor Bears',               sportId: 'college-football', conference: 'Big 12' },
  { name: 'BYU Cougars',                sportId: 'college-football', conference: 'Big 12' },
  { name: 'Cincinnati Bearcats',        sportId: 'college-football', conference: 'Big 12' },
  { name: 'Colorado Buffaloes',         sportId: 'college-football', conference: 'Big 12' },
  { name: 'Houston Cougars',            sportId: 'college-football', conference: 'Big 12' },
  { name: 'Iowa State Cyclones',        sportId: 'college-football', conference: 'Big 12' },
  { name: 'Kansas Jayhawks',            sportId: 'college-football', conference: 'Big 12' },
  { name: 'Kansas State Wildcats',      sportId: 'college-football', conference: 'Big 12' },
  { name: 'Oklahoma State Cowboys',     sportId: 'college-football', conference: 'Big 12' },
  { name: 'TCU Horned Frogs',           sportId: 'college-football', conference: 'Big 12' },
  { name: 'Texas Tech Red Raiders',     sportId: 'college-football', conference: 'Big 12' },
  { name: 'UCF Knights',                sportId: 'college-football', conference: 'Big 12' },
  { name: 'Utah Utes',                  sportId: 'college-football', conference: 'Big 12' },
  { name: 'West Virginia Mountaineers', sportId: 'college-football', conference: 'Big 12' },
  // ACC
  { name: 'Boston College Eagles',      sportId: 'college-football', conference: 'ACC' },
  { name: 'California Golden Bears',     sportId: 'college-football', conference: 'ACC' },
  { name: 'Clemson Tigers',             sportId: 'college-football', conference: 'ACC' },
  { name: 'Duke Blue Devils',           sportId: 'college-football', conference: 'ACC' },
  { name: 'Florida State Seminoles',    sportId: 'college-football', conference: 'ACC' },
  { name: 'Georgia Tech Yellow Jackets',sportId: 'college-football', conference: 'ACC' },
  { name: 'Louisville Cardinals',       sportId: 'college-football', conference: 'ACC' },
  { name: 'Miami Hurricanes',           sportId: 'college-football', conference: 'ACC' },
  { name: 'NC State Wolfpack',          sportId: 'college-football', conference: 'ACC' },
  { name: 'North Carolina Tar Heels',   sportId: 'college-football', conference: 'ACC' },
  { name: 'Pittsburgh Panthers',        sportId: 'college-football', conference: 'ACC' },
  { name: 'SMU Mustangs',               sportId: 'college-football', conference: 'ACC' },
  { name: 'Stanford Cardinal',          sportId: 'college-football', conference: 'ACC' },
  { name: 'Syracuse Orange',            sportId: 'college-football', conference: 'ACC' },
  { name: 'Virginia Cavaliers',         sportId: 'college-football', conference: 'ACC' },
  { name: 'Virginia Tech Hokies',       sportId: 'college-football', conference: 'ACC' },
  { name: 'Wake Forest Demon Deacons',  sportId: 'college-football', conference: 'ACC' },
  // Pac-12 (remaining)
  { name: 'Oregon State Beavers',       sportId: 'college-football', conference: 'Pac-12' },
  { name: 'Washington State Cougars',   sportId: 'college-football', conference: 'Pac-12' },
  // Ivy League
  { name: 'Brown Bears',                sportId: 'college-football', conference: 'Ivy League' },
  { name: 'Columbia Lions',             sportId: 'college-football', conference: 'Ivy League' },
  { name: 'Cornell Big Red',            sportId: 'college-football', conference: 'Ivy League' },
  { name: 'Dartmouth Big Green',        sportId: 'college-football', conference: 'Ivy League' },
  { name: 'Harvard Crimson',            sportId: 'college-football', conference: 'Ivy League' },
  { name: 'Penn Quakers',               sportId: 'college-football', conference: 'Ivy League' },
  { name: 'Princeton Tigers',           sportId: 'college-football', conference: 'Ivy League' },
  { name: 'Yale Bulldogs',              sportId: 'college-football', conference: 'Ivy League' },
]

/* ════════════════════════════════════════════════════════════════
   College Basketball — ACC, Big Ten, Big 12, SEC, Big East, Ivy League
   ════════════════════════════════════════════════════════════════ */

const NCAAB: readonly DirectoryTeam[] = [
  // ACC
  { name: 'Boston College Eagles',       sportId: 'college-basketball', conference: 'ACC' },
  { name: 'California Golden Bears',      sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Clemson Tigers',              sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Duke Blue Devils',            sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Florida State Seminoles',     sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Georgia Tech Yellow Jackets', sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Louisville Cardinals',        sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Miami Hurricanes',            sportId: 'college-basketball', conference: 'ACC' },
  { name: 'NC State Wolfpack',           sportId: 'college-basketball', conference: 'ACC' },
  { name: 'North Carolina Tar Heels',    sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Notre Dame Fighting Irish',   sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Pittsburgh Panthers',         sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Syracuse Orange',             sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Virginia Cavaliers',          sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Virginia Tech Hokies',        sportId: 'college-basketball', conference: 'ACC' },
  { name: 'Wake Forest Demon Deacons',   sportId: 'college-basketball', conference: 'ACC' },
  // Big Ten
  { name: 'Illinois Fighting Illini',    sportId: 'college-basketball', conference: 'Big Ten' },
  { name: 'Indiana Hoosiers',            sportId: 'college-basketball', conference: 'Big Ten' },
  { name: 'Iowa Hawkeyes',               sportId: 'college-basketball', conference: 'Big Ten' },
  { name: 'Maryland Terrapins',          sportId: 'college-basketball', conference: 'Big Ten' },
  { name: 'Michigan Wolverines',         sportId: 'college-basketball', conference: 'Big Ten' },
  { name: 'Michigan State Spartans',     sportId: 'college-basketball', conference: 'Big Ten' },
  { name: 'Ohio State Buckeyes',         sportId: 'college-basketball', conference: 'Big Ten' },
  { name: 'Purdue Boilermakers',         sportId: 'college-basketball', conference: 'Big Ten' },
  { name: 'UCLA Bruins',                 sportId: 'college-basketball', conference: 'Big Ten' },
  { name: 'Wisconsin Badgers',           sportId: 'college-basketball', conference: 'Big Ten' },
  // Big 12
  { name: 'Baylor Bears',                sportId: 'college-basketball', conference: 'Big 12' },
  { name: 'BYU Cougars',                 sportId: 'college-basketball', conference: 'Big 12' },
  { name: 'Houston Cougars',             sportId: 'college-basketball', conference: 'Big 12' },
  { name: 'Iowa State Cyclones',         sportId: 'college-basketball', conference: 'Big 12' },
  { name: 'Kansas Jayhawks',             sportId: 'college-basketball', conference: 'Big 12' },
  { name: 'Kansas State Wildcats',       sportId: 'college-basketball', conference: 'Big 12' },
  { name: 'Texas Tech Red Raiders',      sportId: 'college-basketball', conference: 'Big 12' },
  // SEC
  { name: 'Alabama Crimson Tide',        sportId: 'college-basketball', conference: 'SEC' },
  { name: 'Arkansas Razorbacks',         sportId: 'college-basketball', conference: 'SEC' },
  { name: 'Auburn Tigers',               sportId: 'college-basketball', conference: 'SEC' },
  { name: 'Florida Gators',              sportId: 'college-basketball', conference: 'SEC' },
  { name: 'Kentucky Wildcats',           sportId: 'college-basketball', conference: 'SEC' },
  { name: 'Tennessee Volunteers',        sportId: 'college-basketball', conference: 'SEC' },
  { name: 'Texas A&M Aggies',            sportId: 'college-basketball', conference: 'SEC' },
  // Big East
  { name: 'Butler Bulldogs',             sportId: 'college-basketball', conference: 'Big East' },
  { name: 'Creighton Bluejays',          sportId: 'college-basketball', conference: 'Big East' },
  { name: 'Georgetown Hoyas',            sportId: 'college-basketball', conference: 'Big East' },
  { name: 'Marquette Golden Eagles',     sportId: 'college-basketball', conference: 'Big East' },
  { name: 'Providence Friars',           sportId: 'college-basketball', conference: 'Big East' },
  { name: "St. John's Red Storm",        sportId: 'college-basketball', conference: 'Big East' },
  { name: 'Seton Hall Pirates',          sportId: 'college-basketball', conference: 'Big East' },
  { name: 'UConn Huskies',               sportId: 'college-basketball', conference: 'Big East' },
  { name: 'Villanova Wildcats',          sportId: 'college-basketball', conference: 'Big East' },
  { name: 'Xavier Musketeers',           sportId: 'college-basketball', conference: 'Big East' },
  // Ivy League
  { name: 'Brown Bears',                 sportId: 'college-basketball', conference: 'Ivy League' },
  { name: 'Columbia Lions',              sportId: 'college-basketball', conference: 'Ivy League' },
  { name: 'Cornell Big Red',             sportId: 'college-basketball', conference: 'Ivy League' },
  { name: 'Dartmouth Big Green',         sportId: 'college-basketball', conference: 'Ivy League' },
  { name: 'Harvard Crimson',             sportId: 'college-basketball', conference: 'Ivy League' },
  { name: 'Penn Quakers',                sportId: 'college-basketball', conference: 'Ivy League' },
  { name: 'Princeton Tigers',            sportId: 'college-basketball', conference: 'Ivy League' },
  { name: 'Yale Bulldogs',               sportId: 'college-basketball', conference: 'Ivy League' },
]

export const TEAM_DIRECTORY: readonly DirectoryTeam[] = [
  ...NBA,
  ...NFL,
  ...NCAAF,
  ...NCAAB,
]

/* ════════════════════════════════════════════════════════════════
   Grouping helpers
   ════════════════════════════════════════════════════════════════ */

export interface DirectoryGroup {
  conference: string
  teams:      DirectoryTeam[]
}

/** sportId → ordered list of { conference, teams } groups. */
export type DirectoryBySport = Record<SportId, DirectoryGroup[]>

/**
 * Build the sport → conference → teams tree, preserving directory insertion
 * order for both conferences and teams within a conference.
 */
export function groupDirectory(teams: readonly DirectoryTeam[] = TEAM_DIRECTORY): DirectoryBySport {
  const bySport: Record<string, Map<string, DirectoryTeam[]>> = {}

  for (const team of teams) {
    const sportMap = (bySport[team.sportId] ??= new Map())
    const arr = sportMap.get(team.conference) ?? []
    arr.push(team)
    sportMap.set(team.conference, arr)
  }

  const out = {} as DirectoryBySport
  for (const sportId of Object.keys(bySport) as SportId[]) {
    out[sportId] = [...bySport[sportId].entries()].map(([conference, ts]) => ({
      conference,
      teams: ts,
    }))
  }
  return out
}

/** Pre-computed grouping for direct rendering. */
export const TEAM_DIRECTORY_BY_GROUP: DirectoryBySport = groupDirectory()
