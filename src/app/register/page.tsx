import type {Metadata} from "next";
import Link from "next/link";
import {AuthPanel} from "@/components/auth-panel";

export const metadata:Metadata={
  title:"Регистрация",
  description:"Создай защищённый профиль ORBIS."
};

export default function RegisterPage() {
  return <main className="auth-page">
    <div className="auth-page-brand"><Link href="/">ORBIS</Link><span>YOUR WORLD. YOUR VOICE.</span></div>
    <AuthPanel initialMode="register"/>
  </main>;
}
