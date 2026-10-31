# Rifa Online

Site de rifa com pagamento exclusivo via Pix, painel do organizador e roleta de sorteio.

## O que tem

**Site público (`/`)**
- Foto do prêmio, nome do prêmio e valor do número em destaque, bem grandes
- Grade com a quantidade de números que você definir (disponível, reservado, pago)
- Escolha manual ou aleatória (+1, +5, +10), busca de número
- Compra só via Pix: gera QR Code e Pix Copia e Cola com o valor certo
- Página do pedido que mostra "Aguardando confirmação" e muda sozinha para
  **PAGAMENTO CONFIRMADO** quando você confirma no admin
- Consulta de pedidos pelo WhatsApp do comprador
- Depois do sorteio, mostra o número e o primeiro nome do ganhador

**Painel do organizador (endereço secreto)**
- O site público não tem nenhum link para o painel. No primeiro acesso ele fica em
  `/admin`; em Configurações você troca para um endereço só seu (ex.: `/painel-antonio-77`)
  e o `/admin` deixa de existir.
- Aba **Aparência**: cores, textos, botão de compra, mensagens de pendente e
  confirmado, rodapé e o que aparece ou some no site, com pré-visualização.
- Pedidos: confirmar pagamento, cancelar, voltar para pendente, resumo do arrecadado
- Até 10 fotos do prêmio em carrossel animado (efeitos cinema, zoom, brilho, flutuar
  ou pulsar; troca esmaecendo ou deslizando), com reordenar e remover
- Configurações: título, prêmio, descrição, valor, quantidade de números, fotos,
  chave Pix, WhatsApp, data do sorteio, prazo de reserva, troca de senha
- Roleta: gira com animação entre os números pagos. O número é escolhido pelo
  servidor com sorteio aleatório seguro, e a roleta só para em cima dele.

Senha inicial do admin: **admin123** (troque no primeiro acesso, em Configurações).
Você também pode definir pela variável de ambiente `ADMIN_SENHA`.

## Rodar no computador

Precisa do Node.js 18 ou mais novo.

```bash
npm install
npm start
```

Abra http://localhost:3000 (site) e http://localhost:3000/admin (painel, até você trocar o endereço).

## Colocar no ar (recomendado: Railway)

Os dados (pedidos, configurações e foto) ficam na pasta `data/`, então a
hospedagem precisa de um disco permanente.

1. Suba esta pasta para um repositório no GitHub.
2. Em https://railway.app crie um projeto com "Deploy from GitHub repo".
3. No serviço, adicione um **Volume** montado em `/data`.
4. Em **Variables**, adicione `DATA_DIR=/data` e `ADMIN_SENHA=sua-senha-forte`.
5. Em **Settings → Networking**, clique em "Generate Domain" para ganhar o link público.

Também funciona em Render (com Persistent Disk), Fly.io ou qualquer VPS
(há um `Dockerfile` pronto).

## Variáveis de ambiente

| Variável      | Padrão      | Para que serve                         |
|---------------|-------------|----------------------------------------|
| `PORT`        | `3000`      | Porta do servidor                      |
| `DATA_DIR`    | `./data`    | Onde ficam o banco e as fotos          |
| `ADMIN_SENHA` | `admin123`  | Senha inicial (até trocar pelo painel) |
| `ADMIN_PATH`  | `admin`     | Força o endereço do painel (use se esquecer o seu) |

## Observações

- O Pix é estático (sua chave, com valor e código do pedido). A confirmação é
  manual: confira no app do banco e clique em "Confirmar pagamento".
- Pedidos não pagos expiram depois do prazo configurado (padrão 60 min) e os
  números voltam a ficar disponíveis. Use 0 para nunca expirar.
- Faça backup de `data/db.json` de vez em quando.
