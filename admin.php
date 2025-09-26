<?php
// ====== ADMIN.PHP ======
// Senha simples para acesso
session_start();
define('ADMIN_PASS', 'admin123'); // altere para sua senha real

// Login
if(isset($_POST['senha'])){
    if($_POST['senha'] === ADMIN_PASS){
        $_SESSION['admin'] = true;
    } else {
        $erro = "Senha incorreta!";
    }
}

// Verifica se está logado
if(!isset($_SESSION['admin'])){
    ?>
    <!doctype html>
    <html lang="pt-BR">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Login Admin — Rifa Online</title>
        <style>
            body{display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#f6f8fb;}
            form{background:#fff;padding:20px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.1);}
            input{padding:8px;width:200px;margin-bottom:10px;border-radius:6px;border:1px solid #ccc;}
            button{padding:8px 12px;border:none;background:#0b76ff;color:#fff;border-radius:6px;cursor:pointer;}
            .erro{color:red;margin-bottom:10px;}
        </style>
    </head>
    <body>
        <form method="post">
            <div class="erro"><?= $erro ?? "" ?></div>
            <input type="password" name="senha" placeholder="Senha Admin" required>
            <button type="submit">Entrar</button>
        </form>
    </body>
    </html>
    <?php
    exit;
}

// ====== CONFIGURAÇÃO ======
$arquivo = __DIR__ . "/vendas_rifa.csv";
$vendas = [];

// Carregar vendas do CSV
if(file_exists($arquivo) && ($fp = fopen($arquivo,"r"))!==false){
    while(($row=fgetcsv($fp,1000,";"))!==false){
        if(!isset($row[0]) || $row[0]==="" || strtolower($row[0])==="id") continue;
        $vendas[] = [
            "id"=>intval($row[0]),
            "number"=>intval($row[1]),
            "name"=>$row[2]??"",
            "metodo"=>$row[3]??"",
            "transaction"=>$row[4]??"",
            "cpf"=>$row[5]??"",
            "phone"=>$row[6]??"",
            "date"=>$row[7]??"",
            "vendido"=>$row[8]??"2"
        ];
    }
    fclose($fp);
}
?>

<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Painel Admin — Rifa Online</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body{margin:0;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,Arial;background:#f6f8fb;color:#0f172a;padding:20px;}
h1{font-size:22px;margin-bottom:12px;}
.dashboard{display:flex;gap:20px;flex-wrap:wrap;}
.panel{background:#fff;padding:16px;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,0.06);flex:1;min-width:300px;}
table{width:100%;border-collapse:collapse;margin-top:12px;}
th,td{border:1px solid #e6eef8;padding:8px;text-align:left;}
th{background:#f0f4f8;}
button{background:#0b76ff;color:#fff;border:0;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:600;margin-top:10px;}
</style>
</head>
<body>

<h1>Painel Admin — Rifa Online</h1>

<div class="dashboard">
  <div class="panel">
    <h2>Vendas por Forma de Pagamento</h2>
    <canvas id="paymentChart" width="400" height="200"></canvas>
  </div>

  <div class="panel">
    <h2>Porcentagem de Vendas (Pizza)</h2>
    <canvas id="paymentPieChart" width="400" height="200"></canvas>
  </div>

  <div class="panel" style="flex-basis:100%;">
    <h2>Relatório Completo de Vendas</h2>
    <table id="salesTable">
      <thead>
        <tr>
          <th>ID</th>
          <th>Bilhete</th>
          <th>Comprador</th>
          <th>Pagamento</th>
          <th>Transação</th>
          <th>CPF</th>
          <th>Telefone</th>
          <th>Data</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach($vendas as $v): ?>
          <tr>
            <td><?= $v["id"] ?></td>
            <td><?= $v["number"] ?></td>
            <td><?= htmlspecialchars($v["name"]) ?></td>
            <td><?= htmlspecialchars($v["metodo"]) ?></td>
            <td><?= htmlspecialchars($v["transaction"]) ?></td>
            <td><?= htmlspecialchars($v["cpf"]) ?></td>
            <td><?= htmlspecialchars($v["phone"]) ?></td>
            <td><?= htmlspecialchars($v["date"]) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <button id="exportCsv">Exportar CSV</button>
  </div>
</div>

<script>
const vendas = <?= json_encode($vendas) ?>;

// Contar vendas por método
const counts = {pix:0, card:0, cash:0};
vendas.forEach(v=>{
    if(v.metodo==='pix') counts.pix++;
    else if(v.metodo==='card') counts.card++;
    else if(v.metodo==='cash') counts.cash++;
});

// Gráfico de barras
const barCtx = document.getElementById('paymentChart').getContext('2d');
new Chart(barCtx,{
    type:'bar',
    data:{
        labels:['PIX','Cartão','Dinheiro'],
        datasets:[{label:'Quantidade de Vendas', data:[counts.pix,counts.card,counts.cash], backgroundColor:['#0b76ff','#1d9bf0','#65c466']}]
    },
    options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
});

// Gráfico de pizza
const pieCtx = document.getElementById('paymentPieChart').getContext('2d');
new Chart(pieCtx,{
    type:'pie',
    data:{labels:['PIX','Cartão','Dinheiro'], datasets:[{data:[counts.pix,counts.card,counts.cash], backgroundColor:['#0b76ff','#1d9bf0','#65c466']}]},
    options:{
        responsive:true,
        plugins:{
            legend:{position:'bottom'},
            tooltip:{
                callbacks:{
                    label:function(ctx){
                        const total = counts.pix+counts.card+counts.cash;
                        const value = ctx.raw;
                        const percent = total?((value/total)*100).toFixed(1):0;
                        return `${ctx.label}: ${value} (${percent}%)`;
                    }
                }
            }
        }
    }
});

// Exportar CSV
document.getElementById('exportCsv').onclick=()=>{
    if(!vendas.length){ alert("Nenhuma venda registrada."); return; }
    const header="ID;Número do Bilhete;Nome do Comprador;Pagamento;Transação;CPF;Telefone;Data\n";
    const rows = vendas.map(v=>`${v.id};${v.number};${v.name};${v.metodo};${v.transaction};${v.cpf};${v.phone};${v.date}`).join("\n");
    const blob = new Blob([header+rows],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="vendas_rifa.csv"; a.click();
    URL.revokeObjectURL(url);
};
</script>

</body>
</html>
