// ── Environmental threats database ───────────────────────────────────────────
// Each entry documents a real atrocity against nature, with hard facts.
// In-game, these manifest as enemy camps, raid events, and encounter popups.
// Defeating a threat unlocks educational content and species / ecological bonuses.

export type ThreatCategory =
  | 'logging'
  | 'hunting'           // trophy, fun, subsistence-turned-commercial
  | 'ocean_exploitation'// whaling, shark finning, trawling
  | 'poaching'          // ivory, rhino horn, exotic species
  | 'habitat_loss'      // palm oil, monoculture, urbanisation
  | 'pollution'         // pesticides, plastics, chemical dumping
  | 'climate'           // emissions-driven threats
  | 'exotic_trade';     // exotic pet, illegal wildlife trade

export type ThreatStatus =
  | 'ongoing'            // still happening at scale right now
  | 'escalating'         // getting worse year on year
  | 'banned_some_places' // illegal in parts of world, continues elsewhere
  | 'reduced'            // declining but not stopped
  | 'industry_normalized'// the horror is accepted as business-as-usual;

export interface ThreatDef {
  id: string;
  name: string;
  category: ThreatCategory;
  // The data that should stop your breath
  realWorldFact: string;
  shockingNumber: string;          // one headline statistic
  yearRange: string;               // 'ongoing since XXXX' or '1XXX–present'
  regionsAffected: string[];
  status: ThreatStatus;
  targetSpecies: string[];         // botany.ts species ids or animal names
  // Game data
  hp: number;
  maxHp: number;
  damage: string;                  // what it destroys in-game
  lootDescription: string;         // what defeating it drops
  // Education
  encounterText: string[];         // shown when player approaches (like a dialogue)
  defeatText: string[];            // shown when camp is destroyed (the lesson)
  // Rendering
  campTint: string;                // colour tint of the camp sprite
  icon: string;                    // emoji
  // Spawn rules
  spawnBiome: string[];
  minEra: number;
}

export const THREATS: ThreatDef[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // LOGGING
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'industrial_logging',
    name: 'Industrial Logging Operation',
    category: 'logging',
    realWorldFact: 'The global timber industry clears approximately 15 billion trees every year. Net global tree loss since the dawn of agriculture is 46% — nearly half the trees that once existed are gone. Industrial logging is the single largest driver of biodiversity loss on land.',
    shockingNumber: '15,000,000,000 trees felled per year',
    yearRange: '1800s–present (industrial scale from 1950)',
    regionsAffected: ['Amazon Basin', 'Congo Basin', 'Borneo / Indonesia', 'Myanmar', 'Russia (Siberia)', 'Canada (British Columbia)'],
    status: 'escalating',
    targetSpecies: ['teak', 'coastal_redwood', 'brazil_nut', 'english_oak', 'scots_pine'],
    hp: 400,
    maxHp: 400,
    damage: 'Destroys adjacent forest tiles. Targets old-growth species first. Increases raid events.',
    lootDescription: '30 Wood (fallen timber) · 15 Stone · rescued Sal tree seedlings · Carbon Credit ×20',
    encounterText: [
      '"You smell the sawdust before you see the machines."',
      '"A 300-year teak, felled in 11 seconds. The sawyers do not look up."',
      '"This operation will clear 8 square kilometres before dawn."',
      '"Each tree is a calculation. Board-feet. Nothing else."',
    ],
    defeatText: [
      '"The machines are still. The forest edges forward, cautiously."',
      '"FACT: 15 billion trees are cut down each year. Only 5 billion are planted. The deficit is 10 billion trees — every single year."',
      '"FACT: The Amazon has lost 17% of its forest in 50 years. Scientists say 20-25% is the tipping point beyond which it collapses into savanna — permanently."',
      '"The seedlings you rescued were 300-year-old teak species. You have bought them time."',
    ],
    campTint: '#6a4a20',
    icon: '🪚',
    spawnBiome: ['tropical', 'temperate', 'boreal'],
    minEra: 1,
  },

  {
    id: 'palm_oil_clearing',
    name: 'Palm Oil Plantation Advance',
    category: 'habitat_loss',
    realWorldFact: 'Palm oil is in 50% of all supermarket products. To produce it, 300 football fields of Southeast Asian rainforest are cleared EVERY HOUR. Indonesia and Malaysia have lost over 50% of their original forest cover. The Sumatran orangutan, Bornean pygmy elephant, and Sumatran tiger are all critically endangered as a direct result.',
    shockingNumber: '300 football fields of rainforest cleared EVERY HOUR for palm oil',
    yearRange: '1970s–present (accelerating since 1990)',
    regionsAffected: ['Indonesia (Sumatra, Borneo)', 'Malaysia', 'Papua New Guinea', 'West and Central Africa', 'Latin America'],
    status: 'escalating',
    targetSpecies: ['kapok', 'banyan', 'vanilla_orchid', 'brazil_nut', 'sycamore_fig'],
    hp: 500,
    maxHp: 500,
    damage: 'Converts forest tiles to dead plantation tiles — persistent, hard to restore. Carbon release event.',
    lootDescription: '10 Coin · rescued orangutan entity · Rainforest Alliance blueprint (building cost -20%)',
    encounterText: [
      '"Orange. Everything is orange. Burning, and then mud, and then the same crop repeated to the horizon."',
      '"The last orangutan in this forest was seen two weeks ago. She had an infant."',
      '"This operation has a \'sustainable\' certification. The certification costs $3,000."',
      '"The peat soil beneath is 10,000 years old. When it burns, it releases carbon stored since before writing was invented."',
    ],
    defeatText: [
      '"The advance halts. The peat cools. You find, in the ashes, a fig seed — still viable."',
      '"FACT: A single hectare of peatland stores more carbon than 55 hectares of tropical forest. Indonesia burns its peatlands every dry season. The 2015 peat fires released more carbon than the entire EU does in a year."',
      '"FACT: Palm oil is in Nutella, lipstick, pizza dough, shampoo, bread, and biodiesel. \'Sustainable\' palm oil certifications are, in most cases, not enforced."',
      '"You plant a banyan here. In 50 years, it will be a forest again. That is not nothing."',
    ],
    campTint: '#b06820',
    icon: '🔥',
    spawnBiome: ['tropical'],
    minEra: 2,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HUNTING — TROPHY & COMMERCIAL
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'trophy_hunting',
    name: 'Trophy Hunting Camp',
    category: 'hunting',
    realWorldFact: 'Trophy hunting is the practice of killing animals for sport and keeping body parts as trophies. It is legal in 35 countries. 600,000 animals are killed as trophies globally each year. The United States is the world\'s largest importer of trophy parts — American hunters kill 126,000 animals annually in Africa alone. This includes lions, elephants, leopards, rhinos, hippopotamuses, and giraffes.',
    shockingNumber: '126,000 African animals killed annually by American trophy hunters alone',
    yearRange: '1800s (colonial era) –present',
    regionsAffected: ['Sub-Saharan Africa', 'North America (bear, mountain lion, wolf)', 'Central Asia (snow leopard, argali sheep)', 'Eastern Europe', 'New Zealand'],
    status: 'ongoing',
    targetSpecies: ['baobab'], // elephants, lions etc. — listed as animals
    hp: 280,
    maxHp: 280,
    damage: 'Kills high-value animal entities. Disrupts keystone species balance. Sanity drain from player proximity.',
    lootDescription: '15 Coin · rescued lion cub entity · Tracking knowledge (+wolf detection range)',
    encounterText: [
      '"A photo: a man in khaki, kneeling over Cecil the lion. He is grinning."',
      '"Cecil was 13 years old. A research lion. He was baited out of a national park."',
      '"Trophy hunts cost $50,000 to $350,000. The money rarely reaches local communities."',
      '"The hunter called it conservation. The lions have no voice in this conversation."',
    ],
    defeatText: [
      '"The camp is empty now. Somewhere, a lion lifts her head."',
      '"FACT: Cecil the lion\'s death in 2015 sparked global outrage. But the hunter paid $55,000 legally and faced no criminal charges. Dozens of lions are killed this way every year with no media coverage."',
      '"FACT: Studies in Zimbabwe show that local communities receive less than 3% of trophy hunting revenues. The rest goes to outfitters and overseas operators."',
      '"FACT: When trophy hunters target the biggest males, they remove the strongest genes from the population. The evolutionary damage persists for generations."',
    ],
    campTint: '#8a6030',
    icon: '🎯',
    spawnBiome: ['savanna', 'temperate', 'grassland'],
    minEra: 1,
  },

  {
    id: 'whaling_operation',
    name: 'Whaling Vessel',
    category: 'ocean_exploitation',
    realWorldFact: 'Commercial whaling killed over 3 million whales in the 20th century alone — the largest slaughter of wild animals by mass in history. In the 1960s, the Soviet Union falsified its whaling records, reporting 2,710 humpback whales caught while secretly killing 25,000. The International Whaling Commission \'moratorium\' declared in 1986 has loopholes — Japan alone has killed over 18,000 whales since then under the label of \'scientific research\'.',
    shockingNumber: 'Over 3 MILLION whales killed in the 20th century — the largest slaughter of wild animals in history',
    yearRange: '1600s–present (industrial scale 1900–1986; still ongoing)',
    regionsAffected: ['North Atlantic', 'Southern Ocean / Antarctic', 'North Pacific', 'Norwegian Sea', 'Faroe Islands'],
    status: 'ongoing',
    targetSpecies: [],
    hp: 350,
    maxHp: 350,
    damage: 'Ocean biodiversity damage. Whale entities cannot appear while active. Disrupts deep-ocean carbon cycle.',
    lootDescription: '20 Food · Whale song knowledge (ocean navigation bonus) · Rescued whale calf entity',
    encounterText: [
      '"The factory ship is 140 metres long. It can process a whale in 33 minutes."',
      '"A sperm whale surfaces, exhales once, and is harpooned. It struggles for 45 minutes."',
      '"In its stomach: plastic bags, fishing nets, rope. It was already dying before the harpoon."',
      '"Japan\'s quota this year is 227 minke whales. For \'scientific research.\'"',
    ],
    defeatText: [
      '"The ship turns. The whale dives. In the deep, something ancient is safe, for now."',
      '"FACT: A living whale is worth more to the ocean than dead. Whale falls — the bodies of dead whales on the seafloor — support entire ecosystems for decades, providing food and habitat for over 400 species."',
      '"FACT: Whale feces fertilises ocean surface waters with iron and nitrogen, stimulating plankton blooms that absorb CO₂. Restoring whale populations to pre-whaling levels could sequester the equivalent of 1.7 billion trees worth of carbon."',
      '"FACT: Blue whales can live 90 years. They mate slowly. Their populations cannot recover from industrial harvest rates — ever. We killed them faster than biology allows them to recover."',
      '"The blue whale\'s heart is the size of a small car. You can hear it beating 3 kilometres away."',
    ],
    campTint: '#203060',
    icon: '🐋',
    spawnBiome: ['coastal'],
    minEra: 2,
  },

  {
    id: 'shark_finning',
    name: 'Shark Finning Syndicate',
    category: 'ocean_exploitation',
    realWorldFact: 'Shark finning — cutting off a shark\'s fin and discarding the still-living body at sea — kills 73 million to 100 million sharks every year. Sharks have survived five mass extinction events over 450 million years of evolution. In 50 years of industrial fishing, we have reduced global shark populations by 71%. One-third of all shark and ray species are now threatened with extinction.',
    shockingNumber: '73–100 million sharks killed per year for fin soup',
    yearRange: '1980s–present (most intensive)',
    regionsAffected: ['Pacific Ocean', 'Indian Ocean', 'South China Sea', 'Caribbean', 'Mediterranean'],
    status: 'ongoing',
    targetSpecies: [],
    hp: 300,
    maxHp: 300,
    damage: 'Collapses fish node yields (sharks control fish populations). Coral ecosystem damage.',
    lootDescription: '15 Coin · Marine biology knowledge (ocean map bonus) · Shark entity respawn',
    encounterText: [
      '"The fin is cut with a long knife. The shark, still alive, is thrown back."',
      '"Without its fin, it cannot swim. It sinks and suffocates or is eaten alive."',
      '"This syndicate ships 2,000 fins a day to restaurants in Hong Kong."',
      '"Shark fin soup has no taste of its own. It uses chicken broth. The fin adds texture. That is all."',
    ],
    defeatText: [
      '"FACT: Sharks have survived five mass extinction events — including the one that killed the dinosaurs. They survived 450 million years of Earth\'s violence. They are not surviving us."',
      '"FACT: Without sharks, fish populations explode, overgraze seagrass and coral, and ocean ecosystems collapse. This is called a trophic cascade. We are triggering it globally."',
      '"FACT: Shark fin soup was considered a prestige dish in China. A global campaign comparing the dish to consuming a critically endangered species has reduced consumption by 50-80% in China since 2010. Culture can change."',
      '"450 million years. 50 years to undo it. But not yet undone — if we act now."',
    ],
    campTint: '#203848',
    icon: '🦈',
    spawnBiome: ['coastal'],
    minEra: 2,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // POACHING
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'elephant_poaching',
    name: 'Ivory Poaching Ring',
    category: 'poaching',
    realWorldFact: 'At peak poaching (2011–2016), an African elephant was killed every 25 minutes for ivory. The African elephant population fell from 10 million in 1900 to 415,000 today — a 95% decline. Forest elephants — a distinct species that engineers the rainforest by creating clearings and dispersing seeds — declined by 86% in 31 years. They are now Critically Endangered.',
    shockingNumber: '55 African elephants killed EVERY DAY at peak poaching',
    yearRange: '1800s–present (peak 2011–2016)',
    regionsAffected: ['Central Africa (Congo)', 'East Africa (Tanzania, Kenya)', 'West Africa', 'Asia (Asian elephants for skin and ivory)'],
    status: 'reduced',
    targetSpecies: ['sycamore_fig', 'baobab', 'brazil_nut'],
    hp: 320,
    maxHp: 320,
    damage: 'Removes elephant entities. Forest seed dispersal collapses — baobab and brazil nut cannot spread. Keystone cascade failure.',
    lootDescription: '20 Coin · Elephant entity restored · Forest corridor bonus (elephants create paths)',
    encounterText: [
      '"The carcass is three days old. The face has been hacked away for the tusks."',
      '"Her calf stood beside her for two days before the rangers found her."',
      '"Ivory sells for $1,500 per kilogram in Asia. A large male\'s tusks weigh 25–45 kg."',
      '"The forest without elephants is a forest without an architect."',
    ],
    defeatText: [
      '"The ring is broken. Somewhere, a herd moves through the night, safer."',
      '"FACT: African forest elephants are ecosystem engineers. They break down trees, creating clearings where light reaches the forest floor. They disperse seeds — including brazil nuts — over hundreds of kilometres. Without them, the forest closes in and simplifies into a monoculture."',
      '"FACT: China banned ivory sales in 2018. Within 2 years, ivory prices dropped 50% and poaching rates fell. Consumer choice — and government policy — can work, fast."',
      '"FACT: Elephant graveyards are real. Elephants mourn their dead, touching bones of deceased family members with their trunks. There is no longer any reasonable scientific doubt that they are deeply sentient beings."',
    ],
    campTint: '#604028',
    icon: '🐘',
    spawnBiome: ['savanna', 'tropical'],
    minEra: 1,
  },

  {
    id: 'rhino_poaching',
    name: 'Rhino Horn Syndicate',
    category: 'poaching',
    realWorldFact: 'Rhino horn sells for $65,000 per kilogram — more than gold, cocaine, or platinum. It is made of keratin, the same protein as fingernails. It has no pharmacological properties. Three rhinoceros species are Critically Endangered. The Western Black Rhino was declared extinct in 2011. The Northern White Rhino has only two females alive. The species is functionally extinct.',
    shockingNumber: 'Rhino horn: $65,000/kg — more valuable than gold, for a substance identical to fingernails',
    yearRange: '1970s–present',
    regionsAffected: ['South Africa (Kruger)', 'Zimbabwe', 'Kenya', 'Namibia', 'India (one-horned rhino)', 'Indonesia (Javan rhino)'],
    status: 'escalating',
    targetSpecies: [],
    hp: 300,
    maxHp: 300,
    damage: 'Removes rhino grazing — grassland degrades. Sanity -20 on encounter.',
    lootDescription: '10 Coin · Grassland restoration knowledge · Rhino entity (rare)',
    encounterText: [
      '"They tranquilised her first. Then used a chainsaw."',
      '"The horn is gone. She survived. She will be targeted again."',
      '"In a Vietnamese hospital, a dying man is being sold ground horn for a cure that does not exist."',
      '"Two Northern White Rhinos are alive. Both female. The species is over."',
    ],
    defeatText: [
      '"FACT: Rhino horn is made of keratin — the same as human fingernails. No clinical study has ever shown it has medicinal effects. The demand is driven entirely by superstition and status signalling."',
      '"FACT: The Western Black Rhino was declared extinct in 2011. The Javan rhino has ~70 animals. The Northern White Rhino: 2 females — Najin and Fatu — guarded 24 hours a day in Kenya. The species is functionally extinct."',
      '"FACT: Vietnam is the world\'s largest consumer of rhino horn. A single government education campaign there reduced demand by 40% in 2 years. The market can be ended. It requires will."',
    ],
    campTint: '#582820',
    icon: '🦏',
    spawnBiome: ['savanna', 'grassland'],
    minEra: 2,
  },

  {
    id: 'exotic_pet_trade',
    name: 'Exotic Wildlife Traders',
    category: 'exotic_trade',
    realWorldFact: 'Wildlife trafficking is the fourth largest criminal trade in the world, worth $23 billion annually — after drugs, weapons, and human trafficking. Every year, millions of animals are taken from their habitats: parrots, slow lorises, orangutans, ball pythons, tortoises, seahorses, and hundreds more species. 75% die before reaching the buyer. The slow loris — a primate with a toxic bite — is given "tooth trims" with wire cutters to make it \'safe\' as a pet.',
    shockingNumber: '$23 billion/year — wildlife trafficking is the 4th largest criminal trade globally',
    yearRange: '1700s (colonial era specimens) –present',
    regionsAffected: ['Southeast Asia (parrots, lorises, tigers)', 'Amazon (macaws, toucans, exotic reptiles)', 'East Africa (tortoises, chameleons)', 'Caribbean (parrots, iguanas)', 'global online markets'],
    status: 'escalating',
    targetSpecies: ['vanilla_orchid'],
    hp: 260,
    maxHp: 260,
    damage: 'Removes rare entity spawns. Biodiversity index stagnates in affected zones.',
    lootDescription: '18 Coin · Released bird/primate entities · Species protection protocol (+biodiversity in zone)',
    encounterText: [
      '"Inside the crate: a juvenile orangutan, a slow loris with wire-clipped teeth, six African grey parrots."',
      '"She paid $8,000 for the loris on Instagram. She thought it was smiling."',
      '"The slow loris has a toxic bite. So they cut its teeth out with wire cutters. Without the teeth, it dies of infection within 2 years."',
      '"Online, there are hundreds of videos of \'cute\' lorises being tickled. Each video funds this trade."',
    ],
    defeatText: [
      '"The crates are opened. Some will survive. Some will not."',
      '"FACT: Social media \'cute animal\' videos directly drive the exotic pet trade. A viral slow loris video in 2009 increased poaching by 50% within 12 months. Watching such videos funds animal suffering."',
      '"FACT: 75% of animals caught for the exotic pet trade die during transport before reaching a buyer. For every animal that survives, 3 died. For every animal purchased, 3 carcasses rotted in a shipping crate."',
      '"FACT: The African grey parrot — possibly the most intelligent bird on Earth — declined 90-99% in Ghana between 1992 and 2015, driven almost entirely by pet trade capture."',
    ],
    campTint: '#483020',
    icon: '🦜',
    spawnBiome: ['tropical', 'savanna'],
    minEra: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // POLLUTION
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'pesticide_agriculture',
    name: 'Industrial Pesticide Farm',
    category: 'pollution',
    realWorldFact: 'Global insect populations have declined by 45–75% in 30 years. The primary driver is insecticide use in industrial agriculture. Neonicotinoids — the world\'s most widely used class of insecticides — are systemic: the entire plant becomes toxic, including pollen and nectar. A single corn-coated seed contains enough neonicotinoid to kill 80,000 bees. Without insects, terrestrial ecosystems collapse within decades.',
    shockingNumber: '75% decline in flying insect populations in 27 years (German study, 2017)',
    yearRange: '1950s–present (neonicotinoids from 1990s)',
    regionsAffected: ['Western Europe', 'North America', 'China', 'India', 'Brazil', 'effectively: all agricultural zones globally'],
    status: 'escalating',
    targetSpecies: ['vanilla_orchid', 'acacia', 'english_oak', 'water_lily'],
    hp: 250,
    maxHp: 250,
    damage: 'Eliminates pollinator entities in range. Plants with \'pollinator_host\' role stop producing seeds.',
    lootDescription: '10 Food · Organic farming knowledge (food yield +25% permanently) · Bee entity restored',
    encounterText: [
      '"Silent fields. No bees. No butterflies. Just the crop, and the spray truck, and nothing else."',
      '"The neonicotinoid is systemic — it\'s in the pollen, the nectar, the soil, the groundwater."',
      '"The beekeeper 3 km away lost all 12 of her hives this spring."',
      '"The company\'s product sheet says: \'minimal toxicity to non-target organisms.\'"',
    ],
    defeatText: [
      '"You pull the spray equipment. That evening, a single bee visits a flower nearby."',
      '"FACT: One-third of all food humans eat depends on insect pollination. Bees, butterflies, moths, beetles, and flies pollinate 87% of flowering plant species. Einstein allegedly never said \'if bees die, humans die in 4 years\' — but the ecological truth is no less urgent."',
      '"FACT: Bayer and Syngenta knew neonicotinoids were toxic to bees in 1990. Internal documents showed this. They suppressed the data for 20 years. The EU partially banned neonicotinoids outdoors in 2018; they remain legal indoors and in many other markets."',
      '"FACT: Organic farms host 50% more wild bees and pollinators than conventional farms. Biodiversity returns within 3-5 years of removing pesticides."',
    ],
    campTint: '#707020',
    icon: '☠️',
    spawnBiome: ['grassland', 'temperate'],
    minEra: 2,
  },

  {
    id: 'ocean_plastic',
    name: 'Plastic Waste Dumping Operation',
    category: 'pollution',
    realWorldFact: '8 million metric tonnes of plastic enter the world\'s oceans every year — the equivalent of a garbage truck being emptied into the ocean every 60 seconds. There are now five ocean garbage patches, the largest of which (the Great Pacific Garbage Patch) is three times the size of France. Microplastics have been found in human blood, the placentas of unborn babies, deep ocean trenches, the peak of Everest, and in the bodies of whales that have never been near human settlement.',
    shockingNumber: '8 million tonnes of plastic enter oceans every year — one garbage truck per minute',
    yearRange: '1950s–present',
    regionsAffected: ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic', 'Mediterranean', 'all major coastlines'],
    status: 'escalating',
    targetSpecies: ['red_mangrove', 'water_lily'],
    hp: 300,
    maxHp: 300,
    damage: 'Coastal tile contamination. Fish nodes permanently degraded until cleaned. Whale/seabird entities damaged.',
    lootDescription: '5 Coin · Ocean restoration knowledge · Seabird entity respawn',
    encounterText: [
      '"A sperm whale, dead on the beach. In its stomach: 22 kg of plastic — bags, rope, fishing nets, a crate."',
      '"The albatross chick was fed plastic by its parents. It died of starvation with a full stomach."',
      '"The plastic breaks down not into nothing but into microplastics — smaller and smaller, until they are in everything."',
      '"Microplastics are now in human blood, in placentas. In the unborn."',
    ],
    defeatText: [
      '"You remove what you can. The ocean does not forgive instantly. But the tide moves differently now."',
      '"FACT: Plastic never disappears. It photodegrades into microplastics and nanoplastics, which accumulate in the food chain. A fish you eat has microplastics in its flesh. You have microplastics in your blood."',
      '"FACT: 90% of ocean plastic comes from just 10 rivers — 8 in Asia, 2 in Africa. Targeted river plastic interception could eliminate most ocean plastic input. The technology exists. The will is insufficient."',
      '"FACT: Iceland, Germany, and Scandinavian countries have deposit-refund systems with >90% plastic bottle recovery rates. Single-use plastic bans in the EU since 2021 have reduced plastic bag use by 90% in member states. Policy works."',
    ],
    campTint: '#304050',
    icon: '🏭',
    spawnBiome: ['coastal'],
    minEra: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FUN HUNTING (AMERICAS / COLONIAL / RECREATIONAL)
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'passenger_pigeon_moment',
    name: 'Mass Wildlife Slaughter Camp',
    category: 'hunting',
    realWorldFact: 'The Passenger Pigeon was once the most abundant bird in North America — 3–5 billion individuals, 25–40% of all land birds on the continent. Professional hunters shot them in such quantities that railway cars were filled to the brim. Martha, the last Passenger Pigeon, died alone in Cincinnati Zoo on September 1, 1914. The American Bison numbered 60 million in 1800 and was reduced to 541 by 1889 — entirely by recreational and commercial hunting. The wolf was systematically exterminated from the continental US. The grizzly bear was killed from 95% of its original range.',
    shockingNumber: '60 million American bison → 541 in 89 years of sport and commercial hunting',
    yearRange: '1800s–1930s (most intensive); ongoing in new forms',
    regionsAffected: ['North American Great Plains', 'Eastern United States', 'Canada', 'Mesoamerica'],
    status: 'reduced',
    targetSpecies: ['big_bluestem'],
    hp: 350,
    maxHp: 350,
    damage: 'Removes bison/wolf entities. Grassland biodiversity collapse. No keystone prey recovery for 5 seasons.',
    lootDescription: '20 Food · Ecological restoration knowledge · Bison/wolf entity slowly restored',
    encounterText: [
      '"The hunters come for sport. A single day\'s hunt kills 5,000 bison. No meat taken."',
      '"The bones are sold for fertiliser. 6 million tonnes of bison bones were collected in the 1870s."',
      '"There were 3 billion Passenger Pigeons in 1800. One hundred years later: zero."',
      '"Martha — the last of her kind — died in a cage, watched by humans who had killed everyone she had ever known."',
    ],
    defeatText: [
      '"The hunters leave. The silence is total. Then, from the east, a single bison."',
      '"FACT: The US government actively encouraged bison slaughter to starve Indigenous peoples off the Great Plains. General Sheridan stated: \'For a lasting peace, let them kill, skin, and sell until the buffaloes are exterminated.\' Mass wildlife killing was US policy."',
      '"FACT: Wolves were reintroduced to Yellowstone in 1995 after a 70-year absence. Within 6 years, the entire ecosystem transformed: elk moved, rivers changed course, songbirds returned, beavers came back. One species — 14 individuals in 1995 — rebuilt a continent\'s ecosystem. This is the power of keystone restoration."',
      '"FACT: The Passenger Pigeon could theoretically be de-extincted via gene editing. But the forest it needed to survive — the vast Eastern American forest — no longer exists."',
    ],
    campTint: '#6a4820',
    icon: '🔫',
    spawnBiome: ['grassland', 'temperate'],
    minEra: 1,
  },

  {
    id: 'deep_sea_trawling',
    name: 'Bottom Trawling Fleet',
    category: 'ocean_exploitation',
    realWorldFact: 'Bottom trawling — dragging heavy nets across the seafloor — destroys millennia-old coral reefs, sponge gardens, and deep-sea habitats in seconds. One trawl pass can destroy what took 2,000 years to grow. 40% of all fish caught by bottom trawlers is bycatch — unintended species including sea turtles, dolphins, sharks, seabirds, and juvenile fish of all species, thrown back dead. The world\'s fishing fleets are subsidised by $35 billion in government funds annually.',
    shockingNumber: '40% of deep-sea trawler catch is bycatch — discarded dead',
    yearRange: '1800s–present (industrial scale from 1950)',
    regionsAffected: ['North Atlantic', 'North Sea', 'Bering Sea', 'Grand Banks (collapsed)', 'South China Sea', 'all productive ocean areas'],
    status: 'ongoing',
    targetSpecies: [],
    hp: 320,
    maxHp: 320,
    damage: 'Ocean biodiversity permanently damaged in affected zones. Fish food nodes halved until threat removed.',
    lootDescription: '20 Food · Ocean science knowledge · Coral entity restored',
    encounterText: [
      '"The net is 3 km wide. It drags everything — fish, coral, sea urchins, juvenile sharks, all of it."',
      '"What they want: cod, haddock. What they take: everything that lives there."',
      '"The Grand Banks off Newfoundland had inexhaustible cod for 500 years. The trawlers emptied it in 30."',
      '"The coral that broke apart beneath the net was 1,800 years old."',
    ],
    defeatText: [
      '"FACT: The Grand Banks cod fishery collapsed in 1992. Scientists warned it was failing for 20 years. The fishing industry lobbied against restrictions. The fishery has not recovered in 30 years."',
      '"FACT: Marine Protected Areas where fishing is prohibited can recover fish populations by 400% within 10 years. The science is unambiguous. As of 2024, only 3% of the ocean is fully protected."',
      '"FACT: Bottom trawling releases as much carbon from disturbed seafloor sediments annually as the entire global aviation industry. It is a carbon bomb that no one counts."',
    ],
    campTint: '#204060',
    icon: '🎣',
    spawnBiome: ['coastal'],
    minEra: 2,
  },

  {
    id: 'habitat_fragmentation',
    name: 'Motorway & Development Sprawl',
    category: 'habitat_loss',
    realWorldFact: 'Road networks have fragmented natural habitats so thoroughly that 70% of the world\'s remaining forests are within 1 km of a forest edge. Animals cannot travel to find mates, food, or refuge. Populations become isolated, inbred, and increasingly unable to adapt. Every road built through a forest is a wall. A single motorway can collapse the genetic viability of populations on either side within 3 generations.',
    shockingNumber: '70% of remaining forests are within 1 km of an edge — fragments, not forest',
    yearRange: '1800s (railways) – present (accelerating since 1950)',
    regionsAffected: ['Everywhere. No continent is unaffected.'],
    status: 'escalating',
    targetSpecies: ['english_oak', 'scots_pine', 'siberian_larch'],
    hp: 280,
    maxHp: 280,
    damage: 'Fragments forest zones. Connectivity bonus between patches eliminated until removed.',
    lootDescription: '15 Stone · Wildlife corridor knowledge (connecting 2 forest patches gives ×2 bonus)',
    encounterText: [
      '"The motorway cuts straight through. 8 lanes. Nothing crosses."',
      '"Otters are found dead on roads every week. They cannot understand the barrier."',
      '"The forest on either side is the same species, the same soil. But they cannot speak to each other anymore."',
      '"A study found that the genetic diversity of hedgehog populations drops measurably within 200 metres of a motorway."',
    ],
    defeatText: [
      '"A wildlife bridge is built over the road. Deer cross the first night."',
      '"FACT: Wildlife crossing structures — underpasses, overpasses, green bridges — can reduce wildlife mortality by 97% and allow genetic exchange between fragmented populations. Canada\'s Trans-Canada Highway through Banff has 38 wildlife crossings. Wolverine, grizzly, wolf, elk, and cougar all use them regularly."',
      '"FACT: The UK has more roads per square kilometre than any country in Europe. It also has one of the most depleted wildlife populations. This is not a coincidence."',
    ],
    campTint: '#505050',
    icon: '🛣️',
    spawnBiome: ['temperate', 'boreal', 'grassland'],
    minEra: 2,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getThreat(id: string): ThreatDef | undefined {
  return THREATS.find(t => t.id === id);
}

export function getThreatsByCategory(cat: ThreatCategory): ThreatDef[] {
  return THREATS.filter(t => t.category === cat);
}

/** Starting threat always visible from era 1 */
export const STARTING_THREAT = THREATS.find(t => t.id === 'industrial_logging')!;
