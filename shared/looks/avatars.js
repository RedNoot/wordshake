/*
 * Avatars: an emoji beside the student's name on their device, their round splash and the big-screen lobby.
 * Because the whole class sees them, an avatar must be something any child is happy to be seen with.
 *
 * An avatar = { id, slot: "avatar", name, emoji, price, unlock? }   (the emoji is the avatar)
 *
 * Friendly animals and a few fantastic ones (the rest of the emoji keyboard is in emoji-avatars.js). Left out on purpose: anything easily turned into a tease (pig, cow,
 * whale, elephant, sloth, monkey, food), anything scary or rude, weapons, flags, people and skin tones.
 * Every emoji is Unicode 13 or older, so iPadOS 15+ and ChromeOS draw it.
 */
import { SEASONAL } from "./seasonal.js";
import { EMOJI_AVATARS } from "./emoji-avatars.js";
const avatar = (id, name, emoji, price, unlock) => ({ id, slot: "avatar", name, emoji, price, ...(unlock ? { unlock } : {}) });

const BASE_AVATARS = [
  // Animals, 50 ⭐
  avatar("fox", "Fox", "🦊", 50),
  avatar("panda", "Panda", "🐼", 50),
  avatar("koala", "Koala", "🐨", 50),
  avatar("kangaroo", "Kangaroo", "🦘", 50),
  avatar("frog", "Frog", "🐸", 50),
  avatar("penguin", "Penguin", "🐧", 50),
  avatar("octopus", "Octopus", "🐙", 50),
  avatar("bee", "Bee", "🐝", 50),
  avatar("cat", "Cat", "🐱", 50),
  avatar("dog", "Dog", "🐶", 50),
  avatar("rabbit", "Rabbit", "🐰", 50),
  avatar("lion", "Lion", "🦁", 50),
  avatar("tiger", "Tiger", "🐯", 50),
  avatar("bear", "Bear", "🐻", 50),
  avatar("dolphin", "Dolphin", "🐬", 50),
  avatar("butterfly", "Butterfly", "🦋", 50),
  avatar("hedgehog", "Hedgehog", "🦔", 50),
  avatar("ladybird", "Ladybird", "🐞", 50),
  // Special, 120 ⭐
  avatar("unicorn", "Unicorn", "🦄", 120),
  avatar("dragon", "Dragon", "🐉", 120),
  avatar("dinosaur", "Dinosaur", "🦖", 120),
  avatar("robot", "Robot", "🤖", 120),
  avatar("alien", "Alien", "👽", 120),
  // Won with a trophy, never sold
  avatar("owl", "Wise owl", "🦉", 0, "words-100"),       // Hundred club: 100 words altogether
  avatar("turtle", "Steady turtle", "🐢", 0, "weeks-5"), // Regular: played in 5 different weeks
];

// Plus this slot's items from the seasonal shelves (shared/looks/seasons/), and the rest of the emoji keyboard.
export const AVATARS = [...BASE_AVATARS, ...SEASONAL.filter(i => i.slot === "avatar"), ...EMOJI_AVATARS];
