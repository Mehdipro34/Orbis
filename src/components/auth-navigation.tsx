"use client";

import Link from "next/link";
import {LogOut,UserRound} from "lucide-react";
import {useEffect,useState} from "react";
import {clearSavedIdentity} from "@/lib/orbis/identity-client";

type SessionUser={username:string;name?:string};

export function AuthNavigation() {
  const [user,setUser]=useState<SessionUser|null>(null);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let active=true;
    void fetch("/api/auth/me",{cache:"no-store"})
      .then(async response=>{
        if(!response.ok) return null;
        const payload:unknown=await response.json();
        if(typeof payload!=="object" || payload===null || !("user" in payload) ||
          typeof payload.user!=="object" || payload.user===null || !("username" in payload.user) ||
          typeof payload.user.username!=="string") return null;
        return payload.user as SessionUser;
      })
      .catch(()=>null)
      .then(value=>{if(active){setUser(value);setReady(true);}});
    return ()=>{active=false;};
  },[]);

  async function logout() {
    setBusy(true);
    try {
      const response=await fetch("/api/auth/logout",{method:"POST",cache:"no-store"});
      if(!response.ok) throw new Error("Не удалось завершить сессию.");
      await clearSavedIdentity();
      setUser(null);
    } catch {
      // Keep the signed-in state when the logout request has failed.
    } finally {
      setBusy(false);
    }
  }

  if(!ready) return <div className="auth-nav-placeholder" aria-hidden="true"/>;
  if(!user) return <div className="auth-nav">
    <Link href="/login" className="auth-nav-link">Войти</Link>
    <Link href="/register" className="primary-button auth-nav-register">Регистрация</Link>
  </div>;

  return <div className="auth-nav auth-nav-user">
    <span className="auth-nav-username"><UserRound size={15}/>@{user.username}</span>
    <button type="button" className="icon-button auth-logout" disabled={busy}
      onClick={()=>void logout()} aria-label="Выйти" title="Выйти">
      <LogOut size={16}/>
    </button>
  </div>;
}
