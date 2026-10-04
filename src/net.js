import { io } from "socket.io-client";

let socket;
// One live connection per page, opened only when a room is involved (workbook mode never needs it).
// Default transports: starts on plain HTTP polling and upgrades to a websocket when the network allows,
// so a school firewall that blocks websockets still works.
export function getSocket() {
  socket ??= io();
  return socket;
}

// Emit and wait for the server's reply; a dropped connection reads as an error, not a hang.
export function call(event, data, timeoutMs = 10000) {
  return getSocket().timeout(timeoutMs).emitWithAck(event, data).catch(() => ({ error: "offline" }));
}
