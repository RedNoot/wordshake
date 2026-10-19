// The seasonal shelves' word-sparkle drawings, by effect id (each season's file owns its own).
import { HALLOWEEN_DRAWINGS } from "./halloween.jsx";
import { CHRISTMAS_DRAWINGS } from "./christmas.jsx";
import { EASTER_DRAWINGS } from "./easter.jsx";

export const SEASONAL_DRAWINGS = { ...HALLOWEEN_DRAWINGS, ...CHRISTMAS_DRAWINGS, ...EASTER_DRAWINGS };
