import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"Memorable — Environments",description:"Connect your agent. Inspect its memory. Compare real runs.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
