import './globals.css';

export const metadata = {
  title: 'Stonegy Pro Tracker - Hub de Atualizações & Auth API',
  description: 'Portal oficial de atualizações, ranking global e autenticação em nuvem para a extensão Stonegy Pro Tracker.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
