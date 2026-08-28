import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Расписание университета",
  description: "Расписание занятий в Telegram Mini App",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
