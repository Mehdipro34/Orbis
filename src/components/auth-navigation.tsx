"use client";

import Link from "next/link";
import {LogOut,UserRound} from "lucide-react";
import {useEffect,useState} from "react";
import {
  loadSavedIdentity,saveIdentity,signGuestChallenge,
  type IdentityProfile
} from "@/lib/orbis/identity-client";

type SessionUser={username:string;name?:string};
const SIGNED_OUT_KEY="orbis_explicit_logout";

function isSessionUser(value:unknown):value is SessionUser {
  return typeof value==="object"&&value!==null&&"username" in value&&
    typeof (value as {username?:unknown}).username==="string";
}
async function postJson(path:string,body:unknown):Promise<Record<string,unknown>> {
  const response=await fetch(path,{method:"POST",cache:"no-store",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify(body)});
  const payload:unknown=await response.json().catch(()=>({}));
  if(!response.ok||typeof payload!=="object"||payload===null) throw new Error("Session restore failed");
  return payload as Record<string,unknown>;
}
function broadcastAuth(signedIn:boolean) {
  window.dispatchEvent(new CustomEvent("orbis-auth-changed",{detail:{signedIn}}));
}

async function restoreSession():Promise<SessionUser|null> {
  const current=await fetch("/api/auth/me",{cache:"no-store"});
  if(current.ok) {
    const payload:unknown=await current.json().catch(()=>null);
    if(typeof payload==="object"&&payload!==null&&"user" in payload&&isSessionUser(payload.user)) {
      window.localStorage.removeItem(SIGNED_OUT_KEY);
      return payload.user;
    }
    return null;
  }
  if(current.status!==401||window.localStorage.getItem(SIGNED_OUT_KEY)==="1") return null;
  const saved=await loadSavedIdentity();
  if(!saved) return null;

  const challenge=await postJson("/api/auth/challenge",{deviceId:saved.deviceId});
  if(typeof challenge.challenge!=="string"||typeof challenge.challengeId!=="string") return null;
  const signature=await signGuestChallenge(saved.privateKey,challenge.challenge);
  const verified=await postJson("/api/auth/verify",{
    deviceId:saved.deviceId,challengeId:challenge.challengeId,signature
  });
  if(typeof verified.user!=="object"||verified.user===null||!("id" in verified.user)||
    !isSessionUser(verified.user)) return null;

  const profile=verified.user as IdentityProfile;
  await saveIdentity({...saved,profile});
  window.localStorage.removeItem(SIGNED_OUT_KEY);
  return verified.user;
}

export function AuthNavigation() {
  const [user,setUser]=useState<SessionUser|null>(null);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let active=true;
    void restoreSession().catch(()=>null).then(value=>{
      if(!active)return;
      setUser(value);setReady(true);
      broadcastAuth(Boolean(value));
    });
    return ()=>{active=false;};
  },[]);

  async function logout() {
    if(busy)return;
    setBusy(true);
    try {
      const response=await fetch("/api/auth/logout",{method:"POST",cache:"no-store"});
      if(!response.ok) throw new Error("Не удалось завершить сессию.");
      // Keep the device key: logout clears only the session, not account recovery material.
      window.localStorage.setItem(SIGNED_OUT_KEY,"1");
      setUser(null);
      broadcastAuth(false);
    } catch {
      // Keep the signed-in UI if the server did not confirm logout.
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
    <Link href={"/u/"+encodeURIComponent(user.username)} className="auth-nav-username" title="Открыть мой профиль"><UserRound size={15}/>@{user.username}</Link>
    <button type="button" className="icon-button auth-logout" disabled={busy}
      onClick={()=>void logout()} aria-label="Выйти" title="Выйти">
      <LogOut size={16}/>
    </button>
  </div>;
}
