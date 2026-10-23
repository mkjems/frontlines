// Phase 0 of docs/multiplayer.md: do browsers' maths functions give bit-identical results?
// Prints a fingerprint of each function's results over many inputs of the sizes the game uses. Run it in two
// JavaScript engines and compare the output (macOS has Safari's engine built in):
//   node math-engines.js > v8.txt
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc math-engines.js > jsc.txt
//   diff v8.txt jsc.txt
// Each line: function, how many inputs, a hash of all results, then the first few inputs whose results'
// bits are listed, so two engines' lines can be compared input by input.

var out = typeof print === 'function' ? print : console.log;
var f = new Float64Array(1), w = new Uint32Array(f.buffer);
function bits(v) { f[0] = v; return w[1].toString(16) + ':' + w[0].toString(16); }
var x = 7;   // mulberry32, so both engines get the same inputs
function r() { x = (x + 0x6d2b79f5) >>> 0; var t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

var N = 200000;
var cases = {
  sin: function () { var a = (r() - 0.5) * 40; return [a, Math.sin(a)]; },
  cos: function () { var a = (r() - 0.5) * 40; return [a, Math.cos(a)]; },
  atan2: function () { var y = (r() - 0.5) * 2000, z = (r() - 0.5) * 2000; return [y + '/' + z, Math.atan2(y, z)]; },
  hypot: function () { var a = (r() - 0.5) * 2000, b = (r() - 0.5) * 2000; return [a + ',' + b, Math.hypot(a, b)]; },
  sqrt: function () { var a = r() * 4e6; return [a, Math.sqrt(a)]; },
  exp: function () { var a = (r() - 0.5) * 20; return [a, Math.exp(a)]; },
  'x**2': function () { var a = (r() - 0.5) * 3000; return [a, a ** 2]; },
  'x**2==x*x': function () { var a = (r() - 0.5) * 3000; return [a, a ** 2 === a * a ? 1 : 0]; },
  '1.5**n': function () { var n = (r() * 30) | 0; return [n, 1.5 ** n]; },
  'sqrt(x*x+y*y)': function () { var a = (r() - 0.5) * 2000, b = (r() - 0.5) * 2000; return [a + ',' + b, Math.sqrt(a * a + b * b)]; },
};
for (var name in cases) {
  var h = 2166136261, results = [];
  for (var i = 0; i < N; i++) {
    var c = cases[name](), b = bits(c[1]);
    for (var j = 0; j < b.length; j++) h = Math.imul(h ^ b.charCodeAt(j), 16777619) >>> 0;
    if (i % 2000 === 0) results.push(b);
  }
  out(name + ' ' + N + ' ' + h.toString(16) + ' ' + results.join(' '));
}
