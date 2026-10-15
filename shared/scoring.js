// How words score, on the big screen and on devices: 1 point for a word of the shortest allowed length,
// then +1 for every letter on top of that. With a 3-letter minimum: "cat" 1, "cats" 2, "shake" 3.
export const wordPoints = (length, minLen) => Math.max(1, 1 + length - minLen);
// Extra points for a word with today's Sounds-Write sound (when the teacher turns the bonus on).
export const BONUS = 2;
