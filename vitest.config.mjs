import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { configDefaults, defineConfig } from "vitest/config";

// .env.local lido com o parser do próprio Node.js (o mesmo dos scripts npm run migrar/verificar-ligacao).
// Só é entregue aos testes de integração: os unitários não podem depender do computador de quem os corre.
const envLocal = existsSync(".env.local") ? parseEnv(readFileSync(".env.local", "utf8")) : {};

const INTEGRACAO = "src/**/*.integracao.test.js";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unitarios",
          include: ["src/**/*.test.js"],
          exclude: [...configDefaults.exclude, INTEGRACAO],
        },
      },
      {
        test: {
          name: "integracao",
          include: [INTEGRACAO],
          env: envLocal,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
