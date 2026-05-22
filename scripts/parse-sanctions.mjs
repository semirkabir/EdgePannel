import fs from 'fs';
import path from 'path';

const OUTPUT_FILE = path.join(process.cwd(), 'public', 'data', 'sanctions.generated.json');

const SANCTIONED_ASSETS_DATA = [
  // --- OLIGARCH YACHTS (Vessels) ---
  {
    id: 'sanc-yacht-dilbar',
    name: 'Megayacht "Dilbar"',
    lat: 53.551,
    lon: 9.993,
    type: 'yacht',
    sanctionCountry: 'Russia',
    program: 'OFAC SDN, EU Consolidated, UK SEMA',
    description: 'One of the largest motor yachts in the world by gross tonnage, valued at $600M. Owned by billionaire Alisher Usmanov. Arrested in Hamburg, Germany.',
    owner: 'Alisher Usmanov',
    value: '$600M'
  },
  {
    id: 'sanc-yacht-amore-vero',
    name: 'Superyacht "Amore Vero"',
    lat: 43.175,
    lon: 5.612,
    type: 'yacht',
    sanctionCountry: 'Russia',
    program: 'OFAC SDN, EU Consolidated',
    description: 'Luxury yacht valued at $120M, linked to Igor Sechin, CEO of Rosneft. Seized by French customs in La Ciotat port.',
    owner: 'Igor Sechin',
    value: '$120M'
  },
  {
    id: 'sanc-yacht-scheherazade',
    name: 'Megayacht "Scheherazade"',
    lat: 44.035,
    lon: 10.040,
    type: 'yacht',
    sanctionCountry: 'Russia',
    program: 'EU Consolidated, OFAC SDN',
    description: 'Ultraluxury megayacht valued at $700M. Seized by Italian police in Marina di Carrara port under suspicion of ownership by sanctioned oligarchs.',
    owner: 'Eduard Khudainatov',
    value: '$700M'
  },
  {
    id: 'sanc-yacht-tango',
    name: 'Superyacht "Tango"',
    lat: 39.569,
    lon: 2.650,
    type: 'yacht',
    sanctionCountry: 'Russia',
    program: 'OFAC SDN, Spanish Seizure Directive',
    description: 'Yacht valued at $90M owned by Viktor Vekselberg. Seized by Spanish authorities and federal agents in Palma de Mallorca.',
    owner: 'Viktor Vekselberg',
    value: '$90M'
  },
  {
    id: 'sanc-yacht-amadea',
    name: 'Superyacht "Amadea"',
    lat: 32.715,
    lon: -117.162,
    type: 'yacht',
    sanctionCountry: 'Russia',
    program: 'OFAC SDN, US Task Force KleptoCapture',
    description: 'Valued at $325M, sailed to Fiji where it was seized by US federal authorities. Docked in San Diego, California.',
    owner: 'Suleiman Kerimov',
    value: '$325M'
  },
  {
    id: 'sanc-yacht-sailing-a',
    name: 'Sailing Yacht "A"',
    lat: 45.649,
    lon: 13.776,
    type: 'yacht',
    sanctionCountry: 'Russia',
    program: 'EU Consolidated List',
    description: 'The largest sailing yacht in the world, valued at $580M. Seized by Italian financial police in the port of Trieste.',
    owner: 'Andrey Melnichenko',
    value: '$580M'
  },
  {
    id: 'sanc-yacht-crescent',
    name: 'Superyacht "Crescent"',
    lat: 41.114,
    lon: 1.252,
    type: 'yacht',
    sanctionCountry: 'Russia',
    program: 'EU Consolidated, OFAC SDN',
    description: 'Luxury yacht valued at $600M, believed to be owned by Igor Sechin. Detained in the port of Tarragona, Spain.',
    owner: 'Igor Sechin',
    value: '$600M'
  },
  {
    id: 'sanc-yacht-valerie',
    name: 'Superyacht "Valerie"',
    lat: 41.385,
    lon: 2.173,
    type: 'yacht',
    sanctionCountry: 'Russia',
    program: 'EU Consolidated, OFAC SDN',
    description: 'Superyacht valued at $140M, linked to Rostec chief Sergey Chemezov. Seized in Barcelona port, Spain.',
    owner: 'Sergey Chemezov',
    value: '$140M'
  },
  {
    id: 'sanc-yacht-lady-m',
    name: 'Superyacht "Lady M"',
    lat: 43.882,
    lon: 8.028,
    type: 'yacht',
    sanctionCountry: 'Russia',
    program: 'EU Consolidated, UK SEMA',
    description: 'Luxury yacht valued at $70M owned by steel tycoon Alexey Mordashov. Seized by Italian authorities in Imperia.',
    owner: 'Alexey Mordashov',
    value: '$70M'
  },

  // --- SANCTIONED BANKS & FINANCIAL INSTITUTIONS ---
  {
    id: 'sanc-bank-sberbank',
    name: 'Sberbank HQ',
    lat: 55.701,
    lon: 37.585,
    type: 'bank',
    sanctionCountry: 'Russia',
    program: 'OFAC SDN, EU CAPTA, UK Asset Freeze',
    description: 'Headquarters of Russia\'s largest financial institution. Under full blocking sanctions and cut off from the SWIFT global payments system.',
    owner: 'Russian Federation (Majority Share)',
    value: 'Asset Freeze'
  },
  {
    id: 'sanc-bank-vtb',
    name: 'VTB Bank HQ (Federation Tower)',
    lat: 55.748,
    lon: 37.538,
    type: 'bank',
    sanctionCountry: 'Russia',
    program: 'OFAC SDN, EU Blocking, UK Blocking',
    description: 'Russia\'s second-largest bank, heavily exposed to military financing. Under strict global assets freeze and SWIFT disconnection.',
    owner: 'Russian Federation (Majority Share)',
    value: 'Asset Freeze'
  },
  {
    id: 'sanc-bank-gazprombank',
    name: 'Gazprombank Central Office',
    lat: 55.758,
    lon: 37.601,
    type: 'bank',
    sanctionCountry: 'Russia',
    program: 'US Debt Restrictions, UK Sanctions',
    description: 'Core financial channel for European natural gas payments. Under selective debt restrictions and capital market bans.',
    owner: 'Gazprom (Majority Share)',
    value: 'Targeted Ban'
  },
  {
    id: 'sanc-bank-vebrf',
    name: 'VEB.RF Development Corporation HQ',
    lat: 55.768,
    lon: 37.689,
    type: 'bank',
    sanctionCountry: 'Russia',
    program: 'OFAC SDN, EU Blocking, UK Blocking',
    description: 'State development bank utilized to raise sovereign debt and fund major military-industrial complex programs.',
    owner: 'Russian Federation (State Bank)',
    value: 'Asset Freeze'
  },
  {
    id: 'sanc-bank-rossiya',
    name: 'Bank Rossiya HQ',
    lat: 59.934,
    lon: 30.315,
    type: 'bank',
    sanctionCountry: 'Russia',
    program: 'OFAC SDN, EU Blocking',
    description: 'Commonly known as the "personal bank of senior Russian officials". Under strict asset freeze sanctions since the 2014 Crimea invasion.',
    owner: 'Yuri Kovalchuk (Co-owner)',
    value: 'Asset Freeze'
  },
  {
    id: 'sanc-bank-cbr',
    name: 'Central Bank of the Russian Federation HQ',
    lat: 55.760,
    lon: 37.622,
    type: 'bank',
    sanctionCountry: 'Russia',
    program: 'G7 Sovereign Reserves Freeze',
    description: 'Central bank holding Russia\'s foreign currency reserves. Over $300 billion in G7-jurisdiction assets frozen globally.',
    owner: 'Russian Federation',
    value: '$300B+ Frozen'
  },
  {
    id: 'sanc-bank-cbi',
    name: 'Central Bank of Iran HQ',
    lat: 35.696,
    lon: 51.423,
    type: 'bank',
    sanctionCountry: 'Iran',
    program: 'OFAC SDN, Counter-Terrorism',
    description: 'Primary conduit for financing the IRGC Quds Force and Hezbollah. Subject to severe financial isolation and SWIFT lockouts.',
    owner: 'Islamic Republic of Iran',
    value: 'Full Isolation'
  },
  {
    id: 'sanc-bank-melli',
    name: 'Bank Melli Iran HQ',
    lat: 35.701,
    lon: 51.411,
    type: 'bank',
    sanctionCountry: 'Iran',
    program: 'OFAC SDN, WMD Proliferation',
    description: 'State-owned bank facilitating transactions for Iran\'s Ministry of Defense and Armed Forces Logistics.',
    owner: 'Islamic Republic of Iran',
    value: 'Asset Freeze'
  },
  {
    id: 'sanc-bank-saderat',
    name: 'Bank Saderat Iran HQ',
    lat: 35.729,
    lon: 51.429,
    type: 'bank',
    sanctionCountry: 'Iran',
    program: 'OFAC SDN, Terrorism Financing',
    description: 'Major commercial bank sanctioned for routing payments to regional military groups and arms procurement front companies.',
    owner: 'Islamic Republic of Iran',
    value: 'Asset Freeze'
  },
  {
    id: 'sanc-bank-kp',
    name: 'Agricultural Development Bank of North Korea',
    lat: 39.039,
    lon: 125.762,
    type: 'bank',
    sanctionCountry: 'North Korea',
    program: 'UN Security Council, OFAC SDN',
    description: 'State financial entity involved in laundering illicit foreign currency and funding state ballistic missile programs.',
    owner: 'Democratic People\'s Republic of Korea',
    value: 'Full Block'
  },

  // --- SANCTIONED SHIPPING PORTS ---
  {
    id: 'sanc-port-sevastopol',
    name: 'Port of Sevastopol',
    lat: 44.615,
    lon: 33.525,
    type: 'port',
    sanctionCountry: 'Russia',
    program: 'OFAC SDN, Ukraine-Related Crimea sanctions',
    description: 'Strategic military and shipping port in Crimea. Sanctioned for illegal trade operations and facilitating state transport of seized grains.',
    owner: 'Occupying Russian Administration',
    value: 'Sovereign Disruption'
  },
  {
    id: 'sanc-port-feodosia',
    name: 'Port of Feodosia',
    lat: 45.025,
    lon: 35.385,
    type: 'port',
    sanctionCountry: 'Russia',
    program: 'OFAC SDN, Ukraine-Related',
    description: 'Marine terminal and oil shipping hub in Crimea. Seized and blocked by Western allies to disrupt illicit regional fuels distribution.',
    owner: 'Occupying Russian Administration',
    value: 'Sovereign Disruption'
  },
  {
    id: 'sanc-port-kerch',
    name: 'Port of Kerch',
    lat: 45.361,
    lon: 36.483,
    type: 'port',
    sanctionCountry: 'Russia',
    program: 'OFAC SDN, EU Seizure Directive',
    description: 'Key transit port controlling access to the Sea of Azov. Core bottleneck for trade route shipping in and out of occupied Ukraine.',
    owner: 'Occupying Russian Administration',
    value: 'Sovereign Disruption'
  },
  {
    id: 'sanc-port-tartus',
    name: 'Port of Tartus (Russian Base)',
    lat: 34.892,
    lon: 35.875,
    type: 'port',
    sanctionCountry: 'Syria',
    program: 'OFAC SDN, Caesar Syria Civilian Protection Act',
    description: 'Syrian port leased by Russia. Hosts naval repair hubs and facilitates arms logistics and wheat shipping under active sanctions.',
    owner: 'Syrian State / Russian Navy',
    value: 'Logistical Blockade'
  },
  {
    id: 'sanc-port-latakia',
    name: 'Port of Latakia',
    lat: 35.526,
    lon: 35.768,
    type: 'port',
    sanctionCountry: 'Syria',
    program: 'OFAC SDN, Caesar Act',
    description: 'Syria\'s main commercial seaport. Blocked for handling dual-use chemical manufacturing components and military transport ships.',
    owner: 'Syrian Arab Republic',
    value: 'Trade Freeze'
  },
  {
    id: 'sanc-port-bandar-abbas',
    name: 'Bandar Abbas Port (Shahid Rajaee Terminal)',
    lat: 27.149,
    lon: 56.205,
    type: 'port',
    sanctionCountry: 'Iran',
    program: 'OFAC SDN, IRGC Front Designation',
    description: 'Iran\'s primary container terminal, controlled by Tidewater Middle East (an IRGC-owned maritime transport front company).',
    owner: 'Tidewater Middle East Co.',
    value: 'IRGC Target'
  },
  {
    id: 'sanc-port-chabahar',
    name: 'Chabahar Port',
    lat: 25.289,
    lon: 60.627,
    type: 'port',
    sanctionCountry: 'Iran',
    program: 'US Non-proliferation Sanctions (Special Exemptions)',
    description: 'Deep-sea trade port under targeted monitoring. Operates under limited US sanctions exemptions to facilitate Afghan humanitarian supply lines.',
    owner: 'Islamic Republic of Iran',
    value: 'Targeted Review'
  },
  {
    id: 'sanc-port-nampo',
    name: 'Port of Nampo',
    lat: 38.729,
    lon: 125.405,
    type: 'port',
    sanctionCountry: 'North Korea',
    program: 'UN Security Council Trade Blockade',
    description: 'North Korea\'s largest port, central to banned coal exports and ship-to-ship high-seas oil transfers in violation of UN directives.',
    owner: 'Democratic People\'s Republic of Korea',
    value: 'UN Blockade'
  },
  {
    id: 'sanc-port-wonsan',
    name: 'Port of Wonsan',
    lat: 39.167,
    lon: 127.449,
    type: 'port',
    sanctionCountry: 'North Korea',
    program: 'UN Security Council, OFAC SDN',
    description: 'Naval shipyard and trade facility. Blocked for naval vessel construction and facilitating illicit state marine smuggling operations.',
    owner: 'Democratic People\'s Republic of Korea',
    value: 'UN Blockade'
  },

  // --- HIGH-VALUE REAL ESTATE ASSETS ---
  {
    id: 'sanc-prop-lake-como',
    name: 'Villa of Vladimir Solovyov',
    lat: 46.015,
    lon: 9.268,
    type: 'real_estate',
    sanctionCountry: 'Russia',
    program: 'EU Consolidated Asset Seizure',
    description: 'Luxury villa on Lake Como, Italy, valued at $10M. Owned by state media TV host Vladimir Solovyov. Frozen and vandalized by local protests.',
    owner: 'Vladimir Solovyov',
    value: '$10M'
  },
  {
    id: 'sanc-prop-cap-d-antibes',
    name: 'Villa de la Croe (Chateau)',
    lat: 43.545,
    lon: 7.132,
    type: 'real_estate',
    sanctionCountry: 'Russia',
    program: 'French Ministry of Finance Freeze',
    description: 'Ultra-exclusive oceanfront chateau in Cap d\'Antibes, France, valued at $100M. Owned by billionaire Roman Abramovich. Seized by the French government.',
    owner: 'Roman Abramovich',
    value: '$100M'
  },
  {
    id: 'sanc-prop-sardinia-deripaska',
    name: 'Villa Walkiria',
    lat: 41.135,
    lon: 9.521,
    type: 'real_estate',
    sanctionCountry: 'Russia',
    program: 'Italian Treasury Assets Seizure',
    description: 'Stunning luxury villa complex in Porto Cervo, Sardinia, valued at $40M. Owned by aluminum industrialist Oleg Deripaska. Frozen by Italian Treasury.',
    owner: 'Oleg Deripaska',
    value: '$40M'
  },
  {
    id: 'sanc-prop-sardinia-rotenberg',
    name: 'Sardinian Estate of Arkady Rotenberg',
    lat: 41.118,
    lon: 9.518,
    type: 'real_estate',
    sanctionCountry: 'Russia',
    program: 'EU Consolidated List Assets Freeze',
    description: 'Vast coastal property holdings and luxury villas in Sardinia valued at $45M. Frozen by Italian financial police.',
    owner: 'Arkady Rotenberg',
    value: '$45M'
  },
  {
    id: 'sanc-prop-london-shuvalov',
    name: 'Whitehall Penthouse Apartment',
    lat: 51.506,
    lon: -0.125,
    type: 'real_estate',
    sanctionCountry: 'Russia',
    program: 'UK Sovereign Asset Freeze',
    description: 'Premium luxury penthouse in central London, UK, valued at $15M. Owned by VEB.RF chairman Igor Shuvalov. Frozen under the UK asset freeze programs.',
    owner: 'Igor Shuvalov',
    value: '$15M'
  }
];

function run() {
  console.log('[Sanctions Ingestion] Generating georeferenced sanctioned assets...');
  try {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(SANCTIONED_ASSETS_DATA, null, 2), 'utf-8');
    console.log(`[Sanctions Ingestion] Successfully wrote ${SANCTIONED_ASSETS_DATA.length} sanctioned assets to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('[Sanctions Ingestion] Ingestion failed:', err);
    process.exit(1);
  }
}

run();
