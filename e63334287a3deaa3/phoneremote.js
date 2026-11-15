/*
 * Phone remote (hidden and experimental: nothing links to it, see README).
 *
 * Lets a phone act as a tilt controller for a Back Room game running on a computer. One file, two halves:
 *
 *   PhoneRemote.host(opts)   on the computer, inside a game. Makes a pairing code, shows a small panel with the code,
 *                            the address to open on the phone and a QR code for it, listens for the phone and gives
 *                            the game a simple state to read each frame:
 *                              r.connected          true while a phone is paired and sending
 *                              r.steer              -1 (left) to 1 (right), from tilting the phone
 *                              r.tilt, r.pitch      the same tilt in degrees, and forward/back pitch in degrees
 *                              r.pointer            {x, y} from 0 to 1 (where the phone points), or null
 *                              r.a, r.b, r.c        true while that button is held
 *                              r.pressed('a')       true once for each new press (a quick tap is never missed); ask
 *                                                   every frame: presses that arrive while nobody is asking
 *                                                   (in a menu, say) are dropped
 *                              r.delay              roughly how many milliseconds behind the phone's updates arrive
 *                              r.close()            leave the pairing and remove the panel
 *                            opts: game (name shown on the phone), labels {a, b, c} (shown under the phone's
 *                            buttons), maxTilt (degrees for full lock, default 35), deadzone (degrees, default 2.5).
 *   PhoneRemote.phone(opts)  on the phone, used only by remote/index.html.
 *
 * A game loads this file only when its address has ?remote=1, so for everyone else nothing here is downloaded or run.
 *
 * How it travels: there is no server of our own (the site is static), so the two browsers meet in the same Firebase
 * Realtime Database the multiplayer games use, in a room named rooms/pr-<code> (prefix "pr", not an invite prefix
 * and not routed from the home page). The shared rules only let a browser write its own node,
 * rooms/pr-<code>/players/<uid>, and need n, c, x, z, h and ts in it (x, z, h always 0 here), so:
 *   the computer's node:  n 'Computer', r 'h', g game name, lb 'A label|B label|C label', p the uid of the phone
 *                         it is listening to ('' when none), q a number it changes every 2 s (see below)
 *   the phone's node:     n 'Phone', r 'p', m 'seq,tilt*10,pitch,px,py,held,nA,nB,nC,q' (px/py are 0 to 1000, or -1
 *                         without a pointer; held is a bit mask A=1 B=2 C=4; nA/nB/nC count presses, so a tap that
 *                         starts and ends between two updates is still seen; q is the computer's q sent back)
 * Both nodes are removed when their page closes (onDisconnect). The phone the computer is listening to sends at
 * most about 22 motion updates a second and only while the tilt is changing, button changes straight away (at most
 * 30 a second in all), and one update every 1.5 s while still, which is how the computer knows it is still there.
 * A phone that is waiting its turn only sends that one update every 1.5 s.
 *
 * Delay: each update goes phone -> Firebase -> computer, so expect roughly 60 to 150 ms on good Wi-Fi and more
 * (with the odd stall of a second) on a busy network: fine for steering a kart, too slow for anything that needs a
 * quick flick. The panel shows a measured figure: the computer changes q, the phone sends it straight back, and
 * half the round trip is the delay (the two devices' clocks are never compared, because they don't agree).
 *
 * The motion maths marked "adapted" below (phone attitude to body axes, tilt from those axes, the One Euro filter,
 * and the way orientation events are chosen and the permission is asked for) is adapted from Patrick Sun's
 * open-source phone motion controller, https://github.com/pattssun/OpenWii (core/orientation.js, core/filter.js,
 * public/controller.js), used under the MIT licence below. Nothing else from that project is used: no games,
 * models, sounds, images, fonts or names. The pairing, the Firebase messages, the sideways grip, the pointer, the
 * panel and the QR code are this site's own.
 *
 *   MIT License
 *
 *   Copyright (c) 2026 Patrick Sun
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
 */
(function () {
  'use strict';
  if (window.PhoneRemote) return;

  var SCRIPT = document.currentScript && document.currentScript.src;
  var DIR = SCRIPT ? new URL('.', SCRIPT).href : new URL('/e63334287a3deaa3/', location.href).href;

  // =====================================================================
  //  Motion maths
  // =====================================================================
  var DEG = Math.PI / 180, TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrapDeg(a) { while (a > 180) a -= 360; while (a <= -180) a += 360; return a; }

  /*
   * Adapted from Patrick Sun's core/orientation.js (MIT licence and link at the top of this file).
   * The phone reports alpha, beta, gamma (W3C: rotate about z, then x, then y). This turns them into the phone's
   * three body axes in world coordinates (z is up): x = right edge, y = top edge, z = out of the screen. Working
   * from the axes instead of the angles avoids the jumps the angles make when the phone is held on its side.
   */
  function bodyAxes(alpha, beta, gamma) {
    var z = alpha * DEG, x = beta * DEG, y = gamma * DEG;
    var cZ = Math.cos(z), sZ = Math.sin(z), cX = Math.cos(x), sX = Math.sin(x), cY = Math.cos(y), sY = Math.sin(y);
    return {
      x: { x: cZ * cY - sZ * sX * sY, y: sZ * cY + cZ * sX * sY, z: -cX * sY },
      y: { x: -sZ * cX, y: cZ * cX, z: sX },
      z: { x: cZ * sY + sZ * sX * cY, y: sZ * sY - cZ * sX * cY, z: cX * cY }
    };
  }

  /*
   * Adapted from Patrick Sun's core/orientation.js (MIT, see the top of this file). Tilt for a phone held upright or flat, pointing at the screen
   * like a TV remote: bank is the roll about the pointing direction (right edge dipped = positive = steer right),
   * pitch is how far the pointing direction is above the horizon. The pointing direction ("beam") is the top edge
   * or the back of the phone, whichever is nearer level. useY forces the choice (the pointer keeps one beam between
   * recentres so it doesn't jump).
   */
  function gripTilt(ax, useY) {
    var back = { x: -ax.z.x, y: -ax.z.y, z: -ax.z.z };
    if (useY == null) useY = Math.abs(ax.y.z) <= Math.abs(back.z);
    var fwd = useY ? ax.y : back;
    return { bank: -Math.asin(clamp(ax.x.z, -1, 1)) / DEG, pitch: Math.asin(clamp(fwd.z, -1, 1)) / DEG, beam: fwd, useY: useY };
  }

  /*
   * Adapted from Patrick Sun's core/filter.js (MIT, see the top of this file). The One Euro filter: smooths heavily while the value is nearly
   * still (hides sensor jitter) and hardly at all while it moves fast (so steering doesn't lag).
   */
  function OneEuro(minCutoff, beta, dCutoff) {
    this.minCutoff = minCutoff == null ? 1.4 : minCutoff;
    this.beta = beta == null ? 0.05 : beta;
    this.dCutoff = dCutoff == null ? 1 : dCutoff;
    this.x = null; this.dx = 0;
  }
  OneEuro.alpha = function (cutoff, dt) { var tau = 1 / (TAU * cutoff); return 1 / (1 + tau / dt); };
  OneEuro.prototype.filter = function (value, dt) {
    if (this.x === null) { this.x = value; return value; }
    var dRaw = (value - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (dRaw - this.dx);
    var cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  };
  OneEuro.prototype.reset = function () { this.x = null; this.dx = 0; };

  /*
   * This site's own: turns a stream of orientation readings into what a game wants.
   *
   * Two ways to hold the phone:
   *   'side'  sideways in both hands like a steering wheel, screen towards you (anywhere from upright to flat in
   *           your lap). Tilt is how far one end of the phone is above the other. Which end is the player's left
   *           is read from gravity (whichever way the phone's right edge points, up or down) whenever the phone
   *           isn't lying flat, so it works either way round without trusting the browser's screen angle.
   *   'up'    upright or flat, top pointing at the screen. Tilt is the roll (gripTilt above).
   * grip 'auto' picks 'side' when the page is in landscape.
   *
   * The pointer is where the beam points compared with where it pointed at the last recentre: turning the phone
   * 25 degrees left or right, or 15 up or down, reaches the edges. It leans on the phone's compass angle (alpha),
   * which drifts slowly on some phones; recentre() fixes it.
   */
  function Motion(opts) {
    opts = opts || {};
    this.grip = opts.grip || 'auto';
    this.flip = false;
    this.spanX = opts.spanX || 50; this.spanY = opts.spanY || 30;
    this.sideSign = 0;
    this.fTilt = new OneEuro(2.5, 0.08); this.fPitch = new OneEuro(1.5, 0.05);
    this.fAz = new OneEuro(1.4, 0.05); this.fEl = new OneEuro(1.4, 0.05);
    this.ref = null; this.t = null;
    this.out = { tilt: 0, pitch: 0, px: -1, py: -1, grip: 'up' };
  }
  Motion.prototype.recentre = function () { this.ref = null; this.fAz.reset(); this.fEl.reset(); };
  Motion.prototype.setGrip = function (g) { this.grip = g; this.recentre(); this.fTilt.reset(); this.fPitch.reset(); };
  // alpha/beta/gamma in degrees; landscape: is the page wider than tall; angle: the screen's rotation (90 or 270
  // in landscape) if the browser says, used only until gravity has told us which way round the phone is; tMs: time.
  Motion.prototype.sample = function (alpha, beta, gamma, landscape, angle, tMs) {
    var hasAlpha = typeof alpha === 'number' && isFinite(alpha);
    var ax = bodyAxes(hasAlpha ? alpha : 0, beta || 0, gamma || 0);
    var grip = this.grip === 'auto' ? (landscape ? 'side' : 'up') : this.grip;
    var tilt, pitch, beam;
    if (grip === 'side') {
      if (Math.abs(ax.x.z) > 0.3) this.sideSign = ax.x.z > 0 ? 1 : -1;
      else if (!this.sideSign) this.sideSign = (angle === 270 || angle === -90) ? -1 : 1;
      tilt = this.sideSign * Math.asin(clamp(ax.y.z, -1, 1)) / DEG;
      beam = { x: -ax.z.x, y: -ax.z.y, z: -ax.z.z };
      pitch = Math.asin(clamp(beam.z, -1, 1)) / DEG;
    } else {
      // The pointer keeps the beam it had at the last recentre, unless that beam now points nearly straight up or
      // down (the phone was picked up or laid flat), where its direction means nothing: then start again.
      var keep = this.ref && this.ref.grip === 'up' ? this.ref.useY : null;
      var g = gripTilt(ax, keep);
      if (keep !== null && Math.abs(g.beam.z) > 0.9) { this.ref = null; g = gripTilt(ax, null); }
      tilt = g.bank; pitch = g.pitch; beam = g.beam; this._useY = g.useY;
    }
    if (this.flip) tilt = -tilt;
    var dt = this.t === null ? 1 / 60 : clamp((tMs - this.t) / 1000, 0.002, 0.25);
    this.t = tMs;
    var o = this.out;
    o.grip = grip;
    o.tilt = this.fTilt.filter(tilt, dt);
    o.pitch = this.fPitch.filter(pitch, dt);
    if (hasAlpha) {
      var az = Math.atan2(beam.y, beam.x) / DEG, el = Math.asin(clamp(beam.z, -1, 1)) / DEG;
      if (!this.ref || this.ref.grip !== grip) { this.ref = { az: az, el: el, grip: grip, useY: this._useY }; this.fAz.reset(); this.fEl.reset(); }
      var dAz = this.fAz.filter(wrapDeg(this.ref.az - az), dt), dEl = this.fEl.filter(el - this.ref.el, dt);
      o.px = clamp(0.5 + dAz / this.spanX, 0, 1);
      o.py = clamp(0.5 - dEl / this.spanY, 0, 1);
    } else { o.px = o.py = -1; }
    return o;
  };

  // Tilt in degrees to steering from -1 to 1, with a small dead zone so a level phone drives straight.
  function steerFrom(tilt, maxTilt, deadzone) {
    var a = Math.abs(tilt);
    if (a <= deadzone) return 0;
    return clamp((a - deadzone) / (maxTilt - deadzone), 0, 1) * (tilt < 0 ? -1 : 1);
  }

  // =====================================================================
  //  Reading the phone's sensors (phone page only)
  // =====================================================================
  /*
   * Adapted from Patrick Sun's public/controller.js (MIT, see the top of this file): ask for motion access from inside a tap (iPhones need that,
   * and every phone needs https), ignore empty readings, and stay on one stream of events, because Android sends
   * both 'deviceorientation' and 'deviceorientationabsolute' and mixing the two makes the compass angle jump.
   * Here the plain stream is preferred (it's the smoother one) and the absolute one is only used if the plain one
   * stays silent.
   */
  function askMotion() {
    if (window.isSecureContext !== true) return Promise.reject(new Error('insecure'));
    if (typeof DeviceOrientationEvent === 'undefined') return Promise.reject(new Error('unsupported'));
    var p;
    try {
      p = typeof DeviceOrientationEvent.requestPermission === 'function' ? DeviceOrientationEvent.requestPermission() : Promise.resolve('granted');
    } catch (e) { p = Promise.reject(e); }
    return p.then(function (s) { if (s !== 'granted') throw new Error('denied'); }, function () { throw new Error('denied'); });
  }
  function watchOrientation(cb) {
    var source = null, got = 0;
    function on(e) {
      if (e.alpha === null && e.beta === null && e.gamma === null) return;
      if (source === null) source = e.type;
      if (e.type !== source) return;
      got++;
      cb(e.alpha, e.beta, e.gamma);
    }
    window.addEventListener('deviceorientation', on, true);
    var late = setTimeout(function () { if (!got) window.addEventListener('deviceorientationabsolute', on, true); }, 1500);
    return {
      count: function () { return got; },
      stop: function () { clearTimeout(late); window.removeEventListener('deviceorientation', on, true); window.removeEventListener('deviceorientationabsolute', on, true); }
    };
  }

  // =====================================================================
  //  The connection: the site's Firebase Realtime Database (same project and rules as the games)
  // =====================================================================
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyDZD_Ku8cixteXfwkDYzGv3GKiZFF8sRSM",
    authDomain: "rumblekarts.firebaseapp.com",
    databaseURL: "https://rumblekarts-default-rtdb.firebaseio.com",
    projectId: "rumblekarts",
    storageBucket: "rumblekarts.firebasestorage.app",
    messagingSenderId: "910009166464",
    appId: "1:910009166464:web:cb0f8872c8f06749fc9465"
  };
  var FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var PREFIX = 'pr-';
  var CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // no i, l, o, 0 or 1: they look alike
  var CODE_LEN = 5;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function withTimeout(p, ms, msg) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error(msg)); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  function newCode() {
    var a = new Uint8Array(CODE_LEN * 2), s = '', i = 0;
    while (s.length < CODE_LEN) {
      if (i >= a.length || i === 0) { crypto.getRandomValues(a); i = 0; }
      var v = a[i++] & 31;
      if (v < CODE_CHARS.length) s += CODE_CHARS[v];
    }
    return s;
  }
  function cleanCode(s) {
    s = String(s || '').toLowerCase().replace(/^#/, '').replace(/^pr-/, '').replace(/[^a-z0-9]/g, '');
    return s.length === CODE_LEN ? s : '';
  }

  // One small interface, so the tests can swap in a fake (Playwright only: see the bottom of this file).
  //   start() -> Promise          sign in
  //   uid(), now()                this browser's id; the server's clock in ms
  //   join(room, onPlayers, onLink)   onPlayers({uid: node}) on every change; onLink(true|false) as the link comes and goes
  //   set(node) -> Promise        write this browser's own node
  //   leave()
  function firebaseTransport() {
    var db = null, uid = null, offset = 0, players = null, me = null, info = null;
    return {
      start: function () {
        var p = Promise.resolve();
        if (!window.firebase || !firebase.database || !firebase.auth) {
          p = loadScript(FIREBASE_SDK + 'firebase-app-compat.js')
            .then(function () { return loadScript(FIREBASE_SDK + 'firebase-auth-compat.js'); })
            .then(function () { return loadScript(FIREBASE_SDK + 'firebase-database-compat.js'); });
        }
        return p.then(function () {
          if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
          var a = firebase.auth();
          return withTimeout(new Promise(function (r) { var off = a.onAuthStateChanged(function () { off(); r(); }); })
            .then(function () { return a.currentUser || a.signInAnonymously(); }), 25000, 'Signing in timed out');
        }).then(function () {
          uid = firebase.auth().currentUser.uid; db = firebase.database();
          db.ref('.info/serverTimeOffset').on('value', function (s) { offset = s.val() || 0; });
        });
      },
      uid: function () { return uid; },
      now: function () { return Date.now() + offset; },
      join: function (room, onPlayers, onLink) {
        players = db.ref('rooms/' + room + '/players'); me = players.child(uid);
        players.on('value', function (s) { onPlayers(s.val() || {}); });
        info = db.ref('.info/connected');
        info.on('value', function (s) {
          if (s.val()) me.onDisconnect().remove().then(function () { onLink(true); }, function () { onLink(true); });
          else onLink(false);
        });
      },
      set: function (node) { return me ? me.set(node) : Promise.reject(new Error('not joined')); },
      leave: function () {
        try { if (players) players.off(); if (info) info.off(); if (me) { me.onDisconnect().cancel(); me.remove(); } } catch (e) {}
        players = me = info = null;
      }
    };
  }
  function pickTransport(opts) {
    if (opts && opts.transport) return opts.transport;
    if (navigator.webdriver && typeof window.__prTransport === 'function') return window.__prTransport();
    return firebaseTransport();
  }
  // The six fields the shared rules need in every node.
  function baseNode(name, now) { return { n: name, c: '#38b6ff', x: 0, z: 0, h: 0, ts: Math.round(now) }; }

  function parseMotion(m) {
    var p = String(m == null ? '' : m).split(',');
    if (p.length < 9) return null;
    var v = [];
    for (var i = 0; i < 9; i++) { var n = +p[i]; if (!isFinite(n)) return null; v.push(n); }
    var q = +p[9];
    return {
      seq: v[0], tilt: clamp(v[1] / 10, -90, 90), pitch: clamp(v[2], -90, 90),
      px: v[3] < 0 ? -1 : clamp(v[3] / 1000, 0, 1), py: v[4] < 0 ? -1 : clamp(v[4] / 1000, 0, 1),
      held: v[5] & 7, n: [v[6] | 0, v[7] | 0, v[8] | 0], q: isFinite(q) ? q : 0
    };
  }

  // =====================================================================
  //  A small QR code maker (this site's own), enough for the phone page's address:
  //  byte mode, error correction level L, versions 1 to 5 (up to 106 characters). Returns rows of 0/1, or null.
  // =====================================================================
  function qrMatrix(text) {
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(String(text))), i, j, x, y;
    var CAP = [0, 17, 32, 53, 78, 106], DATA = [0, 19, 34, 55, 80, 108], ECC = [0, 7, 10, 15, 20, 26];
    var v = 1; while (v <= 5 && bytes.length > CAP[v]) v++;
    if (v > 5) return null;
    var size = 17 + 4 * v, nData = DATA[v], nEcc = ECC[v];

    // the message: mode, length, the bytes, then padding
    var bits = [];
    function put(val, len) { for (var b = len - 1; b >= 0; b--) bits.push((val >>> b) & 1); }
    put(4, 4); put(bytes.length, 8);
    for (i = 0; i < bytes.length; i++) put(bytes[i], 8);
    put(0, Math.min(4, nData * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    var data = [];
    for (i = 0; i < bits.length; i += 8) { var c = 0; for (j = 0; j < 8; j++) c = c << 1 | bits[i + j]; data.push(c); }
    for (var pad = 0xEC; data.length < nData; pad ^= 0xEC ^ 0x11) data.push(pad);

    // Reed-Solomon error correction over GF(256)
    function mul(a, b) { var z = 0; for (var k = 7; k >= 0; k--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((b >>> k) & 1) * a; } return z & 255; }
    var gen = []; for (i = 0; i < nEcc; i++) gen.push(0); gen[nEcc - 1] = 1;
    var root = 1;
    for (i = 0; i < nEcc; i++) {
      for (j = 0; j < nEcc; j++) { gen[j] = mul(gen[j], root); if (j + 1 < nEcc) gen[j] ^= gen[j + 1]; }
      root = mul(root, 2);
    }
    var ecc = []; for (i = 0; i < nEcc; i++) ecc.push(0);
    for (i = 0; i < data.length; i++) {
      var f = data[i] ^ ecc.shift(); ecc.push(0);
      for (j = 0; j < nEcc; j++) ecc[j] ^= mul(gen[j], f);
    }
    var words = data.concat(ecc);

    // the fixed patterns
    var m = [], fn = [];
    for (y = 0; y < size; y++) { m.push(new Array(size).fill(0)); fn.push(new Array(size).fill(0)); }
    function setF(px, py, dark) { if (px < 0 || py < 0 || px >= size || py >= size) return; m[py][px] = dark ? 1 : 0; fn[py][px] = 1; }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var d = Math.max(Math.abs(dx), Math.abs(dy)); setF(cx + dx, cy + dy, d !== 2 && d !== 4); }
    }
    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    if (v >= 2) for (y = -2; y <= 2; y++) for (x = -2; x <= 2; x++) setF(size - 7 + x, size - 7 + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
    function format(mask) {
      var d = 1 << 3 | mask, rem = d; // level L
      for (var k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var b = (d << 10 | rem) ^ 0x5412, bit = function (n) { return (b >>> n) & 1; };
      for (k = 0; k <= 5; k++) setF(8, k, bit(k));
      setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
      for (k = 9; k < 15; k++) setF(14 - k, 8, bit(k));
      for (k = 0; k < 8; k++) setF(size - 1 - k, 8, bit(k));
      for (k = 8; k < 15; k++) setF(8, size - 15 + k, bit(k));
      setF(8, size - 8, 1);
    }
    format(0);

    // the message, zig-zagging up and down in pairs of columns from the bottom right
    var n = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        x = right - j; y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn[y][x] && n < words.length * 8) { m[y][x] = (words[n >>> 3] >>> (7 - (n & 7))) & 1; n++; }
      }
    }

    // try the eight masks and keep the one that scans best (lowest penalty)
    function maskAt(k, px, py) {
      switch (k) {
        case 0: return (px + py) % 2 === 0;
        case 1: return py % 2 === 0;
        case 2: return px % 3 === 0;
        case 3: return (px + py) % 3 === 0;
        case 4: return (Math.floor(px / 3) + Math.floor(py / 2)) % 2 === 0;
        case 5: return px * py % 2 + px * py % 3 === 0;
        case 6: return (px * py % 2 + px * py % 3) % 2 === 0;
        default: return ((px + py) % 2 + px * py % 3) % 2 === 0;
      }
    }
    function applyMask(k) { for (var py = 0; py < size; py++) for (var px = 0; px < size; px++) if (!fn[py][px] && maskAt(k, px, py)) m[py][px] ^= 1; }
    function penalty() {
      var p = 0, dark = 0, px, py, run, k;
      for (k = 0; k < 2; k++) for (py = 0; py < size; py++) {
        run = 1;
        var line = [];
        for (px = 0; px < size; px++) line.push(k ? m[px][py] : m[py][px]);
        for (px = 1; px <= size; px++) {
          if (px < size && line[px] === line[px - 1]) run++;
          else { if (run >= 5) p += run - 2; run = 1; }
        }
        var s = line.join('');
        for (px = 0; px + 11 <= size; px++) { var w = s.substr(px, 11); if (w === '10111010000' || w === '00001011101') p += 40; }
      }
      for (py = 0; py < size - 1; py++) for (px = 0; px < size - 1; px++) {
        var q = m[py][px];
        if (q === m[py][px + 1] && q === m[py + 1][px] && q === m[py + 1][px + 1]) p += 3;
      }
      for (py = 0; py < size; py++) for (px = 0; px < size; px++) dark += m[py][px];
      return p + Math.floor(Math.abs(dark * 20 / (size * size) - 10)) * 10;
    }
    var best = 0, bestP = Infinity;
    for (i = 0; i < 8; i++) { applyMask(i); format(i); var pn = penalty(); if (pn < bestP) { bestP = pn; best = i; } applyMask(i); }
    applyMask(best); format(best);
    return m;
  }
  function qrCanvas(text, px) {
    var m = qrMatrix(text);
    if (!m) return null;
    var n = m.length, quiet = 4, cell = Math.max(2, Math.floor(px / (n + quiet * 2))), w = cell * (n + quiet * 2);
    var cv = document.createElement('canvas'); cv.width = cv.height = w;
    var g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); g.fillStyle = '#000';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) g.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
    return cv;
  }

  // =====================================================================
  //  The computer's half
  // =====================================================================
  var STALE_MS = 4000;   // no update for this long: treat the phone as gone (it sends at least every 1.5 s)
  var ASKING_MS = 1000;  // a press only counts if the game asked pressed() within this long before it arrived
  var PING_MS = 2000;    // how often the computer measures the delay
  var KEYS = ['a', 'b', 'c'];

  function host(opts) {
    opts = opts || {};
    var maxTilt = opts.maxTilt || 35, deadzone = opts.deadzone == null ? 2.5 : opts.deadzone;
    var labels = opts.labels || {};
    var tr = pickTransport(opts), code = newCode(), room = PREFIX + code;
    var url = new URL('remote/', DIR).href + '#' + code;
    var phoneUid = '', lastAt = -1e9, last = null, counts = null, asked = { a: -1e9, b: -1e9, c: -1e9 }, waiting = { a: 0, b: 0, c: 0 };
    var cur = 0, curPitch = 0, curT = performance.now(), delay = 0, linked = false, closed = false, status = 'Connecting…', failed = false;
    var ui = null, timer = 0, sameBrowser = false, pingN = 0, pingAt = 0, pingNext = 0;

    function myNode() {
      var o = baseNode('Computer', tr.now());
      o.r = 'h'; o.g = String(opts.game || 'a game').slice(0, 24);
      o.lb = KEYS.map(function (k) { return String(labels[k] || '').replace(/\|/g, '').slice(0, 12); }).join('|');
      o.p = phoneUid; o.q = pingN;
      return o;
    }
    function connected() { return !closed && linked && !!phoneUid && !!last && performance.now() - lastAt < STALE_MS; }
    function onPlayers(all) {
      if (closed) return;
      // Both pages opened in one browser share one sign-in, so the phone page would be writing over this page's
      // node (a browser can only write its own). It can't work that way; say so instead of waiting for ever.
      var mine = all[tr.uid()];
      sameBrowser = !!(mine && mine.r === 'p');
      // Keep the phone we already listen to while it's there; otherwise take the one that has been waiting longest.
      var pick = '', pickTs = Infinity, id;
      if (phoneUid && all[phoneUid] && all[phoneUid].r === 'p') pick = phoneUid;
      else for (id in all) if (all[id] && all[id].r === 'p' && id !== tr.uid() && +all[id].ts < pickTs) { pick = id; pickTs = +all[id].ts; }
      if (pick !== phoneUid) {
        phoneUid = pick; last = null; counts = null; delay = 0; pingAt = 0;
        tr.set(myNode()).catch(function () {});
      }
      if (!phoneUid) { draw(); return; }
      var node = all[phoneUid], mo = parseMotion(node.m);
      if (!mo || (last && mo.seq === last.seq)) { draw(); return; }
      var now = performance.now();
      // presses are counted (up to 3 waiting), so two that land between two frames of a slow game are both seen
      if (counts) for (var i = 0; i < 3; i++) {
        var more = ((mo.n[i] - counts[i]) % 1000 + 1000) % 1000;
        if (more && now - asked[KEYS[i]] <= ASKING_MS) waiting[KEYS[i]] = Math.min(3, waiting[KEYS[i]] + more);
      }
      counts = mo.n; last = mo; lastAt = now;
      if (pingAt && mo.q === pingN) {
        var half = clamp((now - pingAt) / 2, 0, 5000);
        delay = delay ? delay + (half - delay) * 0.3 : half;
        pingAt = 0;
      }
      draw();
    }
    // Ease towards the newest tilt, so 20 updates a second don't look like 20 steps a second.
    function ease() {
      var now = performance.now(), dt = Math.min(0.25, (now - curT) / 1000), k = 1 - Math.exp(-dt / 0.035);
      curT = now;
      var on = connected();
      cur += ((on ? last.tilt : 0) - cur) * k;
      curPitch += ((on ? last.pitch : 0) - curPitch) * k;
    }

    var api = {
      code: code, url: url,
      get connected() { return connected(); },
      get tilt() { ease(); return cur; },
      get pitch() { ease(); return curPitch; },
      get steer() { ease(); return steerFrom(cur, maxTilt, deadzone); },
      get pointer() { return connected() && last.px >= 0 ? { x: last.px, y: last.py } : null; },
      get a() { return connected() && !!(last.held & 1); },
      get b() { return connected() && !!(last.held & 2); },
      get c() { return connected() && !!(last.held & 4); },
      get delay() { return Math.round(delay); },
      get status() { return status; },
      pressed: function (k) {
        asked[k] = performance.now();
        if (!connected()) { waiting[k] = 0; return false; }
        if (!waiting[k]) return false;
        waiting[k]--; return true;
      },
      close: function () {
        closed = true; clearInterval(timer); tr.leave();
        if (ui) { ui.root.remove(); ui = null; }
      }
    };

    // ---- the panel ----
    function build() {
      if (opts.panel === false || ui) return;
      if (!document.getElementById('prStyle')) {
        var st = document.createElement('style'); st.id = 'prStyle';
        st.textContent =
          '.pr-panel{position:fixed;z-index:2147483000;top:10px;right:10px;max-width:calc(100vw - 20px);box-sizing:border-box;' +
          'font:500 14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f4f6ff;background:rgba(14,17,38,.94);border:1px solid rgba(255,255,255,.18);' +
          'border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.45);padding:12px 14px;display:flex;gap:14px;align-items:center}' +
          '.pr-panel *{box-sizing:border-box}' +
          '.pr-panel canvas{display:block;width:132px;height:132px;border-radius:8px;image-rendering:pixelated;flex:none}' +
          '.pr-panel .pr-t{font-weight:700;font-size:15px;margin:0 0 4px}' +
          '.pr-panel .pr-x{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#ffd23a;margin-left:6px}' +
          '.pr-panel .pr-u{font:600 13px ui-monospace,Menlo,Consolas,monospace;color:#9fd8ff;word-break:break-all;user-select:all}' +
          '.pr-panel .pr-c{font:700 26px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.18em;color:#fff;user-select:all}' +
          '.pr-panel .pr-s{margin-top:6px;display:flex;align-items:center;gap:7px;color:rgba(244,246,255,.8)}' +
          '.pr-panel .pr-d{width:10px;height:10px;border-radius:50%;background:#ffb020;flex:none}' +
          '.pr-panel.on .pr-d{background:#3ddc84}.pr-panel.err .pr-d{background:#ff5d5d}' +
          '.pr-panel button{font:inherit;color:inherit;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:3px 9px;cursor:pointer;margin-left:8px}' +
          '.pr-panel button:hover{background:rgba(255,255,255,.2)}' +
          '.pr-panel.mini{padding:6px 10px;border-radius:999px;gap:8px;cursor:pointer;right:auto;left:50%;transform:translateX(-50%)}' +
          '.pr-panel.mini .pr-big{display:none}.pr-panel:not(.mini) .pr-small{display:none}' +
          '.pr-panel .pr-small{display:flex;align-items:center;gap:7px;font-size:13px}' +
          '@media (max-width:560px){.pr-panel:not(.mini){flex-direction:column;align-items:flex-start}}';
        document.head.appendChild(st);
      }
      var root = document.createElement('div'); root.className = 'pr-panel'; root.setAttribute('data-no-ad-refresh', '');
      var shown = new URL(url); var plain = shown.host + shown.pathname.replace(/\/$/, '');
      root.innerHTML =
        '<div class="pr-big pr-qr"></div>' +
        '<div class="pr-big"><p class="pr-t">Phone remote<span class="pr-x">experimental</span><button type="button" class="pr-hide" data-no-ad-refresh>Hide</button></p>' +
        '<div>On your phone, scan the code or open</div><div class="pr-u"></div>' +
        '<div>and type this code: <span class="pr-c"></span></div>' +
        '<div class="pr-s"><span class="pr-d"></span><span class="pr-st"></span></div></div>' +
        '<div class="pr-small"><span class="pr-d"></span><span class="pr-st"></span></div>';
      root.querySelector('.pr-u').textContent = plain;
      root.querySelector('.pr-c').textContent = code.toUpperCase();
      var qr = qrCanvas(url, 264);
      if (qr) root.querySelector('.pr-qr').appendChild(qr); else root.querySelector('.pr-qr').remove();
      root.querySelector('.pr-hide').addEventListener('click', function (e) { e.stopPropagation(); userMini = true; draw(); });
      root.addEventListener('click', function () { if (root.classList.contains('mini')) { userMini = false; draw(); } });
      (document.body || document.documentElement).appendChild(root);
      ui = { root: root, st: root.querySelectorAll('.pr-st') };
    }
    // The panel is open while waiting for a phone and folds to a small pill once one is driving. Hide, or a click
    // on the pill, overrides that until the phone next connects or drops.
    var userMini = null, wasOn = false;
    function draw() {
      var on = connected();
      status = failed ? status : !linked ? 'Connecting…' : on ? 'Phone connected' : sameBrowser ? 'Open the phone page on another device (or in a private window): it can’t share this browser' : phoneUid ? 'Phone not responding…' : 'Waiting for a phone…';
      if (!ui) return;
      if (on !== wasOn) { wasOn = on; userMini = null; }
      ui.root.classList.toggle('mini', userMini === null ? on : userMini);
      ui.root.classList.toggle('on', on);
      ui.root.classList.toggle('err', failed);
      var long = status + (on && delay ? ' · about ' + Math.round(delay / 10) * 10 + ' ms behind' : '');
      ui.st[0].textContent = long;
      ui.st[1].textContent = 'Phone remote: ' + long.charAt(0).toLowerCase() + long.slice(1);
    }

    build(); draw();
    tr.start().then(function () {
      if (closed) return;
      tr.join(room, onPlayers, function (up) {
        if (closed) return;
        if (up) tr.set(myNode()).then(function () { linked = true; failed = false; draw(); }, function (e) {
          failed = true; status = 'The database refused the pairing (' + (e && (e.code || e.message) || 'error') + ')'; draw();
        });
        else { linked = false; draw(); }
      });
      timer = setInterval(function () {
        // Measure the delay: change q in our node and time how long the phone takes to send it back.
        var now = performance.now();
        if (connected() && now >= pingNext) {
          pingNext = now + PING_MS; pingN = pingN % 999 + 1; pingAt = now;
          tr.set(myNode()).catch(function () {});
        }
        draw();
      }, 500);
    }).catch(function (e) { failed = true; status = 'Could not connect: ' + (e && e.message || 'error'); draw(); });
    return api;
  }

  // =====================================================================
  //  The phone's half (used by remote/index.html)
  // =====================================================================
  var MOTION_GAP = 45;     // ms between motion updates: about 22 a second
  var BUTTON_GAP = 34;     // ms between any two updates: at most about 30 a second
  var BEAT_MS = 1500;      // one update this often while nothing changes
  var MAX_PENDING = 4;     // unanswered writes before motion updates wait (button changes always go)

  function phone(opts) {
    opts = opts || {};
    var tr = pickTransport(opts), code = cleanCode(opts.code), room = PREFIX + code;
    var motion = new Motion(), watch = null;
    var held = 0, nPress = [0, 0, 0], seq = 0, echo = 0, dirty = true, lastSend = -1e9, sentTilt = 0, sentPitch = 0, sentPx = -1, sentPy = -1, pending = 0, sendTimer = 0, beat = 0, closed = false;
    var s = {
      code: code, net: 'connecting',      // connecting, online, offline, error
      error: '', host: null,              // {game, labels: [a, b, c]} once the computer's node is seen
      inControl: false, busy: false,      // busy: the computer is listening to a different phone
      motion: 'off',                      // off, asking, on, silent (allowed but no readings), denied, insecure, unsupported
      tilt: 0, pitch: 0, px: -1, py: -1, grip: 'up', sent: 0
    };

    function line() {
      var o = motion.out, on = s.motion === 'on';
      return [seq, on ? Math.round(o.tilt * 10) : 0, on ? Math.round(o.pitch) : 0,
        on && o.px >= 0 ? Math.round(o.px * 1000) : -1, on && o.py >= 0 ? Math.round(o.py * 1000) : -1,
        held, nPress[0], nPress[1], nPress[2], echo].join(',');
    }
    function send() {
      if (closed || s.net !== 'online') return;
      var o = motion.out;
      seq = (seq + 1) % 1000000; dirty = false; lastSend = performance.now();
      sentTilt = o.tilt; sentPitch = o.pitch; sentPx = o.px; sentPy = o.py;
      var node = baseNode('Phone', tr.now()); node.r = 'p'; node.m = line();
      pending++; s.sent++;
      tr.set(node).then(function () { pending = Math.max(0, pending - 1); }, function (e) {
        pending = Math.max(0, pending - 1);
        if (e && /permission/i.test(e.code || e.message || '')) { s.net = 'error'; s.error = 'The database refused this phone.'; }
      });
    }
    // Called on every sensor reading, button change and timer tick: decides whether anything is worth sending now.
    function pump() {
      if (closed || s.net !== 'online') return;
      var now = performance.now(), since = now - lastSend, o = motion.out;
      // Until the computer says it is listening to this phone, only say "still here".
      if (!s.inControl) { if (since >= BEAT_MS) send(); return; }
      if (dirty) {
        if (since >= BUTTON_GAP) send();
        else if (!sendTimer) sendTimer = setTimeout(function () { sendTimer = 0; pump(); }, BUTTON_GAP - since + 1);
        return;
      }
      if (since >= BEAT_MS) { send(); return; }
      if (s.motion !== 'on' || since < MOTION_GAP || pending >= MAX_PENDING) return;
      if (Math.abs(o.tilt - sentTilt) >= 0.4 || Math.abs(o.pitch - sentPitch) >= 1.5 ||
          Math.abs(o.px - sentPx) >= 0.004 || Math.abs(o.py - sentPy) >= 0.004) send();
    }
    function onReading(alpha, beta, gamma) {
      var w = window.innerWidth, h = window.innerHeight;
      var ang = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : window.orientation;
      var o = motion.sample(alpha, beta, gamma, w > h, ang, performance.now());
      s.motion = 'on'; s.tilt = o.tilt; s.pitch = o.pitch; s.px = o.px; s.py = o.py; s.grip = o.grip;
      pump();
    }
    function onPlayers(all) {
      var hostNode = null, id;
      for (id in all) if (all[id] && all[id].r === 'h') { hostNode = all[id]; break; }
      if (!hostNode) { s.host = null; s.inControl = false; s.busy = false; return; }
      var lb = String(hostNode.lb || '').split('|');
      s.host = { game: String(hostNode.g || 'a game').slice(0, 24), labels: [0, 1, 2].map(function (i) { return String(lb[i] || '').slice(0, 12); }) };
      var mine = hostNode.p === tr.uid(), q = +hostNode.q || 0;
      s.busy = !!hostNode.p && !mine;
      if (mine && (!s.inControl || q !== echo)) { s.inControl = true; echo = q; dirty = true; pump(); }
      s.inControl = mine;
    }

    var api = {
      state: s,
      // Call from inside a tap (iPhones only ask for motion access then). Resolves either way; see state.motion.
      startMotion: function () {
        if (watch) return Promise.resolve();
        s.motion = 'asking';
        return askMotion().then(function () {
          watch = watchOrientation(onReading);
          s.motion = 'silent';
        }, function (e) { s.motion = /insecure|unsupported/.test(e.message) ? e.message : 'denied'; });
      },
      // For the tests and for a phone with no sensors: feed a reading by hand.
      feed: onReading,
      button: function (k, down) {
        var i = KEYS.indexOf(k); if (i < 0) return;
        var bit = 1 << i, was = held;
        held = down ? held | bit : held & ~bit;
        if (held === was) return;
        if (down) nPress[i] = (nPress[i] + 1) % 1000;
        dirty = true; pump();
      },
      releaseAll: function () { if (held) { held = 0; dirty = true; pump(); } },
      recentre: function () { motion.recentre(); },
      setGrip: function (g) { motion.setGrip(g); },
      grip: function () { return motion.grip; },
      flip: function () { motion.flip = !motion.flip; return motion.flip; },
      leave: function () { closed = true; clearInterval(beat); clearTimeout(sendTimer); if (watch) watch.stop(); tr.leave(); }
    };

    if (!code) { s.net = 'error'; s.error = 'That code doesn’t look right.'; return api; }
    tr.start().then(function () {
      if (closed) return;
      tr.join(room, onPlayers, function (up) {
        if (closed || s.net === 'error') return;
        s.net = up ? 'online' : 'offline';
        if (up) { dirty = true; pending = 0; pump(); }
      });
      beat = setInterval(pump, 250);
    }).catch(function (e) { s.net = 'error'; s.error = 'Could not connect: ' + (e && e.message || 'error'); });
    return api;
  }

  window.PhoneRemote = {
    host: host, phone: phone, cleanCode: cleanCode, CODE_LEN: CODE_LEN,
    math: { bodyAxes: bodyAxes, gripTilt: gripTilt, OneEuro: OneEuro, Motion: Motion, steerFrom: steerFrom, parseMotion: parseMotion },
    qrMatrix: qrMatrix
  };
})();
