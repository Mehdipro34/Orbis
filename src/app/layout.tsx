import type {Metadata,Viewport} from "next";
import "./globals.css";
import {Analytics} from "@vercel/analytics/next";
import {SocialShell} from "@/components/social-shell";

export const metadata:Metadata = {
  title:{default:"ORBIS — Твои идеи заслуживают аудитории",template:"%s · ORBIS"},
  description:"Международная социальная сеть для идей, публикаций и общения.",
  applicationName:"ORBIS",
  manifest:"/manifest.webmanifest",
  icons:{icon:"/orbis-icon.svg",apple:"/orbis-icon.svg"},
  appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"ORBIS"}
};

export const viewport:Viewport = {
  themeColor:"#080b12",width:"device-width",initialScale:1,viewportFit:"cover"
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ru" data-theme="dark"><body><SocialShell>{children}</SocialShell><Analytics/></body></html>;
}
