"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ligacoes = [
  { href: "/", texto: "Salas" },
  { href: "/minhas-reservas", texto: "As minhas reservas" },
];

export default function Navegacao() {
  const caminho = usePathname();

  return (
    <nav aria-label="Principal" className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <ul className="mx-auto flex w-full max-w-3xl gap-1 px-4 sm:px-6">
        {ligacoes.map(({ href, texto }) => {
          const ativa = caminho === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativa ? "page" : undefined}
                className={`flex min-h-12 items-center border-b-2 px-3 text-base font-medium transition-colors ${
                  ativa
                    ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                    : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                {texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
