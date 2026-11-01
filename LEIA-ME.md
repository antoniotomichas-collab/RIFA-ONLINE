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
- **Dashboard**: arrecadado, valor a confirmar, vendas de hoje, números vendidos,
  compradores, gráfico de arrecadação por dia, últimos pagamentos e lista de compradores
- Pedidos: confirmar pagamento, cancelar, voltar para pendente, resumo do arrecadado
- Mensagens configuráveis com prévia ao vivo: aguardando, agradecimento após a
  confirmação (na tela e no WhatsApp), tela do ganhador, WhatsApp do ganhador e
  resultado no site. Aceitam {nome}, {numeros}, {total}, {pedido}, {premio}, {rifa}, {numero}
- Até 10 fotos do prêmio em carrossel animado (efeitos cinema, zoom, brilho, flutuar
  ou pulsar; troca esmaecendo ou deslizando), com reordenar e remover
- Configurações: título, prêmio, descrição, valor, quantidade de números, fotos,
  chave Pix, WhatsApp, data do sorteio, prazo de reserva, troca de senha
- Roleta: gira com animação entre os números pagos. O número é escolhido pelo
  servidor com sorteio aleatório seguro, e a roleta só para em cima dele.

**Login do painel:** e-mail **admin@rifa.com** e senha **admin123**. No primeiro acesso o
painel pede para você criar o seu próprio e-mail e senha. Depois dá para trocar em
Configurações > Acesso ao painel. Após 10 tentativas erradas o login fica bloqueado
por 15 minutos.

Esqueceu o acesso? No Render, adicione a variável `RESETAR_SENHA` com qualquer valor,
salve, entre com o acesso padrão acima e depois apague a variável.

## Rodar no computador

Precisa do Node.js 18 ou mais novo.

```bash
npm install
npm start
```

Abra http://localhost:3000 (site) e http://localhost:3000/admin (painel, até você trocar o endereço).

## Colocar no ar no Render

O repositório já tem o arquivo `render.yaml`, que configura tudo sozinho.

1. Entre em https://dashboard.render.com e conecte sua conta do GitHub.
2. Clique em **New > Blueprint** e escolha o repositório `RIFA-ONLINE`.
3. Clique em **Apply**. Em poucos minutos o site fica no ar em `https://rifa-online-XXXX.onrender.com`.

Toda atualização enviada para a branch `main` do GitHub é publicada automaticamente.

O plano usado é o **Starter** (cerca de US$ 7/mês), porque ele permite um disco
permanente de 1 GB em `/var/data`, onde ficam pedidos, configurações e fotos. No plano
grátis o Render apaga esses arquivos a cada reinício, e você perderia as vendas.

Também funciona em Railway, Fly.io ou qualquer VPS (há um `Dockerfile` pronto);
nesses casos defina `DATA_DIR` apontando para um disco permanente.

## Variáveis de ambiente

| Variável      | Padrão      | Para que serve                         |
|---------------|-------------|----------------------------------------|
| `PORT`        | `3000`      | Porta do servidor                      |
| `DATA_DIR`    | `./data`    | Onde ficam o banco e as fotos          |
| `ADMIN_PATH`  | `admin`     | Força o endereço do painel (use se esquecer o seu) |
| `RESETAR_SENHA` | (vazio)   | Qualquer valor volta o login para admin@rifa.com / admin123. Remova depois de entrar |

## Observações

- O Pix é estático (sua chave, com valor e código do pedido). A confirmação é
  manual: confira no app do banco e clique em "Confirmar pagamento".
- Pedidos não pagos expiram depois do prazo configurado (padrão 60 min) e os
  números voltam a ficar disponíveis. Use 0 para nunca expirar.
- Faça backup de `data/db.json` de vez em quando.
