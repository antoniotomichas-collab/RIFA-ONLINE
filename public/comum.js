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
