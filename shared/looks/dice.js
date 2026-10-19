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

// A small inline SVG drawn over the whole face (no width/height, so it stretches to any die size).
const svg = body => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>${body}</svg>`)}")`;
// Rounder corners than the theme's die. The die's radius is an inline style, hence !important.
const round = r => `$SEL .ws-die{border-radius:${r} !important}`;

// Textures stay faint, and their gloss and marks sit near the edges and corners, away from the letter in the middle.
export const DICE = [
  {
    id: "wood", slot: "dice", name: "Wooden blocks", emoji: "🌳", price: 80,
    vars: {
      dice: "#E3C08F", "dice-edge": "#A87843", letter: "#3B2412",
      "dice-texture": [
        svg("<g fill='none' stroke='#7A4A1E' stroke-width='1.5' stroke-opacity='.17'>"
          + "<path d='M0 9C25 6 50 15 100 8'/><path d='M0 24C30 19 62 31 100 22'/><path d='M0 40C22 36 56 47 100 38'/>"
          + "<path d='M0 57C34 52 66 63 100 55'/><path d='M0 73C26 69 60 79 100 71'/><path d='M0 89C38 85 70 94 100 87'/></g>"
          + "<ellipse cx='83' cy='15' rx='7' ry='3.2' fill='none' stroke='#7A4A1E' stroke-width='1.3' stroke-opacity='.25'/>"),
        "linear-gradient(180deg, rgba(255,244,220,.35), rgba(255,244,220,0) 35%)",
      ].join(","),
    },
    css: round("10%"),
  },
  {
    id: "chalk", slot: "dice", name: "Chalkboard", emoji: "🖍️", price: 100,
    vars: {
      dice: "#2E3A36", "dice-edge": "#151C1A", letter: "#F7F5EC",
      // a faint chalk-dust rim (so the dark face still shows on a dark tray) and a rubbed-out smudge in the corner
      "dice-texture": [
        svg("<rect x='3' y='3' width='94' height='94' rx='7' fill='none' stroke='#FFFFFF' stroke-width='2' stroke-opacity='.22'/>"
          + "<path d='M10 84C22 78 30 88 44 82' fill='none' stroke='#FFFFFF' stroke-width='3' stroke-opacity='.08' stroke-linecap='round'/>"
          + "<path d='M66 14C74 10 82 16 90 12' fill='none' stroke='#FFFFFF' stroke-width='2.5' stroke-opacity='.09' stroke-linecap='round'/>"),
        "radial-gradient(ellipse 55% 40% at 22% 18%, rgba(255,255,255,.08), rgba(255,255,255,0) 70%)",
      ].join(","),
    },
    css: round("8%"),
  },
  {
    id: "ice", slot: "dice", name: "Ice cubes", emoji: "🧊", price: 120,
    vars: {
      dice: "#DDF0FA", "dice-edge": "#93C3DF", letter: "#0B3A5C",
      // frost: a bright glint top-left, a cooler blue deep in the bottom, a frosty rim, icicles and a hairline crack in a corner
      "dice-texture": [
        svg("<rect x='3' y='3' width='94' height='94' rx='14' fill='none' stroke='#FFFFFF' stroke-width='3' stroke-opacity='.8'/>"
          + "<path d='M78 6L84 16L80 22M84 16L92 18' fill='none' stroke='#FFFFFF' stroke-width='1.4' stroke-opacity='.9'/>"
          // icicles hanging from the top edge, short enough to stay clear of the letter
          + "<g fill='#FFFFFF' stroke='#4F8FBF' stroke-width='1.8' stroke-linejoin='round'>"
          + "<path d='M8 4h12l-6 19z'/><path d='M22 4h8l-4 12z'/><path d='M43 4h11l-5.5 16z'/><path d='M57 4h7l-3.5 10z'/></g>"),
        "linear-gradient(150deg, rgba(255,255,255,.85) 0%, rgba(255,255,255,0) 30%)",
        "linear-gradient(0deg, rgba(110,170,215,.30) 0%, rgba(110,170,215,0) 34%)",
      ].join(","),
    },
    css: round("16%"),
  },
  {
    id: "jelly", slot: "dice", name: "Jelly", emoji: "🍮", price: 100,
    vars: {
      dice: "#FF9CCF", "dice-edge": "#D9478F", letter: "#4A0730",
      // a wet gloss along the top, a little shine spot, and a deeper pink pooling at the bottom
      "dice-texture": [
        "radial-gradient(ellipse 34% 13% at 42% 13%, rgba(255,255,255,.9), rgba(255,255,255,0) 100%)",
        "radial-gradient(circle at 84% 20%, rgba(255,255,255,.95) 0 4%, rgba(255,255,255,0) 6%)",
        "radial-gradient(ellipse 80% 30% at 50% 100%, rgba(214,40,128,.35), rgba(214,40,128,0) 100%)",
      ].join(","),
    },
    css: round("30%"),
  },
  {
    id: "stone", slot: "dice", name: "Stone", emoji: "⛰️", price: 120,
    vars: {
      dice: "#C8C3B8", "dice-edge": "#857E72", letter: "#2A2723",
      // speckles in the rock, light on the top-left and a shaded rim, on a slightly uneven pebble shape
      "dice-texture": [
        svg("<g fill='#5E584F' fill-opacity='.25'><circle cx='14' cy='22' r='1.4'/><circle cx='82' cy='12' r='1.1'/>"
          + "<circle cx='90' cy='46' r='1.6'/><circle cx='10' cy='62' r='1.2'/><circle cx='24' cy='86' r='1.5'/>"
          + "<circle cx='70' cy='88' r='1.2'/><circle cx='56' cy='9' r='.9'/><circle cx='88' cy='76' r='1'/></g>"
          + "<g fill='#FFFFFF' fill-opacity='.35'><circle cx='30' cy='12' r='1'/><circle cx='8' cy='40' r='.9'/><circle cx='78' cy='64' r='.9'/></g>"),
        "radial-gradient(circle at 34% 28%, rgba(255,255,255,.30), rgba(255,255,255,0) 55%)",
        "radial-gradient(closest-side, rgba(80,72,62,0) 80%, rgba(80,72,62,.22) 100%)",
      ].join(","),
    },
    css: round("40% 32% 36% 30% / 34% 38% 30% 36%"),
  },
  {
    id: "gold", slot: "dice", name: "Gold", emoji: "🥇", price: 300,
    vars: {
      dice: "#F2C94C", "dice-edge": "#A87A0C", letter: "#3D2A00",
      // polished: a bright rim, a shine on the top-left, a glint band across the bottom-right corner, a warmer shade low down
      "dice-texture": [
        svg("<rect x='3' y='3' width='94' height='94' rx='12' fill='none' stroke='#FFF4BF' stroke-width='3' stroke-opacity='.85'/>"),
        "linear-gradient(135deg, rgba(255,255,240,.70) 0%, rgba(255,255,240,0) 26%)",
        "linear-gradient(135deg, rgba(255,250,220,0) 74%, rgba(255,250,220,.75) 79%, rgba(255,250,220,0) 84%)",
        "linear-gradient(0deg, rgba(170,110,0,.22) 0%, rgba(170,110,0,0) 40%)",
      ].join(","),
    },
    css: round("14%"),
  },
  {
    // A plain board-game letter tile: flat cream, a slight bevel, and a little diamond in one corner (no point number).
    id: "tiles", slot: "dice", name: "Letter tiles", emoji: "🔤", price: 0, unlock: "weeks-5",
    vars: {
      dice: "#F4E7C6", "dice-edge": "#CBB689", letter: "#2B2118",
      "dice-texture": svg(
        "<rect x='2.5' y='2.5' width='95' height='95' rx='8' fill='none' stroke='#FFFFFF' stroke-width='2.5' stroke-opacity='.7'/>"
        + "<path d='M14 8L20 14L14 20L8 14Z' fill='#B48A4A' fill-opacity='.75'/>"),
    },
    css: round("10%"),
  },
];
