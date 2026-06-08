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
Sem variáveis configuradas, a loja usa dados locais e localStorage.

## Supabase

O projeto está preparado para:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_ANON_KEY` como compatibilidade

O schema inicial está em `supabase/schema.sql`.

## Contatos

Configure os canais públicos sem editar código:

- `VITE_INSTAGRAM_URL`
- `VITE_WHATSAPP_NUMBER`
- `VITE_CONTACT_EMAIL`

Se `VITE_WHATSAPP_NUMBER` estiver vazio, a interface usa o Instagram como canal
principal e não exibe número falso.

## Clientes e endereços

O cadastro coleta telefone, CEP, rua, bairro, cidade e UF. O formulário tenta
preencher o endereço pelo CEP e mantém edição manual como fallback. No MVP, os
clientes ficam em localStorage e o painel administrativo lista esses cadastros
com busca por nome, e-mail, telefone ou CEP.

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
- `OPENAI_API_KEY`

Esses valores não são salvos em localStorage e não usam prefixo `VITE_`.

## Josaninha com GPT

A assistente usa a função `api/josaninha.js` para chamar a OpenAI Responses API
no servidor. Configure `OPENAI_API_KEY` no ambiente de deploy e, se quiser
trocar o modelo, ajuste `OPENAI_MODEL`. A chave da OpenAI não deve usar prefixo
`VITE_`, porque ela nunca deve ser enviada para o navegador.

Também é possível colar a chave GPT no painel admin em Configurações. O painel
salva em `OPENAI_API_KEY` na Vercel usando o endpoint protegido acima.

Sem `OPENAI_API_KEY`, o chat não simula respostas automáticas: ele avisa que a
conexão GPT precisa ser configurada no servidor.

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
