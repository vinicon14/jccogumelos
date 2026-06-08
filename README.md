# JC Cogumelos

E-commerce navegável para cogumelos gourmet, com catálogo, carrinho,
assinaturas, painel do cliente, painel administrativo, PWA instalável
e assistente virtual Josaninha.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- React Router
- Supabase preparado com fallback local
- PWA com manifest e service worker

## Rodar localmente

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env.local` se quiser conectar o cliente Supabase.
Sem variáveis configuradas ou sem a tabela `app_state`, a loja usa dados locais
e localStorage como fallback.

## Supabase

O projeto está preparado para:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_ANON_KEY` como compatibilidade

O schema inicial está em `supabase/schema.sql`.

Para o MVP sincronizar cadastros, produtos, posts, pedidos, assinaturas,
cupons, notificações e configurações entre PC e celular, aplique também
`supabase/mvp-sync.sql` no SQL Editor do Supabase. Essa tabela cria dois
registros de estado remoto:

- `store`: dados editáveis da loja.
- `customers`: cadastros de clientes usados pelo login MVP.

## Contatos

Configure os canais públicos sem editar código:

- `VITE_INSTAGRAM_URL`
- `VITE_WHATSAPP_NUMBER`
- `VITE_CONTACT_EMAIL`

Se `VITE_WHATSAPP_NUMBER` estiver vazio, a interface usa o Instagram como canal
principal e não exibe número falso.

Os botões de WhatsApp do site abrem uma mensagem com o código `SITE-JC`. Use
esse código no atendimento automático para responder somente contatos que vieram
pelo botão do site.

## Blog Josaninha e Instagram

O Blog Josaninha aceita posts com várias mídias, incluindo fotos e vídeos no
mesmo post. No painel administrativo, é possível fazer upload de vários arquivos,
adicionar mídias por URL ou importar os últimos 15 posts do Instagram.

Para importar do Instagram, configure:

- `INSTAGRAM_ACCESS_TOKEN`: token privado da Instagram Graph API.
- `INSTAGRAM_USER_ID`: opcional; ID da conta profissional/Business no Meta.

Também é possível colar o token Instagram pelo painel admin. O valor é enviado
para a Vercel como `INSTAGRAM_ACCESS_TOKEN`, desde que `VERCEL_API_TOKEN` esteja
configurado.

## Clientes e endereços

O cadastro coleta telefone, CEP, rua, bairro, cidade e UF. O formulário tenta
preencher o endereço pelo CEP e mantém edição manual como fallback. Com
`supabase/mvp-sync.sql` aplicado, os clientes sincronizam pelo Supabase e podem
entrar no PC ou celular. Sem a tabela remota, o app mantém fallback local. O
painel administrativo lista esses cadastros com busca por nome, e-mail,
telefone ou CEP.

## Pedidos e assinaturas

Pedidos criados no checkout ficam visíveis para o cliente em Minha conta, com
linha de acompanhamento, endereço e prazo do pagamento. Se um pedido permanecer
em `aguardando_pagamento` por mais de 5 minutos, o MVP cancela automaticamente
ao carregar ou manter a loja aberta.

No painel administrativo, a gestão de pedidos mostra apenas pedidos ativos:
`aguardando_pagamento`, `pago` e `em_separacao`. Quando o status passa para
`enviado`, `entregue` ou `cancelado`, o pedido sai da fila de gestão, mas
continua no acompanhamento do cliente.

As assinaturas criadas pelo cliente entram como `aguardando_pagamento` e geram
um pedido de cobrança. O plano só vira `ativa` quando o pedido relacionado é
marcado como `pago`; se esse pedido expirar ou for cancelado, a assinatura vira
`cancelada`.

No painel administrativo, assinaturas canceladas saem da gestão operacional. O
cliente ainda consegue ver o histórico da própria assinatura em Minha conta.

## Encomendas atacado

Clientes com conta `Atacado` podem entrar na fila de encomenda direto no card do
produto. A loja gera uma senha sequencial, mostra a posição na fila daquele
produto e salva a encomenda no estado sincronizado do Supabase.

Na página Minha conta, o atacadista acompanha status, quantidade, valor e pode
cancelar uma encomenda ativa. No painel administrativo, a fila operacional mostra
apenas encomendas `Na fila`, `Em produção` ou `Disponível`; ao marcar como
`Atendida` ou `Cancelada`, ela sai da fila ativa.

## Login administrativo

O admin entra pela mesma tela de login, mas a senha é validada em
`/api/admin-login` com hash PBKDF2 guardado em variável privada:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `VITE_ADMIN_EMAIL` apenas para o frontend reconhecer o e-mail administrativo

Não coloque senha real em variáveis `VITE_`.

## Secrets pelo painel admin

O painel administrativo pode salvar secrets privados na Vercel por meio de
`/api/admin-secret`. Para ativar esse fluxo, configure uma vez na Vercel:

- `VERCEL_API_TOKEN`: token privado com permissão para editar variáveis do projeto.
- `VERCEL_TARGET_PROJECT_ID`: `jccogumelos` ou o `prj_...` do projeto.
- `VERCEL_TARGET_TEAM_ID`: obrigatório se o token precisar operar dentro do time.
- `VERCEL_REDEPLOY_HOOK_URL`: opcional; se existir, o painel dispara um novo deploy depois de salvar.

Secrets aceitos pelo painel:

- `MERCADO_PAGO_ACCESS_TOKEN`
- `AI_API_KEY`
- `AI_PROVIDER_NAME`
- `AI_API_ENDPOINT`
- `AI_MODEL`
- `AI_API_MODE`
- `OPENAI_API_KEY`
- `INSTAGRAM_ACCESS_TOKEN`

Esses valores não são salvos em localStorage e não usam prefixo `VITE_`.

## Josaninha com API de IA

A assistente usa a função `api/josaninha.js` no servidor. O painel admin permite
configurar qualquer provedor compatível com API de IA via:

- `AI_API_KEY`: chave privada do provedor.
- `AI_API_ENDPOINT`: endpoint completo, como `https://api.openai.com/v1/responses`.
- `AI_MODEL`: modelo usado pela Josaninha.
- `AI_API_MODE`: `responses`, `chat_completions`, `gemini` ou `generic_json`.
- `AI_PROVIDER_NAME`: nome exibido/administrativo do provedor.

O painel tem presets para OpenAI e Gemini. O preset Gemini usa:

- `AI_PROVIDER_NAME=Gemini`
- `AI_API_ENDPOINT=https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- `AI_API_MODE=gemini`
- `AI_MODEL=gemini-2.5-flash`

No modo Gemini, a função envia a chave pelo header `x-goog-api-key`, como exige
a API oficial do Google AI Studio, e troca `{model}` pelo valor de `AI_MODEL`.

O endpoint mantém compatibilidade com `OPENAI_API_KEY` e `OPENAI_MODEL`, mas usa
`AI_API_KEY` e `AI_MODEL` primeiro. Essas chaves nunca devem usar prefixo
`VITE_`, porque não podem ser enviadas para o navegador.

Sem chave configurada, ou se o provedor retornar erro de cota/autenticação, o
chat mostra o diagnóstico real no widget em vez de simular resposta automática.

## Pix Mercado Pago

O checkout gera Pix pelo endpoint server-side `/api/mercado-pago-pix`, usando o
modelo Checkout Transparente do Mercado Pago. Configure na Vercel:

- `MERCADO_PAGO_ACCESS_TOKEN`: token privado da aplicação Mercado Pago.
- `MERCADO_PAGO_API_MODE=payments`: usa `/v1/payments` por padrão.
- `MERCADO_PAGO_WEBHOOK_URL=https://jccogumelos.vercel.app/api/mercado-pago-webhook`
- `MERCADO_PAGO_WEBHOOK_SECRET`: chave secreta do webhook, opcional mas recomendada.

O Access Token não deve ser salvo no painel administrativo nem em variável
`VITE_`. O campo do painel envia o valor para `MERCADO_PAGO_ACCESS_TOKEN` na
Vercel e limpa o campo após salvar.

## Scripts

```bash
npm run build
npm run lint
npm run preview
```
