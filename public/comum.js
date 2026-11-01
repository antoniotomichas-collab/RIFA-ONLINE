// Funções usadas por todas as páginas
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pad = (n, total) => String(n).padStart(String(total).length, '0');
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, opcoes = {}) {
  const r = await fetch(url, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers || {}) }
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(dados.erro || 'Erro de conexão. Tente novamente.');
    e.status = r.status;
    e.dados = dados;
    throw e;
  }
  return dados;
}

function telefoneFmt(t) {
  t = String(t || '').replace(/\D/g, '');
  if (t.length === 11) return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;
  if (t.length === 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
  return t;
}

function mascaraTelefone(input) {
  input.addEventListener('input', () => {
    const d = input.value.replace(/\D/g, '').slice(0, 11);
    let v = d;
    if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    input.value = v;
  });
}

const STATUS_TXT = { pendente: 'Aguardando pagamento', pago: 'Confirmado', cancelado: 'Cancelado', expirado: 'Expirado' };

function meusPedidosLocal() {
  try { return JSON.parse(localStorage.getItem('rifa_pedidos') || '[]'); } catch { return []; }
}
function guardarPedidoLocal(id) {
  try {
    const l = meusPedidosLocal().filter(x => x !== id);
    l.unshift(id);
    localStorage.setItem('rifa_pedidos', JSON.stringify(l.slice(0, 20)));
  } catch {}
}

// Cores escolhidas no painel
function textoContraste(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#1a1200' : '#ffffff';
}
function aplicarAparencia(a) {
  if (!a) return;
  const st = document.documentElement.style;
  st.setProperty('--bg', a.corFundo);
  st.setProperty('--texto', a.corTexto);
  st.setProperty('--destaque', a.corDestaque);
  st.setProperty('--premio', a.corPremio);
  st.setProperty('--roxo', a.corSecundaria);
  st.setProperty('--sobre-destaque', textoContraste(a.corDestaque));
}
// Cor da barra do navegador no celular acompanha o fundo escolhido
(function () {
  const original = aplicarAparencia;
  aplicarAparencia = function (a) {
    original(a);
    const m = document.querySelector('meta[name="theme-color"]');
    if (a && m) m.content = a.corFundo;
  };
})();

// Carrossel de fotos do prêmio com efeito animado
function montarGaleria(caixa, fotos, a, alt) {
  const chave = JSON.stringify([fotos, a.efeitoFoto, a.transicaoFoto, a.intervaloFoto]);
  if (caixa.dataset.chave === chave) return;
  caixa.dataset.chave = chave;
  clearInterval(caixa._timer);
  if (!fotos.length) { caixa.innerHTML = '<div class="sem-foto">🎁</div>'; return; }

  const seg = Math.max(2, Number(a.intervaloFoto) || 5);
  const varias = fotos.length > 1;
  caixa.innerHTML = `<div class="galeria efeito-${a.efeitoFoto || 'cinema'} trans-${a.transicaoFoto || 'esmaecer'}" style="--intervalo:${seg}s">
      ${fotos.map((f, i) => `<div class="slide${i ? '' : ' ativo'}${i % 2 ? ' par' : ''}"><img src="${esc(f)}" alt="${esc(alt)}" ${i ? 'loading="lazy"' : ''}></div>`).join('')}
      ${varias ? `<button type="button" class="seta seta-ant" aria-label="Foto anterior">‹</button>
      <button type="button" class="seta seta-prox" aria-label="Próxima foto">›</button>
      <div class="pontos">${fotos.map((_, i) => `<button type="button" class="${i ? '' : 'ativo'}" aria-label="Foto ${i + 1}"></button>`).join('')}</div>` : ''}
    </div>`;
  if (!varias) return;

  const g = caixa.firstElementChild, slides = [...g.querySelectorAll('.slide')], pontos = [...g.querySelectorAll('.pontos button')];
  let atual = 0;
  function ir(i, direcao = 1) {
    i = (i + slides.length) % slides.length;
    if (i === atual) return;
    const sai = slides[atual], entra = slides[i];
    g.classList.toggle('voltando', direcao < 0);
    slides.forEach(s => s.classList.remove('saindo'));
    sai.classList.remove('ativo'); sai.classList.add('saindo');
    entra.classList.add('ativo');
    pontos[atual].classList.remove('ativo'); pontos[i].classList.add('ativo');
    atual = i;
  }
  const reiniciar = () => { clearInterval(caixa._timer); caixa._timer = setInterval(() => { if (!document.hidden) ir(atual + 1); }, seg * 1000); };
  g.querySelector('.seta-ant').onclick = () => { ir(atual - 1, -1); reiniciar(); };
  g.querySelector('.seta-prox').onclick = () => { ir(atual + 1); reiniciar(); };
  pontos.forEach((p, i) => p.onclick = () => { ir(i, i < atual ? -1 : 1); reiniciar(); });
  // Arrastar com o dedo no celular
  let x0 = null;
  g.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  g.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { dx < 0 ? ir(atual + 1) : ir(atual - 1, -1); reiniciar(); }
  });
  reiniciar();
}

// Troca {nome}, {numeros}, {premio}... pelos dados do pedido
function preencher(texto, v) {
  return String(texto || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null ? v[k] : m));
}

// Prévia ao vivo: o painel envia a aparência ainda não salva para esta página
let previaAparencia = null;
window.addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || e.data.tipo !== 'previa') return;
  previaAparencia = e.data.aparencia;
  if (typeof aoMudarPrevia === 'function') aoMudarPrevia();
});
const comPrevia = a => ({ ...a, ...(previaAparencia || {}) });

// ---------- Fontes e temas prontos ----------
const FONTES = {
  moderna: { nome: 'Moderna', titulo: 'Poppins', texto: 'Inter', css: 'family=Poppins:wght@600;800;900&family=Inter:wght@400;600;700' },
  classica: { nome: 'Clássica', titulo: 'Playfair Display', texto: 'Lora', css: 'family=Playfair+Display:wght@700;900&family=Lora:wght@400;600;700' },
  elegante: { nome: 'Elegante', titulo: 'Cormorant Garamond', texto: 'Montserrat', css: 'family=Cormorant+Garamond:wght@600;700&family=Montserrat:wght@400;600;700' },
  forte: { nome: 'Forte', titulo: 'Oswald', texto: 'Roboto', css: 'family=Oswald:wght@500;700&family=Roboto:wght@400;500;700' },
  divertida: { nome: 'Divertida', titulo: 'Fredoka', texto: 'Nunito', css: 'family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;800' },
  arredondada: { nome: 'Arredondada', titulo: 'Nunito', texto: 'Nunito', css: 'family=Nunito:wght@400;600;800;900' }
};

const TEMAS = {
  padrao: { nome: 'Padrão', emoji: '🎟️', particulas: ['🎟️', '⭐', '✨'], valores: {
    corFundo: '#0f1020', corTexto: '#f4f4ff', corDestaque: '#ffcc00', corPremio: '#ffb703', corSecundaria: '#7c3aed',
    fonte: 'moderna', fundoEstilo: 'brilho', efeitoFoto: 'cinema', particulas: false,
    rotuloPremio: '🏆 Prêmio', rotuloPreco: 'Valor por número', textoBotao: 'Comprar com Pix', tituloNumeros: 'Escolha seus números' } },
  carro: { nome: 'Carro / Moto', emoji: '🏎️', particulas: ['🏁', '🔑', '⚡'], valores: {
    corFundo: '#0b0b0f', corTexto: '#f5f5f5', corDestaque: '#e10600', corPremio: '#ffffff', corSecundaria: '#e10600',
    fonte: 'forte', fundoEstilo: 'gradiente', efeitoFoto: 'cinema', particulas: true,
    rotuloPremio: '🏁 Concorra a', rotuloPreco: 'Valor por número', textoBotao: 'Quero acelerar! 🏎️', tituloNumeros: 'Escolha seus números da sorte' } },
  solidaria: { nome: 'Solidária / Saúde', emoji: '💗', particulas: ['💗', '🤍', '🙏'], valores: {
    corFundo: '#fdf7f9', corTexto: '#3b2a33', corDestaque: '#e11d74', corPremio: '#be185d', corSecundaria: '#0ea5a4',
    fonte: 'arredondada', fundoEstilo: 'brilho', efeitoFoto: 'flutuar', particulas: true,
    rotuloPremio: '💗 Ajude e concorra a', rotuloPreco: 'Sua ajuda por número', textoBotao: 'Quero ajudar 💗', tituloNumeros: 'Escolha seus números e ajude',
    msgConfirmado: 'Muito obrigado, {nome}! 💗 Sua ajuda faz toda a diferença. Seus números {numeros} estão garantidos.',
    rodape: 'Toda a renda desta rifa é destinada ao tratamento. Pagamento via Pix com confirmação pelo organizador.' } },
  dinheiro: { nome: 'Dinheiro / Pix', emoji: '💰', particulas: ['💰', '💵', '🪙'], valores: {
    corFundo: '#04150d', corTexto: '#ecfdf5', corDestaque: '#22c55e', corPremio: '#facc15', corSecundaria: '#16a34a',
    fonte: 'forte', fundoEstilo: 'pontos', efeitoFoto: 'brilho', particulas: true,
    rotuloPremio: '💰 Prêmio em dinheiro', rotuloPreco: 'Valor por número', textoBotao: 'Quero ganhar! 💸', tituloNumeros: 'Escolha seus números' } },
  eletronicos: { nome: 'Eletrônicos', emoji: '📱', particulas: ['⚡', '✨', '📱'], valores: {
    corFundo: '#050816', corTexto: '#e6f1ff', corDestaque: '#22d3ee', corPremio: '#a78bfa', corSecundaria: '#6366f1',
    fonte: 'moderna', fundoEstilo: 'gradiente', efeitoFoto: 'brilho', particulas: true,
    rotuloPremio: '⚡ Concorra a', rotuloPreco: 'Valor por número', textoBotao: 'Garantir meus números', tituloNumeros: 'Escolha seus números' } },
  casa: { nome: 'Casa / Imóvel', emoji: '🏡', particulas: ['🔑', '🏡'], valores: {
    corFundo: '#f7f5f0', corTexto: '#2b2620', corDestaque: '#b45309', corPremio: '#92400e', corSecundaria: '#166534',
    fonte: 'classica', fundoEstilo: 'liso', efeitoFoto: 'cinema', particulas: false,
    rotuloPremio: '🏡 Concorra a', rotuloPreco: 'Valor por número', textoBotao: 'Quero a minha chave 🔑', tituloNumeros: 'Escolha seus números' } },
  beleza: { nome: 'Beleza / Feminino', emoji: '🌸', particulas: ['🌸', '✨', '💖'], valores: {
    corFundo: '#fff5f8', corTexto: '#4a2c3a', corDestaque: '#db2777', corPremio: '#c026d3', corSecundaria: '#f472b6',
    fonte: 'elegante', fundoEstilo: 'brilho', efeitoFoto: 'zoom', particulas: true,
    rotuloPremio: '🌸 Concorra a', rotuloPreco: 'Valor por número', textoBotao: 'Quero participar 💖', tituloNumeros: 'Escolha seus números' } },
  religiosa: { nome: 'Religiosa / Igreja', emoji: '🙏', particulas: ['🕊️', '✨'], valores: {
    corFundo: '#fbf8f1', corTexto: '#2f2a22', corDestaque: '#b8860b', corPremio: '#1e3a8a', corSecundaria: '#1e3a8a',
    fonte: 'classica', fundoEstilo: 'brilho', efeitoFoto: 'cinema', particulas: false,
    rotuloPremio: '🙏 Rifa beneficente', rotuloPreco: 'Colaboração por número', textoBotao: 'Quero colaborar 🙏', tituloNumeros: 'Escolha seus números',
    msgConfirmado: 'Deus abençoe, {nome}! 🙏 Sua colaboração foi recebida. Seus números {numeros} estão garantidos.' } },
  festa: { nome: 'Festa / Evento', emoji: '🎉', particulas: ['🎉', '🎈', '✨'], valores: {
    corFundo: '#1a0b2e', corTexto: '#fff7ff', corDestaque: '#f97316', corPremio: '#facc15', corSecundaria: '#ec4899',
    fonte: 'divertida', fundoEstilo: 'gradiente', efeitoFoto: 'pulsar', particulas: true,
    rotuloPremio: '🎉 Concorra a', rotuloPreco: 'Valor por número', textoBotao: 'Bora participar! 🎉', tituloNumeros: 'Escolha seus números' } }
};

// Textos que alguns temas trocam; os outros temas voltam a estes
const TEXTOS_TEMA_PADRAO = {
  msgConfirmado: 'Obrigado pela compra, {nome}! Seus números {numeros} estão garantidos. Boa sorte! 🍀',
  rodape: 'Pagamento exclusivo via Pix. Seus números são confirmados após a verificação do pagamento pelo organizador.'
};
for (const t of Object.values(TEMAS)) t.valores = { ...TEXTOS_TEMA_PADRAO, ...t.valores };

function carregarFonte(id) {
  const f = FONTES[id] || FONTES.moderna;
  let link = document.getElementById('fonte-link');
  const href = `https://fonts.googleapis.com/css2?${f.css}&display=swap`;
  if (!link) { link = document.createElement('link'); link.id = 'fonte-link'; link.rel = 'stylesheet'; document.head.appendChild(link); }
  if (link.href !== href) link.href = href;
  return f;
}

const luminancia = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// Aparência completa do site público: fonte, fundo claro/escuro, estilo de fundo, partículas e animações
(function () {
  const base = aplicarAparencia;
  aplicarAparencia = function (a) {
    base(a);
    if (!a) return;
    const st = document.documentElement.style, raiz = document.documentElement;
    const f = carregarFonte(a.fonte);
    st.setProperty('--fonte-titulo', `'${f.titulo}', system-ui, sans-serif`);
    st.setProperty('--fonte-texto', `'${f.texto}', system-ui, sans-serif`);
    const claro = luminancia(a.corFundo || '#000000') > 0.6;
    raiz.toggleAttribute('data-claro', claro);
    for (const [k, v] of Object.entries({
      '--card': claro ? '#ffffff' : '', '--card2': claro ? 'color-mix(in srgb, var(--bg), #000 6%)' : '',
      '--borda': claro ? 'color-mix(in srgb, var(--bg), #000 14%)' : '', '--suave': claro ? 'color-mix(in srgb, var(--texto) 62%, var(--bg))' : ''
    })) v ? st.setProperty(k, v) : st.removeProperty(k);
    const body = document.body;
    if (!body) return;
    body.classList.remove('fundo-brilho', 'fundo-liso', 'fundo-gradiente', 'fundo-pontos');
    body.classList.add('fundo-' + (a.fundoEstilo || 'brilho'));
    body.classList.toggle('anim', a.animacoes !== false);
    montarParticulas(a.particulas && a.animacoes !== false ? (TEMAS[a.tema] || TEMAS.padrao).particulas : null);
  };
})();

function montarParticulas(emojis) {
  let c = document.getElementById('particulas');
  const chave = emojis ? emojis.join('') : '';
  if (c && c.dataset.chave === chave) return;
  if (c) c.remove();
  if (!emojis || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  c = document.createElement('div');
  c.id = 'particulas'; c.dataset.chave = chave; c.setAttribute('aria-hidden', 'true');
  const qtd = innerWidth < 640 ? 10 : 18;
  for (let i = 0; i < qtd; i++) {
    const s = document.createElement('span');
    s.textContent = emojis[i % emojis.length];
    s.style.left = Math.random() * 100 + '%';
    s.style.fontSize = 14 + Math.random() * 22 + 'px';
    s.style.animationDuration = 14 + Math.random() * 16 + 's';
    s.style.animationDelay = -Math.random() * 30 + 's';
    c.appendChild(s);
  }
  document.body.prepend(c);
}

// Cartões aparecem suavemente ao rolar a página
function revelarAoRolar(seletor) {
  if (!document.body.classList.contains('anim') || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visivel'); io.unobserve(e.target); } }), { threshold: 0.08 });
  document.querySelectorAll(seletor).forEach(el => { if (!el.classList.contains('visivel')) { el.classList.add('revelar'); io.observe(el); } });
}

// Confete simples em canvas
function confete(duracao = 2600) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'confete'; document.body.appendChild(cv);
  const ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
  const ajustar = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  ajustar();
  const cs = getComputedStyle(document.documentElement);
  const cores = ['--destaque', '--roxo', '--verde', '--premio'].map(v => cs.getPropertyValue(v).trim() || '#ffcc00');
  const pecas = Array.from({ length: 140 }, () => ({
    x: Math.random() * cv.width, y: -Math.random() * cv.height * 0.5, w: (6 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr,
    vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 4) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    cor: cores[Math.floor(Math.random() * cores.length)]
  }));
  const t0 = performance.now();
  (function quadro(t) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    const fim = t - t0 > duracao;
    let vivas = 0;
    for (const p of pecas) {
      p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += 0.04 * dpr;
      if (p.y < cv.height + 20) vivas++;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.cor; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      if (!fim && p.y > cv.height + 20) { p.y = -20; p.x = Math.random() * cv.width; p.vy = (2 + Math.random() * 4) * dpr; }
    }
    vivas ? requestAnimationFrame(quadro) : cv.remove();
  })(t0);
}

// Número que sobe de 0 até o valor
function contarAte(el, valor, formato = v => Math.round(v).toLocaleString('pt-BR')) {
  if (!document.body.classList.contains('anim') || el.dataset.contado) { el.textContent = formato(valor); return; }
  el.dataset.contado = '1';
  const t0 = performance.now(), dur = 1100;
  (function passo(t) {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = formato(valor * e);
    if (k < 1) requestAnimationFrame(passo);
  })(t0);
}
