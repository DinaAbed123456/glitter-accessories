import type { Metadata } from "next";
import "../src/index.css";

export const metadata: Metadata = {
  title: "Glitter Accessories | إكسسوارات تليق بكِ",
  description: "اكتشفي تشكيلتنا من الإكسسوارات المختارة بعناية في فلسطين.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
