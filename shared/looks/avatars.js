/*
 * Avatars: an emoji beside the student's name on their device, their round splash and the big-screen lobby.
 * Because the whole class sees them, an avatar must be something any child is happy to be seen with.
 *
 * An avatar = { id, slot: "avatar", name, emoji, price, unlock? }   (the emoji is the avatar)
 *
 * Friendly animals and a few fantastic ones. Left out on purpose: anything easily turned into a tease (pig, cow,
 * whale, elephant, sloth, monkey, food), anything scary or rude, weapons, flags, people and skin tones.
 * Every emoji is Unicode 13 or older, so iPadOS 15+ and ChromeOS draw it.
 */
import { SEASONAL } from "./seasonal.js";
const avatar = (id, name, emoji, price, unlock) => ({ id, slot: "avatar", name, emoji, price, ...(unlock ? { unlock } : {}) });

const BASE_AVATARS = [
  // Animals, 25 ⭐
  avatar("fox", "Fox", "🦊", 25),
  avatar("panda", "Panda", "🐼", 25),
  avatar("koala", "Koala", "🐨", 25),
  avatar("kangaroo", "Kangaroo", "🦘", 25),
  avatar("frog", "Frog", "🐸", 25),
  avatar("penguin", "Penguin", "🐧", 25),
  avatar("octopus", "Octopus", "🐙", 25),
  avatar("bee", "Bee", "🐝", 25),
  avatar("cat", "Cat", "🐱", 25),
  avatar("dog", "Dog", "🐶", 25),
  avatar("rabbit", "Rabbit", "🐰", 25),
  avatar("lion", "Lion", "🦁", 25),
  avatar("tiger", "Tiger", "🐯", 25),
  avatar("bear", "Bear", "🐻", 25),
  avatar("dolphin", "Dolphin", "🐬", 25),
  avatar("butterfly", "Butterfly", "🦋", 25),
  avatar("hedgehog", "Hedgehog", "🦔", 25),
  avatar("ladybird", "Ladybird", "🐞", 25),
  // Special, 60 ⭐
  avatar("unicorn", "Unicorn", "🦄", 60),
  avatar("dragon", "Dragon", "🐉", 60),
  avatar("dinosaur", "Dinosaur", "🦖", 60),
  avatar("robot", "Robot", "🤖", 60),
  avatar("alien", "Alien", "👽", 60),
  // Won with a trophy, never sold
  avatar("owl", "Wise owl", "🦉", 0, "words-100"),       // Hundred club: 100 words altogether
  avatar("turtle", "Steady turtle", "🐢", 0, "weeks-5"), // Regular: played in 5 different weeks
];

// Plus this slot's items from the seasonal shelves (shared/looks/seasons/).
export const AVATARS = [...BASE_AVATARS, ...SEASONAL.filter(i => i.slot === "avatar")];
