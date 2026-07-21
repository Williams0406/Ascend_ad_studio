import './globals.css';

export const metadata = {
  title: 'Ascend — Creative Intelligence',
  description: 'Dirección creativa y contenido publicitario impulsado por inteligencia artificial.',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }) {
  return <html lang="es"><body>{children}</body></html>;
}
