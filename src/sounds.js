// Sounds-Write sound/spelling picker metadata (labels only — the actual
// phonics word table lives server-side in server/lib/phonics.js).
// Keep this array in sync with the SOUNDS array there if you edit either.
export const SOUNDS = [
  // Initial Code vowels
  { id:"a", lab:"/a/", eg:"cat", grp:"icv", sp:[["a","cat",1]] },
  { id:"e", lab:"/e/", eg:"peg", grp:"icv", sp:[["e","peg",1],["ea","head",0],["ai","said",0]] },
  { id:"i", lab:"/i/", eg:"tin", grp:"icv", sp:[["i","tin",1],["y","gym",0],["ui","build",0]] },
  { id:"o", lab:"/o/", eg:"hot", grp:"icv", sp:[["o","hot",1],["a","want",0]] },
  { id:"u", lab:"/u/", eg:"cup", grp:"icv", sp:[["u","cup",1],["o","son",0],["ou","touch",0]] },
  // Extended Code vowels (Sounds-Write sequence)
  { id:"ae", lab:"/ae/", eg:"rain", grp:"ecv", sp:[["ai","rain",1],["ay","play",1],["ea","great",1],["a-e","make",1],["a","acorn",0],["ey","they",0],["ei","vein",0],["eigh","eight",0]] },
  { id:"ee", lab:"/ee/", eg:"team", grp:"ecv", sp:[["ee","see",1],["ea","team",1],["e","me",1],["e-e","these",1],["y","happy",1],["ie","chief",1],["ey","key",0],["i","ski",0]] },
  { id:"oe", lab:"/oe/", eg:"boat", grp:"ecv", sp:[["o","no",1],["oa","boat",1],["o-e","bone",1],["ow","snow",1],["oe","toe",1],["ou","shoulder",1],["ough","dough",0]] },
  { id:"er", lab:"/er/", eg:"her", grp:"ecv", sp:[["er","her",1],["ir","bird",1],["ur","turn",1],["or","word",1],["ear","learn",0],["ar","dollar",0],["our","journey",0]] },
  { id:"ow", lab:"/ow/", eg:"cow", grp:"ecv", sp:[["ou","cloud",1],["ow","cow",1]] },
  { id:"oo_moon", lab:"/oo/ moon", eg:"moon", grp:"ecv", sp:[["oo","moon",1],["ue","blue",1],["ew","flew",1],["u-e","flute",1],["ou","soup",1],["o","do",0],["ui","fruit",0]] },
  { id:"ie", lab:"/ie/", eg:"night", grp:"ecv", sp:[["i","find",1],["igh","night",1],["y","fly",1],["ie","pie",1],["i-e","time",1]] },
  { id:"oo_book", lab:"/oo/ book", eg:"book", grp:"ecv", sp:[["oo","book",1],["u","put",1],["oul","could",1]] },
  { id:"oy", lab:"/oy/", eg:"boy", grp:"ecv", sp:[["oy","boy",1],["oi","coin",1]] },
  { id:"or", lab:"/or/", eg:"fork", grp:"ecv", sp:[["or","fork",1],["aw","saw",1],["a","ball",1],["ar","warm",1],["au","haul",1],["al","talk",1],["ore","more",0],["oar","roar",0],["our","four",0],["augh","caught",0],["ough","bought",0]] },
  { id:"air", lab:"/air/", eg:"hair", grp:"ecv", sp:[["air","hair",1],["are","care",1],["ear","bear",1],["ere","there",0],["eir","their",0],["ayer","prayer",0]] },
  { id:"ar", lab:"/ar/", eg:"car", grp:"ecv", sp:[["ar","car",1],["a","father",0],["al","calm",0],["au","aunt",0]] },
  { id:"ue", lab:"/ue/", eg:"cube", grp:"ecv", sp:[["u-e","cube",1],["ue","rescue",1],["ew","few",1],["u","unit",1]] },
  { id:"eer", lab:"/eer/", eg:"deer", grp:"ecv", sp:[["eer","deer",1],["ere","here",1],["ear","hear",1]] },
  // Consonant sounds
  { id:"s", lab:"/s/", eg:"sun", grp:"con", sp:[["s","sun",1],["ss","dress",1],["c","city",0],["ce","dance",0],["se","house",0],["sc","science",0],["st","listen",0]] },
  { id:"z", lab:"/z/", eg:"zip", grp:"con", sp:[["z","zip",1],["zz","buzz",1],["s","dogs",0],["se","cheese",0],["ze","sneeze",0],["ss","scissors",0]] },
  { id:"f", lab:"/f/", eg:"fan", grp:"con", sp:[["f","fan",1],["ff","cliff",1],["ph","phone",0],["gh","laugh",0]] },
  { id:"v", lab:"/v/", eg:"van", grp:"con", sp:[["v","van",1],["ve","have",1]] },
  { id:"k", lab:"/k/", eg:"kit", grp:"con", sp:[["c","cat",1],["k","kit",1],["ck","duck",1],["ch","school",0],["cc","soccer",0]] },
  { id:"g", lab:"/g/", eg:"go", grp:"con", sp:[["g","go",1],["gg","egg",1],["gu","guest",0],["gh","ghost",0]] },
  { id:"j", lab:"/j/", eg:"jam", grp:"con", sp:[["j","jam",1],["g","gem",0],["ge","large",0],["dge","bridge",0]] },
  { id:"d", lab:"/d/", eg:"dog", grp:"con", sp:[["d","dog",1],["dd","add",1],["ed","filled",0]] },
  { id:"t", lab:"/t/", eg:"tap", grp:"con", sp:[["t","tap",1],["tt","little",1],["ed","jumped",0],["bt","doubt",0],["te","minute",0]] },
  { id:"m", lab:"/m/", eg:"map", grp:"con", sp:[["m","map",1],["mm","hammer",1],["mb","thumb",0]] },
  { id:"n", lab:"/n/", eg:"net", grp:"con", sp:[["n","net",1],["nn","funny",1],["kn","knee",0],["gn","gnat",0],["ne","gone",0]] },
  { id:"ng", lab:"/ng/", eg:"ring", grp:"con", sp:[["ng","ring",1]] },
  { id:"l", lab:"/l/", eg:"leg", grp:"con", sp:[["l","leg",1],["ll","bell",1],["le","little",0],["al","metal",0],["el","camel",0],["il","pencil",0]] },
  { id:"r", lab:"/r/", eg:"run", grp:"con", sp:[["r","run",1],["rr","carrot",1],["wr","wrap",0],["rh","rhyme",0]] },
  { id:"h", lab:"/h/", eg:"hat", grp:"con", sp:[["h","hat",1],["wh","who",0]] },
  { id:"w", lab:"/w/", eg:"wet", grp:"con", sp:[["w","wet",1],["wh","when",1]] },
  { id:"sh", lab:"/sh/", eg:"ship", grp:"con", sp:[["sh","ship",1],["ch","chef",0],["ti","station",0],["ci","special",0]] },
  { id:"ch", lab:"/ch/", eg:"chip", grp:"con", sp:[["ch","chip",1],["tch","catch",1]] },
  { id:"th", lab:"/th/", eg:"thin", grp:"con", sp:[["th","thin + then",1]] },
  { id:"kw", lab:"/kw/", eg:"queen", grp:"con", sp:[["qu","queen",1]] },
];

export const SOUND_BY_ID = Object.fromEntries(SOUNDS.map(s => [s.id, s]));
