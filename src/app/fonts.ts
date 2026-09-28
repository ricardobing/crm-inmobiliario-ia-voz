import { Inter, JetBrains_Mono, Outfit } from "next/font/google";

// Tipografías de kontaktuai.com. Las variables CSS se consumen en globals.css (@theme).
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ["500", "600"], display: "swap" });
export const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", weight: ["400", "500"], display: "swap" });
