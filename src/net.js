import { io } from "socket.io-client";

let socket;
// One live connection per page, opened only when a room is involved (workbook mode never needs it).
export function getSocket() {
  socket ??= io({ transports: ["websocket", "polling"] });
  return socket;
}

// Emit and wait for the server's reply; a dropped connection reads as an error, not a hang.
export function call(event, data, timeoutMs = 10000) {
  return getSocket().timeout(timeoutMs).emitWithAck(event, data).catch(() => ({ error: "offline" }));
}
