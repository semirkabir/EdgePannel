/**
 * Sports Team to City Mapping
 * Maps team names, mascots, and abbreviations to their home cities
 */

export interface TeamLocation {
  team: string
  city: string
  country: string
  aliases: string[]
  league?: string
}

export const SPORTS_TEAMS: TeamLocation[] = [
  // NFL Teams
  { team: 'Cardinals', city: 'phoenix', country: 'United States', aliases: ['arizona cardinals', 'az cardinals'], league: 'NFL' },
  { team: 'Falcons', city: 'atlanta', country: 'United States', aliases: ['atlanta falcons'], league: 'NFL' },
  { team: 'Ravens', city: 'baltimore', country: 'United States', aliases: ['baltimore ravens'], league: 'NFL' },
  { team: 'Bills', city: 'buffalo', country: 'United States', aliases: ['buffalo bills'], league: 'NFL' },
  { team: 'Panthers', city: 'charlotte', country: 'United States', aliases: ['carolina panthers'], league: 'NFL' },
  { team: 'Bears', city: 'chicago', country: 'United States', aliases: ['chicago bears'], league: 'NFL' },
  { team: 'Bengals', city: 'cincinnati', country: 'United States', aliases: ['cincinnati bengals'], league: 'NFL' },
  { team: 'Browns', city: 'cleveland', country: 'United States', aliases: ['cleveland browns'], league: 'NFL' },
  { team: 'Cowboys', city: 'dallas', country: 'United States', aliases: ['dallas cowboys'], league: 'NFL' },
  { team: 'Broncos', city: 'denver', country: 'United States', aliases: ['denver broncos'], league: 'NFL' },
  { team: 'Lions', city: 'detroit', country: 'United States', aliases: ['detroit lions'], league: 'NFL' },
  { team: 'Packers', city: 'green bay', country: 'United States', aliases: ['green bay packers', 'greenbay packers'], league: 'NFL' },
  { team: 'Texans', city: 'houston', country: 'United States', aliases: ['houston texans'], league: 'NFL' },
  { team: 'Colts', city: 'indianapolis', country: 'United States', aliases: ['indianapolis colts'], league: 'NFL' },
  { team: 'Jaguars', city: 'jacksonville', country: 'United States', aliases: ['jacksonville jaguars'], league: 'NFL' },
  { team: 'Chiefs', city: 'kansas city', country: 'United States', aliases: ['kansas city chiefs', 'kc chiefs'], league: 'NFL' },
  { team: 'Raiders', city: 'las vegas', country: 'United States', aliases: ['las vegas raiders', 'lv raiders'], league: 'NFL' },
  { team: 'Chargers', city: 'los angeles', country: 'United States', aliases: ['los angeles chargers', 'la chargers'], league: 'NFL' },
  { team: 'Rams', city: 'los angeles', country: 'United States', aliases: ['los angeles rams', 'la rams'], league: 'NFL' },
  { team: 'Dolphins', city: 'miami', country: 'United States', aliases: ['miami dolphins'], league: 'NFL' },
  { team: 'Vikings', city: 'minneapolis', country: 'United States', aliases: ['minnesota vikings'], league: 'NFL' },
  { team: 'Patriots', city: 'boston', country: 'United States', aliases: ['new england patriots'], league: 'NFL' },
  { team: 'Saints', city: 'new orleans', country: 'United States', aliases: ['new orleans saints'], league: 'NFL' },
  { team: 'Giants', city: 'new york', country: 'United States', aliases: ['new york giants', 'ny giants'], league: 'NFL' },
  { team: 'Jets', city: 'new york', country: 'United States', aliases: ['new york jets', 'ny jets'], league: 'NFL' },
  { team: 'Eagles', city: 'philadelphia', country: 'United States', aliases: ['philadelphia eagles'], league: 'NFL' },
  { team: 'Steelers', city: 'pittsburgh', country: 'United States', aliases: ['pittsburgh steelers'], league: 'NFL' },
  { team: '49ers', city: 'san francisco', country: 'United States', aliases: ['san francisco 49ers', 'sf 49ers'], league: 'NFL' },
  { team: 'Seahawks', city: 'seattle', country: 'United States', aliases: ['seattle seahawks'], league: 'NFL' },
  { team: 'Buccaneers', city: 'tampa', country: 'United States', aliases: ['tampa bay buccaneers', 'bucs'], league: 'NFL' },
  { team: 'Titans', city: 'nashville', country: 'United States', aliases: ['tennessee titans'], league: 'NFL' },
  { team: 'Commanders', city: 'washington', country: 'United States', aliases: ['washington commanders'], league: 'NFL' },

  // NBA Teams
  { team: 'Hawks', city: 'atlanta', country: 'United States', aliases: ['atlanta hawks'], league: 'NBA' },
  { team: 'Celtics', city: 'boston', country: 'United States', aliases: ['boston celtics'], league: 'NBA' },
  { team: 'Nets', city: 'brooklyn', country: 'United States', aliases: ['brooklyn nets'], league: 'NBA' },
  { team: 'Hornets', city: 'charlotte', country: 'United States', aliases: ['charlotte hornets'], league: 'NBA' },
  { team: 'Bulls', city: 'chicago', country: 'United States', aliases: ['chicago bulls'], league: 'NBA' },
  { team: 'Cavaliers', city: 'cleveland', country: 'United States', aliases: ['cleveland cavaliers', 'cavs'], league: 'NBA' },
  { team: 'Mavericks', city: 'dallas', country: 'United States', aliases: ['dallas mavericks', 'mavs'], league: 'NBA' },
  { team: 'Nuggets', city: 'denver', country: 'United States', aliases: ['denver nuggets'], league: 'NBA' },
  { team: 'Pistons', city: 'detroit', country: 'United States', aliases: ['detroit pistons'], league: 'NBA' },
  { team: 'Warriors', city: 'san francisco', country: 'United States', aliases: ['golden state warriors'], league: 'NBA' },
  { team: 'Rockets', city: 'houston', country: 'United States', aliases: ['houston rockets'], league: 'NBA' },
  { team: 'Pacers', city: 'indianapolis', country: 'United States', aliases: ['indiana pacers'], league: 'NBA' },
  { team: 'Clippers', city: 'los angeles', country: 'United States', aliases: ['los angeles clippers', 'la clippers'], league: 'NBA' },
  { team: 'Lakers', city: 'los angeles', country: 'United States', aliases: ['los angeles lakers', 'la lakers'], league: 'NBA' },
  { team: 'Grizzlies', city: 'memphis', country: 'United States', aliases: ['memphis grizzlies'], league: 'NBA' },
  { team: 'Heat', city: 'miami', country: 'United States', aliases: ['miami heat'], league: 'NBA' },
  { team: 'Bucks', city: 'milwaukee', country: 'United States', aliases: ['milwaukee bucks'], league: 'NBA' },
  { team: 'Timberwolves', city: 'minneapolis', country: 'United States', aliases: ['minnesota timberwolves', 'wolves'], league: 'NBA' },
  { team: 'Pelicans', city: 'new orleans', country: 'United States', aliases: ['new orleans pelicans'], league: 'NBA' },
  { team: 'Knicks', city: 'new york', country: 'United States', aliases: ['new york knicks'], league: 'NBA' },
  { team: 'Thunder', city: 'oklahoma city', country: 'United States', aliases: ['oklahoma city thunder', 'okc thunder'], league: 'NBA' },
  { team: 'Magic', city: 'orlando', country: 'United States', aliases: ['orlando magic'], league: 'NBA' },
  { team: '76ers', city: 'philadelphia', country: 'United States', aliases: ['philadelphia 76ers', 'sixers'], league: 'NBA' },
  { team: 'Suns', city: 'phoenix', country: 'United States', aliases: ['phoenix suns'], league: 'NBA' },
  { team: 'Trail Blazers', city: 'portland', country: 'United States', aliases: ['portland trail blazers', 'blazers'], league: 'NBA' },
  { team: 'Kings', city: 'sacramento', country: 'United States', aliases: ['sacramento kings'], league: 'NBA' },
  { team: 'Spurs', city: 'san antonio', country: 'United States', aliases: ['san antonio spurs'], league: 'NBA' },
  { team: 'Raptors', city: 'toronto', country: 'Canada', aliases: ['toronto raptors'], league: 'NBA' },
  { team: 'Jazz', city: 'salt lake city', country: 'United States', aliases: ['utah jazz'], league: 'NBA' },
  { team: 'Wizards', city: 'washington', country: 'United States', aliases: ['washington wizards'], league: 'NBA' },

  // MLB Teams (Major US cities)
  { team: 'Red Sox', city: 'boston', country: 'United States', aliases: ['boston red sox'], league: 'MLB' },
  { team: 'Yankees', city: 'new york', country: 'United States', aliases: ['new york yankees', 'ny yankees'], league: 'MLB' },
  { team: 'Mets', city: 'new york', country: 'United States', aliases: ['new york mets', 'ny mets'], league: 'MLB' },
  { team: 'Dodgers', city: 'los angeles', country: 'United States', aliases: ['los angeles dodgers', 'la dodgers'], league: 'MLB' },
  { team: 'Cubs', city: 'chicago', country: 'United States', aliases: ['chicago cubs'], league: 'MLB' },
  { team: 'White Sox', city: 'chicago', country: 'United States', aliases: ['chicago white sox'], league: 'MLB' },

  // European Football/Soccer
  { team: 'AC Milan', city: 'milan', country: 'Italy', aliases: ['milan', 'acm', 'rossoneri'], league: 'Serie A' },
  { team: 'Inter Milan', city: 'milan', country: 'Italy', aliases: ['inter', 'internazionale', 'nerazzurri'], league: 'Serie A' },
  { team: 'Juventus', city: 'turin', country: 'Italy', aliases: ['juve', 'bianconeri'], league: 'Serie A' },
  { team: 'Roma', city: 'rome', country: 'Italy', aliases: ['as roma', 'giallorossi'], league: 'Serie A' },
  { team: 'Barcelona', city: 'barcelona', country: 'Spain', aliases: ['barca', 'fc barcelona', 'fcb'], league: 'La Liga' },
  { team: 'Real Madrid', city: 'madrid', country: 'Spain', aliases: ['madrid', 'real', 'los blancos'], league: 'La Liga' },
  { team: 'Atletico Madrid', city: 'madrid', country: 'Spain', aliases: ['atletico', 'atleti'], league: 'La Liga' },
  { team: 'Bayern Munich', city: 'munich', country: 'Germany', aliases: ['bayern', 'fcb'], league: 'Bundesliga' },
  { team: 'Borussia Dortmund', city: 'dortmund', country: 'Germany', aliases: ['dortmund', 'bvb'], league: 'Bundesliga' },
  { team: 'Manchester United', city: 'manchester', country: 'United Kingdom', aliases: ['man united', 'man utd', 'united'], league: 'Premier League' },
  { team: 'Manchester City', city: 'manchester', country: 'United Kingdom', aliases: ['man city', 'city'], league: 'Premier League' },
  { team: 'Liverpool', city: 'liverpool', country: 'United Kingdom', aliases: ['lfc', 'the reds'], league: 'Premier League' },
  { team: 'Chelsea', city: 'london', country: 'United Kingdom', aliases: ['cfc', 'the blues'], league: 'Premier League' },
  { team: 'Arsenal', city: 'london', country: 'United Kingdom', aliases: ['afc', 'gunners'], league: 'Premier League' },
  { team: 'Tottenham', city: 'london', country: 'United Kingdom', aliases: ['spurs', 'thfc'], league: 'Premier League' },
  { team: 'PSG', city: 'paris', country: 'France', aliases: ['paris saint-germain', 'paris sg'], league: 'Ligue 1' },

  // NHL Teams (Ice Hockey)
  { team: 'Bruins', city: 'boston', country: 'United States', aliases: ['boston bruins'], league: 'NHL' },
  { team: 'Sabres', city: 'buffalo', country: 'United States', aliases: ['buffalo sabres'], league: 'NHL' },
  { team: 'Red Wings', city: 'detroit', country: 'United States', aliases: ['detroit red wings'], league: 'NHL' },
  { team: 'Panthers', city: 'miami', country: 'United States', aliases: ['florida panthers'], league: 'NHL' },
  { team: 'Canadiens', city: 'montreal', country: 'Canada', aliases: ['montreal canadiens', 'habs'], league: 'NHL' },
  { team: 'Devils', city: 'newark', country: 'United States', aliases: ['new jersey devils'], league: 'NHL' },
  { team: 'Islanders', city: 'new york', country: 'United States', aliases: ['new york islanders', 'ny islanders'], league: 'NHL' },
  { team: 'Rangers', city: 'new york', country: 'United States', aliases: ['new york rangers', 'ny rangers'], league: 'NHL' },
  { team: 'Flyers', city: 'philadelphia', country: 'United States', aliases: ['philadelphia flyers'], league: 'NHL' },
  { team: 'Penguins', city: 'pittsburgh', country: 'United States', aliases: ['pittsburgh penguins'], league: 'NHL' },
  { team: 'Capitals', city: 'washington', country: 'United States', aliases: ['washington capitals', 'caps'], league: 'NHL' },
  { team: 'Hurricanes', city: 'raleigh', country: 'United States', aliases: ['carolina hurricanes', 'canes'], league: 'NHL' },
  { team: 'Blue Jackets', city: 'columbus', country: 'United States', aliases: ['columbus blue jackets'], league: 'NHL' },
  { team: 'Blackhawks', city: 'chicago', country: 'United States', aliases: ['chicago blackhawks'], league: 'NHL' },
  { team: 'Avalanche', city: 'denver', country: 'United States', aliases: ['colorado avalanche', 'avs'], league: 'NHL' },
  { team: 'Stars', city: 'dallas', country: 'United States', aliases: ['dallas stars'], league: 'NHL' },
  { team: 'Wild', city: 'minneapolis', country: 'United States', aliases: ['minnesota wild'], league: 'NHL' },
  { team: 'Predators', city: 'nashville', country: 'United States', aliases: ['nashville predators', 'preds'], league: 'NHL' },
  { team: 'Blues', city: 'st. louis', country: 'United States', aliases: ['st. louis blues', 'st louis blues', 'stl blues'], league: 'NHL' },
  { team: 'Coyotes', city: 'phoenix', country: 'United States', aliases: ['arizona coyotes'], league: 'NHL' },
  { team: 'Ducks', city: 'anaheim', country: 'United States', aliases: ['anaheim ducks'], league: 'NHL' },
  { team: 'Flames', city: 'calgary', country: 'Canada', aliases: ['calgary flames'], league: 'NHL' },
  { team: 'Oilers', city: 'edmonton', country: 'Canada', aliases: ['edmonton oilers'], league: 'NHL' },
  { team: 'Kings', city: 'los angeles', country: 'United States', aliases: ['los angeles kings', 'la kings'], league: 'NHL' },
  { team: 'Sharks', city: 'san jose', country: 'United States', aliases: ['san jose sharks'], league: 'NHL' },
  { team: 'Kraken', city: 'seattle', country: 'United States', aliases: ['seattle kraken'], league: 'NHL' },
  { team: 'Canucks', city: 'vancouver', country: 'Canada', aliases: ['vancouver canucks'], league: 'NHL' },
  { team: 'Golden Knights', city: 'las vegas', country: 'United States', aliases: ['vegas golden knights', 'vgk'], league: 'NHL' },
  { team: 'Jets', city: 'winnipeg', country: 'Canada', aliases: ['winnipeg jets'], league: 'NHL' },
  { team: 'Maple Leafs', city: 'toronto', country: 'Canada', aliases: ['toronto maple leafs', 'leafs'], league: 'NHL' },
  { team: 'Senators', city: 'ottawa', country: 'Canada', aliases: ['ottawa senators', 'sens'], league: 'NHL' },
  { team: 'Lightning', city: 'tampa', country: 'United States', aliases: ['tampa bay lightning', 'bolts'], league: 'NHL' },
]

/**
 * Find team location from market title
 */
export function detectSportsTeam(text: string): { city: string; country: string } | null {
  const lowerText = text.toLowerCase()

  for (const team of SPORTS_TEAMS) {
    // Check team name and all aliases
    const patterns = [team.team.toLowerCase(), ...team.aliases]

    for (const pattern of patterns) {
      // Word boundary matching
      const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (regex.test(lowerText)) {
        return {
          city: team.city,
          country: team.country
        }
      }
    }
  }

  return null
}
