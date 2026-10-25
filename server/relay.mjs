// The Frontlines server: serves the built game (site/) and, on /ws, the relay for two-player matches.
// See docs/multiplayer.md. Both browsers run the whole battle; the relay only passes each player's turns
// (the orders for 50 ms of play) and checksums to the other, and keeps a room's turns so that a player who
// drops out can rejoin and replay the battle up to now. It never runs a game itself.
//
//   node relay.mjs                      serves ../site on port 8080 (PORT and SITE override)
//   import { start } from './relay.mjs' tests start it on a free port, optionally with a delay per message (ms),
//                                       and jitter: up to that much more, at random, still in order
//
// A room: players[team] (socket, or null while away), keys[team] (to rejoin), names, screens (each player's
// window size, for choosing the board), lobby (the map the host is showing), setup (what the host started:
// map, board, match), turns[team][n] (every turn so far, for rejoining), guest (someone joined) and over.
//
// Messages are JSON, { t: type, ... }:
//   from a player  host {name, screen} · join {code, name, screen} · rejoin {code, team, key} · name {name}
//                  lobby {lobby} and start {setup} (host only) · turn {id, n, orders} · sum {id, n, sum} · over
//                  (id: the match's, from its setup)
//                  ping, pong and rematch (passed on as they are)
//   to a player    room {code, team, key, names, screens, lobby} · joined {names, screens} · names {names}
//                  lobby/start/turn/sum/ping/pong/rematch (the other's) · catchup {setup, turns} (after a
//                  rejoin) · left {team} · back {team} · error {message}

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I, so a code can be read aloud
const IDLE_MS = 30 * 60 * 1000;

export function start({ port = 8080, site = fileURLToPath(new URL('../site/', import.meta.url)), delay = 0, jitter = 0 } = {}) {
  const root = resolve(site);
  const rooms = new Map();   // code -> { players: [socket|null, socket|null], keys, names, setup, turns, seen }

  // ---------- the game's files ----------
  const server = createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (path.endsWith('/')) path += 'index.html';
    const file = join(root, path);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
      const s = await stat(file);
      if (!s.isFile()) throw new Error('not a file');
      const type = TYPES[extname(file)] || 'application/octet-stream';
      res.writeHead(200, {
        'content-type': type, 'content-length': s.size,
        'cache-control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600',
      });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  });

  // ---------- the relay ----------
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
  // a message is never sent before an earlier one to the same player, as on a real connection
  const send = (ws, msg) => {
    if (!ws || ws.readyState !== 1) return;
    if (!delay && !jitter) return ws.send(JSON.stringify(msg));
    const at = Math.max(ws.due || 0, Date.now() + delay + Math.random() * jitter);
    ws.due = at;
    setTimeout(() => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }, at - Date.now());
  };
  const newCode = () => { for (;;) { const b = randomBytes(4), c = [...b].map(x => CODE_CHARS[x % CODE_CHARS.length]).join(''); if (!rooms.has(c)) return c; } };

  wss.on('connection', ws => {
    let room = null, team = -1;
    const other = () => room && room.players[1 - team];
    ws.on('message', data => {
      let m;
      try { m = JSON.parse(data); } catch { return; }
      if (room) room.seen = Date.now();
      if (m.t === 'host' && !room) {
        const code = newCode();
        room = { code, guest: false, over: false, players: [ws, null], keys: [randomBytes(8).toString('hex'), randomBytes(8).toString('hex')], names: [String(m.name || '').slice(0, 24), ''], screens: [m.screen || null, null], lobby: null, setup: null, turns: [[], []], seen: Date.now() };
        rooms.set(code, room); team = 0;
        send(ws, { t: 'room', code, team, key: room.keys[0], names: room.names });
      } else if (m.t === 'join' && !room) {
        const r = rooms.get(String(m.code || '').toUpperCase());
        if (!r) return send(ws, { t: 'error', message: 'No game with that code' });
        if (r.guest) return send(ws, { t: 'error', message: 'That game already has two players' });   // a guest who dropped out rejoins with their key
        room = r; team = 1; r.guest = true; r.players[1] = ws; r.names[1] = String(m.name || '').slice(0, 24); r.screens[1] = m.screen || null;
        send(ws, { t: 'room', code: r.code, team, key: r.keys[1], names: r.names, screens: r.screens, lobby: r.lobby });
        send(r.players[0], { t: 'joined', names: r.names, screens: r.screens });
      } else if (m.t === 'rejoin' && !room) {
        const r = rooms.get(String(m.code || '').toUpperCase()), tm = m.team === 1 ? 1 : 0;
        if (!r || r.over || r.keys[tm] !== m.key) return send(ws, { t: 'error', message: 'That game is over' });
        if (r.players[tm]) r.players[tm].close();
        room = r; team = tm; r.players[tm] = ws;
        send(ws, { t: 'catchup', code: r.code, team, names: r.names, setup: r.setup, turns: r.turns });
        send(r.players[1 - tm], { t: 'back', team });
      } else if (m.t === 'name' && room) {
        room.names[team] = String(m.name || '').slice(0, 24);
        for (const p of room.players) send(p, { t: 'names', names: room.names });
      } else if (m.t === 'lobby' && room && team === 0) {
        room.lobby = m.lobby;
        send(other(), { t: 'lobby', lobby: m.lobby });
      } else if ((m.t === 'ping' || m.t === 'pong' || m.t === 'rematch') && room) {
        send(other(), m);
      } else if (m.t === 'over' && room) {
        room.over = true;
      } else if (m.t === 'start' && room && team === 0) {
        room.setup = m.setup; room.turns = [[], []]; room.over = false;
        for (const p of room.players) send(p, { t: 'start', setup: m.setup });
      } else if (m.t === 'turn' && room && room.setup && m.id === room.setup.id) {   // a late turn from an earlier match is dropped
        room.turns[team][m.n] = m.orders;
        send(other(), { t: 'turn', id: m.id, n: m.n, orders: m.orders });
      } else if (m.t === 'sum' && room) {
        send(other(), { t: 'sum', id: m.id, n: m.n, sum: m.sum });
      }
    });
    ws.on('close', () => {
      if (!room || room.players[team] !== ws) return;
      room.players[team] = null;
      send(other(), { t: 'left', team });
    });
  });

  // rooms nobody has used for half an hour are forgotten
  const sweep = setInterval(() => {
    for (const [code, r] of rooms) if (Date.now() - r.seen > IDLE_MS && !r.players.some(Boolean)) rooms.delete(code);
  }, 60 * 1000);
  sweep.unref();

  return new Promise(res => server.listen(port, () => res({
    port: server.address().port, rooms,
    close: () => new Promise(done => { clearInterval(sweep); for (const c of wss.clients) c.terminate(); wss.close(); server.close(() => done()); }),
  })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await start({ port: +process.env.PORT || 8080, site: process.env.SITE || undefined });
  console.log(`Frontlines on http://localhost:${s.port}`);
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => s.close().then(() => process.exit(0)));   // docker stop
}
