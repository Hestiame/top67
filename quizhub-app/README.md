# quizHub — multiplayer local (estilo Kahoot)

Plataforma de quiz onde **cada pessoa joga pelo próprio celular**, entrando por um **PIN** (ou QR code) no mesmo Wi-Fi. Sem banco de dados, sem login. Os 14 tipos de pergunta do Kahoot funcionando.

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
