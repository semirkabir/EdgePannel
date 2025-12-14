/**
 * Political Entities and Figures Database
 * Maps politicians, political parties, and government institutions to their countries
 */

export interface PoliticalEntity {
  name: string
  country: string
  type: 'leader' | 'politician' | 'party' | 'institution' | 'government'
  titles?: string[]
  aliases?: string[]
}

export const POLITICAL_ENTITIES: PoliticalEntity[] = [
  // US Political Figures
  { name: 'Donald Trump', country: 'United States', type: 'politician', titles: ['President', 'Former President'], aliases: ['trump', 'donald j trump', 'donald j. trump'] },
  { name: 'Joe Biden', country: 'United States', type: 'leader', titles: ['President'], aliases: ['biden', 'joseph biden'] },
  { name: 'Kamala Harris', country: 'United States', type: 'politician', titles: ['Vice President'], aliases: ['harris', 'kamala'] },
  { name: 'Ron DeSantis', country: 'United States', type: 'politician', titles: ['Governor'], aliases: ['desantis'] },
  { name: 'Gavin Newsom', country: 'United States', type: 'politician', titles: ['Governor'], aliases: ['newsom'] },
  { name: 'Mike Johnson', country: 'United States', type: 'politician', titles: ['Speaker'], aliases: ['johnson'] },
  { name: 'Mitch McConnell', country: 'United States', type: 'politician', titles: ['Senator'], aliases: ['mcconnell'] },
  { name: 'Chuck Schumer', country: 'United States', type: 'politician', titles: ['Senator'], aliases: ['schumer'] },
  { name: 'Kevin McCarthy', country: 'United States', type: 'politician', titles: ['Former Speaker'], aliases: ['mccarthy'] },
  { name: 'Nancy Pelosi', country: 'United States', type: 'politician', titles: ['Former Speaker'], aliases: ['pelosi'] },
  { name: 'Pete Buttigieg', country: 'United States', type: 'politician', titles: ['Secretary'], aliases: ['buttigieg', 'mayor pete'] },
  { name: 'J.D. Vance', country: 'United States', type: 'politician', aliases: ['vance', 'jd vance'] },
  { name: 'Nikki Haley', country: 'United States', type: 'politician', aliases: ['haley'] },
  { name: 'Vivek Ramaswamy', country: 'United States', type: 'politician', aliases: ['ramaswamy', 'vivek'] },
  { name: 'Marco Rubio', country: 'United States', type: 'politician', aliases: ['rubio'] },
  { name: 'Ted Cruz', country: 'United States', type: 'politician', aliases: ['cruz'] },
  { name: 'Alexandria Ocasio-Cortez', country: 'United States', type: 'politician', aliases: ['aoc', 'ocasio-cortez', 'ocasio cortez'] },
  { name: 'Bernie Sanders', country: 'United States', type: 'politician', aliases: ['sanders', 'bernie'] },
  { name: 'Elizabeth Warren', country: 'United States', type: 'politician', aliases: ['warren'] },
  { name: 'Adam Schiff', country: 'United States', type: 'politician', aliases: ['schiff'] },

  // US Institutions
  { name: 'Federal Reserve', country: 'United States', type: 'institution', aliases: ['fed', 'the fed', 'federal reserve bank', 'federal reserve system'] },
  { name: 'Supreme Court', country: 'United States', type: 'institution', aliases: ['scotus', 'us supreme court'] },
  { name: 'Congress', country: 'United States', type: 'institution', aliases: ['us congress', 'senate', 'house of representatives'] },
  { name: 'Pentagon', country: 'United States', type: 'institution', aliases: ['department of defense', 'dod'] },
  { name: 'State Department', country: 'United States', type: 'institution', aliases: ['department of state'] },
  { name: 'White House', country: 'United States', type: 'institution', aliases: ['the white house'] },
  { name: 'FBI', country: 'United States', type: 'institution', aliases: ['federal bureau of investigation'] },
  { name: 'CIA', country: 'United States', type: 'institution', aliases: ['central intelligence agency'] },
  { name: 'Treasury', country: 'United States', type: 'institution', aliases: ['us treasury', 'department of treasury'] },

  // World Leaders
  { name: 'Vladimir Putin', country: 'Russia', type: 'leader', titles: ['President'], aliases: ['putin'] },
  { name: 'Xi Jinping', country: 'China', type: 'leader', titles: ['President'], aliases: ['xi', 'xi jinping'] },
  { name: 'Volodymyr Zelenskyy', country: 'Ukraine', type: 'leader', titles: ['President'], aliases: ['zelenskyy', 'zelensky', 'zelenskiy'] },
  { name: 'Benjamin Netanyahu', country: 'Israel', type: 'leader', titles: ['Prime Minister'], aliases: ['netanyahu', 'bibi'] },
  { name: 'Gideon Sa\'ar', country: 'Israel', type: 'politician', aliases: ['saar', 'gideon saar'] },
  { name: 'Emmanuel Macron', country: 'France', type: 'leader', titles: ['President'], aliases: ['macron'] },
  { name: 'Olaf Scholz', country: 'Germany', type: 'leader', titles: ['Chancellor'], aliases: ['scholz'] },
  { name: 'Rishi Sunak', country: 'United Kingdom', type: 'leader', titles: ['Prime Minister'], aliases: ['sunak'] },
  { name: 'Keir Starmer', country: 'United Kingdom', type: 'leader', titles: ['Prime Minister'], aliases: ['starmer'] },
  { name: 'Giorgia Meloni', country: 'Italy', type: 'leader', titles: ['Prime Minister'], aliases: ['meloni'] },
  { name: 'Pedro Sánchez', country: 'Spain', type: 'leader', titles: ['Prime Minister'], aliases: ['sanchez', 'sánchez'] },
  { name: 'Justin Trudeau', country: 'Canada', type: 'leader', titles: ['Prime Minister'], aliases: ['trudeau'] },
  { name: 'Andrés Manuel López Obrador', country: 'Mexico', type: 'leader', titles: ['President'], aliases: ['amlo', 'lopez obrador', 'lópez obrador'] },
  { name: 'Claudia Sheinbaum', country: 'Mexico', type: 'leader', titles: ['President'], aliases: ['sheinbaum'] },
  { name: 'Luiz Inácio Lula da Silva', country: 'Brazil', type: 'leader', titles: ['President'], aliases: ['lula', 'lula da silva'] },
  { name: 'Javier Milei', country: 'Argentina', type: 'leader', titles: ['President'], aliases: ['milei'] },
  { name: 'Nicolás Maduro', country: 'Venezuela', type: 'leader', titles: ['President'], aliases: ['maduro'] },
  { name: 'Nayib Bukele', country: 'El Salvador', type: 'leader', titles: ['President'], aliases: ['bukele'] },
  { name: 'Narendra Modi', country: 'India', type: 'leader', titles: ['Prime Minister'], aliases: ['modi'] },
  { name: 'Recep Tayyip Erdoğan', country: 'Turkey', type: 'leader', titles: ['President'], aliases: ['erdogan', 'erdoğan'] },
  { name: 'Mohammed bin Salman', country: 'Saudi Arabia', type: 'leader', titles: ['Crown Prince'], aliases: ['mbs', 'bin salman'] },
  { name: 'Kim Jong Un', country: 'North Korea', type: 'leader', titles: ['Supreme Leader'], aliases: ['kim jong-un', 'kim'] },
  { name: 'Bashar al-Assad', country: 'Syria', type: 'leader', titles: ['President'], aliases: ['assad'] },
  { name: 'Abdel Fattah el-Sisi', country: 'Egypt', type: 'leader', titles: ['President'], aliases: ['sisi', 'el-sisi'] },

  // Appointees & Cabinet Officials
  { name: 'Kevin Warsh', country: 'United States', type: 'politician', titles: ['Former Fed Governor'], aliases: ['warsh'] },
  { name: 'Jerome Powell', country: 'United States', type: 'institution', titles: ['Fed Chair'], aliases: ['powell', 'jay powell'] },
  { name: 'Janet Yellen', country: 'United States', type: 'politician', titles: ['Treasury Secretary'], aliases: ['yellen'] },
  { name: 'Antony Blinken', country: 'United States', type: 'politician', titles: ['Secretary of State'], aliases: ['blinken'] },
  { name: 'Lloyd Austin', country: 'United States', type: 'politician', titles: ['Defense Secretary'], aliases: ['austin'] },
  { name: 'Merrick Garland', country: 'United States', type: 'politician', titles: ['Attorney General'], aliases: ['garland'] },

  // Celebrities (if they run for office)
  { name: 'Kim Kardashian', country: 'United States', type: 'politician', aliases: ['kardashian', 'kim k'] },
  { name: 'Dwayne Johnson', country: 'United States', type: 'politician', aliases: ['the rock', 'dwayne the rock johnson'] },
  { name: 'Oprah Winfrey', country: 'United States', type: 'politician', aliases: ['oprah'] },
  { name: 'Elon Musk', country: 'United States', type: 'politician', aliases: ['musk'] },
  { name: 'Mark Zuckerberg', country: 'United States', type: 'politician', aliases: ['zuckerberg'] },
]

/**
 * Detect political entity and return associated country
 */
export function detectPoliticalEntity(text: string): { country: string; entity: string; type: string } | null {
  const lowerText = text.toLowerCase()

  for (const entity of POLITICAL_ENTITIES) {
    // Check main name and aliases
    const patterns = [entity.name.toLowerCase(), ...(entity.aliases || [])]

    for (const pattern of patterns) {
      // Use word boundary matching for better accuracy
      const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (regex.test(lowerText)) {
        return {
          country: entity.country,
          entity: entity.name,
          type: entity.type
        }
      }
    }
  }

  return null
}
