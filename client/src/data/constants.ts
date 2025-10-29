/**
 * Music Classification Constants
 * Extracted from prompts/classification-prompt.md
 * Total: 243 subgenres across 10 categories
 */

export const SUBGENRES = [
  // Decades (7)
  "50s Standards",
  "50s Vocal Jazz",
  "60s Vocal Jazz",
  "70s Pop",
  "80s Dance",
  "80s Pop",
  "90s Pop",

  // Ambient & Soundscapes (3)
  "Ambient",
  "Calming Frequencies",
  "Natural Soundscape",

  // Electronic & Dance (Modern) (33)
  "2000s Dance",
  "2010s and 2020s Pop (Dance Remixes)",
  "2010s and 2020s Pop Dance Originals & Remixes",
  "90s Dance",
  "Afro Nu-Disco",
  "Afro-Dance",
  "Afro-House",
  "Afro-Lounge",
  "Balearic",
  "Chillout",
  "Deep House (Jazz)",
  "Deep House (Vocal)",
  "Disco House",
  "EDM Classics",
  "French Electronica",
  "Global Electronica (Non French)",
  "Indie Dance",
  "Indie Electronica",
  "Latin Dance",
  "Latin Nu-Disco",
  "Latin-Lounge",
  "Lounge (Agnostic)",
  "Lounge (French)",
  "Modern Dance",
  "Nu-Disco (Agnostic)",
  "Organic House (Afro)",
  "Organic House (Agnostic)",
  "Organic House (Indo)",
  "Organic House (Latin)",
  "Organic House (Middle Eastern)",
  "Soulful House",
  "Tropical House",
  "Trip-Hop",
  "World Lounge",

  // Funk, Soul & Disco (Classic & Modern) (21)
  "80s R&B",
  "Afro-Disco",
  "Afrobeat",
  "Disco Classics (70s and 80s)",
  "Disco Edits",
  "Doo-Wop",
  "French Funk & Soul",
  "French Indie",
  "Funk & Soul Classics",
  "Funk Classics",
  "Hip-Hop Samples",
  "Italo-Disco",
  "Latin-Disco",
  "Modern Disco",
  "Modern Funk",
  "Modern Instrumentals (Organic)",
  "Modern Soul",
  "Motown",
  "Neo-Soul",
  "Refined Covers",
  "Soul Classics",

  // Hip-Hop & R&B (25)
  "2000s Hip-Hop",
  "2000s R&B",
  "2000s Reggaeton",
  "2010s Hip-Hop",
  "2010s R&B",
  "2010s Reggaeton",
  "2020s Hip-Hop",
  "2020s R&B",
  "2020s Reggaeton",
  "80s Hip-Hop",
  "90s & 00s Dancehall",
  "90s Hip-Hop",
  "90s R&B",
  "Afrobeats",
  "Alternative R&B",
  "Amapiano",
  "Clean 90s Hip-Hop",
  "Golden Era Hip-Hop",
  "Hip Hop Instrumentals",
  "Mumble Rap",
  "Neo Soul",
  "New Jack Swing",

  // Christmas (6)
  "Christmas Acoustic",
  "Christmas Classics",
  "Christmas Coffeehouse",
  "Christmas Indie",
  "Christmas Indie Acoustic",
  "Christmas Jazz",

  // Jazz & Classical (10)
  "20s Jazz & Big-Band",
  "Ambient Piano",
  "Bossa Nova Covers",
  "Classic Bossa Nova",
  "Classical",
  "Japanese Jazz",
  "Jazz & Piano",
  "Jazz Piano Standards",
  "Jazz Standards",
  "Modern Bossa Nova",
  "Nu-Jazz",

  // Pop (2000s-2020s) (14)
  "2000s Indie Pop",
  "2000s Pop",
  "2000s Pop Rock",
  "2010s Indie Pop",
  "2010s Pop",
  "2020s Indie Pop",
  "2020s Pop",
  "Classic Country Pop",
  "Country Remixed",
  "Global Pop (Eastern)",
  "Indie Soft Pop",
  "Modern Country Pop",
  "Soft Pop",

  // Rock & Alternative (27)
  "2000s Garage Rock",
  "2000s Indie Rock",
  "2010s Indie Rock",
  "2020s Indie Rock",
  "80s Rock",
  "90s Alternative",
  "90s Grunge",
  "90s Rock",
  "Alt Modern Country",
  "Bluegrass",
  "Blues",
  "Classic Rock",
  "Garage Rock (60s & 70s)",
  "Indie Folk",
  "Indie Sleaze",
  "Indie Soft Rock",
  "Irish Rock Classics",
  "New Wave",
  "Outlaw Country (Classics)",
  "Outlaw Country (Modern)",
  "Psychedelic Rock",
  "Rockabilly",
  "Roots Country",
  "Ska",
  "Spanish Indie",
  "Stadium Rock",
  "Yacht Rock",

  // World & Regional (23)
  "Afro Funk & Soul (Classics)",
  "Afro Funk & Soul (Modern)",
  "Afro Funk Instrumentals",
  "Classic Bachata",
  "Classic Latin Pop",
  "Classic Merengue",
  "Classic Salsa",
  "Cuban Jazz",
  "East Asian Instrumentals",
  "French Disco",
  "French Jazz",
  "French Pop",
  "Global Disco",
  "Global Disco House",
  "Global Instrumentals (Organic)",
  "Hawaiian Easy Listening",
  "Latin Funk & Soul (Classic)",
  "Latin Funk & Soul (Modern)",
  "Latin Funk Instrumentals",
  "Middle Eastern Funk & Soul",
  "Modern Reggae",
  "Reggae Classics",
  "Roots Reggae",
].sort(); // Sort alphabetically for easier dropdown navigation

export const ENERGY_LEVELS = [
  "Very Low",
  "Low",
  "Medium",
  "High",
  "Very High",
] as const;

export const ACCESSIBILITY_TYPES = [
  "Eclectic",
  "Timeless",
  "Commercial",
  "Cheesy",
] as const;

export const EXPLICIT_TYPES = [
  "Explicit",
  "Suggestive",
  "Family Friendly",
] as const;

export const AI_STATUSES = [
  "SUCCESS",
  "ERROR",
  "REQUIRES HUMAN REVIEW",
  "INVALID INPUT",
] as const;

export const REVIEW_STATUSES = [
  "all",
  "reviewed",
  "unreviewed",
] as const;

// TypeScript types for compile-time safety
export type EnergyLevel = typeof ENERGY_LEVELS[number];
export type AccessibilityType = typeof ACCESSIBILITY_TYPES[number];
export type ExplicitType = typeof EXPLICIT_TYPES[number];
export type AIStatus = typeof AI_STATUSES[number];
export type ReviewStatus = typeof REVIEW_STATUSES[number];
export type Subgenre = typeof SUBGENRES[number];
