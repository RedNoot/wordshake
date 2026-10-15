// Teams mode: the teacher splits the room into 2–6 teams in the lobby. A team's score is its members' points added up.
// Used by the server (team numbers 0–5) and the screens (names, emoji and colours).
export const TEAMS = [
  { name: "Foxes", emoji: "🦊", colour: "#F26B21" },
  { name: "Owls", emoji: "🦉", colour: "#8E5BD9" },
  { name: "Frogs", emoji: "🐸", colour: "#2FA36B" },
  { name: "Dolphins", emoji: "🐬", colour: "#3D7BD9" },
  { name: "Bees", emoji: "🐝", colour: "#D99A00" },
  { name: "Ladybirds", emoji: "🐞", colour: "#E5484D" },
];
export const MIN_TEAMS = 2;
export const MAX_TEAMS = TEAMS.length;
