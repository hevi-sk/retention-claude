import './globals.css'

export const metadata = {
  title: 'StretchFit Retention Dashboard',
  description: 'Multi-shop retention & cohort analytics',
}

export default function RootLayout({ children }) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  )
}
