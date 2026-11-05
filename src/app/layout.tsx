import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";

export const metadata: Metadata = {
  title: "myFitnea — дневник питания",
  description: "Калькулятор калорий и дневник питания",
  applicationName: "myFitnea",
  appleWebApp: { capable: true, title: "myFitnea" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body><AntdRegistry>{children}</AntdRegistry></body>
    </html>
  );
}
