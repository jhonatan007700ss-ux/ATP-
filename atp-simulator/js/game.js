/* ============================================================
   ATP CHALLENGE — Edição Escritório
   Motor ATP + mundo 2D com boneco controlável
   ============================================================ */
"use strict";

/* ============ 1. CONFIG & ESTADO ============ */
const CFG = {
  MISSIONS: 5,
  ACCOM_DAYS: 2,
  PRODUCTS: [
    { name: "Isoflex Topas NB 52",   vke: "10002456" },
    { name: "Klüberalfa 4-TR N",     vke: "10003512" },
    { name: "Berkutu 24-61",         vke: "10007720" },
    { name: "Klübersynth GEM 4-220", vke: "10005108" },
    { name: "Dynamus PM 2-220",      vke: "10006344" },
    { name: "Microlube GL 261",      vke: "10004009" },
    { name: "Grais Highspeed 41",    vke: "10008871" },
    { name: "Klübersynth UH1 14-51", vke: "10009153" }
  ],
  CLIENTS: ["Metalúrgica Aurora LTDA","Indústria Vale Verde S.A.","Autoparts São Bento",
    "Companhia Siderúrgica Leste","Usina Rio Claro","Ferroviária Central Cargo",
    "Plásticos União Norte","Têxtil Santa Clara","Frigorífico Boa Mesa","Cimentos Planalto Industrial"],
  REPS: ["Marcos T.","Renata S.","Alexandre P.","Fernanda L.","Rodrigo C."]
};
const DIFF = {
  facil:  { step: 5, queues: [2,3] },
  medio:  { step: 5, queues: [3,5] },
  dificil:{ step: 1, queues: [4,6] }
};

/* estações do escritório: id, rótulo, emoji, posição (%, %), ordem */
const STATIONS = [
  { id: "terminal",  label: "Terminal TOTVS",    ico: "🖥️", x: 14, y: 62 },
  { id: "calc",      label: "Mesa de Cálculo",   ico: "🧮", x: 38, y: 40 },
  { id: "fila",      label: "Quadro da Fila",    ico: "📋", x: 62, y: 40 },
  { id: "phone",     label: "Telefone / Decisão",ico: "☎️", x: 86, y: 62 },
  { id: "email",     label: "Correio",           ico: "📮", x: 86, y: 84 },
  { id: "dock",      label: "Doca / Armazéns",   ico: "🚛", x: 62, y: 90 },
  { id: "boss",      label: "Mesa do Chefe",     ico: "👨‍💼", x: 38, y: 90 }
];

const state = {
  difficulty: "medio", player: "operador",
  mission: 0, score: 0, turnScore: 0, quality: 100, day: 1,
  scene: null, verif: null, calcOk: false,
  decision: null, releaseDone: null,
  doneStations: [],      // ids já concluídas na missão
  overlayOpen: null,
  gameOver: false
};

/* ============ 2. RNG & GERAÇÃO PROCEDIMENTAL ============ */
function makeRng(seed){
  let s = seed >>> 0;
  return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function qty(rng, diff, min, max){
  const d = DIFF[diff];
  const lo = Math.ceil(min / d.step), hi = Math.floor(max / d.step);
  return Math.floor(lo + rng() * (hi - lo + 1)) * d.step;
}
function pick(rng, arr){ return arr[Math.floor(rng() * arr.length)]; }
function rngInt(rng, n){ return Math.floor(rng() * (n + 1)); }
function addBusinessDays(fromISO, n, fmtBR){
  const d = new Date(fromISO + "T00:00:00"); let added = 0;
  while (added < n){
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  if (fmtBR){
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  }
  return d.toISOString().slice(0, 10);
}
function fmt(n){ return n.toLocaleString("pt-BR"); }

function generateScene(missionIndex, diff){
  const rng = makeRng((Date.now() % 2147483647) ^ (missionIndex * 7919 + 13));
  const d = DIFF[diff];
  const product = pick(rng, CFG.PRODUCTS);

  /* quantidades na faixa 5–40, como pedido pelo treinamento */
  const A1 = qty(rng, diff, 10, 40);
  const A2 = qty(rng, diff, 5, 25);
  const B  = qty(rng, diff, 5, 30);
  const C1 = qty(rng, diff, 5, Math.min(20, A1));
  const C2 = qty(rng, diff, 0,  Math.min(15, A2));
  const A = A1 + A2, C = C1 + C2;
  const availableTotal = A + B - C;
  const saldoLiquido = A + B;

  const queueSize = d.queues[0] + Math.floor(rng() * (d.queues[1] - d.queues[0] + 1));
  const missionPos = Math.min(queueSize, 1 + Math.floor(rng() * Math.min(queueSize, 5)));

  const missionQty = qty(rng, diff,
    Math.min(40, Math.max(d.step, Math.floor(availableTotal * 0.25))),
    Math.min(40, Math.max(d.step * 3, Math.floor(availableTotal * 0.7))));

  const consumeRatio = pick(rng, [0, 0.35, 0.6, 0.9, 1.15, 1.4]);
  const targetAbove = Math.max(0, Math.round(availableTotal * consumeRatio));

  const queue = [];
  for (let i = 1; i <= queueSize; i++){
    const client = pick(rng, CFG.CLIENTS);
    const rep = pick(rng, CFG.REPS);
    if (i === missionPos){
      queue.push({ pos: i, pedido: `PED-${10000 + rngInt(rng, 8999)}`, cliente: client,
        vendedor: rep, qtd: missionQty, isMission: true });
    } else {
      const q = qty(rng, diff, 5, 20);
      queue.push({ pos: i, pedido: `PED-${10000 + rngInt(rng, 8999)}`, cliente: client,
        vendedor: rep, qtd: q, isMission: false });
    }
  }
  /* Ajusta o pedido imediatamente acima para que o consumo da fila
     seja EXATAMENTE a soma dos pedidos acima — o mesmo valor que o
     jogador lê no "Saldo após" da aba Entradas e Saídas. */
  const nAbove = missionPos - 1;
  if (nAbove > 0){
    const lastAbove = queue[missionPos - 2];
    const sumSoFar = queue
      .filter(p => p.pos < missionPos)
      .reduce((t, p) => t + p.qtd, 0);
    const delta = targetAbove - sumSoFar;
    lastAbove.qtd = Math.min(40, Math.max(DIFF[diff].step, lastAbove.qtd + delta));
  }
  const aboveConsumed = queue
    .filter(p => p.pos < missionPos)
    .reduce((t, p) => t + p.qtd, 0);
  const queueAvailable = Math.max(0, availableTotal - aboveConsumed);

  const impacted = [];
  if (queueAvailable < missionQty){
    let rem = availableTotal;
    for (const p of queue){
      if (p.pos >= missionPos) break;
      rem -= p.qtd;
      if (rem < 0) impacted.push(p.pedido);
    }
  }

  const hasInbound = rng() < 0.75;
  let inbound = null;
  if (hasInbound){
    const inQty = qty(rng, diff, missionQty, Math.min(40, missionQty * 2));
    const inDays = 2 + Math.floor(rng() * 12);
    inbound = { qtd: inQty, date: addBusinessDays(todayISO(), inDays, true),
                iso: addBusinessDays(todayISO(), inDays, false) };
  }

  let conduta;
  if (queueAvailable >= missionQty) conduta = "total";
  else if (queueAvailable > 0)      conduta = "parcial";
  else if (inbound)                 conduta = "entrada";
  else                              conduta = "escalonar";

  return { product, A1, A2, B, C1, C2, A, C, availableTotal, saldoLiquido,
    queue, missionPos, missionQty, aboveConsumed, queueAvailable,
    impacted, inbound, conduta,
    ofNumber: `OF-${200000 + rngInt(rng, 9999)}`,
    pedidoMission: queue[missionPos - 1].pedido };
}
function todayISO(){ return new Date().toISOString().slice(0, 10); }

/* ============ 3. HELPERS DOM ============ */
const $ = (id) => document.getElementById(id);
const hide = (el) => { el.hidden = true; };
const show = (el) => { el.hidden = false; };
function feedback(el, msg, cls){ el.textContent = msg; el.className = "feedback " + cls; show(el); }
function showTask(id){
  ["task-terminal","task-calc","task-fila","task-decision",
   "task-email","task-release","task-boss","task-result"].forEach(t => {
    const el = $(t); if (el) hide(el);
  });
  if (id) show($(id));
}

/* ============ 4. MUNDO 2D: ESTAÇÕES E BONECO ============ */
const world = $("world");
const boneco = $("boneco");
const bubble = $("interact-bubble");

/* posição do boneco em % do mundo */
const player = { x: 50, y: 70, vx: 0, vy: 0, facing: 1, nearStation: null };
const SPEED = 26;          // % por segundo
const KEYS = {};
const DIR_KEYS = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right"
};

/* --- cria as estações --- */
function buildStations(){
  const wrap = $("stations");
  wrap.innerHTML = "";
  STATIONS.forEach(st => {
    const el = document.createElement("div");
    el.className = "station";
    el.id = "st-" + st.id;
    el.style.left = st.x + "%";
    el.style.top = st.y + "%";
    el.innerHTML =
      `<div class="st-sprite">${st.ico}<span class="st-estado pendente" id="estado-${st.id}">!</span></div>` +
      `<div class="st-label">${st.label}</div>`;
    el.addEventListener("click", () => {
      /* clique = caminhar até a estação e interagir */
      walkTo(st.x, st.y, () => interactStation(st.id));
    });
    wrap.appendChild(el);
  });
}

/* estado visual das estações */
function refreshStations(){
  const nextId = nextStation();
  STATIONS.forEach(st => {
    const el = $("st-" + st.id);
    const badge = $("estado-" + st.id);
    if (!el || !badge) return;
    const done = state.doneStations.includes(st.id);
    const isNext = st.id === nextId;
    el.classList.toggle("trancada", !done && !isNext);
    el.classList.toggle("feita", done);
    badge.className = "st-estado " + (done ? "feito" : (isNext ? "ativa" : "pendente"));
    badge.textContent = done ? "✓" : (isNext ? "?" : "!");
  });
}
/* ordem de progresso da missão */
const FLOW = ["terminal", "calc", "fila", "phone", "email", "dock", "boss"];
function nextStation(){
  for (const id of FLOW){
    if (!state.doneStations.includes(id)){
      if (id === "fila" && state.scene && state.scene.impacted.length === 0) continue; // sem impactados
      if (id === "email" && state.decision !== "parcial" &&
          !(state.scene && state.emailNeeded)) continue;
      return id;
    }
  }
  return null;
}

/* --- movimentação --- */
window.addEventListener("keydown", (e) => {
  if (state.overlayOpen){
    if (e.code === "Escape") closeOverlay();
    return;
  }
  if (DIR_KEYS[e.code]){
    KEYS[DIR_KEYS[e.code]] = true;
    e.preventDefault();
  }
  if (e.code === "KeyE" && player.nearStation) interactStation(player.nearStation);
});
window.addEventListener("keyup", (e) => {
  if (DIR_KEYS[e.code]) KEYS[DIR_KEYS[e.code]] = false;
});

/* d-pad touch */
document.querySelectorAll(".dp").forEach(btn => {
  const dir = btn.dataset.dir;
  const on = (ev) => { ev.preventDefault(); KEYS[dir] = true; };
  const off = (ev) => { ev.preventDefault(); KEYS[dir] = false; };
  btn.addEventListener("pointerdown", on);
  btn.addEventListener("pointerup", off);
  btn.addEventListener("pointerleave", off);
});

/* clique/toque no mundo: andar até o ponto */
world.addEventListener("pointerdown", (e) => {
  if (state.overlayOpen) return;
  const r = world.getBoundingClientRect();
  const tx = (e.clientX - r.left) / r.width * 100;
  const ty = (e.clientY - r.top) / r.height * 100;
  /* se clicou numa estação o handler próprio cuida */
  if (e.target.closest(".station")) return;
  walkTo(tx, ty);
});

/* caminhada automática até (tx, ty) */
let autoWalk = null;
function walkTo(tx, ty, then){
  autoWalk = { tx: clamp(tx, 6, 94), ty: clamp(ty, 14, 95), then: then || null };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* loop principal */
let lastT = performance.now();
function loop(t){
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  if (!state.overlayOpen) updatePlayer(dt);
  requestAnimationFrame(loop);
}
function updatePlayer(dt){
  let dx = 0, dy = 0;
  if (KEYS.left)  dx -= 1;
  if (KEYS.right) dx += 1;
  if (KEYS.up)    dy -= 1;
  if (KEYS.down)  dy += 1;
  if (autoWalk){
    const ddx = autoWalk.tx - player.x, ddy = autoWalk.ty - player.y;
    const dist = Math.hypot(ddx, ddy);
    if (dist < 1.2){
      player.x = autoWalk.tx; player.y = autoWalk.ty;
      const cb = autoWalk.then; autoWalk = null;
      if (cb) cb();
    } else {
      dx = ddx / dist; dy = ddy / dist;
    }
  }
  const moving = dx !== 0 || dy !== 0;
  if (moving && !autoWalk){
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
  }
  if (moving){
    player.x = clamp(player.x + dx * SPEED * dt, 6, 94);
    player.y = clamp(player.y + dy * SPEED * dt, 14, 95);
    if (dx !== 0) player.facing = dx > 0 ? 1 : -1;
    boneco.classList.toggle("andando", true);
    boneco.classList.toggle("esq", player.facing < 0);
  } else {
    boneco.classList.remove("andando");
  }
  boneco.style.left = player.x + "%";
  boneco.style.top = player.y + "%";

  /* estação próxima? */
  let near = null, best = 999;
  STATIONS.forEach(st => {
    const dist = Math.hypot(st.x - player.x, (st.y - player.y) * 0.9);
    if (dist < 11 && dist < best){ best = dist; near = st.id; }
  });
  player.nearStation = near;
  if (near && !state.overlayOpen){
    const st = STATIONS.find(s => s.id === near);
    const isDone = state.doneStations.includes(near);
    bubble.innerHTML = `Pressione <b>E</b> — ${st.label}` +
      (isDone ? ` <small>(revisar)</small>` : "");
    bubble.style.left = player.x + "%";
    bubble.style.top = player.y + "%";
    show(bubble);
  } else {
    hide(bubble);
  }
}
requestAnimationFrame(loop);

/* ============ 5. INTERAÇÃO COM ESTAÇÕES ============ */
/* Regras de acesso:
   - estação ainda não liberada na sequência → trancada (flash de aviso)
   - estação concluída → REVISÁVEL: painel abre em modo leitura,
     sem cobrar resposta de novo e sem re-pontuar
   - estação atual → interativa */
function interactStation(id){
  if (state.overlayOpen) return;
  const next = nextStation();
  const done = state.doneStations.includes(id);
  if (!done && id !== next){ flashHint(); return; }
  openOverlay(id, done ? "review" : "play");
}
function flashHint(){
  const h = $("hud-hint");
  const orig = h.textContent;
  h.textContent = "⛔ Complete a estação indicada antes de avançar!";
  setTimeout(() => { h.textContent = currentHint(); }, 1400);
}

function openOverlay(stationId, mode){
  state.overlayOpen = stationId;
  state.overlayMode = mode || "play";
  show($("overlay"));
  const titles = {
    terminal: "🖥️ Terminal TOTVS — Saldos & Fila",
    calc: "🧮 Mesa de Cálculo — Disponibilidade",
    fila: "📋 Quadro da Fila — Pedidos Impactados",
    phone: "☎️ Telefone — Árvore de Decisões",
    email: "📮 Correio — Solicitação por E-mail",
    dock: "🚛 Doca — Liberação e OS",
    boss: "👨‍💼 Mesa do Chefe — Registro da Análise"
  };
  $("overlay-title").textContent = titles[stationId] || "Estação";
  if (state.overlayMode === "review"){
    $("overlay-title").textContent += "  (revisão — leitura)";
  }
  /* mapa estação → seção do painel (nomes divergem: phone→task-decision, dock→task-release) */
  const taskIds = { terminal: "task-terminal", calc: "task-calc", fila: "task-fila",
    phone: "task-decision", email: "task-email", dock: "task-release", boss: "task-boss" };
  showTask(taskIds[stationId] || ("task-" + stationId));
  applyReviewMode();
  boneco.classList.remove("andando");
}
/* modo revisão: desabilita ações para não re-responder/re-pontuar */
function applyReviewMode(){
  const review = state.overlayMode === "review";
  /* botões de ação (o btn-send-mail é controlado pela validação dos campos) */
  ["btn-calc","btn-boss-check"].forEach(id => {
    const b = $(id); if (b) b.disabled = review;
  });
  /* inputs do cálculo e do registro */
  document.querySelectorAll("#task-calc input, .boss-gap").forEach(inp => {
    inp.disabled = review;
  });
  /* verificação: botões todos inativos */
  document.querySelectorAll("#verify-buttons .vbtn").forEach(b => {
    if (review) b.disabled = true;
  });
  /* impacto e decisão */
  const impactBtn = $("impact-checks") ? $("impact-checks").querySelector("button") : null;
  if (impactBtn) impactBtn.disabled = review;
  document.querySelectorAll("#impact-checks input").forEach(i => { i.disabled = review; });
  document.querySelectorAll("#decision-cards .dcard").forEach(b => { b.disabled = review; });
  document.querySelectorAll(".release-card").forEach(b => { b.disabled = review; });
  /* campos do correio (novo formato) */
  ["mf1", "mf2", "mf3", "mail-subject", "mail-body"].forEach(id => {
    const el = $(id); if (el) el.disabled = review;
  });
  /* na revisão, mostrar as respostas corretas como consulta */
  if (review) showReviewAnswers();
}
function showReviewAnswers(){
  const s = state.scene;
  const station = state.overlayOpen;
  if (station === "email"){
    const spec = emailSpec();
    spec.forEach((f, i) => {
      const inp = $("mf" + (i + 1));
      inp.value = f.val;
      inp.classList.add("ok");
    });
    feedback($("mail-feedback"),
      "Revisão — respostas corretas exibidas nos campos (não vale pontos).", "ok");
  } else if (station === "calc"){
    $("in-avb").value = s.availableTotal;
    $("in-queue-avail").value = s.queueAvailable;
    feedback($("calc-feedback"),
      "Revisão — respostas corretas exibidas nos campos (não vale pontos).", "ok");
  } else if (station === "terminal"){
    feedback($("verify-feedback"),
      "Revisão — dados da missão: produto, VKE, quantidade, pedido e OF corretos já confirmados.", "ok");
  } else if (station === "boss"){
    $("boss-text").querySelectorAll(".boss-gap").forEach(inp => {
      if (inp.type === "date") inp.value = inp.dataset.expected;
      else inp.value = inp.dataset.expected;
      inp.classList.add("ok");
    });
    feedback($("boss-feedback"),
      "Revisão — modelo preenchido com os valores corretos (não vale pontos).", "ok");
  }
}
function closeOverlay(){
  state.overlayOpen = null;
  hide($("overlay"));
  $("world").focus();
}
$("overlay-close").addEventListener("click", closeOverlay);

function completeStation(id){
  if (!state.doneStations.includes(id)) state.doneStations.push(id);
  refreshStations();
  const h = $("hud-hint");
  h.textContent = currentHint();
  updateEtapaBadge();
}
/* chip de ETAPA no cabeçalho: sequência atual + nome */
const ETAPA_LABELS = {
  terminal: "Verificação Inicial",
  calc: "Cálculo da Disponibilidade",
  fila: "Pedidos Impactados",
  phone: "Árvore de Decisões",
  email: "Solicitação por E-mail",
  dock: "Liberação e OS",
  boss: "Registro da Análise"
};
function updateEtapaBadge(){
  const chip = $("hud-etapa");
  if (!chip) return;
  const n = nextStation();
  if (!n){ chip.textContent = "ETAPA 7/7 · Concluída 🎉"; return; }
  /* total de etapas ativas na missão (fila/email podem ser puladas) */
  const active = FLOW.filter(id => {
    if (id === "fila" && state.scene && state.scene.impacted.length === 0) return false;
    if (id === "email" && state.decision !== "parcial" && !state.emailNeeded) return false;
    return true;
  });
  const idx = active.indexOf(n);
  chip.textContent = `ETAPA ${idx + 1}/${active.length} · ${ETAPA_LABELS[n] || "Concluída"}`;
}
function currentHint(){
  const map = {
    terminal: "Confirme os dados no Terminal TOTVS",
    calc: "Vá à Mesa de Cálculo calcular A+B−C",
    fila: "Marque os pedidos impactados no Quadro da Fila",
    phone: "Ligue (decida) a conduta no Telefone",
    email: "Vá ao Correio enviar a solicitação",
    dock: "Vá à Doca liberar o pedido por UM armazém",
    boss: "Preencha o registro na Mesa do Chefe"
  };
  const n = nextStation();
  if (!n) return "Missão concluída!";
  return map[n] || "";
}


/* ============ 6. ESTAÇÃO: TERMINAL TOTVS ============ */
function renderSaldos(scene){
  const grid = $("saldos-table");
  grid.innerHTML = "";
  const row = document.createElement("div");
  row.className = "row focused";
  [scene.product.name, scene.product.vke, fmt(scene.A1), fmt(scene.A2), fmt(scene.B),
   fmt(scene.C1), fmt(scene.C2), fmt(scene.saldoLiquido)].forEach((c, i) => {
    const s = document.createElement("span");
    s.textContent = c;
    if (i > 1) s.className = "num" + (i === 7 ? " trap" : "");
    row.appendChild(s);
  });
  grid.appendChild(row);
  const rng = makeRng(Number(scene.product.vke.slice(-4)));
  for (let i = 0; i < 2; i++){
    const r = document.createElement("div");
    r.className = "row";
    const other = CFG.PRODUCTS[(Number(scene.product.vke.slice(-2)) + i * 3) % CFG.PRODUCTS.length];
    const v = () => qty(rng, "facil", 5, 40);
    [other.name, other.vke, v(), v(), v(), v(), v(), 0].forEach((c, j) => {
      const s = document.createElement("span");
      s.textContent = fmt(c);
      if (j > 1) s.className = "num" + (j === 7 ? " trap" : "");
      r.appendChild(s);
    });
    grid.appendChild(r);
  }
}
function renderFila(scene){
  const grid = $("fila-table");
  grid.innerHTML = "";
  let saldo = scene.availableTotal;
  const addRow = (cells, cls, tip) => {
    const div = document.createElement("div");
    div.className = "row " + (cls || "");
    if (tip) div.title = tip;
    cells.forEach(c => {
      const s = document.createElement("span");
      if (c && c.__badge){ const b = document.createElement("span"); b.className = "badge-mov " + c.cls; b.textContent = c.txt; s.appendChild(b); }
      else if (c && c.__saldo){ s.className = "saldo-pos " + c.cls; s.textContent = c.txt; }
      else { s.textContent = c; }
      div.appendChild(s);
    });
    grid.appendChild(div);
  };
  addRow(["0", "—", "SALDO INICIAL", scene.product.vke, fmt(scene.A + scene.B),
    { __badge: true, cls: "in", txt: "SALDO" }, "—",
    { __saldo: true, cls: clsPos(saldo), txt: fmt(saldo) }]);
  scene.queue.forEach(p => {
    saldo -= p.qtd;
    const vkeCell = p.vke || scene.product.vke;   // VKE visível em TODA linha
    if (p.isMission){
      addRow([String(p.pos), p.pedido, p.cliente, vkeCell, fmt(p.qtd),
        { __badge: true, cls: "miss", txt: "MISSÃO" }, "hoje",
        { __saldo: true, cls: clsPos(saldo), txt: fmt(saldo) }],
        "mission-row", "Pedido da sua missão");
    } else {
      const hi = p.pos < scene.missionPos;
      addRow([String(p.pos), p.pedido, p.cliente, vkeCell, fmt(p.qtd),
        { __badge: true, cls: "out", txt: "SAÍDA" }, "hoje",
        { __saldo: true, cls: clsPos(saldo), txt: fmt(saldo) }],
        (hi ? "pos-hi " : ""), hi ? "Pedido ACIMA da sua posição — prioridade" : "Pedido abaixo");
    }
  });
  if (scene.inbound){
    saldo += scene.inbound.qtd;
    addRow(["—", "ENTRADA", "Ordem de compra", scene.product.vke, fmt(scene.inbound.qtd),
      { __badge: true, cls: "in", txt: "ENTRADA" }, scene.inbound.date,
      { __saldo: true, cls: clsPos(saldo), txt: fmt(saldo) }]);
  }
}
function clsPos(v){ return v < 0 ? "neg" : (v === 0 ? "zero" : "pos"); }

/* abas do terminal */
document.querySelectorAll(".totvs-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".totvs-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".totvs-panel").forEach(p => p.classList.remove("active"));
    $("tab-" + tab.dataset.tab).classList.add("active");
  });
});

/* verificação inicial dentro do terminal */
function startVerify(){
  const s = state.scene;
  const items = [
    { label: `Produto: ${s.product.name}`, val: true },
    { label: `VKE: ${s.product.vke}`, val: true },
    { label: `Quantidade: ${fmt(s.missionQty)} un.`, val: true },
    { label: `Pedido: ${s.pedidoMission}`, val: true },
    { label: `OF: ${s.ofNumber}`, val: true }
  ];
  const wrongs = [
    { label: `VKE: ${"1000" + String(Math.floor(10000 + Math.random() * 89999)).slice(0, 4)}`, val: false },
    { label: `Produto: ${wrongProduct()}`, val: false }
  ];
  items.push(wrongs[0], wrongs[1]);
  items.sort(() => Math.random() - 0.5);

  state.verif = { done: 0 };
  const wrap = $("verify-buttons");
  wrap.innerHTML = "";
  const fb = $("verify-feedback"); hide(fb);

  items.forEach(it => {
    const b = document.createElement("button");
    b.className = "vbtn";
    b.innerHTML = `<span class="chip">✓</span> ${it.label}`;
    b.addEventListener("click", () => {
      if (it.val){
        b.classList.add("correct"); b.disabled = true;
        state.verif.done++;
        if (state.verif.done === 5){
          state.score += 10;
          completeStation("terminal");
          feedback(fb, "Dados confirmados (CTRL+L). +10 pts — siga para a Mesa de Cálculo.", "ok");
          updateHud();
          setTimeout(closeOverlay, 1400);
        }
      } else {
        b.classList.add("wrong");
        state.score = Math.max(0, state.score - 8);
        feedback(fb, "Linha errada! Confira produto, VKE, quantidade, pedido e OF. −8 pts", "bad");
        setTimeout(() => b.classList.remove("wrong"), 600);
        updateHud();
      }
    });
    wrap.appendChild(b);
  });
}
function wrongProduct(){
  const alt = CFG.PRODUCTS.filter(p => p.name !== state.scene.product.name);
  return alt[Math.floor(Math.random() * alt.length)].name;
}

/* ============ 7. ESTAÇÃO: MESA DE CÁLCULO ============ */
function startCalc(){
  state.calcOk = false;
  $("in-avb").value = ""; $("in-queue-avail").value = "";
  hide($("calc-feedback"));
}
$("btn-calc").addEventListener("click", () => {
  if (state.calcOk) return;
  const s = state.scene;
  /* aceita "1.450", "1.450,0", "1450" e "1,450" (pt-BR) */
  const parseNum = (str) => {
    const clean = str.trim().replace(/\./g, "").replace(",", ".");
    return Math.round(parseFloat(clean));
  };
  const avb = parseNum($("in-avb").value);
  const qAv = parseNum($("in-queue-avail").value);
  const fb = $("calc-feedback");
  if (isNaN(avb) || isNaN(qAv)){
    feedback(fb, "Preencha os dois valores antes de calcular.", "warn"); return;
  }
  /* pegadinha específica: usou saldo de OUTRO produto (linha de ruído) */
  if (avb !== s.availableTotal && avb !== s.saldoLiquido){
    state.score = Math.max(0, state.score - 10);
    feedback(fb,
      `O valor ${fmt(avb)} não é o disponível do produto da missão (${s.product.name}, VKE ${s.product.vke}). ` +
      "Use SEMPRE a linha destacada em azul da aba Saldos Iniciais — as outras são outros produtos. −10 pts.", "bad");
    updateHud(); return;
  }
  if (avb === s.saldoLiquido && avb !== s.availableTotal){
    state.score = Math.max(0, state.score - 25);
    state.quality = Math.max(0, state.quality - 15);
    feedback(fb,
      "Você usou o SALDO LÍQUIDO (A+B) sem descontar os empenhos (C)! " +
      "O correto é o ESTOQUE DISPONÍVEL PARA VENDA (A+B−C). −25 pts, −15% qualidade.", "bad");
    updateHud(); return;
  }
  if (avb === s.availableTotal && qAv === s.queueAvailable){
    state.calcOk = true;
    state.score += 20;
    completeStation("calc");
    feedback(fb,
      `Correto! Disponível p/ venda = ${fmt(s.availableTotal)} (A ${fmt(s.A)} + B ${fmt(s.B)} − C ${fmt(s.C)}). ` +
      `Respeitando a fila: ${fmt(s.queueAvailable)}. +20 pts. ` +
      (s.impacted.length ? "Há pedidos impactados — vá ao Quadro da Fila." : "Sem impactados — vá ao Telefone."),
      "ok");
    updateHud();
    setTimeout(closeOverlay, 2200);
  } else {
    state.score = Math.max(0, state.score - 10);
    const msgs = [];
    if (avb !== s.availableTotal) msgs.push("Estoque disponível (A+B−C) incorreto.");
    if (qAv !== s.queueAvailable){
      if (qAv === s.missionPos){
        msgs.push(`Você digitou ${qAv} — a POSIÇÃO do seu pedido na fila. Este campo pede UNIDADES: ` +
          `o "Saldo após" da linha logo ACIMA da sua linha azul na aba Entradas e Saídas (se for negativo, digite 0).`);
      } else if (qAv === s.missionQty){
        msgs.push(`Você digitou ${qAv} — a quantidade do SEU pedido. Este campo pede o que SOBRA para você após os pedidos acima.`);
      } else if (qAv === s.availableTotal){
        msgs.push("Você repetiu o valor do campo 1 — falta descontar os pedidos ACIMA de você na fila.");
      } else {
        msgs.push("Disponibilidade na fila incorreta — veja o 'Saldo após' da última linha ACIMA da sua na aba Entradas e Saídas.");
      }
    }
    msgs.push("−10 pts. Tente novamente.");
    feedback(fb, msgs.join(" "), "bad");
    updateHud();
  }
});

/* ============ 8. ESTAÇÃO: QUADRO DA FILA (IMPACTADOS) ============ */
function startFila(){
  const s = state.scene;
  const box = $("impact-checks");
  box.innerHTML = "";
  const above = s.queue.filter(p => p.pos < s.missionPos);
  if (above.length === 0) return;
  above.forEach(p => {
    const isImp = s.impacted.includes(p.pedido);
    const label = document.createElement("label");
    label.className = "impact-item";
    label.innerHTML =
      `<input type="checkbox" data-pedido="${p.pedido}" data-imp="${isImp}"> ` +
      `<span><strong>${p.pedido}</strong> · ${p.cliente} · ${fmt(p.qtd)} un.</span>`;
    const inp = label.querySelector("input");
    inp.addEventListener("change", () => label.classList.toggle("sel", inp.checked));
    box.appendChild(label);
  });
  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Registrar Pedidos Impactados";
  btn.addEventListener("click", () => {
    const sel = [...box.querySelectorAll("input:checked")].map(c => c.dataset.pedido);
    const correct = s.impacted;
    const same = sel.length === correct.length && sel.every(p => correct.includes(p));
    if (same){
      state.score += 15;
      completeStation("fila");
      feedbackBox("Impactados registrados: " + (correct.join(", ") || "nenhum") + ". +15 pts. Vá ao Telefone.");
      setTimeout(closeOverlay, 1800);
    } else {
      state.score = Math.max(0, state.score - 12);
      state.quality = Math.max(0, state.quality - 10);
      feedbackBox("Incorreto. Um pedido anterior só é impactado se o saldo remanescente " +
        "ficar negativo ao deduzi-lo. −12 pts, −10% qualidade.", true);
    }
    updateHud();
  });
  box.appendChild(btn);
  let fb = $("fila-fb");
  if (!fb){
    fb = document.createElement("p"); fb.id = "fila-fb"; fb.className = "feedback";
    box.after(fb);
  }
  hide(fb);
  function feedbackBox(msg, bad){
    fb.textContent = msg;
    fb.className = "feedback " + (bad ? "bad" : "ok");
    show(fb);
  }
}


/* ============ 9. ESTAÇÃO: TELEFONE (ÁRVORE DE DECISÕES) ============ */
const CONDUTA_LABEL = {
  total:     ["✅ Disponibilidade total, sem impacto",
              "Informar disponibilidade e seguir o fluxo normal de liberação e faturamento."],
  parcial:   ["🟡 Disponibilidade parcial, sem impacto",
              "Faturamento parcial SOMENTE mediante autorização do cliente."],
  entrada:   ["🔵 Sem disponibilidade, com entrada prevista",
              "Informar a melhor data de disponibilidade apresentada pela ATP."],
  escalonar: ["🔴 Sem disponibilidade e sem entrada",
              "Informar a indisponibilidade e seguir o escalonamento definido."]
};
function startDecision(){
  state.decision = null;
  state.emailNeeded = false;
  const wrap = $("decision-cards");
  wrap.innerHTML = "";
  hide($("decision-fb"));
  Object.keys(CONDUTA_LABEL).forEach(k => {
    const b = document.createElement("button");
    b.className = "dcard";
    b.dataset.cond = k;
    b.innerHTML = `<strong>${CONDUTA_LABEL[k][0]}</strong><small>${CONDUTA_LABEL[k][1]}</small>`;
    b.addEventListener("click", () => {
      const s = state.scene;
      const fb = $("decision-fb");
      if (k === s.conduta){
        state.decision = k;
        state.score += 20;
        completeStation("phone");
        /* acomodação urgente? precisa do e-mail Julio */
        const needJulius = k !== "total" && s.B > 0 &&
          s.queueAvailable < s.missionQty && Math.random() < 0.6;
        state.emailNeeded = needJulius || k === "parcial";
        state.emailType = needJulius ? "julio" : "cliente";
        feedback(fb,
          "Conduta correta. +20 pts. " +
          (state.emailNeeded
            ? (needJulius ? "O material em acomodação é necessário — vá ao CORREIO e-mail Julio Cesar (vendedor + Vivian em cópia)."
                          : "Vá ao CORREIO solicitar autorização do cliente para faturamento parcial.")
            : "Vá à DOCA liberar o pedido."),
          "ok");
        updateHud();
        updateEtapaBadge();
        setTimeout(closeOverlay, 2600);
      } else {
        state.score = Math.max(0, state.score - 15);
        state.quality = Math.max(0, state.quality - 12);
        feedback(fb, "Conduta incompatível com o resultado da análise. Reveja a fila e as entradas. " +
          "−15 pts, −12% qualidade.", "bad");
        updateHud();
      }
    });
    wrap.appendChild(b);
  });
}

/* ============ 10. ESTAÇÃO: CORREIO (E-MAILS) ============ */
/* novo formato: 3 campos validados + corpo de e-mail livre.
   O botão Enviar só dispara quando os 3 campos estiverem OK. */
function emailSpec(){
  const s = state.scene;
  if ((state.emailType || "cliente") === "julio"){
    return [
      { label: "VKE do produto",                val: s.product.vke.toLowerCase(),
        hint: "aba Saldos Iniciais, linha azul, coluna VKE" },
      { label: "Número do pedido",              val: s.pedidoMission.toLowerCase(),
        hint: "sua linha azul na fila" },
      { label: "Quantidade em acomodação (un.)", val: String(s.B),
        hint: "aba Saldos Iniciais, linha azul, coluna B Acom." }
    ];
  }
  return [
    { label: "Número do pedido",           val: s.pedidoMission.toLowerCase(),
      hint: "sua linha azul na fila" },
    { label: "Quantidade disponível (un.)", val: String(s.queueAvailable),
      hint: '"Saldo após" da linha ACIMA da sua (vermelho = 0)' },
    { label: "Saldo restante (un.)",        val: String(s.missionQty - s.queueAvailable),
      hint: `seu pedido (${s.missionQty}) − disponível` }
  ];
}

function startEmail(){
  const s = state.scene;
  const type = state.emailType || "cliente";
  const comp = $("email-composer");
  const spec = emailSpec();

  /* configura rótulos dos 3 campos */
  spec.forEach((f, i) => {
    const lab = $("mf" + (i + 1) + "-label");
    lab.innerHTML = `${f.label} <small class="mf-hint">(${f.hint})</small>`;
    const inp = $("mf" + (i + 1));
    inp.value = "";
    inp.className = "";
    inp.disabled = false;
  });

  if (type === "julio"){
    $("email-title").textContent = "Priorizar guarda na Kluber";
    $("email-desc").innerHTML =
      `Há <strong>${fmt(s.B)} un.</strong> em <strong>acomodação</strong> (transferência Kluber → Rudlog) ` +
      `— só vira estoque físico em <strong>${CFG.ACCOM_DAYS} dias úteis</strong>. Solicite a priorização ` +
      `da guarda na Kluber por e-mail a <strong>Julio Cesar</strong>, com o vendedor ` +
      `<strong>${s.queue[s.missionPos-1].vendedor}</strong> e <strong>Vivian</strong> em cópia.`;
    $("mail-to").value = "julio.santos@kluber.com";
    $("mail-cc").value = `${s.queue[s.missionPos-1].vendedor.toLowerCase().replace(/[^a-z]/g,"").slice(0,8)}@kluber.com; vivian@kluber.com`;
    $("mail-subject").value = `Priorização de guarda — ${s.pedidoMission}`;
  } else {
    $("email-title").textContent = "Autorização para faturamento parcial";
    $("email-desc").innerHTML =
      `Disponibilidade parcial de <strong>${fmt(s.queueAvailable)} un.</strong> para o pedido ` +
      `<strong>${s.pedidoMission}</strong>. Solicite ao cliente a autorização para faturar ` +
      `a parcela disponível, informando o saldo restante.`;
    $("mail-to").value = "cliente@industria.com";
    $("mail-cc").value = `${s.queue[s.missionPos-1].vendedor.toLowerCase().replace(/[^a-z]/g,"").slice(0,8)}@kluber.com`;
    $("mail-subject").value = `Autorização faturamento parcial — ${s.pedidoMission}`;
  }
  $("mail-body").value = "";
  $("mail-requirements").innerHTML = "Preencha os 3 campos corretamente para liberar o envio do e-mail.";
  hide($("mail-feedback"));
  comp.style.display = "";
  $("btn-send-mail").disabled = true;
}

/* validação em tempo real: campo a campo, conforme digita */
["mf1", "mf2", "mf3"].forEach((id, idx) => {
  $(id).addEventListener("input", () => {
    const spec = emailSpec();
    const inp = $(id);
    const exp = spec[idx].val;
    const v = inp.value.trim().toLowerCase();
    /* aceita número com ponto/vírgula de milhar */
    const parseNum = (str) => {
      if (!/^-?[\d.,]+$/.test(str)) return str;
      return String(Math.round(parseFloat(str.replace(/\./g, "").replace(",", "."))));
    };
    const ok = (v === exp) || (parseNum(v) === parseNum(exp) && v !== "");
    inp.classList.toggle("ok", ok);
    inp.classList.toggle("ko", !ok && v !== "");
    /* libera o botão só quando os 3 estiverem OK */
    const allOk = ["mf1", "mf2", "mf3"].every((c, i) => {
      const vv = $(c).value.trim().toLowerCase();
      const e = emailSpec()[i].val;
      return vv === e || (parseNum(vv) === parseNum(e) && vv !== "");
    });
    $("btn-send-mail").disabled = !allOk;
    $("mail-requirements").innerHTML = allOk
      ? "✅ Todos os campos corretos — e-mail pronto para envio."
      : "Preencha os 3 campos corretamente para liberar o envio do e-mail.";
  });
});

$("btn-send-mail").addEventListener("click", () => {
  const s = state.scene;
  state.score += 15;
  completeStation("email");
  feedback($("mail-feedback"),
    "E-mail enviado corretamente — rastreabilidade garantida. +15 pts. " +
    "Vá à DOCA liberar o pedido.", "ok");
  updateHud();
  setTimeout(closeOverlay, 1800);
});

/* ============ 11. ESTAÇÃO: DOCA (LIBERAÇÃO / OS) ============ */
function startRelease(){
  state.releaseDone = null;
  hide($("release-feedback"));
}
document.querySelectorAll(".release-card").forEach(card => {
  card.addEventListener("click", () => {
    if (state.releaseDone) return;
    const s = state.scene;
    const wh = card.dataset.wh;
    const fb = $("release-feedback");
    if (wh === "SPLIT"){
      card.classList.add("blocked");
      state.score = Math.max(0, state.score - 10);
      feedback(fb, "ERRO DE LIBERAÇÃO: proibido liberar parte do saldo pela Kluber e parte pelo " +
        "armazém externo simultaneamente. A liberação deve ocorrer por UM único armazém. −10 pts.", "bad");
      setTimeout(() => card.classList.remove("blocked"), 700);
      updateHud();
      return;
    }
    const correctWh = s.A1 >= s.A2 ? "E" : "K";
    if (wh === correctWh){
      state.releaseDone = wh;
      state.score += 15;
      completeStation("dock");
      if (wh === "E"){
        feedback(fb, `Liberado pelo ARMAZÉM EXTERNO (Rudlog, A1=${fmt(s.A1)} un. físicas). ` +
          "✔ OS automática gerada — acompanhar separação e faturamento. +15 pts.", "ok");
      } else {
        feedback(fb, `Liberado pelo ARMAZÉM KL (A2=${fmt(s.A2)} un. físicas). ` +
          "Atenção: armazém KL NÃO gera OS automática — seguir fluxo manual correspondente. +15 pts.", "ok");
      }
      updateHud();
      setTimeout(closeOverlay, 2400);
    } else {
      const needed = correctWh === "E" ? "Rudlog (A1)" : "Kluber (A2)";
      state.score = Math.max(0, state.score - 12);
      state.quality = Math.max(0, state.quality - 10);
      feedback(fb, `Armazém incorreto. Valide a localização física: o saldo atendível está em ${needed}. ` +
        "A1/A2 indica onde o material está fisicamente. −12 pts, −10% qualidade.", "bad");
      updateHud();
    }
  });
});

/* ============ 12. ESTAÇÃO: CHEFE (REGISTRO MAD LIBS) ============ */
function filaAnswer(){
  const s = state.scene;
  let rem = s.availableTotal;
  const atendidos = [];
  for (const p of s.queue){
    if (rem >= p.qtd){
      if (p.pos <= s.missionPos) atendidos.push(p.pedido);
      rem -= p.qtd;
    } else break;
  }
  return atendidos.join(", ");
}
function dateAnswer(){
  const s = state.scene;
  return s.inbound ? s.inbound.iso : addBusinessDays(todayISO(), 10, false);
}
function condutaAnswer(){
  return {
    total: "disponibilidade total confirmada",
    parcial: "faturamento parcial com autorização do cliente",
    entrada: "melhor data informada ao cliente",
    escalonar: "escalamento do pedido"
  }[state.decision || state.scene.conduta];
}
const BOSS_TEMPLATE = [
  { pre: "Realizada análise de ATP do produto ", gap: "produto",  val: () => state.scene.product.name },
  { pre: ", VKE ",                                gap: "vke",      val: () => state.scene.product.vke },
  { pre: ", referente ao pedido ",                gap: "pedido",   val: () => state.scene.pedidoMission },
  { pre: " e OF ",                                gap: "of",       val: () => state.scene.ofNumber },
  { pre: ". Foi identificado saldo de ",          gap: "kluber",   val: () => String(state.scene.A2) },
  { pre: " unidades na Kluber, ",                 gap: "rudlog",   val: () => String(state.scene.A1) },
  { pre: " unidades na Rudlog, ",                 gap: "acomod",   val: () => String(state.scene.B) },
  { pre: " unidades em acomodação e ",            gap: "empenho", val: () => String(state.scene.C) },
  { pre: " unidades empenhadas. Conforme a ordem de prioridade da ATP, o saldo disponível atende os pedidos ",
    gap: "fila", val: () => filaAnswer() },
  { pre: ". O pedido analisado está na posição ", gap: "posicao", val: () => String(state.scene.missionPos) },
  { pre: " da fila, com previsão de disponibilidade para ", gap: "data", val: () => dateAnswer(), type: "date" },
  { pre: ". Ação realizada: ",                    gap: "acao",     val: () => condutaAnswer() },
  { pre: ".", post: " Não foi realizada alteração de data, armazém ou prioridade sem autorização formal." }
];
function startBoss(){
  const wrap = $("boss-text");
  wrap.innerHTML = "";
  hide($("boss-feedback"));
  /* placeholders descritivos: mostram O QUE e ONDE buscar */
  const hints = {
    produto:  "nome do produto (linha azul)",
    vke:      "código 8 dígitos",
    pedido:   "PED-XXXXX (linha azul da fila)",
    of:       "OF-XXXXXX",
    kluber:   "A2 (unidades)",
    rudlog:   "A1 (unidades)",
    acomod:   "B (unidades)",
    empenho:  "C1+C2 (unidades)",
    fila:     "PED-XXXXX, ... atendidos",
    posicao:  "nº da linha azul na fila",
    data:     "selecione a data",
    acao:     "escolha a conduta"
  };
  BOSS_TEMPLATE.forEach(seg => {
    wrap.insertAdjacentText("beforeend", seg.pre);
    if (seg.gap){
      if (seg.gap === "acao"){
        /* menu suspenso com as 4 condutas — sem erro de digitação */
        const sel = document.createElement("select");
        sel.className = "boss-gap";
        sel.dataset.expected = condutaAnswer();
        sel.innerHTML = '<option value="">— escolha —</option>' +
          Object.keys(CONDUTA_LABEL).map(k =>
            `<option value="${condutaOpt(k)}">${condutaOpt(k)}</option>`).join("");
        wrap.appendChild(sel);
      } else if (seg.type === "date"){
        const inp = document.createElement("input");
        inp.type = "date";
        inp.className = "boss-gap";
        inp.dataset.expected = seg.val();
        inp.placeholder = hints[seg.gap] || seg.gap;
        wrap.appendChild(inp);
      } else {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.className = "boss-gap";
        inp.dataset.expected = seg.val();
        inp.placeholder = hints[seg.gap] || seg.gap;
        wrap.appendChild(inp);
      }
    }
  });
  wrap.insertAdjacentText("beforeend", BOSS_TEMPLATE[BOSS_TEMPLATE.length-1].post);
}
function condutaOpt(k){
  return {
    total: "disponibilidade total confirmada",
    parcial: "faturamento parcial com autorização do cliente",
    entrada: "melhor data informada ao cliente",
    escalonar: "escalamento do pedido"
  }[k];
}
$("btn-boss-check").addEventListener("click", () => {
  const inputs = [...$("boss-text").querySelectorAll(".boss-gap")];
  /* aceita quantidades com separador de milhar: "1.450" = 1450 */
  const parseNum = (str) => {
    if (!/^-?[\d.,]+$/.test(str)) return str;
    const clean = str.replace(/\./g, "").replace(",", ".");
    return String(Math.round(parseFloat(clean)));
  };
  let wrong = 0;
  inputs.forEach(inp => {
    const v = inp.value.trim();
    const exp = inp.dataset.expected;
    const ok = inp.type === "date"
      ? (v === exp || (state.scene.inbound && v.split("-").reverse().join("/") === state.scene.inbound.date))
      : (parseNum(v) === parseNum(exp) || v.toLowerCase() === exp.toLowerCase());
    inp.classList.toggle("ok", ok);
    inp.classList.toggle("ko", !ok);
    if (!ok) wrong++;
  });
  const fb = $("boss-feedback");
  if (wrong === 0){
    state.score += 25;
    completeStation("boss");
    boneco.classList.add("comemorar");
    setTimeout(() => boneco.classList.remove("comemorar"), 1600);
    feedback(fb, "Registro validado — rastreabilidade completa. +25 pts. Missão concluída!", "ok");
    updateHud();
    setTimeout(finishMission, 1600);
  } else {
    state.score = Math.max(0, state.score - 10);
    feedback(fb, `${wrong} campo(s) incorreto(s). VKE, quantidades por armazém, empenhos, ` +
      "posição na fila e impactados devem reproduzir o modelo padrão. −10 pts.", "bad");
    updateHud();
  }
});


/* ============ 13. RESULTADO E FLUXO DO TURNO ============ */
function finishMission(){
  state.turnScore += state.score;
  state.mission++;
  const last = state.mission >= CFG.MISSIONS;
  const s = state.scene;
  const body = $("result-body");
  body.innerHTML = "";
  const rows = [
    ["Produto / VKE", `${s.product.name} · ${s.product.vke}`],
    ["Estoque disponível (A+B−C)", `${fmt(s.availableTotal)} un.`],
    ["Disponibilidade na fila", `${fmt(s.queueAvailable)} un.`],
    ["Quantidade da missão", `${fmt(s.missionQty)} un.`],
    ["Conduta obrigatória", CONDUTA_LABEL[s.conduta][0].replace(/^[^\w]+/, "")],
    ["Pedidos impactados", s.impacted.length ? s.impacted.join(", ") : "nenhum"],
    ["Pontuação da missão", `${state.score} pts`],
    ["Qualidade", `${state.quality}%`]
  ];
  body.insertAdjacentHTML("afterbegin",
    `<div class="res-badge ${state.quality >= 70 ? "win" : "lose"}">` +
    (state.quality >= 70 ? "MISSÃO CUMPRIDA" : "MISSÃO COMPROMETIDA") + `</div>`);
  rows.forEach(r => body.insertAdjacentHTML("beforeend",
    `<div class="res-line"><span>${r[0]}</span><b>${r[1]}</b></div>`));
  $("result-title").textContent = last ? "Resultado do Turno" : "Resultado da Missão";
  $("btn-next").textContent = last ? "Jogar Novamente" : "Próxima Missão";
  state.overlayOpen = "result";
  show($("overlay"));
  showTask("task-result");
  $("overlay-title").textContent = "🏆 Resultado";
  if (state.quality <= 0){
    triggerGameOver("Qualidade do atendimento chegou a zero: múltiplos erros de análise " +
      "comprometeram a fila de prioridade.");
  }
}
$("btn-next").addEventListener("click", () => {
  const last = state.mission >= CFG.MISSIONS;
  if (last) location.reload();
  else startMission();
});
function triggerGameOver(reason){
  $("gameover-text").textContent = reason;
  state.overlayOpen = "gameover";
  show($("modal-gameover"));
}
$("btn-restart-mission").addEventListener("click", () => {
  hide($("modal-gameover"));
  state.quality = Math.max(30, state.quality);
  startMission();
});
$("btn-restart-all").addEventListener("click", () => location.reload());

/* ============ 14. HUD & MISSÃO ============ */
function updateHud(){
  $("hud-score").textContent = state.score;
  $("hud-quality").textContent = state.quality;
  $("hud-day").textContent = "D" + state.day;
  $("hud-mission").textContent =
    `Missão ${Math.min(state.mission + 1, CFG.MISSIONS)}/${CFG.MISSIONS}`;
}
function startMission(){
  state.gameOver = false;
  state.calcOk = false;
  state.decision = null;
  state.releaseDone = null;
  state.emailNeeded = false;
  state.emailType = null;
  state.day = 1;
  state.score = 0;
  state.doneStations = [];
  state.scene = generateScene(state.mission, state.difficulty);
  renderSaldos(state.scene);
  renderFila(state.scene);
  startVerify();
  startCalc();
  startFila();
  startDecision();
  startEmail();
  startRelease();
  startBoss();
  refreshStations();
  updateHud();
  updateEtapaBadge();
  const h = $("hud-hint");
  h.textContent = "Vá ao Terminal TOTVS confirmar os dados da missão";
  /* boneco renasce perto da entrada */
  player.x = 50; player.y = 70;
  boneco.classList.remove("comemorar");
}

/* ============ 15. BOOT ============ */
$("btn-start").addEventListener("click", () => {
  state.player = $("player-name").value.trim() || "operador";
  $("boneco-tag").textContent = state.player;
  state.difficulty = $("difficulty").value;
  state.mission = 0; state.score = 0; state.turnScore = 0; state.quality = 100;
  $("screen-start").classList.remove("active");
  $("screen-game").classList.add("active");
  buildStations();
  startMission();
  $("world").focus();
});

/* estado inicial das estações (pré-jogo) */
buildStations();
