const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3000;

// --- Rate limiting (concurrencia) + Timeout ---
// IMPORTANTE: esto funciona perfecto en endpoints async (health, users, slow, etc.)
// pero NO puede interceptar mientras /heavy está bloqueando el hilo con cálculo sincrónico
// (Node es single-thread: ningún middleware corre hasta que el cálculo actual termina).
// Es a propósito, para mostrar esa diferencia en la demo.
const MAX_CONCURRENT = 4;
const REQUEST_TIMEOUT_MS = 3000;
let activeRequests = 0;

// --- Colores para consola (sin dependencias externas) ---
const color = {
  reset: '\x1b[0m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m',
};

app.use((req, res, next) => {
  // /status no compite por cupo: es el semáforo, no debe verse afectado por lo que mide
  if (req.path === '/status') return next();

  const inicio = Date.now();
  const hora = new Date().toLocaleTimeString('es-EC', { hour12: false });

  console.log(`${color.cyan}→ [${hora}] ${req.method} ${req.originalUrl}${color.reset} ${color.dim}(en uso: ${activeRequests}/${MAX_CONCURRENT})${color.reset}`);

  if (activeRequests >= MAX_CONCURRENT) {
    console.log(`${color.yellow}  ⤷ 429 RECHAZADO (cupo lleno)${color.reset}`);
    return res.status(429).json({
      error: 'Rate limit: demasiadas solicitudes concurrentes',
      activas: activeRequests,
      limite: MAX_CONCURRENT,
    });
  }

  activeRequests++;

  const timer = setTimeout(() => {
    if (!res.headersSent) {
      console.log(`${color.red}  ⤷ 503 TIMEOUT tras ${REQUEST_TIMEOUT_MS}ms → ${req.originalUrl}${color.reset}`);
      res.status(503).json({ error: `Timeout: la solicitud superó los ${REQUEST_TIMEOUT_MS}ms` });
    }
  }, REQUEST_TIMEOUT_MS);

  const liberar = () => {
    activeRequests = Math.max(0, activeRequests - 1);
    clearTimeout(timer);
    const ms = Date.now() - inicio;
    const codigo = res.statusCode;
    const c = codigo >= 500 ? color.red : codigo >= 400 ? color.yellow : color.green;
    console.log(`${c}  ⤷ ${codigo} en ${ms}ms → ${req.originalUrl}${color.reset}`);
  };
  res.on('finish', liberar);
  res.on('close', liberar);

  next();
});

// In-memory "DB" bien simple
let users = [
  { id: 1, name: 'Ana' },
  { id: 2, name: 'Luis' },
];

// 1) Endpoint simple GET - caso "feliz"
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// 2) GET con "datos" - para mostrar Response Assertion sobre el body
app.get('/users', (req, res) => {
  res.status(200).json(users);
});

// 3) POST - para mostrar Body Data + Header Manager en JMeter
app.post('/users', (req, res) => {
  const { name } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'name es requerido' });
  }
  const newUser = { id: users.length + 1, name };
  users.push(newUser);
  res.status(201).json(newUser);
});

// 4) Endpoint lento - para mostrar tiempos de respuesta / timeouts en el reporte
app.get('/slow', (req, res) => {
  const delayMs = Number(req.query.ms) || 2000;
  setTimeout(() => {
    res.status(200).json({ status: 'ok', delayed_ms: delayMs });
  }, delayMs);
});

// 5) Endpoint que falla siempre - para mostrar manejo de errores / % error en el reporte
app.get('/error', (req, res) => {
  res.status(500).json({ error: 'algo salió mal (a propósito)' });
});

// 7) Endpoint PESADO (CPU-bound, bloquea el event loop) - para forzar el colapso real bajo carga
function fibLento(n) {
  if (n <= 1) return n;
  return fibLento(n - 1) + fibLento(n - 2);
}
app.get('/heavy', (req, res) => {
  const n = Number(req.query.n) || 35; // subí el valor de n para hacerlo más pesado
  const resultado = fibLento(n);
  res.status(200).json({ n, resultado });
});

// 6) Endpoint con variable en la URL - para mostrar uso de Variables en JMeter
app.get('/users/:id', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'no encontrado' });
  res.status(200).json(user);
});

// Endpoint de estado - lo consulta la UI cada cierto tiempo para mostrar el cupo en vivo
app.get('/status', (req, res) => {
  res.status(200).json({ activeRequests, max: MAX_CONCURRENT });
});

app.listen(PORT, () => {
  console.log(`API de prueba corriendo en http://localhost:${PORT}`);
  console.log(`UI de demo: http://localhost:${PORT}`);
});