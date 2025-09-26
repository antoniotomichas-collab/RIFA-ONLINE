<?php
$arquivo = __DIR__ . "/vendas_rifa.csv";

// Receber dados
$id          = $_POST["id"] ?? "";
$buyer       = $_POST["buyer"] ?? "";
$pay         = $_POST["pay"] ?? "";
$transaction = $_POST["transaction"] ?? "";
$cpf         = $_POST["cpf"] ?? "";
$phone       = $_POST["phone"] ?? "";
$date        = date("d/m/Y H:i");
$vendido     = "1"; // sempre vendido ao salvar

if ($id === "" || $buyer === "") {
    echo json_encode(["success"=>false,"message"=>"Dados inválidos"]);
    exit;
}

// Ler CSV existente
$rows = [];
if (file_exists($arquivo) && ($fp = fopen($arquivo, "r")) !== false) {
    while (($row = fgetcsv($fp, 1000, ";")) !== false) {
        $rows[] = $row;
    }
    fclose($fp);
}

// Atualizar ou adicionar linha
$found = false;
foreach ($rows as &$row) {
    if (isset($row[0]) && $row[0] == $id) {
        $row = [$id, $id, $buyer, $pay, $transaction, $cpf, $phone, $date, $vendido];
        $found = true;
        break;
    }
}
unset($row);

if (!$found) {
    $rows[] = [$id, $id, $buyer, $pay, $transaction, $cpf, $phone, $date, $vendido];
}

// Regravar CSV
if (($fp = fopen($arquivo, "w")) !== false) {
    fputcsv($fp, ["id","number","buyer","pay","transaction","cpf","phone","date","vendido"], ";");
    foreach ($rows as $r) {
        fputcsv($fp, $r, ";");
    }
    fclose($fp);
}

echo json_encode(["success"=>true,"number"=>$id]);
