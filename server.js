const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
// Acesso padrão do painel: vale até o organizador criar o seu no primeiro login
const EMAIL_PADRAO = 'admin@rifa.com';
const SENHA_PADRAO = 'admin123';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Banco de dados (arquivo JSON) ----------

const DB_INICIAL = {
  config: {
    titulo: 'Minha Rifa',
    premio: 'iPhone 16 Pro Max',
    descricao: 'Concorra a um prêmio incrível! Escolha seus números, pague via Pix e aguarde a confirmação.',
    preco: 10,
    quantidade: 100,
    foto: '',
    fotos: [],
    pixChave: '',
    pixNome: '',
    pixCidade: '',
    reservaMinutos: 60,
    whatsapp: '',
    dataSorteio: ''
  },
  aparencia: {
    corFundo: '#0f1020',
    corTexto: '#f4f4ff',
    corDestaque: '#ffcc00',
    corPremio: '#ffb703',
    corSecundaria: '#7c3aed',
    textoBotao: 'Comprar com Pix',
    rotuloPremio: '🏆 Prêmio',
    rotuloPreco: 'Valor por número',
    tituloNumeros: 'Escolha seus números',
    msgPendente: 'Pague o Pix abaixo. Assim que o organizador confirmar o recebimento, esta página mostra CONFIRMADO.',
    tituloPendente: 'Aguardando confirmação',
    tituloConfirmado: 'PAGAMENTO CONFIRMADO!',
    msgConfirmado: 'Obrigado pela compra, {nome}! Seus números {numeros} estão garantidos. Boa sorte! 🍀',
    tituloGanhador: '🎉 Temos um ganhador!',
    msgGanhador: 'Parabéns, {nome}! O número {numero} levou o prêmio {premio}.',
    tituloVoceGanhou: 'VOCÊ GANHOU! 🏆',
    msgVoceGanhou: 'Parabéns, {nome}! Seu número {numero} foi o sorteado e o prêmio {premio} é seu. O organizador vai entrar em contato.',
    whatsObrigado: 'Olá, {nome}! Recebemos seu pagamento de {total} da rifa "{rifa}". Seus números: {numeros}. Obrigado e boa sorte! 🍀',
    whatsGanhador: 'Parabéns, {nome}! 🎉 Seu número {numero} foi o sorteado na rifa "{rifa}" e você ganhou {premio}! Vamos combinar a entrega.',
    rodape: 'Pagamento exclusivo via Pix. Seus números são confirmados após a verificação do pagamento pelo organizador.',
    mostrarProgresso: true,
    mostrarContagem: true,
    mostrarAleatorio: true,
    mostrarConsulta: true,
    mostrarGanhador: true,
    mostrarWhatsapp: true,
    efeitoFoto: 'cinema',
    transicaoFoto: 'esmaecer',
    intervaloFoto: 5
  },
  adminPath: process.env.ADMIN_PATH || 'admin',
  senhaHash: null,
  pedidos: [],
  sorteios: [],
  seq: 0
};

function carregar() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return { ...DB_INICIAL, ...db, config: { ...DB_INICIAL.config, ...db.config }, aparencia: { ...DB_INICIAL.aparencia, ...db.aparencia } };
  } catch {
    return JSON.parse(JSON.stringify(DB_INICIAL));
  }
}

let db = carregar();
// Versões antigas tinham uma foto só
if (!db.config.fotos.length && db.config.foto) db.config.fotos = [db.config.foto];
// Volta o login para o acesso padrão: uma vez ao atualizar para o login com e-mail,
// ou sempre que RESETAR_SENHA estiver definida no ambiente
if (db.credVersao !== 2 || process.env.RESETAR_SENHA) {
  db.adminEmail = EMAIL_PADRAO;
  db.senhaHash = hashSenha(SENHA_PADRAO);
  db.deveTrocar = true;
  db.credVersao = 2;
  salvar();
  console.log(`Acesso do painel resetado: ${EMAIL_PADRAO} / ${SENHA_PADRAO}.` + (process.env.RESETAR_SENHA ? ' Remova RESETAR_SENHA depois de entrar.' : ''));
}
// ADMIN_PATH no ambiente sempre vence (serve para recuperar o painel se esquecer o endereço)
if (process.env.ADMIN_PATH) db.adminPath = process.env.ADMIN_PATH;

function salvar() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// Pedidos pendentes que passaram do prazo de reserva liberam os números
function expirarReservas() {
  const min = Number(db.config.reservaMinutos) || 0;
  if (min <= 0) return;
  const limite = Date.now() - min * 60 * 1000;
  let mudou = false;
  for (const p of db.pedidos) {
    if (p.status === 'pendente' && new Date(p.criadoEm).getTime() < limite) {
      p.status = 'expirado';
      mudou = true;
    }
  }
  if (mudou) salvar();
}

function numerosOcupados(ignorarId) {
  const mapa = {};
  for (const p of db.pedidos) {
    if (p.id === ignorarId) continue;
    if (p.status === 'pendente' || p.status === 'pago') {
      for (const n of p.numeros) mapa[n] = p.status === 'pago' ? 'pago' : 'reservado';
    }
  }
  return mapa;
}

// ---------- Pix (BR Code estático "copia e cola") ----------

function semAcento(txt, max) {
  return String(txt || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase().trim().slice(0, max);
}

function campo(id, valor) {
  return id + String(valor.length).padStart(2, '0') + valor;
}

function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function gerarPix({ chave, nome, cidade, valor, txid }) {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave.trim());
  let payload =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', Number(valor).toFixed(2)) +
    campo('58', 'BR') +
    campo('59', semAcento(nome, 25) || 'RECEBEDOR') +
    campo('60', semAcento(cidade, 15) || 'BRASIL') +
    campo('62', campo('05', semAcento(txid, 25).replace(/ /g, '') || '***')) +
    '6304';
  return payload + crc16(payload);
}

// ---------- Auth do admin ----------

function hashSenha(senha, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(senha, salt, 64).toString('hex');
}

function senhaConfere(email, senha) {
  if (!db.senhaHash || email.trim().toLowerCase() !== String(db.adminEmail || '').toLowerCase()) return false;
  const [salt, hash] = db.senhaHash.split(':');
  const teste = crypto.scryptSync(senha, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(teste, 'hex'));
}

const sessoes = new Map(); // token -> expira em (ms)

function exigirAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const exp = sessoes.get(token);
  if (!exp || exp < Date.now()) return res.status(401).json({ erro: 'Faça login novamente.' });
  next();
}

// ---------- App ----------

const app = express();
app.set('trust proxy', true);
app.use(express.json());

// Página inicial com título, descrição e foto para a prévia do link no WhatsApp/Facebook
const INDEX_HTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const attr = s => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
app.get(['/', '/index.html'], (req, res) => {
  const c = db.config;
  const base = `${req.protocol}://${req.get('host')}`;
  const titulo = `${c.titulo} | Concorra: ${c.premio}`;
  const desc = `Apenas ${Number(c.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por número. Escolha os seus e pague via Pix.`;
  const meta = [
    `<meta name="description" content="${attr(desc)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${attr(base + '/')}">`,
    `<meta property="og:title" content="${attr(titulo)}">`,
    `<meta property="og:description" content="${attr(desc)}">`,
    c.fotos[0] ? `<meta property="og:image" content="${attr(base + c.fotos[0])}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`
  ].join('\n  ');
  res.set('Cache-Control', 'no-cache');
  res.type('html').send(INDEX_HTML.replace('<title>Rifa Online</title>', `<title>${attr(titulo)}</title>`).replace('<!--META-->', meta)
    .replace('content="#0f1020"', `content="${attr(db.aparencia.corFundo)}"`));
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, 'foto-' + Date.now() + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

function configPublica() {
  const c = db.config;
  return {
    titulo: c.titulo, premio: c.premio, descricao: c.descricao, preco: c.preco,
    quantidade: c.quantidade, foto: c.fotos[0] || '', fotos: c.fotos, whatsapp: c.whatsapp, dataSorteio: c.dataSorteio,
    pixConfigurado: Boolean(c.pixChave),
    aparencia: db.aparencia
  };
}

function pedidoPublico(p) {
  const pix = gerarPix({
    chave: db.config.pixChave, nome: db.config.pixNome, cidade: db.config.pixCidade,
    valor: p.total, txid: 'RIFA' + p.codigo
  });
  return {
    id: p.id, codigo: p.codigo, nome: p.nome, numeros: p.numeros, total: p.total,
    status: p.status, criadoEm: p.criadoEm, confirmadoEm: p.confirmadoEm || null,
    reservaMinutos: db.config.reservaMinutos, pix
  };
}

// Rifa pública
app.get('/api/rifa', (req, res) => {
  expirarReservas();
  const ultimo = db.sorteios[db.sorteios.length - 1];
  res.json({
    config: configPublica(),
    ocupados: numerosOcupados(),
    ganhador: ultimo ? { numero: ultimo.numero, nome: primeiroNome(ultimo.nome), data: ultimo.data } : null
  });
});

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

// Criar pedido (reserva os números)
app.post('/api/pedidos', (req, res) => {
  expirarReservas();
  const c = db.config;
  if (!c.pixChave) return res.status(400).json({ erro: 'A rifa ainda não está aberta para pagamentos.' });
  if (db.sorteios.length) return res.status(400).json({ erro: 'Esta rifa já foi sorteada.' });

  const nome = String(req.body.nome || '').trim().slice(0, 80);
  const telefone = String(req.body.telefone || '').replace(/\D/g, '').slice(0, 13);
  const numeros = [...new Set((req.body.numeros || []).map(Number))].sort((a, b) => a - b);

  if (nome.length < 3) return res.status(400).json({ erro: 'Informe seu nome completo.' });
  if (telefone.length < 10) return res.status(400).json({ erro: 'Informe um WhatsApp válido com DDD.' });
  if (!numeros.length) return res.status(400).json({ erro: 'Escolha pelo menos um número.' });
  if (numeros.some(n => !Number.isInteger(n) || n < 1 || n > c.quantidade)) {
    return res.status(400).json({ erro: 'Número inválido.' });
  }
  const ocupados = numerosOcupados();
  const indisponiveis = numeros.filter(n => ocupados[n]);
  if (indisponiveis.length) {
    return res.status(409).json({ erro: 'Alguns números acabaram de ser reservados por outra pessoa.', indisponiveis });
  }

  db.seq += 1;
  const pedido = {
    id: crypto.randomBytes(12).toString('hex'),
    codigo: String(db.seq).padStart(4, '0'),
    nome, telefone, numeros,
    total: Math.round(numeros.length * c.preco * 100) / 100,
    status: 'pendente',
    criadoEm: new Date().toISOString()
  };
  db.pedidos.push(pedido);
  salvar();
  res.json({ id: pedido.id });
});

// Pedido de exemplo para a prévia das telas no painel
app.get('/api/previa/pedido/:status', async (req, res) => {
  const status = ['pendente', 'pago', 'ganhou'].includes(req.params.status) ? req.params.status : 'pendente';
  const q = db.config.quantidade;
  const numeros = [7, 13, 42].filter(n => n <= q);
  const p = { id: 'previa-' + status, codigo: '0001', nome: 'Maria da Silva', numeros: numeros.length ? numeros : [1],
    total: Math.round((numeros.length || 1) * db.config.preco * 100) / 100,
    status: status === 'ganhou' ? 'pago' : status, criadoEm: new Date().toISOString() };
  const dados = db.config.pixChave ? pedidoPublico(p) : { ...p, pix: 'PIX-DE-EXEMPLO', reservaMinutos: db.config.reservaMinutos };
  dados.ganhou = status === 'ganhou' ? p.numeros[0] : null;
  dados.qr = await QRCode.toDataURL(dados.pix, { margin: 1, width: 320 });
  dados.rifa = configPublica();
  dados.previa = true;
  res.json(dados);
});

app.get('/api/pedidos/:id', async (req, res) => {
  expirarReservas();
  const p = db.pedidos.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ erro: 'Pedido não encontrado.' });
  const dados = pedidoPublico(p);
  const ultimo = db.sorteios[db.sorteios.length - 1];
  dados.ganhou = p.status === 'pago' && ultimo && p.numeros.includes(ultimo.numero) ? ultimo.numero : null;
  dados.qr = await QRCode.toDataURL(dados.pix, { margin: 1, width: 320 });
  dados.rifa = configPublica();
  res.json(dados);
});

// Comprador consulta seus pedidos pelo WhatsApp
app.get('/api/consulta', (req, res) => {
  expirarReservas();
  const tel = String(req.query.telefone || '').replace(/\D/g, '');
  if (tel.length < 10) return res.status(400).json({ erro: 'Informe o WhatsApp com DDD.' });
  const lista = db.pedidos
    .filter(p => p.telefone === tel)
    .reverse()
    .map(p => ({ id: p.id, codigo: p.codigo, numeros: p.numeros, total: p.total, status: p.status, criadoEm: p.criadoEm }));
  res.json(lista);
});

// ---------- Rotas do admin ----------

// Limite de tentativas por IP: 10 erros em 15 minutos
const tentativas = new Map();
app.post('/api/admin/login', (req, res) => {
  const ip = req.ip, agora = Date.now();
  const t = (tentativas.get(ip) || []).filter(x => x > agora - 15 * 60 * 1000);
  if (t.length >= 10) return res.status(429).json({ erro: 'Muitas tentativas. Espere 15 minutos e tente de novo.' });
  if (!senhaConfere(String(req.body.email || ''), String(req.body.senha || ''))) {
    t.push(agora); tentativas.set(ip, t);
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }
  tentativas.delete(ip);
  const token = crypto.randomBytes(24).toString('hex');
  sessoes.set(token, Date.now() + 12 * 60 * 60 * 1000);
  res.json({ token, deveTrocar: !!db.deveTrocar });
});

app.get('/api/admin/dados', exigirAdmin, (req, res) => {
  expirarReservas();
  res.json({
    config: db.config,
    pedidos: [...db.pedidos].reverse(),
    sorteios: db.sorteios,
    aparencia: db.aparencia,
    adminPath: db.adminPath,
    adminEmail: db.adminEmail,
    deveTrocar: !!db.deveTrocar
  });
});

app.put('/api/admin/config', exigirAdmin, (req, res) => {
  const b = req.body;
  const c = db.config;
  const quantidade = parseInt(b.quantidade, 10);
  const preco = Number(String(b.preco).replace(',', '.'));
  if (!(quantidade >= 1 && quantidade <= 100000)) return res.status(400).json({ erro: 'Quantidade de números inválida (1 a 100000).' });
  if (!(preco > 0)) return res.status(400).json({ erro: 'Valor do número inválido.' });
  const maiorUsado = Math.max(0, ...db.pedidos.filter(p => p.status === 'pendente' || p.status === 'pago').flatMap(p => p.numeros));
  if (quantidade < maiorUsado) {
    return res.status(400).json({ erro: `Já existe número ${maiorUsado} vendido/reservado. A quantidade não pode ser menor que isso.` });
  }
  Object.assign(c, {
    titulo: String(b.titulo || '').slice(0, 100),
    premio: String(b.premio || '').slice(0, 150),
    descricao: String(b.descricao || '').slice(0, 2000),
    preco: Math.round(preco * 100) / 100,
    quantidade,
    pixChave: String(b.pixChave || '').trim().slice(0, 77),
    pixNome: String(b.pixNome || '').slice(0, 60),
    pixCidade: String(b.pixCidade || '').slice(0, 40),
    reservaMinutos: Math.max(0, parseInt(b.reservaMinutos, 10) || 0),
    whatsapp: String(b.whatsapp || '').replace(/\D/g, '').slice(0, 13),
    dataSorteio: String(b.dataSorteio || '').slice(0, 60)
  });
  salvar();
  res.json({ ok: true, config: c });
});

const MAX_FOTOS = 10;
function apagarUpload(url) {
  if (url && url.startsWith('/uploads/')) fs.unlink(path.join(UPLOAD_DIR, path.basename(url)), () => {});
}
function atualizarFotos(lista) {
  db.config.fotos = lista;
  db.config.foto = lista[0] || '';
  salvar();
}

// Adiciona uma ou mais fotos ao carrossel
app.post('/api/admin/fotos', exigirAdmin, upload.array('fotos', MAX_FOTOS), (req, res) => {
  const novas = (req.files || []).map(f => '/uploads/' + f.filename);
  if (!novas.length) return res.status(400).json({ erro: 'Envie imagens (JPG, PNG, WEBP ou GIF) de até 8 MB cada.' });
  const lista = [...db.config.fotos, ...novas];
  lista.slice(MAX_FOTOS).forEach(apagarUpload);
  atualizarFotos(lista.slice(0, MAX_FOTOS));
  res.json({ fotos: db.config.fotos, aviso: lista.length > MAX_FOTOS ? `Máximo de ${MAX_FOTOS} fotos. As que passaram foram ignoradas.` : '' });
});

// Nova ordem (e remoção) das fotos: recebe a lista final
app.put('/api/admin/fotos', exigirAdmin, (req, res) => {
  const atual = db.config.fotos;
  const lista = (Array.isArray(req.body.fotos) ? req.body.fotos : []).filter(f => atual.includes(f));
  atual.filter(f => !lista.includes(f)).forEach(apagarUpload);
  atualizarFotos([...new Set(lista)]);
  res.json({ fotos: db.config.fotos });
});

app.post('/api/admin/pedidos/:id/:acao', exigirAdmin, (req, res) => {
  const p = db.pedidos.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ erro: 'Pedido não encontrado.' });
  const acao = req.params.acao;
  if (acao === 'confirmar') {
    if (p.status !== 'pago') {
      const ocupados = numerosOcupados(p.id);
      const conflito = p.numeros.filter(n => ocupados[n]);
      if (conflito.length) {
        return res.status(409).json({ erro: `Os números ${conflito.join(', ')} já foram pegos por outro pedido. Não dá para confirmar este.` });
      }
    }
    p.status = 'pago';
    p.confirmadoEm = new Date().toISOString();
  } else if (acao === 'cancelar') {
    p.status = 'cancelado';
    delete p.confirmadoEm;
  } else if (acao === 'pendente') {
    const ocupados = numerosOcupados(p.id);
    if (p.numeros.some(n => ocupados[n])) return res.status(409).json({ erro: 'Os números deste pedido já foram pegos por outro.' });
    p.status = 'pendente';
    p.criadoEm = new Date().toISOString();
    delete p.confirmadoEm;
  } else {
    return res.status(400).json({ erro: 'Ação inválida.' });
  }
  salvar();
  res.json({ ok: true, pedido: p });
});

// Sorteio: o servidor escolhe o número (aleatório seguro) e a roleta só anima até ele
app.post('/api/admin/sorteio', exigirAdmin, (req, res) => {
  const pagos = db.pedidos.filter(p => p.status === 'pago');
  const numeros = pagos.flatMap(p => p.numeros.map(n => ({ n, p })));
  if (!numeros.length) return res.status(400).json({ erro: 'Nenhum número pago para sortear.' });
  const sorteado = numeros[crypto.randomInt(numeros.length)];
  const resultado = {
    numero: sorteado.n,
    nome: sorteado.p.nome,
    telefone: sorteado.p.telefone,
    pedido: sorteado.p.codigo,
    data: new Date().toISOString()
  };
  db.sorteios.push(resultado);
  salvar();
  res.json(resultado);
});

app.delete('/api/admin/sorteios', exigirAdmin, (req, res) => {
  db.sorteios = [];
  salvar();
  res.json({ ok: true });
});

app.post('/api/admin/credenciais', exigirAdmin, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const nova = String(req.body.senha || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  if (nova.length < 6) return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
  if (email === EMAIL_PADRAO && nova === SENHA_PADRAO) return res.status(400).json({ erro: 'Escolha uma senha diferente da padrão.' });
  db.adminEmail = email;
  db.senhaHash = hashSenha(nova);
  db.deveTrocar = false;
  salvar();
  // Derruba as outras sessões abertas com o acesso antigo
  const atual = (req.headers.authorization || '').replace('Bearer ', '');
  for (const tk of [...sessoes.keys()]) if (tk !== atual) sessoes.delete(tk);
  res.json({ ok: true, email });
});

const COR = /^#[0-9a-fA-F]{6}$/;
app.put('/api/admin/aparencia', exigirAdmin, (req, res) => {
  const a = db.aparencia, b = req.body;
  for (const k of ['corFundo', 'corTexto', 'corDestaque', 'corPremio', 'corSecundaria']) {
    if (b[k] !== undefined) {
      if (!COR.test(b[k])) return res.status(400).json({ erro: 'Cor inválida.' });
      a[k] = b[k];
    }
  }
  if (b.efeitoFoto !== undefined) {
    if (!['cinema', 'zoom', 'brilho', 'flutuar', 'pulsar', 'nenhum'].includes(b.efeitoFoto)) return res.status(400).json({ erro: 'Efeito inválido.' });
    a.efeitoFoto = b.efeitoFoto;
  }
  if (b.transicaoFoto !== undefined) a.transicaoFoto = b.transicaoFoto === 'deslizar' ? 'deslizar' : 'esmaecer';
  if (b.intervaloFoto !== undefined) a.intervaloFoto = Math.min(30, Math.max(2, parseInt(b.intervaloFoto, 10) || 5));
  for (const k of ['textoBotao', 'rotuloPremio', 'rotuloPreco', 'tituloNumeros', 'msgPendente', 'msgConfirmado', 'rodape',
    'tituloPendente', 'tituloConfirmado', 'tituloGanhador', 'msgGanhador', 'tituloVoceGanhou', 'msgVoceGanhou', 'whatsObrigado', 'whatsGanhador']) {
    if (b[k] !== undefined) a[k] = String(b[k]).slice(0, 500);
  }
  for (const k of ['mostrarProgresso', 'mostrarContagem', 'mostrarAleatorio', 'mostrarConsulta', 'mostrarGanhador', 'mostrarWhatsapp']) {
    if (b[k] !== undefined) a[k] = Boolean(b[k]);
  }
  salvar();
  res.json({ ok: true, aparencia: a });
});

app.put('/api/admin/aparencia/padrao', exigirAdmin, (req, res) => {
  db.aparencia = { ...DB_INICIAL.aparencia };
  salvar();
  res.json({ ok: true, aparencia: db.aparencia });
});

// Endereço secreto do painel (ex.: /painel-antonio-2024)
const RESERVADOS = ['api', 'uploads', 'pedido', 'index.html', 'pedido.html', 'style.css', 'comum.js'];
app.put('/api/admin/endereco', exigirAdmin, (req, res) => {
  const slug = String(req.body.endereco || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{4,40}$/.test(slug) || RESERVADOS.includes(slug)) {
    return res.status(400).json({ erro: 'Use de 4 a 40 caracteres: letras minúsculas, números e hífen.' });
  }
  db.adminPath = slug;
  salvar();
  res.json({ ok: true, endereco: slug });
});

app.get('/:slug', (req, res, next) => {
  if (req.params.slug !== db.adminPath) return next();
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'privado', 'admin.html'));
});
app.get('/pedido/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pedido.html')));

app.listen(PORT, () => console.log(`Rifa online rodando em http://localhost:${PORT}  (painel: /${db.adminPath})`));
