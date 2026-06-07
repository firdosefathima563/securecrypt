import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, ResponsiveContainer, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from "recharts";

// ── RSA MATH ────────────────────────────────────────────────────────────────
function modPow(base, exp, mod) {
  if (mod === 1n) return 0n;
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % mod;
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}
function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
function modInverse(e, phi) {
  let [old_r, r] = [e, phi], [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % phi) + phi) % phi;
}
const SMALL_PRIMES = [2n,3n,5n,7n,11n,13n,17n,19n,23n,29n,31n,37n,41n,43n,47n,53n,59n,61n,67n,71n,73n,79n,83n,89n,97n,101n,103n,107n,109n,113n,127n,131n,137n,139n,149n,151n,157n,163n,167n,173n,179n,181n,191n,193n,197n,199n,211n,223n,227n,229n,233n,239n,241n,251n,257n,263n,269n,271n,277n,281n,283n];
function millerRabin(n) {
  if (n < 2n) return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n) return false;
  let d = n - 1n, r = 0n;
  while (d % 2n === 0n) { d /= 2n; r++; }
  for (const a of [2n,3n,5n,7n,11n,13n,17n,19n,23n,29n,31n,37n]) {
    if (a >= n) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let comp = true;
    for (let i = 0n; i < r - 1n; i++) { x = (x * x) % n; if (x === n - 1n) { comp = false; break; } }
    if (comp) return false;
  }
  return true;
}
function randomBigInt(bits) {
  const bytes = Math.ceil(bits / 8), arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr); arr[0] |= 0x80; arr[bytes-1] |= 0x01;
  return BigInt("0x" + Array.from(arr).map(b => b.toString(16).padStart(2,"0")).join(""));
}
function generatePrime(bits = 64) {
  while (true) { const c = randomBigInt(bits); if (millerRabin(c)) return c; }
}
function generateRSAKeys(bits = 32) {
  let p, q; do { p = generatePrime(bits); q = generatePrime(bits); } while (p === q);
  const n = p * q, phi = (p-1n)*(q-1n);
  let e = 65537n; while (gcd(e, phi) !== 1n) e += 2n;
  const d = modInverse(e, phi);
  return { p, q, n, e, d, phi };
}
function rsaEncrypt(message, e, n) {
  return Array.from(new TextEncoder().encode(message)).map(b => modPow(BigInt(b), e, n).toString());
}
function rsaDecrypt(chunks, d, n) {
  return new TextDecoder().decode(new Uint8Array(chunks.map(c => Number(modPow(BigInt(c), d, n)))));
}
function modPowSteps(base, exp, mod) {
  const steps = []; let result = 1n, b = base % mod, e = exp;
  steps.push({ step: 0, result: result.toString(), action: "Initialize result = 1" });
  let i = 1;
  while (e > 0n) {
    const bit = e % 2n;
    if (bit === 1n) { const prev = result; result = (result * b) % mod; steps.push({ step: i, result: result.toString(), action: `bit=1 → result=(${prev}×${b}) mod ${mod}=${result}` }); }
    else { steps.push({ step: i, result: result.toString(), action: `bit=0 → skip multiply, result stays ${result}` }); }
    e = e / 2n; b = (b * b) % mod; i++; if (i > 18) break;
  }
  return steps;
}

// ── LIGHT THEME PALETTE ──────────────────────────────────────────────────────
const C = {
  bg:        "#f0f4ff",
  bgAlt:     "#e8eeff",
  surface:   "#ffffff",
  glass:     "rgba(255,255,255,0.85)",
  border:    "rgba(99,102,241,0.18)",
  borderMid: "rgba(99,102,241,0.35)",
  indigo:    "#4f46e5",
  indigoDim: "#6366f1",
  indigoLight:"#e0e7ff",
  blue:      "#2563eb",
  teal:      "#0d9488",
  green:     "#059669",
  greenLight:"#d1fae5",
  red:       "#dc2626",
  redLight:  "#fee2e2",
  amber:     "#d97706",
  amberLight:"#fef3c7",
  purple:    "#7c3aed",
  purpleLight:"#ede9fe",
  pink:      "#db2777",
  text:      "#0f172a",
  textMid:   "#334155",
  muted:     "#64748b",
  mutedLight:"#94a3b8",
};

const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(79,70,229,0.07), 0 1px 4px rgba(0,0,0,0.04)",
};

const glassCard = {
  background: C.glass,
  border: `1px solid ${C.border}`,
  borderRadius: "20px",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  boxShadow: "0 4px 24px rgba(79,70,229,0.09)",
};

// ── SHARED UI ────────────────────────────────────────────────────────────────

function Tag({ children, color = C.indigo, bg = C.indigoLight }) {
  return (
    <span style={{
      background: bg, color, border: `1px solid ${color}30`,
      padding: "3px 12px", borderRadius: "999px",
      fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase"
    }}>{children}</span>
  );
}

function SectionHeading({ tag, title, subtitle, align = "center" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55 }}
      style={{ textAlign: align, marginBottom: "3rem" }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "1rem" }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.indigo, display: "inline-block" }} />
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.purple, display: "inline-block" }} />
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.teal, display: "inline-block" }} />
        <span style={{ color: C.indigo, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", letterSpacing: "0.14em", fontWeight: 600, textTransform: "uppercase", marginLeft: "4px" }}>{tag}</span>
      </div>
      <h2 style={{
        fontSize: "clamp(1.75rem, 3vw, 2.4rem)", fontWeight: 800,
        fontFamily: "'Sora', sans-serif", color: C.text,
        lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: "0.75rem"
      }}>{title}</h2>
      {subtitle && (
        <p style={{ color: C.muted, fontSize: "1rem", maxWidth: "520px", margin: align === "center" ? "0 auto" : "0", lineHeight: 1.7 }}>{subtitle}</p>
      )}
    </motion.div>
  );
}

function StatPill({ value, label, color = C.indigo }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${color}25`, borderRadius: "14px", padding: "1rem 1.5rem", textAlign: "center", boxShadow: `0 2px 12px ${color}15` }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color, lineHeight: 1 }}>{value}</div>
      <div style={{ color: C.muted, fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace", marginTop: "4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function KeyValRow({ label, value, color = C.indigo }) {
  return (
    <div style={{ background: C.bg, borderRadius: "10px", padding: "9px 14px", borderLeft: `3px solid ${color}` }}>
      <div style={{ color: C.muted, fontSize: "0.65rem", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>{label}</div>
      <div style={{ color: C.text, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", wordBreak: "break-all" }}>{String(value).length > 44 ? String(value).slice(0,44)+"…" : value}</div>
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled = false, fullWidth = false }) {
  const styles = {
    primary: { background: `linear-gradient(135deg, ${C.indigo}, ${C.purple})`, color: "#fff", border: "none" },
    success: { background: `linear-gradient(135deg, ${C.teal}, ${C.green})`, color: "#fff", border: "none" },
    danger:  { background: `linear-gradient(135deg, ${C.red}, #b91c1c)`, color: "#fff", border: "none" },
    outline: { background: "transparent", color: C.indigo, border: `1.5px solid ${C.indigo}` },
    ghost:   { background: C.indigoLight, color: C.indigo, border: `1px solid ${C.indigo}25` },
  };
  return (
    <motion.button whileHover={{ scale: disabled ? 1 : 1.025 }} whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={onClick} disabled={disabled}
      style={{ ...styles[variant], padding: "10px 22px", borderRadius: "10px", fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.85rem", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, width: fullWidth ? "100%" : "auto", transition: "box-shadow 0.2s", boxShadow: variant === "primary" ? `0 4px 18px ${C.indigo}35` : "none" }}>
      {children}
    </motion.button>
  );
}

// ── NAV ──────────────────────────────────────────────────────────────────────
const MORE_LINKS = [
  { id: "hero",     label: "🏠 Home",             desc: "Landing & threat overview" },
  { id: "modular",  label: "🔢 Modular Math",      desc: "Binary exponentiation visualizer" },
  { id: "primes",   label: "🔭 Primes",            desc: "Sieve & cryptographic prime gen" },
  { id: "demo",     label: "⚔️ Security Demo",     desc: "Plaintext vs encrypted attack sim" },
  { id: "analysis", label: "📊 Analysis",          desc: "Time & space complexity dashboard" },
  { id: "cipher",   label: "🔠 Caesar Cipher",     desc: "Classic cipher playground & brute-force" },
  { id: "password", label: "🛡️ Password Strength", desc: "Real-time entropy & security meter" },
];

function Nav({ active, setActive }) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);
  useEffect(() => {
    const h = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const go = id => { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setOpen(false); };

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
      background: "rgba(240,244,255,0.95)", backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}`,
      padding: "0 2rem", display: "flex", alignItems: "center", height: "62px",
      boxShadow: "0 1px 20px rgba(79,70,229,0.08)", gap: "0.75rem"
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "auto" }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${C.indigo},${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem", flexShrink: 0 }}>🔐</div>
        <span style={{ fontFamily: "'Sora',sans-serif", color: C.text, fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>SecureCrypt</span>
      </div>

      {/* RSA Simulator primary link */}
      <button onClick={() => go("simulator")}
        style={{ background: active === "simulator" ? C.indigoLight : "transparent", border: `1px solid ${active === "simulator" ? C.indigo + "40" : "transparent"}`, color: active === "simulator" ? C.indigo : C.muted, padding: "5px 14px", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", fontFamily: "'Sora',sans-serif", fontWeight: active === "simulator" ? 600 : 400, transition: "all 0.18s", whiteSpace: "nowrap" }}>
        RSA Simulator
      </button>

      {/* ··· three-dot dropdown */}
      <div ref={dropRef} style={{ position: "relative" }}>
        <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={() => setOpen(o => !o)}
          style={{ background: open ? C.indigoLight : C.surface, border: `1.5px solid ${open ? C.indigo + "60" : C.border}`, color: open ? C.indigo : C.muted, width: 40, height: 34, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "3px", transition: "all 0.18s", boxShadow: open ? `0 0 0 3px ${C.indigoLight}` : "none" }}>
          {[0, 1, 2].map(i => (
            <motion.span key={i} animate={{ background: open ? C.indigo : C.muted, scale: open ? 1.2 : 1 }}
              style={{ width: 4, height: 4, borderRadius: "50%", display: "block", transition: "background 0.2s" }} />
          ))}
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ position: "absolute", top: "calc(100% + 12px)", right: 0, width: 280, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: "0 24px 60px rgba(79,70,229,0.14),0 4px 16px rgba(0,0,0,0.06)", overflow: "hidden", zIndex: 300 }}>
              {/* Header */}
              <div style={{ padding: "12px 16px 8px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.indigo, display: "inline-block" }} />
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.purple, display: "inline-block" }} />
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.teal, display: "inline-block" }} />
                <span style={{ fontSize: "0.65rem", fontFamily: "'JetBrains Mono',monospace", color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginLeft: 4 }}>All Sections</span>
              </div>
              {/* Items */}
              {MORE_LINKS.map(l => (
                <motion.button key={l.id} onClick={() => go(l.id)} whileHover={{ background: C.bgAlt }}
                  style={{ width: "100%", padding: "10px 16px", background: active === l.id ? C.indigoLight : "transparent", border: "none", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 2, borderLeft: `3px solid ${active === l.id ? C.indigo : "transparent"}`, transition: "background 0.15s" }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: "0.83rem", fontWeight: active === l.id ? 700 : 500, color: active === l.id ? C.indigo : C.text }}>{l.label}</span>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: "0.68rem", color: C.muted }}>{l.desc}</span>
                </motion.button>
              ))}
              {/* Footer badge */}
              <div style={{ padding: "8px 16px 12px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 5px ${C.green}` }} />
                <span style={{ fontSize: "0.62rem", fontFamily: "'JetBrains Mono',monospace", color: C.muted, letterSpacing: "0.08em" }}>All computation runs locally</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => go("simulator")}
        style={{ background: `linear-gradient(135deg,${C.indigo},${C.purple})`, color: "#fff", border: "none", padding: "7px 18px", borderRadius: 10, fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", boxShadow: `0 4px 14px ${C.indigo}35`, whiteSpace: "nowrap" }}>
        Get Started →
      </motion.button>
    </nav>
  );
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function Hero() {
  const problems = [
    { icon: "📡", title: "Intercepted Packets", desc: "Plaintext traffic can be captured by anyone on the same network using basic tools.", color: C.red, bg: C.redLight },
    { icon: "🕵️", title: "Man-in-the-Middle", desc: "Attackers silently position between sender and receiver, reading and altering data.", color: C.amber, bg: C.amberLight },
    { icon: "🔓", title: "Unencrypted Protocols", desc: "HTTP, FTP, Telnet — legacy protocols expose credentials and full payload data.", color: C.purple, bg: C.purpleLight },
    { icon: "💾", title: "Data Breaches", desc: "Unencrypted stored data becomes an instant goldmine when servers are compromised.", color: C.blue, bg: C.indigoLight },
  ];

  return (
    <section id="hero" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 2rem 5rem", position: "relative", overflow: "hidden", background: `linear-gradient(160deg, #f0f4ff 0%, #e8eeff 40%, #f5f0ff 100%)` }}>

      {/* Decorative orbs */}
      <div style={{ position: "absolute", top: "10%", left: "8%", width: "320px", height: "320px", borderRadius: "50%", background: `radial-gradient(circle, ${C.indigo}18 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "15%", right: "6%", width: "260px", height: "260px", borderRadius: "50%", background: `radial-gradient(circle, ${C.purple}18 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "700px", height: "700px", borderRadius: "50%", background: `radial-gradient(circle, ${C.indigoLight} 0%, transparent 65%)`, pointerEvents: "none", opacity: 0.5 }} />

      {/* Subtle grid */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${C.indigo}09 1px, transparent 1px), linear-gradient(90deg, ${C.indigo}09 1px, transparent 1px)`, backgroundSize: "48px 48px", pointerEvents: "none" }} />

      {/* Floating particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div key={i}
          style={{ position: "absolute", left: `${8 + (i * 8) % 84}%`, top: `${10 + (i * 11) % 75}%`, width: `${4 + i % 5}px`, height: `${4 + i % 5}px`, borderRadius: "50%", background: [C.indigo, C.purple, C.teal][i % 3], opacity: 0.25, pointerEvents: "none" }}
          animate={{ y: [0, -18, 0], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 3 + i * 0.4, repeat: Infinity, delay: i * 0.25 }}
        />
      ))}

      <motion.div initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}
        style={{ textAlign: "center", maxWidth: "820px", position: "relative", zIndex: 1 }}>

        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "999px", padding: "6px 16px", marginBottom: "1.75rem", boxShadow: "0 2px 12px rgba(79,70,229,0.1)" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", color: C.muted, letterSpacing: "0.1em" }}>RSA · MILLER-RABIN · MODULAR EXPONENTIATION</span>
        </div>

        <h1 style={{ fontSize: "clamp(2.6rem, 6vw, 4.8rem)", fontWeight: 900, fontFamily: "'Sora', sans-serif", lineHeight: 1.08, letterSpacing: "-0.03em", color: C.text, marginBottom: "1.5rem" }}>
          The Internet is<br />
          <span style={{ background: `linear-gradient(135deg, ${C.red}, ${C.pink})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Dangerously Open.
          </span>
        </h1>

        <p style={{ color: C.muted, fontSize: "1.1rem", maxWidth: "560px", margin: "0 auto 2.25rem", lineHeight: 1.75, fontFamily: "'Sora', sans-serif" }}>
          Every unencrypted byte you transmit is readable by anyone watching. <strong style={{ color: C.indigo, fontWeight: 600 }}>SecureCrypt</strong> shows exactly how RSA public-key cryptography makes interception mathematically impossible.
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Btn onClick={() => document.getElementById("simulator")?.scrollIntoView({ behavior: "smooth" })}>
            Try the Simulator →
          </Btn>
          <Btn variant="outline" onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}>
            See Attack Demo
          </Btn>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "3rem", flexWrap: "wrap" }}>
          {[["2048+", "bit keys", C.indigo], ["10⁶¹⁷", "key space", C.purple], ["O(log n)", "encryption", C.teal]].map(([v, l, c]) => (
            <StatPill key={l} value={v} label={l} color={c} />
          ))}
        </div>
      </motion.div>

      {/* Problem cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(218px, 1fr))", gap: "1.25rem", maxWidth: "960px", width: "100%", marginTop: "4.5rem", position: "relative", zIndex: 1 }}>
        {problems.map((p, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.1 }}
            whileHover={{ y: -5, boxShadow: `0 12px 32px ${p.color}22` }}
            style={{ ...card, padding: "1.5rem", borderTop: `3px solid ${p.color}` }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", marginBottom: "0.9rem" }}>
              {p.icon}
            </div>
            <h3 style={{ color: p.color, fontFamily: "'Sora', sans-serif", fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.45rem" }}>{p.title}</h3>
            <p style={{ color: C.muted, fontSize: "0.8rem", lineHeight: 1.65, fontFamily: "'Sora', sans-serif" }}>{p.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── RSA SIMULATOR ─────────────────────────────────────────────────────────────
function RSASimulator() {
  const [message, setMessage] = useState("Hello, SecureCrypt!");
  const [keys, setKeys] = useState(null);
  const [ciphertext, setCiphertext] = useState(null);
  const [decrypted, setDecrypted] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [bits, setBits] = useState(32);

  const handleGenKeys = () => {
    setLoading(true);
    setTimeout(() => { setKeys(generateRSAKeys(bits)); setCiphertext(null); setDecrypted(""); setStep(1); setLoading(false); }, 100);
  };
  const handleEncrypt = () => { if (!keys) return; setCiphertext(rsaEncrypt(message, keys.e, keys.n)); setDecrypted(""); setStep(2); };
  const handleDecrypt = () => { if (!ciphertext || !keys) return; setDecrypted(rsaDecrypt(ciphertext, keys.d, keys.n)); setStep(3); };

  const steps = ["Write Message", "Generate Keys", "Encrypt", "Decrypt"];

  return (
    <section id="simulator" style={{ padding: "7rem 2rem", background: C.bg }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <SectionHeading tag="Feature · RSA Encryption" title="End-to-End RSA Simulator" subtitle="Real RSA math running in your browser. Generate keypairs, encrypt messages, and decrypt them back — all locally." />

        {/* Step tracker */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0", marginBottom: "2.5rem", flexWrap: "wrap", gap: "4px" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <motion.div animate={{ scale: step === i ? 1.1 : 1, background: step > i ? C.green : step === i ? C.indigo : C.bgAlt }}
                style={{ width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: step >= i ? "#fff" : C.muted, fontWeight: 700, fontSize: "0.78rem", fontFamily: "'JetBrains Mono', monospace", border: `2px solid ${step >= i ? (step > i ? C.green : C.indigo) : C.border}`, boxShadow: step === i ? `0 0 0 4px ${C.indigoLight}` : "none" }}>
                {step > i ? "✓" : i + 1}
              </motion.div>
              <span style={{ fontSize: "0.75rem", fontFamily: "'Sora', sans-serif", color: step === i ? C.indigo : C.muted, fontWeight: step === i ? 600 : 400, marginRight: "4px" }}>{s}</span>
              {i < 3 && <div style={{ width: "28px", height: "2px", background: step > i ? C.green : C.border, borderRadius: "2px", marginRight: "4px" }} />}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "1.5rem" }}>
          {/* Input */}
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: C.indigoLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>📝</div>
              <div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem" }}>Message Input</div>
                <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.72rem" }}>Type any plaintext message</div>
              </div>
            </div>
            <textarea value={message}
              onChange={e => { setMessage(e.target.value); setStep(0); setCiphertext(null); setDecrypted(""); setKeys(null); }}
              style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: "10px", padding: "12px 14px", color: C.text, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.85rem", resize: "vertical", minHeight: "90px", outline: "none", lineHeight: 1.6 }} />
            <div style={{ display: "flex", gap: "6px", marginTop: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", color: C.muted, fontFamily: "'Sora', sans-serif", marginRight: "4px" }}>Key size:</span>
              {[16, 32, 64].map(b => (
                <button key={b} onClick={() => setBits(b)}
                  style={{ background: bits === b ? C.indigoLight : C.bg, border: `1.5px solid ${bits === b ? C.indigo : C.border}`, color: bits === b ? C.indigo : C.muted, padding: "3px 12px", borderRadius: "7px", cursor: "pointer", fontSize: "0.75rem", fontFamily: "'JetBrains Mono', monospace", fontWeight: bits === b ? 700 : 400 }}>
                  {b}-bit
                </button>
              ))}
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Btn onClick={handleGenKeys} disabled={loading || !message} fullWidth variant="primary">
                {loading ? "⏳ Generating keys…" : "🔑 Generate RSA Keypair"}
              </Btn>
            </div>
          </motion.div>

          {/* Keys */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: C.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🗝️</div>
              <div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem" }}>Key Pair</div>
                <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.72rem" }}>Public &amp; private components</div>
              </div>
            </div>
            {keys ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <KeyValRow label="p — prime factor" value={keys.p.toString()} color={C.green} />
                <KeyValRow label="q — prime factor" value={keys.q.toString()} color={C.teal} />
                <KeyValRow label="n = p × q (modulus)" value={keys.n.toString()} color={C.amber} />
                <KeyValRow label="φ(n) = (p-1)(q-1)" value={keys.phi.toString()} color={C.muted} />
                <KeyValRow label="e — public exponent" value={keys.e.toString()} color={C.indigo} />
                <KeyValRow label="d — private exponent" value={keys.d.toString()} color={C.red} />
                <div style={{ marginTop: "0.5rem" }}>
                  <Btn onClick={handleEncrypt} fullWidth variant="success">🔒 Encrypt with Public Key (e, n)</Btn>
                </div>
              </div>
            ) : (
              <div style={{ background: C.bg, border: `1.5px dashed ${C.border}`, borderRadius: "12px", padding: "2.5rem", textAlign: "center", color: C.muted, fontFamily: "'Sora', sans-serif", fontSize: "0.85rem" }}>
                Generate a keypair to see the RSA parameters
              </div>
            )}
          </motion.div>

          {/* Ciphertext */}
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: C.redLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🔒</div>
              <div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem" }}>Ciphertext</div>
                <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.72rem" }}>Encrypted numeric chunks</div>
              </div>
            </div>
            {ciphertext ? (
              <>
                <div style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: "10px", padding: "12px 14px", maxHeight: "160px", overflowY: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", color: C.red, wordBreak: "break-all", lineHeight: 1.9 }}>
                  [{ciphertext.slice(0, 8).join(", ")}{ciphertext.length > 8 ? `, … +${ciphertext.length - 8} more` : ""}]
                </div>
                <div style={{ marginTop: "0.6rem", display: "flex", gap: "6px", alignItems: "center" }}>
                  <Tag color={C.red} bg={C.redLight}>{ciphertext.length} CHUNKS</Tag>
                  <span style={{ fontSize: "0.72rem", color: C.muted, fontFamily: "'Sora', sans-serif" }}>One per byte</span>
                </div>
                <div style={{ marginTop: "1rem" }}>
                  <Btn onClick={handleDecrypt} fullWidth variant="primary">🔓 Decrypt with Private Key (d, n)</Btn>
                </div>
              </>
            ) : (
              <div style={{ background: C.bg, border: `1.5px dashed ${C.border}`, borderRadius: "12px", padding: "2.5rem", textAlign: "center", color: C.muted, fontFamily: "'Sora', sans-serif", fontSize: "0.85rem" }}>
                Encrypt a message to see ciphertext
              </div>
            )}
          </motion.div>
        </div>

        {/* Decrypted result */}
        <AnimatePresence>
          {decrypted && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ ...card, padding: "2rem", marginTop: "1.5rem", border: `1.5px solid ${decrypted === message ? C.green : C.red}40` }}>
              <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, background: decrypted === message ? C.greenLight : C.redLight, borderRadius: "12px", padding: "1.1rem 1.4rem", border: `1px solid ${decrypted === message ? C.green : C.red}30` }}>
                  <div style={{ fontSize: "0.65rem", fontFamily: "'JetBrains Mono', monospace", color: decrypted === message ? C.green : C.red, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Decrypted Output</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1rem", color: C.text }}>{decrypted}</div>
                </div>
                <div style={{ textAlign: "center", minWidth: "80px" }}>
                  <div style={{ fontSize: "2.2rem" }}>{decrypted === message ? "✅" : "❌"}</div>
                  <div style={{ fontFamily: "'Sora', sans-serif", fontSize: "0.72rem", color: decrypted === message ? C.green : C.red, fontWeight: 600, marginTop: "4px" }}>{decrypted === message ? "Perfect Match" : "Mismatch"}</div>
                </div>
              </div>
              {/* Flow diagram */}
              <div style={{ marginTop: "1.75rem", paddingTop: "1.5rem", borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: "0.7rem", color: C.muted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem", textAlign: "center" }}>Transmission Flow</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "6px" }}>
                  {[
                    { label: "Alice", sub: "Sender", icon: "👤", color: C.indigo, active: step >= 0 },
                    { arrow: true, active: step >= 1 },
                    { label: "Encrypt", sub: "Public Key", icon: "🔒", color: C.purple, active: step >= 2 },
                    { arrow: true, active: step >= 2 },
                    { label: "Network", sub: "Ciphertext", icon: "📡", color: C.amber, active: step >= 2 },
                    { arrow: true, active: step >= 3 },
                    { label: "Decrypt", sub: "Private Key", icon: "🔓", color: C.teal, active: step >= 3 },
                    { arrow: true, active: step >= 3 },
                    { label: "Bob", sub: "Receiver", icon: "👤", color: C.green, active: step >= 3 },
                  ].map((n, i) => n.arrow ? (
                    <motion.div key={i} animate={{ x: n.active ? [0, 4, 0] : 0, opacity: n.active ? 1 : 0.2 }} transition={{ repeat: n.active ? Infinity : 0, duration: 1 }}
                      style={{ color: C.muted, fontSize: "1rem", padding: "0 2px" }}>→</motion.div>
                  ) : (
                    <motion.div key={i} animate={{ opacity: n.active ? 1 : 0.25 }}
                      style={{ background: n.active ? `${n.color}12` : C.bg, border: `1.5px solid ${n.active ? n.color + "50" : C.border}`, borderRadius: "12px", padding: "8px 14px", textAlign: "center", minWidth: "72px", boxShadow: n.active ? `0 4px 16px ${n.color}20` : "none" }}>
                      <div style={{ fontSize: "1.2rem" }}>{n.icon}</div>
                      <div style={{ color: n.active ? n.color : C.muted, fontFamily: "'Sora', sans-serif", fontSize: "0.68rem", fontWeight: 700, marginTop: "3px" }}>{n.label}</div>
                      <div style={{ color: C.muted, fontFamily: "'Sora', sans-serif", fontSize: "0.6rem" }}>{n.sub}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ── MODULAR VISUALIZER ────────────────────────────────────────────────────────
function ModularVisualizer() {
  const [base, setBase] = useState("3");
  const [exp, setExp] = useState("13");
  const [mod, setMod] = useState("17");
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const compute = () => {
    try {
      const b = BigInt(base), e = BigInt(exp), m = BigInt(mod);
      if (m <= 1n) return;
      const s = modPowSteps(b, e, m);
      setSteps(s); setCurrentStep(0); setPlaying(true);
    } catch {}
  };

  useEffect(() => {
    if (!playing || steps.length === 0) return;
    if (currentStep >= steps.length - 1) { setPlaying(false); return; }
    const id = setTimeout(() => setCurrentStep(c => c + 1), 650);
    return () => clearTimeout(id);
  }, [playing, currentStep, steps]);

  const modChart = Array.from({ length: Math.min(Number(mod) || 12, 24) }, (_, i) => ({
    i: String(i), y: Number(base) ** i % Number(mod)
  }));

  return (
    <section id="modular" style={{ padding: "7rem 2rem", background: C.bgAlt }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <SectionHeading tag="Feature · Number Theory" title="Modular Arithmetic Visualizer" subtitle="Step through fast binary exponentiation — the core algorithm behind RSA encryption." />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
          {/* Controls */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: C.indigoLight, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.85rem", fontWeight: 700, color: C.indigo }}>xⁿ</div>
              <div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem" }}>Compute base^exp mod m</div>
                <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.72rem" }}>Uses square-and-multiply</div>
              </div>
            </div>
            {[["base", base, setBase, C.indigo], ["exponent", exp, setExp, C.purple], ["modulus (m)", mod, setMod, C.teal]].map(([l, v, s, c]) => (
              <div key={l} style={{ marginBottom: "0.9rem" }}>
                <label style={{ color: C.muted, fontSize: "0.72rem", fontFamily: "'Sora', sans-serif", fontWeight: 500, display: "block", marginBottom: "5px", textTransform: "capitalize" }}>{l}</label>
                <input type="number" value={v} onChange={e => { s(e.target.value); setSteps([]); }}
                  style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: "9px", padding: "9px 13px", color: C.text, fontFamily: "'JetBrains Mono', monospace", fontSize: "1rem", outline: "none", transition: "border-color 0.2s" }}
                  onFocus={e => e.target.style.borderColor = c} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            ))}
            <Btn onClick={compute} fullWidth>▶ Visualize Step-by-Step</Btn>
            {steps.length > 0 && (
              <div style={{ marginTop: "1.1rem", background: `linear-gradient(135deg, ${C.indigoLight}, ${C.purpleLight})`, borderRadius: "12px", padding: "1rem", textAlign: "center", border: `1px solid ${C.indigo}20` }}>
                <div style={{ color: C.muted, fontSize: "0.65rem", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>Result</div>
                <div style={{ color: C.indigo, fontFamily: "'JetBrains Mono', monospace", fontSize: "2rem", fontWeight: 800, marginTop: "2px" }}>{steps[steps.length - 1]?.result}</div>
                <div style={{ color: C.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", marginTop: "2px" }}>{base}^{exp} mod {mod}</div>
              </div>
            )}
          </motion.div>

          {/* Steps */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem" }}>Binary Exponentiation Steps</div>
                <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.72rem" }}>Square-and-multiply algorithm</div>
              </div>
              {steps.length > 0 && (
                <div style={{ display: "flex", gap: "5px" }}>
                  {[["◀", () => setCurrentStep(c => Math.max(0, c-1))], ["▶", () => setCurrentStep(c => Math.min(steps.length-1, c+1))]].map(([l, fn]) => (
                    <button key={l} onClick={fn} style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted, width: "28px", height: "28px", borderRadius: "6px", cursor: "pointer", fontFamily: "monospace", fontSize: "0.8rem" }}>{l}</button>
                  ))}
                  <button onClick={() => { setCurrentStep(0); setPlaying(true); }} style={{ background: C.indigoLight, border: `1px solid ${C.indigo}30`, color: C.indigo, padding: "0 10px", height: "28px", borderRadius: "6px", cursor: "pointer", fontFamily: "'Sora', sans-serif", fontSize: "0.72rem", fontWeight: 600 }}>↺ Replay</button>
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "310px", overflowY: "auto" }}>
              {steps.length === 0 ? (
                <div style={{ background: C.bg, border: `1.5px dashed ${C.border}`, borderRadius: "12px", padding: "2.5rem", textAlign: "center", color: C.muted, fontFamily: "'Sora', sans-serif", fontSize: "0.82rem" }}>
                  Press "Visualize" to watch the algorithm run step by step
                </div>
              ) : steps.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: i <= currentStep ? 1 : 0.2 }}
                  style={{ background: i === currentStep ? C.indigoLight : C.bg, border: `1.5px solid ${i === currentStep ? C.indigo+"60" : C.border}`, borderRadius: "10px", padding: "9px 13px", boxShadow: i === currentStep ? `0 2px 12px ${C.indigo}20` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <Tag color={i === currentStep ? C.indigo : C.muted} bg={i === currentStep ? C.indigoLight : C.bg}>Step {s.step}</Tag>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", color: C.indigo, fontWeight: 700 }}>result = {s.result}</span>
                  </div>
                  <div style={{ color: C.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", marginTop: "1px" }}>{s.action}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Chart */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem", marginBottom: "4px" }}>
              Cyclic Pattern: {base}ⁱ mod {mod}
            </div>
            <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.72rem", marginBottom: "1.25rem" }}>
              The pseudorandom output is why modular math is cryptographically powerful
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={modChart}>
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={C.indigo} />
                    <stop offset="100%" stopColor={C.purple} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="i" stroke={C.muted} tick={{ fontSize: 9, fill: C.muted, fontFamily: "'JetBrains Mono', monospace" }} label={{ value: "i", position: "insideRight", fill: C.muted, fontSize: 10 }} />
                <YAxis stroke={C.muted} tick={{ fontSize: 9, fill: C.muted, fontFamily: "'JetBrains Mono', monospace" }} />
                <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }} />
                <Line type="monotone" dataKey="y" stroke="url(#lineGrad)" strokeWidth={2.5} dot={{ fill: C.indigo, r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Concept cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginTop: "1.5rem" }}>
          {[
            { op: "Addition", formula: "(a + b) mod m", ex: "(9+7) mod 11 = 5", color: C.indigo, bg: C.indigoLight },
            { op: "Multiplication", formula: "(a × b) mod m", ex: "(8×9) mod 11 = 6", color: C.purple, bg: C.purpleLight },
            { op: "Exponentiation", formula: "aᵇ mod m", ex: "3¹³ mod 17 = 12", color: C.teal, bg: "#ccfbf180" },
            { op: "Modular Inverse", formula: "a·a⁻¹ ≡ 1 (mod m)", ex: "3×4 mod 11 = 1", color: C.green, bg: C.greenLight },
          ].map(({ op, formula, ex, color, bg }) => (
            <motion.div key={op} whileHover={{ y: -4, boxShadow: `0 8px 24px ${color}18` }}
              style={{ ...card, padding: "1.25rem", borderTop: `3px solid ${color}` }}>
              <div style={{ color, fontFamily: "'Sora', sans-serif", fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.4rem" }}>{op}</div>
              <div style={{ background: bg, borderRadius: "7px", padding: "5px 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem", color: C.text, marginBottom: "0.4rem" }}>{formula}</div>
              <div style={{ color: C.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem" }}>{ex}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── PRIME GENERATOR ───────────────────────────────────────────────────────────
function PrimeGenerator() {
  const [sieveSize, setSieveSize] = useState(120);
  const [sieve, setSieve] = useState([]);
  const [generated, setGenerated] = useState([]);
  const [bits, setBits] = useState(16);
  const [generating, setGenerating] = useState(false);
  const [revealed, setRevealed] = useState(new Set());

  const runSieve = useCallback(() => {
    const n = sieveSize;
    const comp = new Array(n + 1).fill(false);
    comp[0] = comp[1] = true;
    for (let i = 2; i * i <= n; i++) if (!comp[i]) for (let j = i*i; j <= n; j += i) comp[j] = true;
    const primes = Array.from({ length: n - 1 }, (_, i) => ({ n: i + 2, prime: !comp[i + 2] }));
    setSieve(primes); setRevealed(new Set());
    let idx = 0;
    const rev = setInterval(() => { setRevealed(p => new Set([...p, idx])); idx++; if (idx >= primes.length) clearInterval(rev); }, 14);
  }, [sieveSize]);

  useEffect(() => { runSieve(); }, []);

  const genPrime = () => {
    setGenerating(true);
    setTimeout(() => { const p = generatePrime(bits); setGenerated(prev => [{ value: p.toString(), bits, id: Date.now() }, ...prev.slice(0, 7)]); setGenerating(false); }, 180);
  };

  const densityData = [10, 50, 100, 500, 1000, 5000].map(n => {
    let count = 0;
    for (let x = 2; x <= n; x++) { let ok = true; for (let j = 2; j * j <= x; j++) { if (x % j === 0) { ok = false; break; } } if (ok) count++; }
    return { range: `≤${n}`, primes: count, density: +(count / n * 100).toFixed(1) };
  });

  return (
    <section id="primes" style={{ padding: "7rem 2rem", background: C.bg }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <SectionHeading tag="Feature · Cryptographic Primes" title="Prime Number Generator" subtitle="Large primes are the bedrock of RSA. Generate them using Miller-Rabin probabilistic primality testing." />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
          {/* Sieve */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem" }}>Sieve of Eratosthenes</div>
                <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.72rem" }}>Primes highlighted in indigo</div>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input type="number" value={sieveSize} onChange={e => setSieveSize(Math.min(200, Math.max(20, +e.target.value)))}
                  style={{ width: "58px", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: "7px", padding: "4px 8px", color: C.text, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem", outline: "none", textAlign: "center" }} />
                <button onClick={runSieve} style={{ background: C.indigoLight, border: `1px solid ${C.indigo}30`, color: C.indigo, padding: "4px 10px", borderRadius: "7px", cursor: "pointer", fontFamily: "'Sora', sans-serif", fontSize: "0.72rem", fontWeight: 600 }}>Run</button>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxHeight: "270px", overflowY: "auto" }}>
              {sieve.map(({ n, prime }, i) => (
                <motion.div key={n}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: revealed.has(i) ? 1 : 0.08, scale: revealed.has(i) ? 1 : 0.6, background: prime ? C.indigoLight : C.bg }}
                  transition={{ duration: 0.12 }}
                  style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "7px", border: `1.5px solid ${prime ? C.indigo+"50" : C.border}`, color: prime ? C.indigo : C.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", fontWeight: prime ? 700 : 400, cursor: "default" }}>
                  {n}
                </motion.div>
              ))}
            </div>
            <div style={{ marginTop: "0.85rem", display: "flex", gap: "8px", alignItems: "center" }}>
              <Tag color={C.indigo} bg={C.indigoLight}>{sieve.filter(x => x.prime).length} PRIMES</Tag>
              <span style={{ color: C.muted, fontSize: "0.72rem", fontFamily: "'Sora', sans-serif" }}>in [2, {sieveSize}]</span>
            </div>
          </motion.div>

          {/* Generator */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem", marginBottom: "4px" }}>Cryptographic Prime Generator</div>
            <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.72rem", marginBottom: "1.1rem" }}>Miller-Rabin probabilistic primality test</div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "1rem", flexWrap: "wrap" }}>
              {[8, 16, 32, 64].map(b => (
                <button key={b} onClick={() => setBits(b)}
                  style={{ background: bits === b ? C.indigoLight : C.bg, border: `1.5px solid ${bits === b ? C.indigo : C.border}`, color: bits === b ? C.indigo : C.muted, padding: "5px 14px", borderRadius: "8px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", fontWeight: bits === b ? 700 : 400 }}>
                  {b}-bit
                </button>
              ))}
            </div>
            <Btn onClick={genPrime} disabled={generating} fullWidth variant="success">
              {generating ? "⏳ Testing candidates…" : "⚡ Generate Prime"}
            </Btn>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1rem", maxHeight: "240px", overflowY: "auto" }}>
              {generated.length === 0 ? (
                <div style={{ background: C.bg, border: `1.5px dashed ${C.border}`, borderRadius: "12px", padding: "2rem", textAlign: "center", color: C.muted, fontFamily: "'Sora', sans-serif", fontSize: "0.82rem" }}>
                  Your generated primes will appear here
                </div>
              ) : generated.map((g, i) => (
                <motion.div key={g.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  style={{ background: i === 0 ? C.greenLight : C.bg, border: `1.5px solid ${i === 0 ? C.green+"50" : C.border}`, borderRadius: "10px", padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <Tag color={C.green} bg={C.greenLight}>{g.bits}-BIT PRIME</Tag>
                    {i === 0 && <Tag color={C.amber} bg={C.amberLight}>LATEST</Tag>}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", color: C.textMid, wordBreak: "break-all", marginTop: "2px" }}>{g.value}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Density chart */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem", marginBottom: "4px" }}>Prime Density (Prime Number Theorem)</div>
            <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.72rem", marginBottom: "1.25rem" }}>π(n) ≈ n / ln(n) — primes thin out but never stop</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={densityData} barGap={4}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.indigo} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={C.purple} stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="range" stroke={C.muted} tick={{ fontSize: 8, fill: C.muted, fontFamily: "'JetBrains Mono', monospace" }} />
                <YAxis stroke={C.muted} tick={{ fontSize: 9, fill: C.muted, fontFamily: "'JetBrains Mono', monospace" }} />
                <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem" }} />
                <Bar dataKey="primes" name="# primes" fill="url(#barGrad)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ── SECURITY DEMO ─────────────────────────────────────────────────────────────
function SecurityDemo() {
  const [msg, setMsg] = useState("password=hunter2&user=alice");
  const [keys, setKeys] = useState(null);
  const [ct, setCt] = useState(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => { const k = generateRSAKeys(32); setKeys(k); }, []);

  const sendPlain = () => { setPhase(1); setCt(null); };
  const sendEnc = () => { if (!keys) return; const c = rsaEncrypt(msg, keys.e, keys.n); setCt(c); setPhase(2); };

  return (
    <section id="demo" style={{ padding: "7rem 2rem", background: C.bgAlt }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <SectionHeading tag="Feature · Attack Simulation" title="Plaintext vs Encrypted" subtitle="Witness the stark difference between sending data in the clear versus encrypted — from an attacker's perspective." />

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem", marginBottom: "1.5rem" }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, color: C.text, fontSize: "0.9rem", marginBottom: "0.75rem" }}>Sensitive payload to transmit</div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <input value={msg} onChange={e => { setMsg(e.target.value); setPhase(0); setCt(null); }}
              style={{ flex: 1, minWidth: "220px", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: "10px", padding: "10px 14px", color: C.text, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.88rem", outline: "none" }} />
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Btn onClick={sendPlain} variant="danger">📡 Send Plaintext</Btn>
              <Btn onClick={sendEnc} variant="success">🔒 Send Encrypted</Btn>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {phase > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
              {/* Sender */}
              <div style={{ ...card, padding: "1.5rem", borderTop: `3px solid ${C.indigo}` }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "1rem" }}>
                  <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: C.indigoLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>👤</div>
                  <div>
                    <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.indigo, fontSize: "0.88rem" }}>Alice — Sender</div>
                    <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.7rem" }}>Transmitting…</div>
                  </div>
                </div>
                <div style={{ background: C.bg, borderRadius: "8px", padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.78rem", color: C.text, wordBreak: "break-all" }}>{msg}</div>
                {phase === 2 && <div style={{ marginTop: "8px", color: C.green, fontFamily: "'Sora', sans-serif", fontSize: "0.72rem", fontWeight: 600 }}>✓ Encrypted before transmission</div>}
              </div>

              {/* Attacker */}
              <motion.div
                animate={{ boxShadow: phase === 1 ? [`0 0 0px ${C.red}00`, `0 0 32px ${C.red}50`, `0 0 0px ${C.red}00`] : `0 4px 24px rgba(79,70,229,0.07)` }}
                transition={{ duration: 1.2, repeat: phase === 1 ? Infinity : 0 }}
                style={{ ...card, padding: "1.5rem", borderTop: `3px solid ${phase === 1 ? C.red : C.border}` }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "1rem" }}>
                  <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: phase === 1 ? C.redLight : C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                    {phase === 1 ? "😈" : "👁️"}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: phase === 1 ? C.red : C.muted, fontSize: "0.88rem" }}>
                      {phase === 1 ? "Attacker — SNIFFING!" : "Attacker — Intercepted"}
                    </div>
                    <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.7rem" }}>Monitoring the wire…</div>
                  </div>
                </div>
                <div style={{ background: phase === 1 ? C.redLight : C.bg, borderRadius: "8px", padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", color: phase === 1 ? C.red : C.muted, wordBreak: "break-all", border: `1px solid ${phase === 1 ? C.red+"30" : C.border}` }}>
                  {phase === 1 ? msg : ct ? `[${ct.slice(0, 4).join(", ")}, … ${ct.length} chunks]` : ""}
                </div>
                <div style={{ marginTop: "10px" }}>
                  {phase === 1 ? (
                    <motion.div animate={{ opacity: [1, 0.55, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}
                      style={{ background: C.redLight, border: `1px solid ${C.red}40`, borderRadius: "8px", padding: "7px 12px", color: C.red, fontFamily: "'Sora', sans-serif", fontSize: "0.72rem", fontWeight: 600 }}>
                      ⚠️ COMPROMISED — full message exposed
                    </motion.div>
                  ) : (
                    <div style={{ background: C.greenLight, border: `1px solid ${C.green}40`, borderRadius: "8px", padding: "7px 12px", color: C.green, fontFamily: "'Sora', sans-serif", fontSize: "0.72rem", fontWeight: 600 }}>
                      ✅ SAFE — ciphertext is mathematically opaque
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Receiver */}
              <div style={{ ...card, padding: "1.5rem", borderTop: `3px solid ${C.green}` }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "1rem" }}>
                  <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: C.greenLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>👤</div>
                  <div>
                    <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.green, fontSize: "0.88rem" }}>Bob — Receiver</div>
                    <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.7rem" }}>Receiving data…</div>
                  </div>
                </div>
                {phase === 1 && (
                  <div style={{ background: C.bg, borderRadius: "8px", padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.78rem", color: C.text }}>{msg}</div>
                )}
                {phase === 2 && ct && keys && (
                  <>
                    <div style={{ background: C.bg, borderRadius: "8px", padding: "8px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", color: C.muted, wordBreak: "break-all", marginBottom: "6px" }}>
                      Received: [{ct.slice(0,3).join(", ")}, …]
                    </div>
                    <div style={{ background: C.greenLight, borderRadius: "8px", padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.78rem", color: C.green, border: `1px solid ${C.green}30` }}>
                      🔓 {rsaDecrypt(ct, keys.d, keys.n)}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comparison table */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem", marginBottom: "1.25rem" }}>Security Property Comparison</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 5px", fontFamily: "'Sora', sans-serif", fontSize: "0.8rem" }}>
              <thead>
                <tr>
                  {["Property", "Plaintext HTTP", "RSA-Encrypted HTTPS"].map(h => (
                    <th key={h} style={{ padding: "7px 16px", color: C.muted, textAlign: "left", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Packet interception", "🔴 Full message visible", "🟢 Only ciphertext, unreadable"],
                  ["Attacker readable", "🔴 Instantly readable", "🟢 Requires private key"],
                  ["MITM attack", "🔴 Full access, can modify", "🟢 Blocked by encryption"],
                  ["Replay attacks", "🔴 Trivially replayed", "🟡 Mitigated with nonces"],
                  ["Data integrity", "🔴 Silently modifiable", "🟢 Tampering breaks decryption"],
                  ["Credential safety", "🔴 Passwords exposed", "🟢 Mathematically protected"],
                ].map(([prop, bad, good], idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? C.bg : C.surface }}>
                    <td style={{ padding: "9px 16px", color: C.textMid, fontWeight: 500, borderRadius: "8px 0 0 8px" }}>{prop}</td>
                    <td style={{ padding: "9px 16px", color: C.red }}>{bad}</td>
                    <td style={{ padding: "9px 16px", color: C.green, borderRadius: "0 8px 8px 0" }}>{good}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── ALGORITHM ANALYSIS ────────────────────────────────────────────────────────
function AlgorithmAnalysis() {
  const radarData = [
    { algorithm: "Mod Exp", Security: 95, Speed: 90, Memory: 96 },
    { algorithm: "Miller-Rabin", Security: 92, Speed: 80, Memory: 93 },
    { algorithm: "Sieve", Security: 70, Speed: 88, Memory: 58 },
    { algorithm: "Ext. GCD", Security: 86, Speed: 96, Memory: 99 },
    { algorithm: "RSA Enc", Security: 98, Speed: 75, Memory: 85 },
    { algorithm: "RSA Dec", Security: 98, Speed: 64, Memory: 85 },
  ];

  const keySizeData = [512, 1024, 2048, 4096].map(bits => ({
    bits: `${bits}b`,
    securityBits: Math.round(bits / 3),
    keygenRel: Math.round(0.00005 * bits ** 1.9 / 50),
  }));

  const algorithms = [
    { name: "Fast Modular Exponentiation", time: "O(log e · M(n))", space: "O(1)", desc: "Square-and-multiply reduces exponentiation to O(log e) multiplications by processing each bit of the exponent.", color: C.indigo, bg: C.indigoLight },
    { name: "Miller-Rabin Primality Test", time: "O(k · log²n)", space: "O(log n)", desc: "Probabilistic primality test with error probability ≤ 4⁻ᵏ. Industry standard for cryptographic prime generation.", color: C.purple, bg: C.purpleLight },
    { name: "Sieve of Eratosthenes", time: "O(n log log n)", space: "O(n)", desc: "Finds all primes up to n. Used as a pre-filter before expensive probabilistic testing to quickly eliminate composites.", color: C.teal, bg: "#ccfbf1" },
    { name: "Extended Euclidean Algorithm", time: "O(log min(a,b))", space: "O(1)", desc: "Computes GCD and Bézout coefficients. Used to find the modular multiplicative inverse: d = e⁻¹ mod φ(n).", color: C.green, bg: C.greenLight },
  ];

  return (
    <section id="analysis" style={{ padding: "7rem 2rem", background: C.bg }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <SectionHeading tag="Feature · Complexity Analysis" title="Algorithm Analysis Dashboard" subtitle="Time & space complexity of every cryptographic operation powering SecureCrypt." />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
          {/* Radar */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem", marginBottom: "4px" }}>Algorithm Performance Radar</div>
            <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.72rem", marginBottom: "1.25rem" }}>Security · Speed · Memory efficiency</div>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="algorithm" tick={{ fill: C.muted, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: C.muted, fontSize: 8 }} axisLine={false} />
                <Radar name="Security" dataKey="Security" stroke={C.indigo} fill={C.indigo} fillOpacity={0.12} strokeWidth={1.5} />
                <Radar name="Speed" dataKey="Speed" stroke={C.teal} fill={C.teal} fillOpacity={0.12} strokeWidth={1.5} />
                <Radar name="Memory" dataKey="Memory" stroke={C.purple} fill={C.purple} fillOpacity={0.12} strokeWidth={1.5} />
                <Legend wrapperStyle={{ fontFamily: "'Sora', sans-serif", fontSize: "0.72rem" }} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Key size bar */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem", marginBottom: "4px" }}>Key Size vs Security Tradeoff</div>
            <div style={{ fontFamily: "'Sora', sans-serif", color: C.muted, fontSize: "0.72rem", marginBottom: "1.25rem" }}>Larger keys = more security, slower keygen</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={keySizeData} barGap={6}>
                <defs>
                  <linearGradient id="secGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.indigo} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={C.indigoLight} stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="keyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.amber} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={C.amberLight} stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="bits" stroke={C.muted} tick={{ fontSize: 10, fill: C.muted, fontFamily: "'JetBrains Mono', monospace" }} />
                <YAxis stroke={C.muted} tick={{ fontSize: 9, fill: C.muted, fontFamily: "'JetBrains Mono', monospace" }} />
                <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem" }} />
                <Bar dataKey="securityBits" name="Security bits" fill="url(#secGrad)" radius={[5, 5, 0, 0]} />
                <Bar dataKey="keygenRel" name="Keygen cost (rel)" fill="url(#keyGrad)" radius={[5, 5, 0, 0]} />
                <Legend wrapperStyle={{ fontFamily: "'Sora', sans-serif", fontSize: "0.72rem" }} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Algorithm cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
          {algorithms.map(a => (
            <motion.div key={a.name} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              whileHover={{ y: -4, boxShadow: `0 10px 28px ${a.color}20` }}
              style={{ ...card, padding: "1.4rem", borderTop: `3px solid ${a.color}` }}>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: a.color, fontSize: "0.85rem", marginBottom: "0.7rem" }}>{a.name}</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <Tag color={a.color} bg={a.bg}>T: {a.time}</Tag>
                <Tag color={C.muted} bg={C.bg}>S: {a.space}</Tag>
              </div>
              <p style={{ color: C.muted, fontSize: "0.76rem", lineHeight: 1.65, fontFamily: "'Sora', sans-serif" }}>{a.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Big-O table */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: C.text, fontSize: "0.95rem", marginBottom: "1.25rem" }}>Complete Big-O Complexity Table</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.76rem" }}>
              <thead>
                <tr>
                  {["Operation", "Best Case", "Average Case", "Worst Case", "Space"].map(h => (
                    <th key={h} style={{ padding: "6px 14px", color: C.muted, textAlign: "left", fontSize: "0.65rem", letterSpacing: "0.09em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["RSA Key Generation", "O(n²)", "O(n²log n)", "O(n³)", "O(n)", C.indigo],
                  ["RSA Encryption", "O(log e·n²)", "O(log e·n²)", "O(log e·n²)", "O(k)", C.purple],
                  ["RSA Decryption", "O(log d·n²)", "O(log d·n²)", "O(log d·n²)", "O(k)", C.teal],
                  ["Miller-Rabin", "O(1)", "O(k log²n)", "O(k log²n)", "O(log n)", C.green],
                  ["Sieve of Eratosthenes", "O(n log log n)", "O(n log log n)", "O(n log log n)", "O(n)", C.amber],
                  ["Extended GCD", "O(1)", "O(log n)", "O(log n)", "O(1)", C.red],
                  ["Modular Inverse", "O(1)", "O(log n)", "O(log n)", "O(1)", C.pink],
                ].map(([op, best, avg, worst, space, c], idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? C.bg : C.surface }}>
                    <td style={{ padding: "9px 14px", color: c, fontWeight: 700, borderRadius: "8px 0 0 8px", fontSize: "0.75rem", fontFamily: "'Sora', sans-serif" }}>{op}</td>
                    <td style={{ padding: "9px 14px", color: C.muted }}>{best}</td>
                    <td style={{ padding: "9px 14px", color: C.textMid }}>{avg}</td>
                    <td style={{ padding: "9px 14px", color: C.textMid }}>{worst}</td>
                    <td style={{ padding: "9px 14px", color: C.purple, borderRadius: "0 8px 8px 0" }}>{space}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── CAESAR CIPHER PLAYGROUND ─────────────────────────────────────────────────
function CaesarCipher() {
  const [input, setInput] = useState("The quick brown fox jumps over the lazy dog");
  const [shift, setShift] = useState(13);
  const [mode, setMode] = useState("encrypt");
  const [bruteForce, setBruteForce] = useState(false);

  const caesarShift = (text, n, enc) => {
    const s = ((enc ? n : -n) % 26 + 26) % 26;
    return text.split("").map(ch => {
      if (/[a-zA-Z]/.test(ch)) {
        const base = ch >= "a" ? 97 : 65;
        return String.fromCharCode(((ch.charCodeAt(0) - base + s) % 26) + base);
      }
      return ch;
    }).join("");
  };

  const output = caesarShift(input, shift, mode === "encrypt");
  const allShifts = Array.from({ length: 26 }, (_, i) => ({ shift: i, text: caesarShift(input, i, false) }));
  const freq = {};
  for (const ch of input.toUpperCase()) if (/[A-Z]/.test(ch)) freq[ch] = (freq[ch] || 0) + 1;
  const freqData = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(c => ({ letter: c, count: freq[c] || 0 }));

  return (
    <section id="cipher" style={{ padding: "7rem 2rem", background: C.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <SectionHeading tag="New Feature · Classic Cryptography" title="Caesar Cipher Playground" subtitle="The world's oldest cipher — shift each letter by a fixed amount. Discover why it's trivially breakable, and why RSA isn't." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: C.amberLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🔠</div>
              <div><div style={{ fontWeight: 700, color: C.text, fontSize: "0.95rem" }}>Caesar Cipher</div><div style={{ color: C.muted, fontSize: "0.72rem" }}>Shift letters by a fixed amount</div></div>
            </div>
            <div style={{ display: "flex", background: C.bg, borderRadius: 10, padding: 4, gap: 4, marginBottom: "1.1rem", border: `1px solid ${C.border}` }}>
              {["encrypt", "decrypt"].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, background: mode === m ? C.surface : "transparent", border: mode === m ? `1px solid ${C.border}` : "none", color: mode === m ? C.indigo : C.muted, fontWeight: mode === m ? 700 : 400, fontSize: "0.78rem", cursor: "pointer", boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.06)" : "none", transition: "all 0.18s" }}>
                  {m === "encrypt" ? "🔒 Encrypt" : "🔓 Decrypt"}
                </button>
              ))}
            </div>
            <label style={{ color: C.muted, fontSize: "0.72rem", fontWeight: 500, display: "block", marginBottom: 5 }}>Input text</label>
            <textarea value={input} onChange={e => setInput(e.target.value)} style={{ width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.82rem", minHeight: 80, outline: "none", resize: "vertical", lineHeight: 1.6 }} />
            <div style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ color: C.muted, fontSize: "0.72rem", fontWeight: 500 }}>Shift: <strong style={{ color: C.amber }}>{shift}</strong></label>
                <Tag color={C.amber} bg={C.amberLight}>ROT-{shift}</Tag>
              </div>
              <input type="range" min={1} max={25} value={shift} onChange={e => setShift(+e.target.value)} style={{ width: "100%", accentColor: C.amber, cursor: "pointer" }} />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ fontWeight: 700, color: C.text, fontSize: "0.95rem", marginBottom: 4 }}>{mode === "encrypt" ? "🔒 Encrypted Output" : "🔓 Decrypted Output"}</div>
            <div style={{ color: C.muted, fontSize: "0.72rem", marginBottom: "1.25rem" }}>Each letter shifted by {shift} position{shift !== 1 ? "s" : ""}</div>
            <div style={{ background: mode === "encrypt" ? C.redLight : C.greenLight, borderRadius: 12, padding: "1.25rem", border: `1px solid ${mode === "encrypt" ? C.red + "30" : C.green + "30"}`, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.88rem", color: C.text, lineHeight: 1.7, wordBreak: "break-all", minHeight: 80 }}>{output}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginTop: "1rem" }}>
              {[["Input chars", input.replace(/[^a-zA-Z]/g, "").length, C.indigo], ["Key space", 25, C.amber]].map(([l, v, c]) => (
                <div key={l} style={{ background: C.bg, borderRadius: 10, padding: "8px 12px", borderLeft: `3px solid ${c}` }}>
                  <div style={{ fontSize: "0.62rem", color: C.muted, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "1rem", background: C.amberLight, borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.amber}30` }}>
              <div style={{ fontSize: "0.7rem", color: C.amber, fontWeight: 700, marginBottom: 3 }}>⚠️ Why Caesar is broken</div>
              <div style={{ fontSize: "0.72rem", color: C.textMid, lineHeight: 1.6 }}>Only 25 possible keys — cracked in microseconds. RSA has 10⁶¹⁷ possible keys.</div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ fontWeight: 700, color: C.text, fontSize: "0.95rem", marginBottom: 4 }}>Frequency Analysis</div>
            <div style={{ color: C.muted, fontSize: "0.72rem", marginBottom: "1.25rem" }}>Letter distribution reveals cipher patterns — the attacker's primary tool</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={freqData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="letter" tick={{ fontSize: 8, fill: C.muted, fontFamily: "'JetBrains Mono',monospace" }} />
                <YAxis tick={{ fontSize: 8, fill: C.muted }} />
                <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.7rem" }} />
                <Bar dataKey="count" fill={C.amber} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <div style={{ fontWeight: 700, color: C.text, fontSize: "0.95rem" }}>Brute-Force All 25 Keys</div>
              <div style={{ color: C.muted, fontSize: "0.72rem" }}>An attacker tries every shift in milliseconds — click any row to select it</div>
            </div>
            <button onClick={() => setBruteForce(b => !b)} style={{ background: bruteForce ? C.indigoLight : C.redLight, border: `1px solid ${bruteForce ? C.indigo : C.red}30`, color: bruteForce ? C.indigo : C.red, padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}>{bruteForce ? "Hide" : "🔓 Show All Decryptions"}</button>
          </div>
          <AnimatePresence>
            {bruteForce && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "0.6rem" }}>
                  {allShifts.map(({ shift: s, text }) => (
                    <div key={s} onClick={() => setShift(s)} style={{ background: s === shift ? C.indigoLight : C.bg, border: `1.5px solid ${s === shift ? C.indigo + "60" : C.border}`, borderRadius: 10, padding: "8px 12px", cursor: "pointer", transition: "all 0.15s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem", color: s === shift ? C.indigo : C.muted, fontWeight: 700 }}>SHIFT {s}</span>
                        {s === shift && <Tag color={C.indigo} bg={C.indigoLight}>ACTIVE</Tag>}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.7rem", color: C.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text.slice(0, 28)}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

// ── PASSWORD STRENGTH ANALYZER ────────────────────────────────────────────────
function PasswordStrength() {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);

  const analyze = p => {
    const checks = {
      length8:  p.length >= 8,
      length12: p.length >= 12,
      length16: p.length >= 16,
      upper:    /[A-Z]/.test(p),
      lower:    /[a-z]/.test(p),
      digit:    /[0-9]/.test(p),
      special:  /[^A-Za-z0-9]/.test(p),
      noRepeat: !/(.)\1{2,}/.test(p),
      noCommon: !["password","123456","qwerty","admin","letmein","welcome","monkey","dragon"].includes(p.toLowerCase()),
    };
    const charset = (checks.upper ? 26 : 0) + (checks.lower ? 26 : 0) + (checks.digit ? 10 : 0) + (checks.special ? 32 : 0);
    const entropy = charset > 0 && p.length > 0 ? Math.round(p.length * Math.log2(charset)) : 0;
    const passedCount = Object.values(checks).filter(Boolean).length;
    const score = Math.round((passedCount / Object.keys(checks).length) * 100);
    let strength = "Very Weak", color = C.red;
    if (score >= 80) { strength = "Very Strong"; color = C.green; }
    else if (score >= 65) { strength = "Strong"; color = C.teal; }
    else if (score >= 45) { strength = "Moderate"; color = C.amber; }
    else if (score >= 25) { strength = "Weak"; color = C.red; }
    const crackTime = entropy < 28 ? "< 1 second" : entropy < 40 ? "Minutes" : entropy < 55 ? "Hours–Days" : entropy < 70 ? "Years" : entropy < 90 ? "Centuries" : "Astronomical";
    return { checks, entropy, score, strength, color, crackTime };
  };

  const { checks, entropy, score, strength, color: sc, crackTime } = analyze(pwd);
  const checkItems = [
    { key: "length8",  label: "At least 8 characters" },
    { key: "length12", label: "At least 12 characters" },
    { key: "length16", label: "At least 16 characters (ideal)" },
    { key: "upper",    label: "Contains uppercase (A-Z)" },
    { key: "lower",    label: "Contains lowercase (a-z)" },
    { key: "digit",    label: "Contains digits (0-9)" },
    { key: "special",  label: "Contains special characters (!@#…)" },
    { key: "noRepeat", label: "No 3+ repeated characters" },
    { key: "noCommon", label: "Not a common password" },
  ];
  const suggestions = [
    { pwd: "SecureP@ss2024!", label: "Medium" },
    { pwd: "Tr0ub4dor&3!", label: "Diceware" },
    { pwd: "correct-horse-battery!", label: "Passphrase" },
    { pwd: "X9#mK$vQ!pL2@nR8", label: "Random 16" },
  ];

  return (
    <section id="password" style={{ padding: "7rem 2rem", background: C.bgAlt }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <SectionHeading tag="New Feature · Password Security" title="Password Strength Analyzer" subtitle="Instantly assess your password's security with entropy calculations, crack-time estimates, and actionable feedback." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "1.5rem" }}>
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: C.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🛡️</div>
              <div><div style={{ fontWeight: 700, color: C.text, fontSize: "0.95rem" }}>Test Your Password</div><div style={{ color: C.muted, fontSize: "0.72rem" }}>Analyzed locally — never sent anywhere</div></div>
            </div>
            <div style={{ position: "relative" }}>
              <input type={show ? "text" : "password"} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Enter a password to analyze…"
                style={{ width: "100%", background: C.bg, border: `2px solid ${pwd ? sc + "60" : C.border}`, borderRadius: 12, padding: "12px 48px 12px 16px", color: C.text, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", outline: "none", transition: "border-color 0.3s", letterSpacing: "0.05em" }} />
              <button onClick={() => setShow(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "1rem" }}>{show ? "🙈" : "👁️"}</button>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: "0.72rem", color: C.muted }}>Strength</span>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: sc }}>{pwd ? strength : "—"}</span>
              </div>
              <div style={{ height: 8, background: C.bg, borderRadius: 99, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <motion.div animate={{ width: pwd ? `${score}%` : "0%" }} transition={{ duration: 0.5 }} style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg,${sc},${sc}cc)` }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginTop: "1rem" }}>
              {[["Entropy", `${entropy} bits`, C.indigo], ["Length", `${pwd.length} chars`, C.purple], ["Crack time", crackTime, sc], ["Score", `${score}/100`, sc]].map(([l, v, c]) => (
                <div key={l} style={{ background: C.bg, borderRadius: 10, padding: "8px 12px", borderLeft: `3px solid ${c}` }}>
                  <div style={{ fontSize: "0.62rem", color: C.muted, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "1.1rem" }}>
              <div style={{ fontSize: "0.72rem", color: C.muted, fontWeight: 500, marginBottom: "0.5rem" }}>Try examples:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {suggestions.map(s => (
                  <button key={s.label} onClick={() => setPwd(s.pwd)} style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.textMid, padding: "3px 10px", borderRadius: 7, cursor: "pointer", fontSize: "0.68rem", transition: "all 0.15s" }}>{s.label}</button>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ fontWeight: 700, color: C.text, fontSize: "0.95rem", marginBottom: 4 }}>Security Checklist</div>
            <div style={{ color: C.muted, fontSize: "0.72rem", marginBottom: "1.25rem" }}>NIST-recommended password requirements</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {checkItems.map(({ key, label }) => {
                const passed = checks[key];
                return (
                  <motion.div key={key} animate={{ background: pwd ? (passed ? C.greenLight : C.redLight) : C.bg }}
                    style={{ borderRadius: 10, padding: "9px 14px", border: `1px solid ${pwd ? (passed ? C.green + "30" : C.red + "20") : C.border}`, display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: pwd ? (passed ? C.green : C.redLight) : C.bg, border: `1.5px solid ${pwd ? (passed ? C.green : C.red + "40") : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", flexShrink: 0, color: pwd ? (passed ? "#fff" : C.red) : C.muted }}>
                      {pwd ? (passed ? "✓" : "✕") : "·"}
                    </div>
                    <span style={{ fontSize: "0.78rem", color: pwd ? (passed ? C.textMid : C.muted) : C.muted, fontWeight: pwd && passed ? 600 : 400 }}>{label}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} style={{ ...card, padding: "1.75rem" }}>
            <div style={{ fontWeight: 700, color: C.text, fontSize: "0.95rem", marginBottom: 4 }}>Entropy Scale</div>
            <div style={{ color: C.muted, fontSize: "0.72rem", marginBottom: "1.25rem" }}>H = L × log₂(N) — bits of security per password type</div>
            {[
              { label: "4-digit PIN", e: 13, time: "< 1 sec", color: C.red },
              { label: "8-char lowercase", e: 38, time: "Hours", color: C.red },
              { label: "8-char mixed", e: 52, time: "Decades", color: C.amber },
              { label: "12-char mixed+symbols", e: 79, time: "Centuries", color: C.teal },
              { label: "16-char random", e: 105, time: "Heat death", color: C.green },
            ].map(({ label, e, time, color }) => (
              <div key={label} style={{ marginBottom: "0.9rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.75rem", color: C.textMid, fontWeight: 500 }}>{label}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.68rem", color }}>~{e} bits</span>
                    <Tag color={color} bg={color + "18"}>{time}</Tag>
                  </div>
                </div>
                <div style={{ height: 6, background: C.bg, borderRadius: 99, overflow: "hidden", border: `1px solid ${C.border}` }}>
                  <div style={{ height: "100%", width: `${Math.min(100, e / 1.1)}%`, borderRadius: 99, background: color }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: "1rem", background: C.indigoLight, borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.indigo}20` }}>
              <div style={{ fontSize: "0.7rem", color: C.indigo, fontWeight: 700, marginBottom: 2 }}>RSA Connection</div>
              <div style={{ fontSize: "0.72rem", color: C.textMid, lineHeight: 1.6 }}>A 2048-bit RSA key has ~617 bits of security — equivalent to a 100+ character truly random password.</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ padding: "3.5rem 2rem", background: C.text, textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "0.75rem" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `linear-gradient(135deg, ${C.indigo}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🔐</div>
        <span style={{ fontFamily: "'Sora', sans-serif", color: "#fff", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>SecureCrypt</span>
      </div>
      <p style={{ color: "#94a3b8", fontSize: "0.8rem", fontFamily: "'Sora', sans-serif", maxWidth: "480px", margin: "0 auto 1.5rem", lineHeight: 1.7 }}>
        A cryptography education platform. All RSA computation runs locally in your browser — zero data transmitted to any server.
      </p>
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
        {["RSA", "Miller-Rabin", "Modular Exponentiation", "Extended GCD", "Sieve"].map(t => (
          <span key={t} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", padding: "3px 12px", borderRadius: "999px", fontSize: "0.68rem", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>{t}</span>
        ))}
      </div>
    </footer>
  );
}

const ALL_SECTIONS = ["hero", "simulator", "modular", "primes", "demo", "analysis", "cipher", "password"];

export default function App() {
  const [activeSection, setActiveSection] = useState("hero");
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); });
    }, { threshold: 0.3 });
    ALL_SECTIONS.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:#f0f4ff;font-family:'Sora',sans-serif}
        ::-webkit-scrollbar{width:5px;background:#f0f4ff}
        ::-webkit-scrollbar-thumb{background:#c7d2fe;border-radius:3px}
        input,textarea,button,select{font-family:inherit}
        ::selection{background:#c7d2fe;color:#1e1b4b}
      `}</style>
      <Nav active={activeSection} setActive={setActiveSection} />
      <Hero />
      <RSASimulator />
      <ModularVisualizer />
      <PrimeGenerator />
      <SecurityDemo />
      <AlgorithmAnalysis />
      <CaesarCipher />
      <PasswordStrength />
      <Footer />
    </div>
  );
}
