<?php
// ====== CONFIGURAÇÃO ======
$arquivo = __DIR__ . "/vendas_rifa.csv";
$vendas = [];

// Carregar vendas do CSV
if (file_exists($arquivo) && ($fp = fopen($arquivo, "r")) !== false) {
    while (($row = fgetcsv($fp, 1000, ";")) !== false) {
        if (!isset($row[0]) || $row[0] === "" || strtolower($row[0]) === "id") continue;
        $vendas[] = [
            "id"          => intval($row[0]),
            "number"      => intval($row[1]),
            "buyer"       => $row[2] ?? "",
            "pay"         => $row[3] ?? "",
            "transaction" => $row[4] ?? "",
            "cpf"         => $row[5] ?? "",
            "phone"       => $row[6] ?? "",
            "date"        => $row[7] ?? "",
            "vendido"     => $row[8] ?? "2"
        ];
    }
    fclose($fp);
}

// Total de rifas
define("TOTAL_TICKETS", 1000);

// Inicializar tickets
$tickets = [];
for ($i = 1; $i <= TOTAL_TICKETS; $i++) {
    $tickets[$i] = ["id"=>$i,"number"=>$i,"status"=>"free"];
}

// Marcar vendidos
foreach ($vendas as $v) {
    if (isset($tickets[$v["id"]])) {
        $tickets[$v["id"]]["status"] = ($v["vendido"]=="1") ? "sold" : "free";
    }
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Venda de Rifa Online</title>
<style>
:root{
--bg:#f6f8fb; --card:#fff; --accent:#0b76ff; --muted:#6b7280;
--sold:#c7f0d4; --reserved:#fff6d1;
}
*{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,Arial;}
body{margin:0;background:linear-gradient(180deg,var(--bg),#eef5ff);min-height:100vh;padding:18px;color:#0f172a;}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap;}
h1{font-size:20px;margin:0;}
.controls{display:flex;gap:8px;align-items:center;}
button{background:var(--accent);color:#fff;border:0;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:600;}
button.alt{background:transparent;border:1px solid rgba(11,118,255,0.12);color:var(--accent);}
.wrap{display:grid;grid-template-columns:320px 1fr;gap:16px;}
.panel{background:var(--card);padding:14px;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,0.06);}
.tickets{display:grid;grid-template-columns:repeat(auto-fill,60px);gap:8px;max-height:60vh;overflow:auto;padding:8px;border-radius:8px;border:1px dashed #e6eef8;background:linear-gradient(180deg,#fff,#fbfdff);}
.ticket{width:60px;height:60px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#f8fbff;border:1px solid #e6eef8;font-weight:600;color:#0f172a;cursor:pointer;transition:0.2s;text-align:center;padding:4px;font-size:12px;}
.ticket:hover{box-shadow:0 4px 12px rgba(0,0,0,0.15);transform:translateY(-2px);}
.ticket.sold{background:var(--sold);border-color:#9fe3b3;color:#065f2b;cursor:not-allowed;}
.legend{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;}
.legend span{display:flex;gap:6px;align-items:center;font-size:13px;}
.sw{width:14px;height:14px;border-radius:4px;display:inline-block;}
.small{font-size:13px;color:var(--muted);}
.modal{position:fixed;inset:0;background:rgba(10,20,40,0.45);display:flex;align-items:center;justify-content:center;padding:20px;z-index:60;visibility:hidden;opacity:0;transition:all .18s;}
.modal.open{visibility:visible;opacity:1;}
.dialog{background:#fff;padding:18px;border-radius:12px;max-width:720px;width:100%;box-shadow:0 10px 40px rgba(2,6,23,0.4);}
form{display:flex;flex-direction:column;gap:10px;}
.summary{background:linear-gradient(180deg,#fff,#fbfdff);padding:12px;border-radius:8px;border:1px solid #e6eef8;}
footer{margin-top:12px;color:var(--muted);font-size:13px;text-align:center;}
@media(max-width:900px){.wrap{grid-template-columns:1fr}}
#pixQr{width:180px;height:180px;object-fit:contain;border:1px solid #e6eef8;border-radius:8px;margin-top:6px;}
#premio{display:block;max-width:100%;height:auto;margin-top:12px;border-radius:8px;border:1px solid #e6eef8;}
</style>
</head>
<body>

<header>
<div>
<h1>Venda de Rifa Online — Prêmio: Bicicleta Aro 26 — R$ 10,00</h1>
<div class="small">Clique nos números para comprar o bilhete.</div>
</div>
<div class="controls">
<button id="adminBtn">Painel Admin</button>
<div class="small" id="stats"></div>
</div>
</header>

<div class="wrap">
<div class="panel">
<div class="legend">
<span><i class="sw" style="background:#f8fbff;border:1px solid #e6eef8"></i> Livre</span>
<span><i class="sw" style="background:#c7f0d4;border:1px solid #9fe3b3"></i> Vendido</span>
</div>
<img id="premio" src="bike.webp" alt="Prêmio da Rifa">
</div>

<div class="panel">
<strong>Mapa de bilhetes</strong>
<div id="tickets" class="tickets">
<?php foreach ($tickets as $t): ?>
  <div class="ticket <?= $t["status"] ?>" data-id="<?= $t["id"] ?>"><?= $t["number"] ?></div>
<?php endforeach; ?>
</div>
</div>
</div>

<!-- Modal -->
<div id="modal" class="modal">
<div class="dialog">
<div style="display:flex;justify-content:space-between;align-items:center">
  <strong id="modalTitle">Bilhete</strong>
  <button id="closeModal" class="alt">Fechar</button>
</div>
<form id="saleForm" style="margin-top:10px">
<input type="hidden" id="ticketId" name="id">
<input id="buyerName" name="buyer" type="text" placeholder="Nome completo" required>
<select id="paymentMethod" name="pay">
  <option value="pix">PIX</option>
  <option value="card">Cartão Débito / Crédito</option>
  <option value="cash">Dinheiro</option>
</select>
<input type="text" id="transactionNumber" name="transaction" placeholder="Número da transação">
<input type="text" id="cpfBuyer" name="cpf" placeholder="CPF do comprador" maxlength="14">
<input type="text" id="phoneBuyer" name="phone" placeholder="Telefone (DDD + Número)" maxlength="15">
<div class="summary" id="pixCode">PIX: antoniocarlosqueiroz2025@hotmail.com</div>
<img id="pixQr" src="qrcode.png">
<button type="submit">Confirmar venda</button>
</form>
</div>
</div>

<footer>© 2025 Rifa Online - Desenvolvido por Antônio Carlos</footer>

<script>
// ===== Botão Admin simples =====
document.getElementById('adminBtn').addEventListener('click', ()=>{
    window.location.href = "admin.php";
});

// ===== Inicializar tickets e stats =====
const TOTAL = <?= TOTAL_TICKETS ?>;
let tickets = <?php echo json_encode(array_values($tickets)); ?>;

function updateStats(){
    const sold = tickets.filter(t => t.status==='sold').length;
    document.getElementById('stats').innerText = sold + " vendidos • " + (TOTAL - sold) + " livres";
}
updateStats();

// ===== Modal =====
const modal = document.getElementById('modal');
document.querySelectorAll('.ticket').forEach(el=>{
    el.addEventListener('click', ()=>{
        if(el.classList.contains('sold')) return;
        document.getElementById('ticketId').value = el.dataset.id;
        document.getElementById('modalTitle').innerText = "Bilhete Nº " + el.innerText;
        modal.classList.add('open');
    });
});
document.getElementById('closeModal').onclick = ()=>modal.classList.remove('open');

// ===== Máscaras =====
function maskCPF(v){return v.replace(/\D/g,"").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2");}
function maskPhone(v){return v.replace(/\D/g,"").replace(/^(\d{2})(\d)/g,"($1) $2").replace(/(\d{4,5})(\d{4})$/,"$1-$2");}
document.getElementById('cpfBuyer').addEventListener('input',e=>e.target.value=maskCPF(e.target.value));
document.getElementById('phoneBuyer').addEventListener('input',e=>e.target.value=maskPhone(e.target.value));

// ===== Salvar venda =====
document.getElementById('saleForm').onsubmit = async e=>{
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await fetch('salvar.php',{method:'POST',body:formData});
    const data = await res.json();
    if(data.success){
        alert("Venda confirmada! Bilhete nº "+data.number+" foi marcado como vendido.");
        location.reload();
    }else{
        alert("Erro: "+data.message);
    }
};
</script>

</body>
</html>
