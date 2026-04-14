import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Providers } from "./providers"

import "./globals.css"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Vidpod",
  description: "Vidpod",
}

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en" className={inter.variable}>
      <body><Providers>{children}</Providers></body>
    </html>
  )
}

export default RootLayout
