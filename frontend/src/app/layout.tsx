import type { Metadata } from "next"
import { Inter, Poppins } from "next/font/google"
import "./globals.css"

import { siteConfig } from "@/config/site"
import { Providers } from "@/components/providers"

// Headings use Inter, body text uses Poppins.
const fontHeading = Inter({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
})

const fontSans = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontHeading.variable} ${fontSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
