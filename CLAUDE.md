@AGENTS.md

# Regras do projeto

## Stack e infraestrutura
- Next.js (App Router), JavaScript, Tailwind CSS.
- Deploy: Vercel. Base de dados: PostgreSQL no Aiven.

## Arquitetura em 4 camadas
- A app está organizada em 4 camadas: apresentação, aplicacional, dominio e persistencia.
- dominio, aplicacional e persistencia têm pasta própria em `src/`: `src/dominio/`, `src/aplicacional/`, `src/persistencia/`.
- A apresentação são as páginas e componentes Next.js (`src/app/` e `src/components/`); não existe pasta `src/apresentacao/`.
- O domínio não depende de nenhuma outra camada.
- A apresentação só comunica com a camada aplicacional. Exceção: um único ficheiro de composição (ex.: `src/app/actions.js`) cria o repositório e entrega-o aos casos de uso; é o único sítio da apresentação que importa de `src/persistencia/`.
- As chamadas à base de dados só existem na camada persistencia.

## Segurança
- As variáveis de ambiente sensíveis e as respetivas credenciais de acesso (`DATABASE_URL`, etc.) nunca aparecem em código do lado do cliente.

## Testes e qualidade
- A lógica de domínio, aplicacional e persistência só está concluída com testes validados. Não alterar os testes só para os fazer passar.
- Antes de dar uma tarefa por concluída, correr `npm run test`, `npm run lint` e `npm run build`.

## Forma de trabalhar
- Antes de instalar uma dependência, indicar qual é e para que serve.
- Antes de implementar, apresentar sempre um plano curto.
- No fim de cada tarefa, explicar o que foi feito em linguagem simples.
