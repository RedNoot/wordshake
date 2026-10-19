import { newRound } from "./round.js";

/*
 * A live room as plain JSON, so it can be kept in the database and picked up again after the server restarts
 * (a deploy, Render putting the server to sleep, a crash). Connections aren't kept: devices reconnect on their own.
 * The round's word sets are rebuilt from its board, so only what was played is stored.
 */
const pairs = m => [...m];
const teamsOut = t => t && { count: t.count, of: pairs(t.of) };
const teamsIn = t => t && { count: t.count, of: new Map(t.of) };

export function snapshotRoom(room, t) {
  const r = room.round;
  return {
    v: 1, savedAt: t,
    code: room.code, teacherId: room.teacherId, classId: room.classId, className: room.className, roster: room.roster,
    phase: room.phase, ownLooks: room.ownLooks, createdAt: room.createdAt, roundNo: room.roundNo,
    players: [...room.players.values()].map(({ id, name, studentId, token, avatar }) => ({ id, name, studentId, token, avatar: avatar || null })),
    teams: teamsOut(room.teams),
    round: r && {
      n: r.n, settings: r.settings, game: r.game, state: r.state, endsAt: r.endsAt, left: r.left,
      id: r.id, endedAt: r.endedAt, aborted: !!r.aborted, cutShort: !!r.cutShort,
      // A save that was under way when the server stopped is tried again (the round id stops it counting twice).
      save: r.save ? (r.save === "done" ? "done" : "pending") : null,
      found: pairs(r.found).map(([playerId, words]) => [playerId, pairs(words)]),
      submits: pairs(r.submits), eligible: [...r.eligible], who: r.who ? pairs(r.who) : [],
      teams: teamsOut(r.teams), teamResult: r.teamResult || null, teamsShown: !!r.teamsShown,
      rewards: r.rewards ? pairs(r.rewards) : null,
      idleFrom: pairs(r.idleFrom || new Map()), resumedAt: r.resumedAt || 0,
      hints: pairs(r.hints || new Map()).map(([playerId, h]) => [playerId, { word: h.word, count: h.count, given: [...h.given] }]),
    },
  };
}

export function restoreRoom(s) {
  const room = {
    code: s.code, teacherId: s.teacherId, hostSocket: null, classId: s.classId, className: s.className, roster: s.roster,
    players: new Map(s.players.map(p => [p.id, { ...p, avatar: p.avatar || null, socketId: null }])),
    // A room kept before the shop has a theme instead: it's left behind, and own looks are on as by default.
    phase: s.phase, ownLooks: s.ownLooks !== false, createdAt: s.createdAt, roundNo: s.roundNo, teams: teamsIn(s.teams),
    round: null, savedAt: s.savedAt,
  };
  const x = s.round;
  if (x) {
    const r = newRound(x.n, x.settings, x.game, x.eligible);
    Object.assign(r, {
      state: x.state, endsAt: x.endsAt, left: x.left, id: x.id, endedAt: x.endedAt, aborted: x.aborted, cutShort: x.cutShort,
      save: x.save || undefined, teamResult: x.teamResult || undefined, teamsShown: x.teamsShown,
      found: new Map(x.found.map(([playerId, words]) => [playerId, new Map(words)])),
      submits: new Map(x.submits), who: new Map(x.who), teams: teamsIn(x.teams),
      rewards: x.rewards ? new Map(x.rewards) : undefined,
      idleFrom: new Map(x.idleFrom || []), resumedAt: x.resumedAt || 0,
      hints: new Map((x.hints || []).map(([playerId, h]) => [playerId, { ...h, given: new Set(h.given) }])),
    });
    room.round = r;
  }
  return room;
}
