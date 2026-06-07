# JC Cogumelos

E-commerce navegável para cogumelos gourmet, com catálogo, carrinho,
assinaturas, painel do cliente, painel administrativo, PWA instalável
e assistente virtual Jozaninha.

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

## Login administrativo

O admin entra pela mesma tela de login, mas a senha é validada em
`/api/admin-login` com hash PBKDF2 guardado em variável privada:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `VITE_ADMIN_EMAIL` apenas para o frontend reconhecer o e-mail administrativo

Não coloque senha real em variáveis `VITE_`.

## Jozaninha com GPT

A assistente usa a função `api/jozaninha.js` para chamar a OpenAI Responses API
no servidor. Configure `OPENAI_API_KEY` no ambiente de deploy e, se quiser
trocar o modelo, ajuste `OPENAI_MODEL`. A chave da OpenAI não deve usar prefixo
`VITE_`, porque ela nunca deve ser enviada para o navegador.

Sem `OPENAI_API_KEY`, o chat continua respondendo com fallback local para não
quebrar a experiência.

## Scripts

```bash
npm run build
npm run lint
npm run preview
```
