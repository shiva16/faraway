import type { Resources } from './types';

// ── Linnaean taxonomy helpers ────────────────────────────────────────────────

export type EcologicalRole =
  | 'nitrogen_fixer'    // enriches soil, boosts neighbours
  | 'keystone'          // supports disproportionate biodiversity
  | 'pioneer'           // colonises bare ground first
  | 'canopy'            // creates shade layer for understory
  | 'pollinator_host'   // flowers/nectar attract pollinators
  | 'seed_disperser'    // fruit attracts animals that spread seeds
  | 'mycorrhizal_host'  // hosts underground fungal networks
  | 'coastal_stabiliser'// roots bind shoreline / prevent erosion
  | 'aquatic'           // lives in / filters water
  | 'emergent'          // breaks above the canopy
  | 'understory'        // thrives under larger canopy
  | 'ground_cover'      // low-growing, prevents soil erosion
  | 'medicinal';        // human/animal medicinal value

export type Biome = 'tropical' | 'temperate' | 'savanna' | 'coastal' | 'wetland' | 'grassland' | 'boreal' | 'alpine';

export type IUCNStatus = 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';

export type CanopyLayer = 'ground' | 'shrub' | 'understory' | 'canopy' | 'emergent';

export interface SpeciesDef {
  id: string;
  commonName: string;
  scientificName: string;
  // Full Linnaean taxonomy
  kingdom: 'Plantae';
  division: string;
  class_: string;
  order: string;
  family: string;
  genus: string;
  epithet: string;       // species epithet (second part of binomial)
  // Ecology
  ecologicalRoles: EcologicalRole[];
  biomes: Biome[];
  canopyLayer: CanopyLayer;
  supports: string[];    // animal species / guilds this plant supports
  dependencies: string[];// what this species needs to thrive
  // Game data
  biodiversityScore: number;    // 1–10 contribution to biodiversity index per planted tile
  keystoneMultiplier: number;   // multiplies nearby species' biodiversity scores (1.0 = no effect)
  growthSeasons: number;        // seasons to reach maturity
  spreadRadius: number;         // tiles; mature plant can colonise nearby tiles
  cost: Resources;              // to plant (seeds counted as 'food')
  spriteTint: string;           // CSS colour for pixel sprite
  // Education
  iucnStatus: IUCNStatus;
  threatStatus: string;         // human-readable
  ecologicalFact: string;       // one jaw-dropping fact
  gameEffect: string;           // what this species does in-game
  flavorText: string;           // evocative prose
}

// ── The species catalogue ─────────────────────────────────────────────────────

export const SPECIES: SpeciesDef[] = [

  // ── TROPICAL RAINFOREST ──────────────────────────────────────────────────

  {
    id: 'banyan',
    commonName: 'Banyan Tree',
    scientificName: 'Ficus benghalensis',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Rosales', family: 'Moraceae', genus: 'Ficus', epithet: 'benghalensis',
    ecologicalRoles: ['keystone', 'canopy', 'seed_disperser', 'mycorrhizal_host'],
    biomes: ['tropical'],
    canopyLayer: 'canopy',
    supports: ['fruit bats', 'barbets', 'hornbills', 'langur monkeys', '~70 bird species'],
    dependencies: ['bird and bat seed dispersers to establish', 'Blastophaga wasp for pollination'],
    biodiversityScore: 9,
    keystoneMultiplier: 1.8,
    growthSeasons: 4,
    spreadRadius: 3,
    cost: { wood: 0, stone: 0, food: 15, coin: 8 },
    spriteTint: '#2d6e2d',
    iucnStatus: 'LC',
    threatStatus: 'Least Concern — but habitat loss threatens pollinators',
    ecologicalFact: 'A single Banyan can support over 500 animal species. The largest known Banyan covers 3.5 acres — it is a forest in one tree.',
    gameEffect: 'Keystone: all species within 3 tiles gain ×1.8 biodiversity score. Attracts bird/bat entities.',
    flavorText: '"Its roots descend from the sky, its canopy is a city, its presence is ancient."',
  },

  {
    id: 'kapok',
    commonName: 'Kapok / Silk-Cotton Tree',
    scientificName: 'Ceiba pentandra',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Malvales', family: 'Malvaceae', genus: 'Ceiba', epithet: 'pentandra',
    ecologicalRoles: ['emergent', 'keystone', 'pollinator_host'],
    biomes: ['tropical'],
    canopyLayer: 'emergent',
    supports: ['harpy eagles (nesting)', 'ocelots', 'toucans', 'monkeys', 'bats (night pollinator)'],
    dependencies: ['bats for night pollination', 'wind for seed dispersal'],
    biodiversityScore: 8,
    keystoneMultiplier: 1.6,
    growthSeasons: 5,
    spreadRadius: 2,
    cost: { wood: 0, stone: 0, food: 18, coin: 10 },
    spriteTint: '#1a5c1a',
    iucnStatus: 'LC',
    threatStatus: 'Sacred to Maya peoples; threatened by palm oil conversion',
    ecologicalFact: 'Kapok is one of the few trees pollinated primarily by bats. Its seeds travel up to 30 km on silken fibres — earning it the name "the flying forest."',
    gameEffect: 'Emergent: creates a third canopy layer, enabling shade-dependent rare species. Night pollinators +50%.',
    flavorText: '"The Maya called it the axis mundi — the tree that holds up the sky."',
  },

  {
    id: 'sycamore_fig',
    commonName: 'Sycamore Fig',
    scientificName: 'Ficus sycomorus',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Rosales', family: 'Moraceae', genus: 'Ficus', epithet: 'sycomorus',
    ecologicalRoles: ['keystone', 'seed_disperser', 'pollinator_host'],
    biomes: ['tropical', 'savanna'],
    canopyLayer: 'canopy',
    supports: ['elephants', 'baboons', 'giraffes', 'civets', '~120 bird species in Africa'],
    dependencies: ['species-specific fig wasp (Ceratosolen arabicus) for pollination'],
    biodiversityScore: 10,
    keystoneMultiplier: 2.0,
    growthSeasons: 4,
    spreadRadius: 3,
    cost: { wood: 0, stone: 0, food: 20, coin: 12 },
    spriteTint: '#3a7a2a',
    iucnStatus: 'LC',
    threatStatus: 'Deeply threatened by fig wasp population collapse due to pesticides',
    ecologicalFact: 'The fig tree and its specific wasp have co-evolved for 80 million years. If either goes extinct, the other follows within a generation. Figs are the single most important food for tropical animals.',
    gameEffect: 'Maximum keystone score (×2.0). Attracts elephant entities. Enables fig-wasp ecological chain.',
    flavorText: '"Without the fig, the forest collapses. Without the wasp, the fig is silent."',
  },

  {
    id: 'teak',
    commonName: 'Teak',
    scientificName: 'Tectona grandis',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Lamiales', family: 'Lamiaceae', genus: 'Tectona', epithet: 'grandis',
    ecologicalRoles: ['canopy', 'understory'],
    biomes: ['tropical'],
    canopyLayer: 'canopy',
    supports: ['sambar deer', 'barking deer', 'peacocks', 'hornbills'],
    dependencies: ['seasonal monsoon', 'fire disturbance for regeneration'],
    biodiversityScore: 6,
    keystoneMultiplier: 1.1,
    growthSeasons: 6,
    spreadRadius: 1,
    cost: { wood: 0, stone: 0, food: 12, coin: 5 },
    spriteTint: '#4a6a30',
    iucnStatus: 'LC',
    threatStatus: 'OLD-GROWTH TEAK CRITICALLY THREATENED — primary target of illegal logging in Myanmar, Thailand, Laos',
    ecologicalFact: 'Myanmar once held 80% of the world\'s old-growth teak. Industrial logging has reduced this by 90% since 1960. A 300-year teak tree supports an ecosystem that takes centuries to rebuild.',
    gameEffect: 'Grows slowly but produces Wood resource passively. Symbol: old-growth teak = primary logging target.',
    flavorText: '"The loggers came for the teak first. They always come for the strongest ones first."',
  },

  {
    id: 'vanilla_orchid',
    commonName: 'Vanilla Orchid',
    scientificName: 'Vanilla planifolia',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Liliopsida',
    order: 'Asparagales', family: 'Orchidaceae', genus: 'Vanilla', epithet: 'planifolia',
    ecologicalRoles: ['pollinator_host', 'understory'],
    biomes: ['tropical'],
    canopyLayer: 'understory',
    supports: ['Melipona bees (sole native pollinator)', 'hummingbirds'],
    dependencies: ['canopy shade', 'tree to climb', 'specific bee species for pollination'],
    biodiversityScore: 7,
    keystoneMultiplier: 1.3,
    growthSeasons: 3,
    spreadRadius: 1,
    cost: { wood: 0, stone: 0, food: 10, coin: 15 },
    spriteTint: '#8a6090',
    iucnStatus: 'NT',
    threatStatus: 'Near Threatened — wild population nearly eliminated by over-collection',
    ecologicalFact: 'Wild vanilla can only be pollinated by the native Melipona bee of Mexico. All vanilla cultivation elsewhere requires hand-pollination with a toothpick — a process discovered by a 12-year-old enslaved boy, Edmond Albius, in 1841.',
    gameEffect: 'Grows on adjacent canopy trees. Attracts rare bee entities. Produces Coin (as a luxury crop).',
    flavorText: '"The most widely used flavour on Earth grows in silence, climbing the trees we have forgotten."',
  },

  // ── SAVANNA ───────────────────────────────────────────────────────────────

  {
    id: 'baobab',
    commonName: 'Baobab',
    scientificName: 'Adansonia digitata',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Malvales', family: 'Malvaceae', genus: 'Adansonia', epithet: 'digitata',
    ecologicalRoles: ['keystone', 'pollinator_host', 'seed_disperser'],
    biomes: ['savanna'],
    canopyLayer: 'canopy',
    supports: ['African elephants (water source)', 'fruit bats (primary pollinator)', 'bushbabies', 'hornbills', '350+ species'],
    dependencies: ['fruit bats for pollination', 'elephants spread seeds in dung'],
    biodiversityScore: 9,
    keystoneMultiplier: 1.9,
    growthSeasons: 5,
    spreadRadius: 2,
    cost: { wood: 0, stone: 5, food: 20, coin: 10 },
    spriteTint: '#9a6830',
    iucnStatus: 'EN',
    threatStatus: 'ENDANGERED — ancient baobabs dying en masse since 2005. Climate change suspected.',
    ecologicalFact: 'Nine of the world\'s 13 largest known baobabs — some over 2,000 years old — have collapsed and died since 2005. Scientists call it "a phenomenon without precedent." They store up to 100,000 litres of water in their trunks.',
    gameEffect: 'Water source: reduces hunger drain for nearby units. Supports elephant faction. Keystone ×1.9.',
    flavorText: '"The upside-down tree. Ancient as the elephants. Dying in our lifetimes."',
  },

  {
    id: 'acacia',
    commonName: 'Gum Arabic Acacia',
    scientificName: 'Acacia senegal',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Fabales', family: 'Fabaceae', genus: 'Acacia', epithet: 'senegal',
    ecologicalRoles: ['nitrogen_fixer', 'pioneer', 'pollinator_host'],
    biomes: ['savanna', 'grassland'],
    canopyLayer: 'shrub',
    supports: ['giraffes', 'ants (mutualistic)', 'bees', 'dung beetles'],
    dependencies: ['minimal: drought-tolerant, full sun'],
    biodiversityScore: 6,
    keystoneMultiplier: 1.3,
    growthSeasons: 2,
    spreadRadius: 2,
    cost: { wood: 0, stone: 0, food: 8, coin: 3 },
    spriteTint: '#7a8828',
    iucnStatus: 'LC',
    threatStatus: 'Threatened in Sudan by desertification and charcoal demand',
    ecologicalFact: 'Acacia thorns evolved in direct response to giraffe browsing. When a giraffe eats from one side, the tree releases tannins AND releases chemical signals (ethylene gas) that warn neighbouring acacias to also produce tannins.',
    gameEffect: 'Nitrogen fixer: adjacent plants get +50% growth speed. Pioneer: can be planted on degraded ground.',
    flavorText: '"It speaks to its neighbours in chemistry. We are only beginning to understand its language."',
  },

  // ── TEMPERATE FOREST ────────────────────────────────────────────────────

  {
    id: 'english_oak',
    commonName: 'English / Pedunculate Oak',
    scientificName: 'Quercus robur',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Fagales', family: 'Fagaceae', genus: 'Quercus', epithet: 'robur',
    ecologicalRoles: ['keystone', 'canopy', 'mycorrhizal_host'],
    biomes: ['temperate'],
    canopyLayer: 'canopy',
    supports: ['500+ invertebrate species (more than any other UK tree)', 'woodpeckers', 'owls', 'bats (7 species roost)', 'deer', 'wild boar', 'jays (acorn cache planters)'],
    dependencies: ['ectomycorrhizal fungi (Boletus edulis etc.)', 'jays for acorn dispersal'],
    biodiversityScore: 10,
    keystoneMultiplier: 2.0,
    growthSeasons: 6,
    spreadRadius: 2,
    cost: { wood: 0, stone: 0, food: 10, coin: 6 },
    spriteTint: '#2a5a18',
    iucnStatus: 'LC',
    threatStatus: 'Acute oak decline threatening UK forests; Processionary moth outbreak',
    ecologicalFact: 'A single mature English Oak supports more species of wildlife than any other native British tree — over 500 invertebrate species, 230 species of bird, mammal, and fungi. It can live 1,000 years. Britain has lost 50% of its ancient oaks since 1900.',
    gameEffect: 'Keystone ×2.0 in temperate zones. Jay entities spread acorns: auto-plants oaks in adjacent tiles over time.',
    flavorText: '"We have known and loved and lived under English Oaks for ten thousand years. We are still learning what they support."',
  },

  {
    id: 'silver_birch',
    commonName: 'Silver Birch',
    scientificName: 'Betula pendula',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Fagales', family: 'Betulaceae', genus: 'Betula', epithet: 'pendula',
    ecologicalRoles: ['pioneer', 'mycorrhizal_host', 'understory'],
    biomes: ['temperate', 'boreal'],
    canopyLayer: 'canopy',
    supports: ['334 insect species', 'redpolls (seeds)', 'woodpeckers (bark insects)', 'fungi (200+ species)'],
    dependencies: ['light — cannot grow under dense shade', 'mycorrhizal fungi for nutrition'],
    biodiversityScore: 7,
    keystoneMultiplier: 1.4,
    growthSeasons: 2,
    spreadRadius: 3,
    cost: { wood: 0, stone: 0, food: 6, coin: 2 },
    spriteTint: '#aac888',
    iucnStatus: 'LC',
    threatStatus: 'Vulnerable to birch dieback disease, spreading northward with climate change',
    ecologicalFact: 'Birch is a nurse tree — it creates the conditions (shade, moisture, mycorrhizal networks) that allow oak, beech and other climax trees to establish. Without birch pioneers, ancient forests cannot regenerate. It sacrifices its own future for the forest\'s.',
    gameEffect: 'Pioneer: can be planted on bare degraded soil. Establishes mycorrhizal network for subsequent species.',
    flavorText: '"The birch does not live to see the forest it makes possible. But the forest remembers."',
  },

  {
    id: 'alder',
    commonName: 'Common Alder',
    scientificName: 'Alnus glutinosa',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Fagales', family: 'Betulaceae', genus: 'Alnus', epithet: 'glutinosa',
    ecologicalRoles: ['nitrogen_fixer', 'coastal_stabiliser', 'mycorrhizal_host'],
    biomes: ['temperate', 'wetland'],
    canopyLayer: 'canopy',
    supports: ['otters (roots create holts)', 'kingfishers', 'siskins', '90+ invertebrates'],
    dependencies: ['waterside location', 'Frankia bacteria (nitrogen-fixing symbiont)'],
    biodiversityScore: 7,
    keystoneMultiplier: 1.4,
    growthSeasons: 3,
    spreadRadius: 2,
    cost: { wood: 0, stone: 0, food: 8, coin: 3 },
    spriteTint: '#3a7050',
    iucnStatus: 'LC',
    threatStatus: 'Threatened by Phytophthora alni (water mould), spreading via waterways',
    ecologicalFact: 'Alder roots host Frankia bacteria that fix atmospheric nitrogen, enriching the soil. Ancient riverbeds under European cities — including Venice and Amsterdam — are held up by alder pile foundations that have not rotted in 1,000 years because alder wood hardens in water.',
    gameEffect: 'Nitrogen fixer near water tiles. Stabilises shoreline (prevents coastal erosion). Otter habitat.',
    flavorText: '"Venice stands on alder bones. The city of water, built by the tree of water."',
  },

  {
    id: 'scots_pine',
    commonName: 'Scots Pine',
    scientificName: 'Pinus sylvestris',
    kingdom: 'Plantae', division: 'Pinophyta', class_: 'Pinopsida',
    order: 'Pinales', family: 'Pinaceae', genus: 'Pinus', epithet: 'sylvestris',
    ecologicalRoles: ['canopy', 'mycorrhizal_host', 'keystone'],
    biomes: ['boreal', 'temperate'],
    canopyLayer: 'canopy',
    supports: ['red squirrels', 'crossbills', 'Scottish wildcats', '170+ lichen species', '~300 invertebrates'],
    dependencies: ['ectomycorrhizal fungi (Suillus, Tricholoma)', 'fire disturbance every 50-200 years'],
    biodiversityScore: 8,
    keystoneMultiplier: 1.6,
    growthSeasons: 4,
    spreadRadius: 2,
    cost: { wood: 0, stone: 0, food: 10, coin: 4 },
    spriteTint: '#1a4020',
    iucnStatus: 'LC',
    threatStatus: 'Scotland\'s Caledonian Forest reduced to 1% of original extent',
    ecologicalFact: 'The Caledonian Forest once covered 1.5 million hectares of Scotland. Today, less than 1% survives — fragmented patches too small for wolves or lynx to live in. Each fragment is an island of isolation in an ocean of sheepwalk.',
    gameEffect: 'Boreal keystone: enables red squirrel and crossbill entities. Mycorrhizal network ×2 in cold biome.',
    flavorText: '"Scotland\'s ancient pines have survived 10,000 years. They are not surviving us."',
  },

  // ── COASTAL & WETLAND ────────────────────────────────────────────────────

  {
    id: 'red_mangrove',
    commonName: 'Red Mangrove',
    scientificName: 'Rhizophora mangle',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Malpighiales', family: 'Rhizophoraceae', genus: 'Rhizophora', epithet: 'mangle',
    ecologicalRoles: ['coastal_stabiliser', 'keystone', 'aquatic', 'nitrogen_fixer'],
    biomes: ['coastal', 'wetland'],
    canopyLayer: 'shrub',
    supports: ['seahorses', 'juvenile reef fish (nursery)', 'manatees', 'crocodiles', 'frigate birds', 'roseate spoonbills'],
    dependencies: ['intertidal zone', 'salt water tolerance'],
    biodiversityScore: 9,
    keystoneMultiplier: 1.7,
    growthSeasons: 3,
    spreadRadius: 2,
    cost: { wood: 0, stone: 0, food: 12, coin: 5 },
    spriteTint: '#2a7848',
    iucnStatus: 'VU',
    threatStatus: 'VULNERABLE — 35% of global mangroves lost since 1980 to shrimp farming and coastal development',
    ecologicalFact: 'Mangroves store up to 10× more carbon per hectare than tropical rainforests. They protect coastlines from tsunamis — villages sheltered by mangroves in the 2004 Indian Ocean tsunami had dramatically lower death tolls. We are cutting them down to grow shrimp.',
    gameEffect: 'Coastal protection: reduces storm damage to adjacent buildings. Carbon credits +2/season. Fish node yield +50% nearby.',
    flavorText: '"The sea-forest stands between us and the ocean\'s fury. We cut it for prawn farms."',
  },

  {
    id: 'common_reed',
    commonName: 'Common Reed',
    scientificName: 'Phragmites australis',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Liliopsida',
    order: 'Poales', family: 'Poaceae', genus: 'Phragmites', epithet: 'australis',
    ecologicalRoles: ['aquatic', 'ground_cover', 'nitrogen_fixer'],
    biomes: ['wetland'],
    canopyLayer: 'shrub',
    supports: ['reed warblers', 'marsh harriers', 'bitterns', 'water voles', 'reed buntings'],
    dependencies: ['shallow standing water or waterlogged soil'],
    biodiversityScore: 6,
    keystoneMultiplier: 1.2,
    growthSeasons: 1,
    spreadRadius: 4,
    cost: { wood: 0, stone: 0, food: 4, coin: 1 },
    spriteTint: '#a0b840',
    iucnStatus: 'LC',
    threatStatus: 'Wetland drainage for agriculture has eliminated 87% of global wetlands since 1700',
    ecologicalFact: '87% of the world\'s wetlands have been destroyed since 1700 — a rate three times faster than forest loss. Wetlands store twice as much carbon per hectare as forests. The UK alone drained 90% of its fens — releasing millennia of stored carbon in decades.',
    gameEffect: 'Fast-growing. Water filtration: reduces disease events. Enables bittern/marsh harrier entities.',
    flavorText: '"The fen burned for three days when they drained it in 1840. The peat had stored that carbon since before the Romans came."',
  },

  // ── GRASSLAND & PRAIRIE ──────────────────────────────────────────────────

  {
    id: 'big_bluestem',
    commonName: 'Big Bluestem',
    scientificName: 'Andropogon gerardii',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Liliopsida',
    order: 'Poales', family: 'Poaceae', genus: 'Andropogon', epithet: 'gerardii',
    ecologicalRoles: ['ground_cover', 'nitrogen_fixer', 'pioneer'],
    biomes: ['grassland'],
    canopyLayer: 'ground',
    supports: ['bison', 'prairie dogs', 'meadowlarks', 'monarch butterflies', 'prairie chickens'],
    dependencies: ['periodic fire or grazing to prevent woody shrub invasion'],
    biodiversityScore: 6,
    keystoneMultiplier: 1.3,
    growthSeasons: 1,
    spreadRadius: 3,
    cost: { wood: 0, stone: 0, food: 5, coin: 1 },
    spriteTint: '#90a030',
    iucnStatus: 'LC',
    threatStatus: '96% of North American tallgrass prairie destroyed — most endangered ecosystem in the world',
    ecologicalFact: 'North American tallgrass prairie was the most diverse terrestrial ecosystem on Earth. In 200 years, industrial agriculture destroyed 96% of it. Below-ground, it held deep root systems that had sequestered carbon for 12,000 years. Now it is corn and soy.',
    gameEffect: 'Pioneer on grassland tiles. Bison entities arrive when 10+ tiles are planted. Monarch butterfly migration path.',
    flavorText: '"The prairie had roots 3 metres deep. The roots are still there, under the corn, waiting."',
  },

  // ── BOREAL & ALPINE ─────────────────────────────────────────────────────

  {
    id: 'siberian_larch',
    commonName: 'Siberian Larch',
    scientificName: 'Larix sibirica',
    kingdom: 'Plantae', division: 'Pinophyta', class_: 'Pinopsida',
    order: 'Pinales', family: 'Pinaceae', genus: 'Larix', epithet: 'sibirica',
    ecologicalRoles: ['canopy', 'pioneer', 'mycorrhizal_host'],
    biomes: ['boreal', 'alpine'],
    canopyLayer: 'canopy',
    supports: ['Siberian tigers (cover)', 'sable', 'wolverine', 'sable antelope', 'crossbills'],
    dependencies: ['permafrost intact', 'mycorrhizal fungi'],
    biodiversityScore: 7,
    keystoneMultiplier: 1.4,
    growthSeasons: 5,
    spreadRadius: 2,
    cost: { wood: 0, stone: 3, food: 10, coin: 5 },
    spriteTint: '#306828',
    iucnStatus: 'LC',
    threatStatus: 'Critically threatened by permafrost thaw — entire taiga at risk of conversion to bog',
    ecologicalFact: 'The Siberian taiga covers 7 million km² — the largest forest on Earth. As permafrost thaws, the trees lose their footing and topple in "drunken forests." The thaw releases methane stored for 40,000 years, which then accelerates the thaw. An irreversible loop.',
    gameEffect: 'Grows on cold winter tiles. Permafrost stability bonus: slows winter food depletion.',
    flavorText: '"The drunken trees of Siberia lean and fall. The ground they stood on is turning to mud."',
  },

  // ── NITROGEN FIXERS ──────────────────────────────────────────────────────

  {
    id: 'leucaena',
    commonName: 'Leucaena / White Leadtree',
    scientificName: 'Leucaena leucocephala',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Fabales', family: 'Fabaceae', genus: 'Leucaena', epithet: 'leucocephala',
    ecologicalRoles: ['nitrogen_fixer', 'pioneer', 'medicinal'],
    biomes: ['tropical', 'savanna', 'coastal'],
    canopyLayer: 'shrub',
    supports: ['deer', 'goats', 'seed-eating birds'],
    dependencies: ['minimal: tolerates degraded, infertile soils'],
    biodiversityScore: 5,
    keystoneMultiplier: 1.4,
    growthSeasons: 1,
    spreadRadius: 3,
    cost: { wood: 0, stone: 0, food: 5, coin: 1 },
    spriteTint: '#68a050',
    iucnStatus: 'LC',
    threatStatus: 'Can become invasive — must be managed. Also used for reforestation of degraded land.',
    ecologicalFact: 'Leucaena can fix 500+ kg of atmospheric nitrogen per hectare per year — more than almost any other plant. It is the first-responder of degraded land restoration: plant it, and the soil rebuilds itself within 3–5 years.',
    gameEffect: 'Fast pioneer: boosts all adjacent plant growth rates by +75%. Can plant on dead/barren tiles.',
    flavorText: '"It comes first to the wound in the earth, and makes the soil ready for those who follow."',
  },

  {
    id: 'alder_seaside',
    commonName: 'She-Oak / Horsetail Tree',
    scientificName: 'Casuarina equisetifolia',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Fagales', family: 'Casuarinaceae', genus: 'Casuarina', epithet: 'equisetifolia',
    ecologicalRoles: ['coastal_stabiliser', 'nitrogen_fixer', 'pioneer'],
    biomes: ['coastal'],
    canopyLayer: 'canopy',
    supports: ['lorikeets', 'glossy starlings', 'beach-nesting birds'],
    dependencies: ['sandy coastal soils', 'Frankia nitrogen-fixing bacteria'],
    biodiversityScore: 5,
    keystoneMultiplier: 1.2,
    growthSeasons: 2,
    spreadRadius: 2,
    cost: { wood: 0, stone: 0, food: 6, coin: 2 },
    spriteTint: '#506830',
    iucnStatus: 'LC',
    threatStatus: 'Native ranges threatened by coastal development; used in dune stabilisation globally',
    ecologicalFact: 'Casuarina roots fix nitrogen and can stabilise sand dunes within 2 years of planting. It was instrumental in stopping the advance of the Sahara in parts of North Africa. Its roots go 30 metres deep to find water.',
    gameEffect: 'Coastal nitrogen fixer: stabilises sandy tiles, prevents beach erosion. Can plant on shore tiles.',
    flavorText: '"It holds the sand still. Without it, the shore walks inland."',
  },

  // ── MEDICINAL & FOOD FOREST ──────────────────────────────────────────────

  {
    id: 'moringa',
    commonName: 'Moringa / Drumstick Tree',
    scientificName: 'Moringa oleifera',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Brassicales', family: 'Moringaceae', genus: 'Moringa', epithet: 'oleifera',
    ecologicalRoles: ['medicinal', 'pioneer', 'ground_cover'],
    biomes: ['tropical', 'savanna'],
    canopyLayer: 'shrub',
    supports: ['honeybees', 'sunbirds', 'small mammals'],
    dependencies: ['well-drained soil', 'full sun'],
    biodiversityScore: 5,
    keystoneMultiplier: 1.1,
    growthSeasons: 1,
    spreadRadius: 2,
    cost: { wood: 0, stone: 0, food: 6, coin: 2 },
    spriteTint: '#70b038',
    iucnStatus: 'LC',
    threatStatus: 'Not threatened — one of the most useful trees on Earth, widely cultivated',
    ecologicalFact: 'Every part of Moringa is edible or medicinal. Its seeds can purify water — crushing one Moringa seed and mixing it into a litre of muddy water removes 90-99% of bacteria. In regions without clean water access, this tree is a lifeline.',
    gameEffect: 'Medicinal: reduces HP drain from disease events. Water purification: reduces spoilage events.',
    flavorText: '"The tree of life, they call it. Not poetically — literally. People survive because of this tree."',
  },

  {
    id: 'wild_fig',
    commonName: 'Indian Sacred Fig / Peepal',
    scientificName: 'Ficus religiosa',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Rosales', family: 'Moraceae', genus: 'Ficus', epithet: 'religiosa',
    ecologicalRoles: ['keystone', 'seed_disperser', 'mycorrhizal_host', 'medicinal'],
    biomes: ['tropical'],
    canopyLayer: 'canopy',
    supports: ['fruit bats', 'parakeets', 'barbets', 'starlings', 'langurs', 'porcupines'],
    dependencies: ['Blastophaga quadraticeps wasp for pollination'],
    biodiversityScore: 9,
    keystoneMultiplier: 1.7,
    growthSeasons: 4,
    spreadRadius: 3,
    cost: { wood: 0, stone: 0, food: 14, coin: 8 },
    spriteTint: '#306828',
    iucnStatus: 'LC',
    threatStatus: 'Sacred status protects many specimens — cultural reverence as ecological protection',
    ecologicalFact: 'The Buddha achieved enlightenment under a Ficus religiosa. Because of this, millions of these trees across South and Southeast Asia have been protected for 2,500 years by religious reverence — making cultural respect for trees one of the oldest conservation strategies.',
    gameEffect: 'Sacred aura: +10 sanity to nearby player. Keystone ×1.7. Enables primate entity interactions.',
    flavorText: '"The oldest conservation policy in human history: call the tree sacred. It has worked for 2,500 years."',
  },

  {
    id: 'guava',
    commonName: 'Guava',
    scientificName: 'Psidium guajava',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Myrtales', family: 'Myrtaceae', genus: 'Psidium', epithet: 'guajava',
    ecologicalRoles: ['seed_disperser', 'pollinator_host', 'medicinal'],
    biomes: ['tropical', 'savanna'],
    canopyLayer: 'understory',
    supports: ['bats', 'birds (60+ species eat fruit)', 'bees', 'butterflies'],
    dependencies: ['full sun or partial shade', 'tolerates poor soils'],
    biodiversityScore: 5,
    keystoneMultiplier: 1.2,
    growthSeasons: 2,
    spreadRadius: 2,
    cost: { wood: 0, stone: 0, food: 8, coin: 2 },
    spriteTint: '#68b840',
    iucnStatus: 'LC',
    threatStatus: 'Invasive in some islands (Hawaii, Pacific) — must be carefully managed',
    gameEffect: 'Produces Food passively. Fruit attracts bird entities which spread other seeds.',
    ecologicalFact: 'Guava contains 4× more vitamin C per gram than oranges. In forests, guava fruit is a critical fallback food source for animals when primary food sources fail — an ecological safety net.',
    flavorText: '"In lean seasons, the guava gives what the forest cannot."',
  },

  {
    id: 'banana',
    commonName: 'Wild Banana',
    scientificName: 'Musa acuminata',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Liliopsida',
    order: 'Zingiberales', family: 'Musaceae', genus: 'Musa', epithet: 'acuminata',
    ecologicalRoles: ['seed_disperser', 'pollinator_host', 'pioneer'],
    biomes: ['tropical'],
    canopyLayer: 'understory',
    supports: ['fruit bats (primary wild pollinator)', 'sunbirds', 'hornbills', 'elephants'],
    dependencies: ['bats and birds for seed dispersal of wild varieties'],
    biodiversityScore: 5,
    keystoneMultiplier: 1.2,
    growthSeasons: 1,
    spreadRadius: 2,
    cost: { wood: 0, stone: 0, food: 6, coin: 2 },
    spriteTint: '#60a830',
    iucnStatus: 'VU',
    threatStatus: 'VULNERABLE — commercial banana monoculture (Cavendish) is one fruit variety facing extinction from Panama Disease TR4 fungus',
    ecologicalFact: 'Every commercial banana sold globally is a clone of a single variety: the Cavendish. A fungus (TR4) is currently destroying Cavendish plantations worldwide — exactly as it destroyed the previous variety (Gros Michel) in the 1950s. Wild banana diversity — the genetic backup — is disappearing with tropical forests.',
    gameEffect: 'Fast biomass: produces Food quickly. Provides shade for understory species after 1 season.',
    flavorText: '"You eat the same clone, the same banana, every time. When the fungus comes, there is no backup."',
  },

  // ── SPECIAL: OLD GROWTH ──────────────────────────────────────────────────

  {
    id: 'coastal_redwood',
    commonName: 'Coast Redwood',
    scientificName: 'Sequoia sempervirens',
    kingdom: 'Plantae', division: 'Pinophyta', class_: 'Pinopsida',
    order: 'Cupressales', family: 'Cupressaceae', genus: 'Sequoia', epithet: 'sempervirens',
    ecologicalRoles: ['emergent', 'keystone', 'canopy', 'mycorrhizal_host'],
    biomes: ['temperate', 'coastal'],
    canopyLayer: 'emergent',
    supports: ['marbled murrelets (nesting only in old-growth)', 'northern spotted owls', 'black bears', '~350 species'],
    dependencies: ['coastal fog (collects water on needles)', 'mycorrhizal fungi', 'fire for cone opening'],
    biodiversityScore: 10,
    keystoneMultiplier: 2.0,
    growthSeasons: 8,
    spreadRadius: 1,
    cost: { wood: 0, stone: 5, food: 25, coin: 20 },
    spriteTint: '#1a3c18',
    iucnStatus: 'EN',
    threatStatus: 'ENDANGERED — 96% of old-growth coast redwood forest logged',
    ecologicalFact: 'Coast Redwoods are the tallest living organisms on Earth (116m). They can live 2,000 years. 96% of old-growth redwood forest was logged between 1850 and 1980. A logging operation can destroy in hours what took 2,000 years to build. The marbled murrelet, which nests only in old-growth, is now endangered — not because of ocean threats but because there are no trees left to nest in.',
    gameEffect: 'Ultimate keystone. Takes 8 seasons to mature but supports entire ecosystem. Fog collection: passive water bonus. Unlocks rare murrelet entity.',
    flavorText: '"It lived through the Roman Empire, the Black Death, and the Renaissance. It did not survive the chainsaw."',
  },

  {
    id: 'brazil_nut',
    commonName: 'Brazil Nut Tree',
    scientificName: 'Bertholletia excelsa',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Ericales', family: 'Lecythidaceae', genus: 'Bertholletia', epithet: 'excelsa',
    ecologicalRoles: ['keystone', 'seed_disperser', 'canopy'],
    biomes: ['tropical'],
    canopyLayer: 'emergent',
    supports: ['agoutis (sole seed disperser — jaws strong enough to crack capsule)', 'peccaries', 'large parrots'],
    dependencies: ['ONLY orchid bees (Eulaema spp.) can pollinate it — they need orchids to exist', 'agoutis to disperse seeds'],
    biodiversityScore: 9,
    keystoneMultiplier: 1.9,
    growthSeasons: 6,
    spreadRadius: 1,
    cost: { wood: 0, stone: 0, food: 20, coin: 15 },
    spriteTint: '#2a5820',
    iucnStatus: 'VU',
    threatStatus: 'VULNERABLE — cannot be cultivated in plantations; only survives in intact primary forest',
    ecologicalFact: 'Brazil nuts cannot be farmed. They will only fruit in intact primary Amazon rainforest because they need orchid bees for pollination (which need orchids) and agoutis for seed dispersal. Every Brazil nut you eat was harvested from a standing wild forest. The nut is proof the forest is alive.',
    gameEffect: 'Can only be planted on intact forest tiles (adjacent to other mature trees). Requires orchid bee entity. Produces rare Coin resource.',
    flavorText: '"Every Brazil nut is a certificate: this forest is alive. The nut does not grow in desolation."',
  },

  {
    id: 'vetiver',
    commonName: 'Vetiver Grass',
    scientificName: 'Chrysopogon zizanioides',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Liliopsida',
    order: 'Poales', family: 'Poaceae', genus: 'Chrysopogon', epithet: 'zizanioides',
    ecologicalRoles: ['ground_cover', 'coastal_stabiliser', 'nitrogen_fixer'],
    biomes: ['tropical', 'grassland', 'coastal'],
    canopyLayer: 'ground',
    supports: ['ground-nesting birds', 'small rodents', 'lizards'],
    dependencies: ['minimal: extreme drought and flood tolerance'],
    biodiversityScore: 4,
    keystoneMultiplier: 1.1,
    growthSeasons: 1,
    spreadRadius: 3,
    cost: { wood: 0, stone: 0, food: 3, coin: 1 },
    spriteTint: '#b8a840',
    iucnStatus: 'LC',
    threatStatus: 'Not threatened — widely used in erosion control',
    ecologicalFact: 'Vetiver roots grow 3–4 metres deep within 6 months and can reduce soil erosion by 90%. The World Bank has promoted it in 100+ countries as the most effective low-cost erosion control. One planted hedge can protect an entire hillside from landslide after monsoon rains.',
    gameEffect: 'Rapid erosion control. Can be planted on degraded coastal/slope tiles immediately. +50% soil health to adjacent tiles.',
    flavorText: '"The roots you cannot see are holding the mountain in place."',
  },

  {
    id: 'wild_olive',
    commonName: 'Wild Olive',
    scientificName: 'Olea europaea subsp. europaea',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Lamiales', family: 'Oleaceae', genus: 'Olea', epithet: 'europaea',
    ecologicalRoles: ['keystone', 'pollinator_host', 'medicinal'],
    biomes: ['temperate', 'savanna'],
    canopyLayer: 'canopy',
    supports: ['bee-eaters', 'hoopoes', 'blackbirds', 'foxes', 'endemic beetles (100+)'],
    dependencies: ['wind pollination', 'poor rocky soil performs better than fertile'],
    biodiversityScore: 7,
    keystoneMultiplier: 1.5,
    growthSeasons: 5,
    spreadRadius: 1,
    cost: { wood: 0, stone: 2, food: 10, coin: 5 },
    spriteTint: '#788050',
    iucnStatus: 'LC',
    threatStatus: 'Ancient groves (1,000–5,000 years old) threatened by land clearing and Xylella fastidiosa bacteria',
    ecologicalFact: 'The oldest olive tree in the world, in Crete, is estimated to be 4,000 years old and still produces olives. A 2,000-year-old olive tree in a Tunisian grove was bulldozed in 2019 to make way for a tourist road. Xylella fastidiosa bacteria, introduced from the Americas, is now killing ancient olive groves in Italy — 21 million trees dead.',
    gameEffect: 'Slow-growing. Ancient (mature 5 seasons) olives have ×2 biodiversity bonus and produce Coin passively.',
    flavorText: '"Older than Rome, it still gives fruit. We have bulldozed them for car parks."',
  },

  {
    id: 'water_lily',
    commonName: 'Giant Water Lily',
    scientificName: 'Victoria amazonica',
    kingdom: 'Plantae', division: 'Magnoliophyta', class_: 'Magnoliopsida',
    order: 'Nymphaeales', family: 'Nymphaeaceae', genus: 'Victoria', epithet: 'amazonica',
    ecologicalRoles: ['aquatic', 'pollinator_host'],
    biomes: ['wetland', 'tropical'],
    canopyLayer: 'ground',
    supports: ['scarab beetles (nightly trapped pollinator)', 'caiman (resting platform)', 'capybara', 'giant river otter'],
    dependencies: ['shallow warm water', 'scarab beetles (Cyclocephala spp.) for pollination'],
    biodiversityScore: 7,
    keystoneMultiplier: 1.4,
    growthSeasons: 1,
    spreadRadius: 2,
    cost: { wood: 0, stone: 0, food: 8, coin: 6 },
    spriteTint: '#40a870',
    iucnStatus: 'LC',
    threatStatus: 'Amazon wetland habitat severely threatened by hydroelectric dam construction and soy agriculture',
    ecologicalFact: 'The Victoria amazonica lily pad can support the weight of a child. It operates a 2-day pollination cycle that traps scarab beetles overnight with warmth and scent, then releases them dusted in pollen the second morning. This architectural flower discovered modern structural engineering 50 years before Joseph Paxton designed the Crystal Palace — he acknowledged copying its leaf structure.',
    gameEffect: 'Aquatic. Opens on water tiles. Attracts caiman/otter entities. Beetle pollination chain enables adjacent aquatic plants.',
    flavorText: '"The flower that heated a room, trapped a beetle, and taught an architect how to build a palace."',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getSpecies(id: string): SpeciesDef | undefined {
  return SPECIES.find(s => s.id === id);
}

export function getSpeciesByFamily(family: string): SpeciesDef[] {
  return SPECIES.filter(s => s.family === family);
}

export function getSpeciesByBiome(biome: Biome): SpeciesDef[] {
  return SPECIES.filter(s => s.biomes.includes(biome));
}

export function getKeystoneSpecies(): SpeciesDef[] {
  return SPECIES.filter(s => s.ecologicalRoles.includes('keystone'));
}

export function getPioneerSpecies(): SpeciesDef[] {
  return SPECIES.filter(s => s.ecologicalRoles.includes('pioneer'));
}

export function getNitrogenFixers(): SpeciesDef[] {
  return SPECIES.filter(s => s.ecologicalRoles.includes('nitrogen_fixer'));
}

/** Format full binomial taxonomic rank string */
export function taxonomyLine(s: SpeciesDef): string {
  return `${s.kingdom} › ${s.division} › ${s.class_} › ${s.order} › ${s.family} › ${s.genus} › ${s.epithet}`;
}

export const FAMILIES: string[] = [...new Set(SPECIES.map(s => s.family))].sort();
