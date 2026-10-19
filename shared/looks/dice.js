/*
 * Dice styles: only the die faces on the student's own board. They sit on top of any theme, so a style brings its own
 * face, lip and letter colours and is checked for contrast on its own (letter on face), never against a theme.
 * With no dice style worn, the theme's own dice show.
 *
 * A dice style = { id, slot: "dice", name, emoji, price, unlock?, vars, css? }
 *   vars: "dice", "dice-edge", "letter" (hex), and optionally "dice-texture": a CSS background-image layered over the
 *         face colour (gradients or a small inline SVG; keep it faint so letters stay crisp).
 *   css:  optional extra rules for the selector SEL ($SEL in the string), e.g. "$SEL .ws-die{border-radius:30%}".
 *         Only style .ws-die. Don't change its size, and don't hide the letter.
 * While a die is traced or just found its fill turns amber/green and its letter uses the theme's "letter-lit",
 * so a dice style never has to work on those colours.
 */
export const SEL = "[data-ws-dice=\"$id\"]";

export const DICE = [];
