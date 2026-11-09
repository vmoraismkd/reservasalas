@AGENTS.md

# Regras do projeto

## Stack e infraestrutura
- Next.js (App Router), JavaScript, Tailwind CSS.
- Deploy: Vercel. Base de dados: PostgreSQL no Aiven, acedido com o pacote `pg`.

## Persistência
- A app usa o repositório PostgreSQL (`src/persistencia/RepositorioPostgres.js`), criado no ficheiro de composição `src/app/composicao.js`. O repositório em memória (`RepositorioMemoria.js`) fica só para testes: os testes de contrato e os testes da Server Action.
- Com `cacheComponents` ligado, as páginas que leem da base de dados chamam `await connection()` antes da leitura e ficam dentro de `<Suspense>`, para o `next build` nunca ligar à base de dados.
- Os dois repositórios cumprem a interface de `src/aplicacional/repositorio.js` e passam nos mesmos testes de contrato (`src/persistencia/__testes__/contratoRepositorio.js`).
- Os ids são UUID gerados pela base de dados; no domínio são texto. Uma reserva nova não tem id até ser guardada.
- As consultas usam sempre parâmetros (`$1`, `$2`, ...); nunca se cola texto do utilizador no SQL.
- O esquema (tabelas, salas de exemplo, permissões) é criado por `npm run migrar` (`src/persistencia/migracao.js`), que pode correr várias vezes.

## Ligação segura à base de dados
- Toda a ligação passa por `src/persistencia/ligacao.js`: TLS sempre, com o certificado do Aiven (`DATABASE_CA_CERT`) verificado. Nunca desligar a verificação (`rejectUnauthorized: true`); os parâmetros `ssl*`, `host` e `hostaddr` do endereço são retirados.
- Com `DATABASE_PROXY` (proxy HTTP da rede da empresa) a ligação passa por um túnel `CONNECT`; o TLS continua a ser feito até ao Aiven por cima do túnel.
- O endereço, o utilizador e a palavra-passe nunca aparecem em mensagens nem em registos.
- `npm run verificar-ligacao` confirma a cifra, o certificado e as permissões do utilizador da app, numa transação sempre anulada.

## Datas e horas
- No domínio e na base de dados as datas são instantes em UTC (`Date` no JavaScript, `timestamptz` no PostgreSQL).
- O utilizador escreve horas de Lisboa (`Europe/Lisbon`); a apresentação converte-as explicitamente para UTC (`src/app/horaLisboa.js`) antes de chamar os casos de uso.

## Arquitetura em 4 camadas
- A app está organizada em 4 camadas: apresentação, aplicacional, dominio e persistencia.
- dominio, aplicacional e persistencia têm pasta própria em `src/`: `src/dominio/`, `src/aplicacional/`, `src/persistencia/`.
- A apresentação são as páginas e componentes Next.js (`src/app/` e `src/components/`); não existe pasta `src/apresentacao/`.
- O domínio não depende de nenhuma outra camada.
- A apresentação só comunica com a camada aplicacional. Exceção: um único ficheiro de composição, `src/app/composicao.js`, cria o repositório e entrega-o aos casos de uso; é o único sítio da apresentação que importa de `src/persistencia/`. Só código do servidor o importa (páginas sem `"use client"` e `src/app/actions.js`).
- As chamadas à base de dados só existem na camada persistencia.

## Segurança
- As variáveis de ambiente sensíveis e as respetivas credenciais de acesso (`DATABASE_URL`, etc.) nunca aparecem em código do lado do cliente.
- A app liga-se com `DATABASE_URL`, que deve usar o utilizador `app_reservas` (só pode ler, inserir, alterar e apagar dados nas tabelas `salas` e `reservas`).
- `DATABASE_ADMIN_URL` existe só no computador do programador, no `.env.local`, para `npm run migrar`. Nunca vai para a Vercel nem é usado pelo código da app.

## Testes e qualidade
- A lógica de domínio, aplicacional e persistência só está concluída com testes validados. Não alterar os testes só para os fazer passar.
- Antes de dar uma tarefa por concluída, correr `npm run test`, `npm run lint` e `npm run build`.
- `npm run test` corre só os testes unitários (sem base de dados nem `.env.local`). `npm run test:postgres` corre os testes de contrato contra o PostgreSQL real, com o `.env.local`; os dados de teste são sempre apagados no fim.

## Forma de trabalhar
- Antes de instalar uma dependência, indicar qual é e para que serve.
- Antes de implementar, apresentar sempre um plano curto.
- No fim de cada tarefa, explicar o que foi feito em linguagem simples.
