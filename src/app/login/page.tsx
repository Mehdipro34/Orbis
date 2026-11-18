import type {Metadata} from "next";
import Link from "next/link";
import {AuthPanel} from "@/components/auth-panel";

export const metadata:Metadata={
  title:"Вход и восстановление",
  description:"Вход в ORBIS и восстановление доступа к существующему аккаунту."
};

export default function LoginPage() {
  return <main className="auth-page">
    <div className="auth-page-brand"><Link href="/">ORBIS</Link><span>YOUR WORLD. YOUR VOICE.</span></div>
    <AuthPanel initialMode="restore"/>
  </main>;
}
