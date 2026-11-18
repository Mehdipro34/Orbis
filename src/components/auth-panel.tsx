"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,ArrowRight,Download,KeyRound,ShieldCheck} from "lucide-react";
import {
  createDeviceIdentity,createRecoveryBundle,decryptRecoveryBundle,
  downloadRecoveryBundle,importPrivateKey,isRecoveryBundle,
  loadSavedIdentity,saveIdentity,signGuestChallenge,
  type IdentityProfile,type RecoveryBundle
} from "@/lib/orbis/identity-client";

type Mode="register"|"restore";
type View="checking"|"form"|"backup"|"signed-in";

async function requestJson(path:string,method:"GET"|"POST",body?:unknown):Promise<Record<string,unknown>> {
  const response=await fetch(path,{
    method,cache:"no-store",
    headers:body===undefined?{"Accept":"application/json"}:{"Accept":"application/json","Content-Type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const payload:unknown=await response.json().catch(()=>({}));
  if(!response.ok) {
    const row=payload && typeof payload==="object"?payload as Record<string,unknown>:{};
    const message=typeof row.error==="string"?row.error:"Не удалось выполнить запрос.";
    throw new Error(message);
  }
  if(typeof payload!=="object" || payload===null) throw new Error("Сервер вернул некорректный ответ.");
  return payload as Record<string,unknown>;
}

async function completeKeyLogin(deviceId:string,privateKey:CryptoKey):Promise<IdentityProfile> {
  const challenge=await requestJson("/api/auth/challenge","POST",{deviceId});
  if(typeof challenge.challenge!=="string" || typeof challenge.challengeId!=="string") {
    throw new Error("Сервер не выдал запрос подтверждения.");
  }
  const signature=await signGuestChallenge(privateKey,challenge.challenge);
  const verified=await requestJson("/api/auth/verify","POST",{
    deviceId,challengeId:challenge.challengeId,signature
  });
  if(typeof verified.user!=="object" || verified.user===null || !("id" in verified.user)) {
    throw new Error("Сервер не вернул профиль аккаунта.");
  }
  return verified.user as IdentityProfile;
}

export function AuthPanel({initialMode="register"}:{initialMode?:Mode}) {
  const router=useRouter();
  const [mode,setMode]=useState<Mode>(initialMode);
  const [view,setView]=useState<View>("checking");
  const [username,setUsername]=useState("");
  const [bio,setBio]=useState("");
  const [website,setWebsite]=useState("");
  const [recoveryFile,setRecoveryFile]=useState<File|null>(null);
  const [recoveryCode,setRecoveryCode]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [user,setUser]=useState<IdentityProfile|null>(null);
  const [bundle,setBundle]=useState<RecoveryBundle|null>(null);
  const [secretCode,setSecretCode]=useState("");
  const [downloaded,setDownloaded]=useState(false);

  useEffect(()=>{
    let active=true;
    async function bootstrap() {
      try {
        const explicitlySignedOut=window.localStorage.getItem("orbis_explicit_logout")==="1";
        const response=await fetch("/api/auth/me",{cache:"no-store"});
        const payload:unknown=await response.json().catch(()=>({}));
        if(response.ok && payload && typeof payload==="object" && "user" in payload &&
          typeof payload.user==="object" && payload.user!==null) {
          const currentUser=payload.user as {username?:unknown};
          const destination=typeof currentUser.username==="string"
            ?"/u/"+encodeURIComponent(currentUser.username):"/";
          if(active) {window.localStorage.removeItem("orbis_explicit_logout");router.replace(destination);}
          return;
        }
        if(response.status!==401) {
          if(active) {setMessage("Не удалось проверить сессию. Проверь подключение.");setView("form");}
          return;
        }
        const saved=explicitlySignedOut?null:await loadSavedIdentity();
        if(saved) {
          const profile=await completeKeyLogin(saved.deviceId,saved.privateKey);
          await saveIdentity({...saved,profile});
          if(active) {window.localStorage.removeItem("orbis_explicit_logout");router.replace("/u/"+encodeURIComponent(profile.username));}
          return;
        }
      } catch {
        if(active) setMessage("Автоматический вход не выполнен. Восстанови доступ с помощью файла и кода.");
      }
      if(active) setView("form");
    }
    void bootstrap();
    return ()=>{active=false;};
  },[router]);

  async function handleRegister(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if(!crypto?.subtle || !window.isSecureContext) {
        throw new Error("Безопасная регистрация доступна только в браузере с WebCrypto и HTTPS.");
      }
      const cleanUsername=username.trim().toLowerCase();
      if(!/^[a-z0-9_.]{3,24}$/.test(cleanUsername)) {
        throw new Error("Никнейм: 3–24 символа, латиница, цифры, точка или _.");
      }
      const identity=await createDeviceIdentity();
      const created=await requestJson("/api/auth/register","POST",{
        deviceId:identity.deviceId,username:cleanUsername,bio:bio.trim(),
        publicKey:identity.publicKey,website
      });
      if(typeof created.challenge!=="string" || typeof created.challengeId!=="string") {
        throw new Error("Профиль создан, но сервер не вернул запрос подтверждения. Войди с помощью файла восстановления.");
      }
      const signature=await signGuestChallenge(identity.privateKey,created.challenge);
      const verified=await requestJson("/api/auth/verify","POST",{
        deviceId:identity.deviceId,challengeId:created.challengeId,signature
      });
      if(typeof verified.user!=="object" || verified.user===null || !("id" in verified.user)) {
        throw new Error("Профиль создан, но сервер не вернул данные аккаунта.");
      }
      const profile=verified.user as IdentityProfile;
      await saveIdentity({
        deviceId:identity.deviceId,privateKey:identity.privateKey,
        username:cleanUsername,profile
      });
      const recovery=await createRecoveryBundle(identity.deviceId,cleanUsername,identity.privateJwk);
      setUser(profile);
      setBundle(recovery.bundle);
      setSecretCode(recovery.code);
      setDownloaded(false);
      setView("backup");
    } catch(error) {
      setMessage(error instanceof Error?error.message:"Не удалось создать профиль ORBIS.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if(!recoveryFile || !recoveryCode.trim()) {
        throw new Error("Выбери файл восстановления и введи секретный код.");
      }
      const parsed:unknown=JSON.parse(await recoveryFile.text());
      if(!isRecoveryBundle(parsed)) throw new Error("Файл не является совместимым файлом ORBIS.");
      const privateJwk=await decryptRecoveryBundle(parsed,recoveryCode.trim());
      const privateKey=await importPrivateKey(privateJwk);
      const profile=await completeKeyLogin(parsed.deviceId,privateKey);
      await saveIdentity({deviceId:parsed.deviceId,privateKey,username:parsed.username,profile});
      window.localStorage.removeItem("orbis_explicit_logout");
      router.replace("/u/"+encodeURIComponent(profile.username));
    } catch(error) {
      setMessage(error instanceof Error?error.message:"Не удалось восстановить доступ.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(secretCode); }
    catch { setMessage("Выдели секретный код вручную и скопируй его."); }
  }

  if(view==="checking") {
    return <section className="auth-card auth-card-narrow" aria-busy="true">
      <div className="auth-icon"><KeyRound size={23}/></div>
      <h1>Проверяем доступ</h1>
      <p>ORBIS проверяет сессию и ключ этого браузера.</p>
      <div className="auth-progress"/>
    </section>;
  }

  if(view==="signed-in" && user) {
    return <section className="auth-card auth-card-narrow">
      <div className="auth-icon"><ShieldCheck size={23}/></div>
      <div className="eyebrow">АККАУНТ ПОДКЛЮЧЁН</div>
      <h1>С возвращением</h1>
      <p className="auth-user-handle">@{user.username}</p>
      <p>Сессия хранится в HttpOnly cookie. Приватный ключ остаётся в локальном хранилище браузера.</p>
      <Link href="/" className="primary-button auth-wide-button">Открыть ORBIS <ArrowRight size={16}/></Link>
    </section>;
  }

  if(view==="backup" && bundle) {
    return <section className="auth-card auth-card-narrow">
      <div className="auth-icon"><ShieldCheck size={23}/></div>
      <div className="eyebrow">ЗАЩИТА АККАУНТА</div>
      <h1>Сохрани доступ к ORBIS</h1>
      <p>Файл содержит зашифрованный ключ. Секретный код нужен для расшифровки. Сохрани их отдельно друг от друга.</p>
      <div className="recovery-code-panel">
        <span>СЕКРЕТНЫЙ КОД</span>
        <code>{secretCode}</code>
        <button type="button" className="secondary-button" onClick={()=>void copyCode()}>Скопировать код</button>
      </div>
      <button type="button" className="primary-button auth-wide-button"
        onClick={()=>{downloadRecoveryBundle(bundle);setDownloaded(true);}}>
        <Download size={16}/> Скачать файл восстановления
      </button>
      <label className="auth-checkbox">
        <input type="checkbox" checked={downloaded} onChange={event=>setDownloaded(event.target.checked)}/>
        <span>Я скачал файл и сохранил секретный код отдельно.</span>
      </label>
      {message && <p className="auth-error" role="alert">{message}</p>}
      <button type="button" className="primary-button auth-wide-button"
        onClick={()=>router.replace("/u/"+encodeURIComponent(bundle.username))}>
        Войти в свой профиль <ArrowRight size={16}/>
      </button>
      {!downloaded&&<p className="auth-footnote">Резервный файл и секретный код лучше сохранить отдельно. Можно продолжить сейчас и сохранить их позже в этом браузере.</p>}
    </section>;
  }

  return <section className="auth-card">
    <Link href="/" className="auth-back-link"><ArrowLeft size={15}/> На главную</Link>
    <div className="auth-icon"><KeyRound size={23}/></div>
    <div className="eyebrow">ORBIS IDENTITY</div>
    <h1>{mode==="register"?"Создай профиль":"Восстанови доступ"}</h1>
    <p className="auth-intro">В этой версии сохранён совместимый вход существующих аккаунтов через ключ устройства. Почта и телефон не требуются.</p>
    <div className="auth-mode-tabs" role="tablist" aria-label="Режим доступа">
      <button type="button" role="tab" aria-selected={mode==="register"}
        className={mode==="register"?"active":""} onClick={()=>{setMode("register");setMessage("");}}>
        Регистрация
      </button>
      <button type="button" role="tab" aria-selected={mode==="restore"}
        className={mode==="restore"?"active":""} onClick={()=>{setMode("restore");setMessage("");}}>
        Восстановление
      </button>
    </div>

    {mode==="register"?(
      <form className="auth-form" onSubmit={event=>void handleRegister(event)}>
        <label className="auth-field">
          <span>Никнейм</span>
          <input value={username} onChange={event=>setUsername(event.target.value)}
            minLength={3} maxLength={24} autoComplete="username" required
            placeholder="например, orbis_user"/>
          <small>3–24 символа: латиница, цифры, точка или _.</small>
        </label>
        <label className="auth-field">
          <span>О себе <small>(необязательно)</small></span>
          <textarea value={bio} onChange={event=>setBio(event.target.value)}
            maxLength={180} rows={3} placeholder="Коротко расскажи о себе"/>
        </label>
        <label className="auth-honeypot" aria-hidden="true">
          <span>Не заполняй это поле</span>
          <input value={website} onChange={event=>setWebsite(event.target.value)}
            name="website" autoComplete="off" tabIndex={-1}/>
        </label>
        {message && <p className="auth-error" role="alert">{message}</p>}
        <button className="primary-button auth-wide-button" type="submit" disabled={busy}>
          {busy?"Создаём профиль…":"Создать профиль"} <ArrowRight size={16}/>
        </button>
        <p className="auth-footnote">После регистрации обязательно сохрани файл восстановления и секретный код.</p>
      </form>
    ):(
      <form className="auth-form" onSubmit={event=>void handleRestore(event)}>
        <label className="auth-field">
          <span>Файл восстановления</span>
          <input type="file" accept="application/json,.json"
            onChange={event=>setRecoveryFile(event.target.files?.[0]||null)} required/>
        </label>
        <label className="auth-field">
          <span>Секретный код</span>
          <input type="password" value={recoveryCode}
            onChange={event=>setRecoveryCode(event.target.value)}
            autoComplete="off" required placeholder="48 символов"/>
        </label>
        {message && <p className="auth-error" role="alert">{message}</p>}
        <button className="primary-button auth-wide-button" type="submit" disabled={busy}>
          {busy?"Проверяем файл…":"Восстановить доступ"} <ArrowRight size={16}/>
        </button>
      </form>
    )}
  </section>;
}
