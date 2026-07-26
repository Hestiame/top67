# quizHub — multiplayer online (estilo Kahoot)

Plataforma de quiz onde **cada pessoa joga pelo próprio celular**, entrando por um **PIN** (ou QR code) no mesmo Wi-Fi. Sem banco de dados, sem login. Os 14 tipos de pergunta do Kahoot funcionando.


## 🆕 Novidades desta versão

- **Personagens em vetor** (estilo chapado, tipo Kahoot). 12 personagens + chapéus e óculos
  desenhados no mesmo sistema, então o acessório encaixa perfeito em qualquer um.
  O app ficou ~5x mais leve (saíram as fotos).
- **Reconexão**: se o celular cair do Wi-Fi ou o navegador fechar, o jogador volta
  para o jogo **com os pontos, o nome e o personagem intactos**.
- **Pódio novo**: coroa, medalhas, animação de subida, brilho no 1º lugar e
  os demais colocados em etiquetas embaixo.
- **Banco de dados Supabase**: os quizzes não se perdem mais em reinício.
  Na primeira vez, o quiz de demonstração é criado sozinho.
- **IA mais confiável**: criatividade reduzida (0.15), instruções contra invenção,
  e **cada pergunta vem com a justificativa da resposta** para você conferir.
  ⚠️ Ainda assim, revise antes de usar em prova — nenhuma IA acerta 100%.


## 🛡️ Robustez (o que protege o sistema)

| O quê | Como funciona |
|---|---|
| **Senha do apresentador** | `HOST_PASSWORD` no `.env`. Sem ela, qualquer um com o link apresenta e apaga seus quizzes. **Configure!** |
| **Reconexão do apresentador** | Se seu navegador cair/atualizar, a sala continua viva e você volta pra onde estava. |
| **Reconexão do jogador** | O celular volta com nome, personagem e pontos. |
| **Cronômetro no servidor** | O tempo não depende do navegador — todo mundo tem o mesmo prazo e a rodada fecha sozinha. |
| **Faxina de salas** | Sala ociosa (3h) ou sem apresentador (20min) é encerrada, para não acumular lixo na memória. |
| **Limite na IA** | Máx. 6 gerações a cada 10 min por pessoa, para não queimar sua cota do Groq. |
| **Limites de tamanho** | Máx. 80 jogadores por sala (`MAX_PLAYERS`), 60 perguntas por quiz, 8 alternativas. |
| **Filtro de nomes** | Bloqueia palavrão e nome ofensivo na entrada. |
| **Nomes duplicados** | Dois "João" viram "João" e "João (2)". |
| **Expulsar jogador** | Passe o mouse no jogador no lobby e clique no ✕. |
| **Trancar sala** | Depois que todos entraram, tranque para ninguém mais entrar. |
| **Banco fora do ar** | O app continua funcionando com uma cópia local e mostra um aviso no topo. |
| **Página de erro** | Em vez de tela branca, uma página explicando o que houve. |

> ⚠️ **Configure a `HOST_PASSWORD`.** Sem ela, o `/host.html` fica aberto na internet:
> qualquer pessoa que descobrir o endereço pode editar e apagar todos os seus quizzes.

## Como rodar (no seu PC)

1. Tenha o **Node.js** instalado.
2. Abra o terminal nesta pasta e instale as dependências (só na 1ª vez):
   ```
   npm install
   ```
3. Inicie o servidor:
   ```
   npm start
   ```
4. O terminal vai mostrar dois endereços:
   - **Apresentador (este PC):** `http://localhost:3000/host.html`
   - **Jogadores (mesmo Wi-Fi):** `http://SEU-IP:3000`

## Como jogar

- No **seu PC**, abra `http://localhost:3000/host.html` → escolha um quiz → **Apresentar**.
  Vai aparecer um **PIN** e um **QR code** na tela.
- Nos **celulares** (mesma rede Wi-Fi), abra `http://SEU-IP:3000` (ou aponte a câmera no QR).
  Cada jogador digita o **PIN**, o **nome** e escolhe um **personagem**.
- Quando todos entrarem, clique em **Começar** no PC.

## ☁️ Deixar online 24/7 (sem seu PC ligado)

O quizHub precisa de um servidor Node sempre ligado, então a hospedagem é num
serviço de nuvem (não no GitHub Pages, que só serve site estático). O caminho
mais fácil é o **Render** (tem nível gratuito, sem cartão):

1. Suba o projeto pro **GitHub** (veja acima).
2. Em **render.com**, crie um **New → Web Service** e conecte o repositório.
   - Build Command: `npm install`
   - Start Command: `npm start`
   - (O `render.yaml` incluído já sugere isso automaticamente.)
3. Em **Environment**, adicione as variáveis:
   - `GROQ_API_KEY` = sua chave do Groq
   - `PUBLIC_URL` = a URL que o Render te der (ex.: `https://quizhub.onrender.com`)
4. Deploy. Pronto — o apresentador abre em `https://SEU-APP.onrender.com/host.html`
   e os jogadores entram em `https://SEU-APP.onrender.com`.

### ⚠️ Limitações do plano gratuito (importante)

- **Ele "dorme" após 15 min sem ninguém usando** e leva ~30–60s pra acordar no
  próximo acesso. Para evitar isso:
  - defina `PUBLIC_URL` (o app se auto-pinga e não dorme), ou
  - use um monitor externo grátis (ex.: UptimeRobot) batendo em `/healthz` a cada 5 min.
  - ou assine o plano pago (~US$7/mês) que nunca dorme.
  - (Um serviço 24/7 cabe nas 750 horas grátis/mês do Render.)
- **O disco é temporário:** quizzes criados/gerados *enquanto está no ar* podem
  ser **perdidos quando o serviço reinicia ou dorme**. O quiz de demonstração e
  qualquer quiz que você **comitar no `quizzes.json`** sobrevivem. Para salvar
  quizzes novos de forma permanente, o próximo passo é ligar um banco (ex.: **Supabase**).

## ✨ Gerar quiz com IA (a partir de um tema)

Na tela do apresentador tem o botão **"✨ Criar com IA"**: você digita um tema
(ex: *"crie um kahoot sobre a Alemanha nazista"*), escolhe a quantidade de perguntas
e a dificuldade, e a IA monta o quiz com **tipos variados** (múltipla escolha, V/F,
resposta curta, quebra-cabeça e controle deslizante). Você **revisa em detalhe** e só
então salva.

### Configurar a IA (Groq — grátis)

1. Crie uma conta e gere uma chave gratuita em **https://console.groq.com/keys**
2. Copie o arquivo `.env.example` para `.env`:
   ```
   cp .env.example .env
   ```
3. Abra o `.env` e cole sua chave no campo `GROQ_API_KEY`.
4. Reinicie o servidor (`npm start`).

> A chave fica **só no servidor** (no `.env`), nunca no navegador.

### Trocar de IA (opcional)

A IA é **plugável**. No `.env`, mude `AI_PROVIDER` para `groq`, `gemini`, `openai`,
`claude` ou `ollama` (local), e coloque a chave correspondente. O resto do app
continua igual.

## O que já tem

- Multiplayer real por PIN + entrada por QR code.
- Entrar com nome e personagem (estilo Kahoot).
- Os 14 tipos: quiz, V/F, resposta curta, quebra-cabeça, quiz+áudio, controle deslizante,
  largar marcador, enquete, nuvem de palavras, pergunta aberta, brainstorm, escala, marcador de opinião, slide.
- Pontuação por velocidade, **bônus de sequência** (acertos seguidos), ranking ao vivo e pódio.
- Sons, confete e identidade visual quizHub.
- **Importar/Exportar** quiz em arquivo `.json` (botões na tela do apresentador).
- **Gerar quiz com IA** a partir de um tema (Groq grátis por padrão, trocável).
- **Personagens com acessórios** (chapéus e óculos): o jogador monta o boneco na entrada e ele aparece no lobby, ranking e pódio.
- **Editor de quiz completo** dentro do app: criar do zero, editar qualquer quiz (gerado por IA ou não) e apagar. Botões ✏️ e 🗑 em cada quiz.

## Estrutura

```
server.js          → servidor (Express + Socket.io), regras do jogo
quizzes.json       → seus quizzes (salvos em arquivo, sem banco)
public/
  index.html       → app do JOGADOR (celular)
  host.html        → app do APRESENTADOR (telão)
  css/style.css    → estilo
  js/shared.js     → tipos, formas, mapa, sons
  js/player.js     → lógica do jogador
  js/host.js       → lógica do apresentador
```

## Próximos passos (a combinar)

- Times, mais power-ups e temas de cor para trocar.
- Editor de quiz completo dentro do app (criar/editar sem mexer no arquivo).
- Reconexão se um celular cair do Wi-Fi.
- Mais categorias de acessórios (pescoço, cabeça, costas, efeitos...). Obs: acessórios escuros precisam ser fornecidos como PNG com fundo transparente, pois não dá pra recortá-los do fundo preto.
