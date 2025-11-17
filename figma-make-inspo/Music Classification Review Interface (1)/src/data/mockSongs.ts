// Mock data from CSV sample
export interface Song {
  id: number;
  isrc: string | null;
  title: string;
  artist: string;
  energy: string;
  bpm: number | null;
  subgenre: string;
  artwork: string | null;
  source_file: string | null;
  ai_status: 'SUCCESS' | 'ERROR' | 'REQUIRES HUMAN REVIEW' | 'INVALID INPUT';
  ai_error_message: string | null;
  ai_reasoning: string;
  ai_context_used: string;
  ai_energy: string;
  ai_accessibility: string;
  ai_subgenre_1: string;
  ai_subgenre_2: string | null;
  ai_subgenre_3: string | null;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  curator_notes: string | null;
}

export const mockSongs: Song[] = [
  {
    id: 1,
    isrc: null,
    title: "Adorn (Uptempo Remix)",
    artist: "Miguel",
    energy: "High",
    bpm: 111,
    subgenre: "Indie Open Format",
    artwork: null,
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250721184832326622.mp3",
    ai_status: "SUCCESS",
    ai_error_message: null,
    ai_reasoning: "This classification is based on the popular dance floor remix which layers the classic 2010s R&B and Neo-Soul vocals over a driving, four-on-the-floor beat, transforming it into a high-energy track. The resulting sound is highly accessible and features the characteristic groove and production of Soulful House, making it perfect for active social settings. As a remix of a major pop hit, it falls within the Pop Dance category.",
    ai_context_used: "Analyzed cultural reception and common DJ usage of the 'Uptempo Remix' version of the 2012 hit track, focusing on the added house/dance elements.",
    ai_energy: "High",
    ai_accessibility: "Commercial",
    ai_subgenre_1: "Soulful House",
    ai_subgenre_2: "2010s R&B",
    ai_subgenre_3: "2010s and 2020s Pop Dance Originals & Remixes",
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    curator_notes: null
  },
  {
    id: 2,
    isrc: null,
    title: "He Wasn't Man Enough",
    artist: "Toni Braxton",
    energy: "High",
    bpm: 88,
    subgenre: "90s Hip-Hop & Hits;McFadden's Lunch",
    artwork: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250415225827899991.jpg",
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250415225823287290.mp3",
    ai_status: "SUCCESS",
    ai_error_message: null,
    ai_reasoning: "This is a quintessential early 2000s R&B and Pop crossover track, characterized by Rodney Jerkins' signature driving, syncopated production and Toni Braxton's powerful vocals. Its high-quality production and constant rhythmic movement define it as a high-energy track suitable for active commercial settings. Due to its massive chart success and heavy radio rotation, the track is considered Commercial.",
    ai_context_used: "Web search confirmed 2000 release date, R&B/Pop genre, and high commercial success/radio play.",
    ai_energy: "High",
    ai_accessibility: "Commercial",
    ai_subgenre_1: "2000s R&B",
    ai_subgenre_2: "2000s Pop",
    ai_subgenre_3: null,
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    curator_notes: null
  },
  {
    id: 3,
    isrc: "GBAYE2300262",
    title: "Tioga Pass (feat. Rocco Palladino)",
    artist: "Yussef Dayes, Rocco Palladino",
    energy: "Medium",
    bpm: 91,
    subgenre: "Nu-Jazz",
    artwork: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250828104700234392.jpg",
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250828104653620194.mp3",
    ai_status: "SUCCESS",
    ai_error_message: null,
    ai_reasoning: "This track is a sophisticated piece of modern instrumental jazz fusion, driven by complex, dynamic drumming and deep basslines. Its smooth, even-tempered groove maintains steady movement without intense energy peaks, fitting perfectly into sophisticated daytime hospitality settings. The track is highly respected within contemporary music circles but remains accessible and enduring.",
    ai_context_used: "Used Google Search to confirm the artists' standing in the contemporary UK jazz scene, and verified the track's style as instrumental jazz fusion (nu-jazz).",
    ai_energy: "Medium",
    ai_accessibility: "Timeless",
    ai_subgenre_1: "Nu-Jazz",
    ai_subgenre_2: "Modern Instrumentals (Organic)",
    ai_subgenre_3: null,
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    curator_notes: null
  },
  {
    id: 4,
    isrc: "FR6V80498049",
    title: "Jungle Jungle - Version Maxi",
    artist: "Bibi Flash",
    energy: "Medium",
    bpm: 124,
    subgenre: "Klocke Estate (Evening)",
    artwork: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250923052313414714.jpg",
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250923052309731969.mp3",
    ai_status: "SUCCESS",
    ai_error_message: null,
    ai_reasoning: "This track is a classic 1983 'Maxi Version' Italo-Disco and synth-pop cut, characterized by a high-tempo, driving electronic beat and synthesized melodies, designed specifically to excite listeners and encourage dancing. While highly recognized in underground and specialist dance circles, its niche nature prevents it from being classified as Commercial or Cheesy.",
    ai_context_used: "Web search confirmed release date (1983), French origin, and genre classification as Italo-Disco/Synth-Pop. The 'Maxi Version' denotes a very high energy club focus.",
    ai_energy: "Very High",
    ai_accessibility: "Timeless",
    ai_subgenre_1: "Italo-Disco",
    ai_subgenre_2: "80s Dance",
    ai_subgenre_3: "French Disco",
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    curator_notes: null
  },
  {
    id: 5,
    isrc: "QM6MZ1489917",
    title: "African Queen - Remastered Version",
    artist: "2Baba",
    energy: "Medium",
    bpm: 77,
    subgenre: "Tall Tales (Island Reggae)",
    artwork: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250930110718078924.jpg",
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250930110712823284.mp3",
    ai_status: "SUCCESS",
    ai_error_message: null,
    ai_reasoning: "This song is a foundational track of modern Afrobeats and Nigerian R&B, characterized by a smooth, mid-tempo groove and romantic vocal performance. Released in 2004, it fits squarely within the style of 2000s R&B while maintaining its commercial accessibility across global markets. The energy level is balanced, providing a comfortable, steady rhythm without intense dynamic spikes.",
    ai_context_used: "Confirmed release in 2004; identified as a signature track by 2Baba (2Face Idibia) and a classic example of early Afrobeats and Nigerian R&B.",
    ai_energy: "Medium",
    ai_accessibility: "Commercial",
    ai_subgenre_1: "Afrobeats",
    ai_subgenre_2: "2000s R&B",
    ai_subgenre_3: "Global Pop (Eastern)",
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    curator_notes: null
  },
  {
    id: 6,
    isrc: "USNRS2543977",
    title: "The Less I Know The Better",
    artist: "Mau P",
    energy: "High",
    bpm: 128,
    subgenre: "Bar Moxy (Late);Sports & Social (Late Night)",
    artwork: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250820205400798603.jpg",
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250820205357375309.mp3",
    ai_status: "SUCCESS",
    ai_error_message: null,
    ai_reasoning: "This 2023 track is a high-energy, driving tech house remix of the popular Tame Impala song, designed explicitly for peak-hour club settings and festivals. The propulsive beat and recognizable vocal hook make it highly accessible and intended to excite listeners, classifying it as Very High energy.",
    ai_context_used: "Web search confirmed the song's status as a 2023 tech house remix and its widespread play in mainstream electronic music environments.",
    ai_energy: "Very High",
    ai_accessibility: "Commercial",
    ai_subgenre_1: "Modern Dance",
    ai_subgenre_2: "2010s and 2020s Pop (Dance Remixes)",
    ai_subgenre_3: null,
    reviewed: true,
    reviewed_by: "Sarah M.",
    reviewed_at: "2025-10-25T14:30:00Z",
    curator_notes: "Perfect tech house energy for late night sets"
  },
  {
    id: 7,
    isrc: null,
    title: "I Can't Go for That (No Can Do)",
    artist: "Daryl Hall & John Oates",
    energy: "High",
    bpm: 111,
    subgenre: "Capon's Chophouse (Dinner);CS (Late);McFadden's Lunch;Municipal Bar (Late Night)",
    artwork: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250415233225708141.jpg",
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250415233220820097.mp3",
    ai_status: "SUCCESS",
    ai_error_message: null,
    ai_reasoning: "This iconic 1981 track pioneered the blend of new wave, R&B, and pop, driven by its sophisticated, machine-based rhythm and funky bassline. The resulting smooth, yet steady groove makes it suitable for movement without intense energy spikes, placing it firmly in the medium category. Due to its enduring popularity and status as a multi-generational radio staple, it is highly Commercial and accessible, representing the best of the 80s R&B and Pop crossover sound.",
    ai_context_used: "Web search confirmed 1981 release date, influence on R&B/Pop fusion, use of LinnDrum machine, and consistent radio presence.",
    ai_energy: "Medium",
    ai_accessibility: "Commercial",
    ai_subgenre_1: "80s R&B",
    ai_subgenre_2: "80s Pop",
    ai_subgenre_3: "Funk Classics",
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    curator_notes: null
  },
  {
    id: 8,
    isrc: null,
    title: "Sweet Memories",
    artist: "CID",
    energy: "High",
    bpm: 125,
    subgenre: "McFadden's Late Night",
    artwork: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250415231533861646.jpg",
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250415231529771277.mp3",
    ai_status: "SUCCESS",
    ai_error_message: null,
    ai_reasoning: "This track is a high-energy, contemporary house production from 2017, characterized by a forceful four-on-the-floor beat and repetitive vocal sampling designed for peak-hour club play. Its highly propulsive rhythm pushes the energy into the very high category, fitting the criteria for mainstream, commercial electronic dance music.",
    ai_context_used: "Used web search to verify the artist's genre (house producer) and track's description (high-energy, club-focused 2017 release).",
    ai_energy: "Very High",
    ai_accessibility: "Commercial",
    ai_subgenre_1: "Modern Dance",
    ai_subgenre_2: "2010s and 2020s Pop Dance Originals & Remixes",
    ai_subgenre_3: "Deep House (Vocal)",
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    curator_notes: null
  },
  {
    id: 9,
    isrc: null,
    title: "Darkest Light",
    artist: "Lafayette Afro Rock Band",
    energy: "Medium",
    bpm: 105,
    subgenre: "Municipal Bar (Afternoon)",
    artwork: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250619001302718829.jpg",
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250619001256510590.mp3",
    ai_status: "SUCCESS",
    ai_error_message: null,
    ai_reasoning: "This is a quintessential 70s funk track, famed for its heavy, driving instrumental breakbeat and prominent brass arrangements, heavily incorporating West African rhythms. The track's highly propulsive groove and its status as a foundational source for Golden Era Hip-Hop sampling elevate its energy and timeless appeal, making it perfect for active social environments.",
    ai_context_used: "Used web search to confirm release year (1974), genre (Afro-funk/Afrobeat), and its cultural significance as a widely sampled instrumental track.",
    ai_energy: "High",
    ai_accessibility: "Timeless",
    ai_subgenre_1: "Afro Funk & Soul (Classics)",
    ai_subgenre_2: "Funk Classics",
    ai_subgenre_3: "Hip-Hop Samples",
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    curator_notes: null
  },
  {
    id: 10,
    isrc: "GBUQH1700101",
    title: "Mon ecole",
    artist: "XOA",
    energy: "Medium",
    bpm: 117,
    subgenre: "The Observatory",
    artwork: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250918103244164947.jpg",
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250918103238821817.mp3",
    ai_status: "SUCCESS",
    ai_error_message: null,
    ai_reasoning: "This track blends deep electronic production with authentic West African rhythms, featuring Dele Sosimi's Afrobeat vocals, creating a driving and sophisticated groove. The resulting sound is highly danceable and suitable for active social environments, classifying it as High energy. The track is critically acclaimed but remains a deep cut within specialized music scenes, classifying it as Timeless for discerning listeners.",
    ai_context_used: "Web search verifying the artist's genre association (Afrobeat/electronic) and the track's status as a well-regarded deep cut (2016 release).",
    ai_energy: "High",
    ai_accessibility: "Timeless",
    ai_subgenre_1: "Afrobeat",
    ai_subgenre_2: "Global Electronica (Non French)",
    ai_subgenre_3: "Afro Funk & Soul (Modern)",
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    curator_notes: null
  },
  {
    id: 11,
    isrc: null,
    title: "Vol 1: Higher Ground Afternoon",
    artist: "Raina Music",
    energy: "High",
    bpm: 120,
    subgenre: "Higher Ground Afternoon (Mixes)",
    artwork: null,
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250915200529519192.mp3",
    ai_status: "ERROR",
    ai_error_message: "Failed to parse JSON response: Unexpected token '*', \"**Status**\"... is not valid JSON",
    ai_reasoning: "",
    ai_context_used: "",
    ai_energy: "",
    ai_accessibility: "",
    ai_subgenre_1: "",
    ai_subgenre_2: null,
    ai_subgenre_3: null,
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    curator_notes: null
  },
  {
    id: 12,
    isrc: "DKARS9003403",
    title: "Everything happens to me",
    artist: "Duke Jordan",
    energy: "Low",
    bpm: 73,
    subgenre: "Jazz & Piano",
    artwork: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250826001057468310.jpg",
    source_file: "https://raina-backend-dteam-dev.s3.eu-north-1.amazonaws.com/song/20250826001053144356.mp3",
    ai_status: "SUCCESS",
    ai_error_message: null,
    ai_reasoning: "This is a quintessential jazz standard performed as a slow, reflective instrumental ballad, primarily featuring piano. Its mellow tempo and sophisticated arrangement classify it as Low energy, making it suitable for quiet, high-end environments where refined background music is desired.",
    ai_context_used: "Confirmed Duke Jordan's history as a prominent bebop/hard bop pianist and the track's status as a classic jazz standard, often performed instrumentally.",
    ai_energy: "Low",
    ai_accessibility: "Timeless",
    ai_subgenre_1: "Jazz Standards",
    ai_subgenre_2: "Jazz Piano Standards",
    ai_subgenre_3: "Jazz & Piano",
    reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    curator_notes: null
  }
];

// Extract unique subgenres from mock data
export const getAllSubgenres = (): string[] => {
  const subgenresSet = new Set<string>();
  
  mockSongs.forEach(song => {
    if (song.ai_subgenre_1) subgenresSet.add(song.ai_subgenre_1);
    if (song.ai_subgenre_2) subgenresSet.add(song.ai_subgenre_2);
    if (song.ai_subgenre_3) subgenresSet.add(song.ai_subgenre_3);
  });
  
  return Array.from(subgenresSet).sort();
};

// Energy and Accessibility options
export const ENERGY_LEVELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
export const ACCESSIBILITY_TYPES = ['Eclectic', 'Timeless', 'Commercial', 'Cheesy'];
export const AI_STATUSES = ['SUCCESS', 'ERROR', 'REQUIRES HUMAN REVIEW', 'INVALID INPUT'];
