import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DeployWidget from "../components/DeployWidget";
import Navegacao from "../components/Navegacao";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Reserva de Salas",
  description: "Consultar e reservar salas",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt-PT"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Navegacao />
        {children}
        {process.env.NODE_ENV === "development" && <DeployWidget />}
      </body>
    </html>
  );
}
