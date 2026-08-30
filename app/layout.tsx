import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Расписание университета",
  description: "Веб-приложение с расписанием занятий",
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
