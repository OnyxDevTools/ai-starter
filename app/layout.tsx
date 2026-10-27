import project from "@/project.json";
// filename: app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: `${project.name} · Onyx`,
  description: "A private workspace for ideas, powered by Onyx agents.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('ai-studio-theme')==='light'){document.documentElement.classList.remove('dark');document.documentElement.dataset.theme='light'}}catch{}`,
          }}
        />
        <a
          href="#main"
          className="bg-card sr-only p-3 focus:not-sr-only focus:fixed focus:z-50"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
