// Every seasonal shelf's items, gathered for the slot files (each slot file adds its own slot's ones to its list).
import { HALLOWEEN } from "./seasons/halloween.js";
import { CHRISTMAS } from "./seasons/christmas.js";
import { EASTER } from "./seasons/easter.js";

export const SEASONAL = [...HALLOWEEN, ...CHRISTMAS, ...EASTER];
