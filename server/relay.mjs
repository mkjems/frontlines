// The Frontlines server: serves the built game (site/) and, on /ws, the relay for two-player matches.
// See docs/multiplayer.md. Both browsers run the whole battle; the relay only passes each player's turns
// (the orders for 50 ms of play) and checksums to the other, and keeps a room's turns so that a player who
// drops out can rejoin and replay the battle up to now. It never runs a game itself.
//
//   node relay.mjs                      serves ../site on port 8080 (PORT and SITE override)
//   import { start } from './relay.mjs' tests start it on a free port, optionally with a delay per message
//
// A room: players[team] (socket, or null while away), keys[team] (to rejoin), names, setup (what the host
// started: map, board, match), turns[team][n] (every turn so far, for rejoining) and guest (someone joined).
//
// Messages are JSON, { t: type, ... }:
//   from a player  host {name} · join {code, name} · rejoin {code, team, key} · start {setup} (host only)
//                  turn {n, orders} · sum {n, sum}
//   to a player    room {code, team, key, names} · joined {names} · start {setup} · turn/sum (the other's)
//                  catchup {setup, turns} (after a rejoin) · left {team} · back {team} · error {message}

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

export function start({ port = 8080, site = fileURLToPath(new URL('../site/', import.meta.url)), delay = 0 } = {}) {
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
  const send = (ws, msg) => { if (ws && ws.readyState === 1) setTimeout(() => ws.send(JSON.stringify(msg)), delay); };
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
        room = { code, guest: false, players: [ws, null], keys: [randomBytes(8).toString('hex'), randomBytes(8).toString('hex')], names: [String(m.name || '').slice(0, 24), ''], setup: null, turns: [[], []], seen: Date.now() };
        rooms.set(code, room); team = 0;
        send(ws, { t: 'room', code, team, key: room.keys[0], names: room.names });
      } else if (m.t === 'join' && !room) {
        const r = rooms.get(String(m.code || '').toUpperCase());
        if (!r) return send(ws, { t: 'error', message: 'No game with that code' });
        if (r.guest) return send(ws, { t: 'error', message: 'That game already has two players' });   // a guest who dropped out rejoins with their key
        room = r; team = 1; r.guest = true; r.players[1] = ws; r.names[1] = String(m.name || '').slice(0, 24);
        send(ws, { t: 'room', code: r.code, team, key: r.keys[1], names: r.names, setup: r.setup });
        send(r.players[0], { t: 'joined', names: r.names });
      } else if (m.t === 'rejoin' && !room) {
        const r = rooms.get(String(m.code || '').toUpperCase()), tm = m.team === 1 ? 1 : 0;
        if (!r || r.keys[tm] !== m.key) return send(ws, { t: 'error', message: 'That game is over' });
        if (r.players[tm]) r.players[tm].close();
        room = r; team = tm; r.players[tm] = ws;
        send(ws, { t: 'catchup', code: r.code, team, names: r.names, setup: r.setup, turns: r.turns });
        send(r.players[1 - tm], { t: 'back', team });
      } else if (m.t === 'start' && room && team === 0) {
        room.setup = m.setup; room.turns = [[], []];
        for (const p of room.players) send(p, { t: 'start', setup: m.setup });
      } else if (m.t === 'turn' && room && room.setup) {
        room.turns[team][m.n] = m.orders;
        send(other(), { t: 'turn', n: m.n, orders: m.orders });
      } else if (m.t === 'sum' && room) {
        send(other(), { t: 'sum', n: m.n, sum: m.sum });
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
