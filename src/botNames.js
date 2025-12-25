// Satirical bot names for the pyramid

const FIRST_NAMES = [
  'Karen', 'Chad', 'Brenda', 'Kyle', 'Linda',
  'Brad', 'Debbie', 'Derek', 'Tammy', 'Trevor',
  'Crystal', 'Hunter', 'Destiny', 'Tyler', 'Amber',
  'Brayden', 'Ashleigh', 'Jayden', 'Brittney', 'Skyler',
]

const RELATIONSHIPS = [
  'Your Aunt', 'Your Uncle', 'Your Cousin', 'Your Neighbor',
  "Mom's Friend", 'High School Acquaintance', 'That Guy From Church',
  'Your Ex', 'College Roommate', 'Distant Relative',
]

const TITLES = [
  'CEO Mindset', 'Boss Babe', 'Hustle King', 'Dream Chaser',
  'Wealth Builder', 'Success Story', 'Freedom Seeker', 'Empire Builder',
  'Passive Income Pro', 'Side Hustle Queen',
]

const PLATFORMS = [
  'from Facebook', 'from LinkedIn', 'from Instagram',
  'from that weird group chat', 'from the PTA', 'from Nextdoor',
]

// Generate a random bot name
function generateBotName() {
  const rand = Math.random()

  if (rand < 0.3) {
    // Relationship-based name
    const relationship = RELATIONSHIPS[Math.floor(Math.random() * RELATIONSHIPS.length)]
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
    return `${relationship} ${firstName}`
  } else if (rand < 0.5) {
    // Platform-based name
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
    const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)]
    return `${firstName} ${platform}`
  } else if (rand < 0.7) {
    // Title-based name
    const title = TITLES[Math.floor(Math.random() * TITLES.length)]
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
    return `${firstName} "${title}"`
  } else {
    // Simple name with emoji
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
    const emojis = ['💪', '🚀', '💰', '✨', '🔥', '👑', '💎', '🌟']
    const emoji = emojis[Math.floor(Math.random() * emojis.length)]
    return `${firstName} ${emoji}`
  }
}

// Generate a list of unique bot names
export function generateBotNames(count) {
  const names = new Set()

  // Add some special names first
  const specialNames = [
    'The Founder',
    'Regional Vice President',
    'Diamond Leader Extraordinaire',
    '"Retired at 25"',
    'Gary from the Conference',
    'The One Who Got You Into This',
  ]

  for (const name of specialNames) {
    if (names.size < count) {
      names.add(name)
    }
  }

  // Generate random names until we have enough
  while (names.size < count) {
    names.add(generateBotName())
  }

  // Shuffle and return as array
  return [...names].sort(() => Math.random() - 0.5)
}
