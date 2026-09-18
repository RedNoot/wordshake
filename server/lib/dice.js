export const DICE = {
  4: ["AAEEGN","ABBJOO","ACHOPS","AFFKPS","AOOTTW","CIMOTU","DEILRX","DELRVY",
      "DISTTY","EEGHNW","EEINSU","EHRTVW","EIOSST","ELRTTY","HIMNQU","HLNNRZ"],
  5: ["AAAFRS","AAEEEE","AAFIRS","ADENNN","AEEEEM","AEEGMU","AEGMNN","AFIRSY",
      "BJKQXZ","CCNSTW","CEIILT","CEILPT","CEIPST","DDLNOR","DHHLOR","DHHNOT",
      "DHLNOR","EIIITT","EMOTTT","ENSSSU","FIPRSY","GORRVW","HIPRRY","NOOTUW","OOOTTU"],
};
DICE[6] = DICE[5].concat([
  "AAEEOO","ABDEIO","AEILMN","AEINOU","CDDLNN","CEIITT","CFGNUY","EHILRS",
  "EILPST","AEIOUS","An,Er,He,In,Qu,Th", // digraph die renders as combo tiles
]);

// soundswrite floors: the Sounds-Write list finds ~45% as many words per board as the full list
export const QUALITY = { full: { 4: 40, 5: 80, 6: 130 }, soundswrite: { 4: 18, 5: 36, 6: 58 }, fallback: { 4: 12, 5: 20, 6: 30 } };
