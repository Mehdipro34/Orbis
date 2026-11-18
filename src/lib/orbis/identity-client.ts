export type IdentityProfile={
  id:string;username:string;name?:string;bio?:string;
  avatar_url?:string|null;publicNumber?:string|null;
};
export type SavedIdentity={deviceId:string;privateKey:CryptoKey;username:string;profile?:IdentityProfile};
export type RecoveryBundle={
  format:"ORBIS-KEY-1";deviceId:string;username:string;salt:string;iv:string;
  iterations:number;ciphertext:string;createdAt:string;
};

const DATABASE_NAME="orbis-local-v3";
const DATABASE_VERSION=2;
const RECOVERY_ITERATIONS=310000;
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64URL_PATTERN=/^[A-Za-z0-9_-]+$/;

function openDatabase():Promise<IDBDatabase> {
  if(typeof indexedDB==="undefined") return Promise.reject(new Error("IndexedDB недоступен в этом браузере."));
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE_NAME,DATABASE_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains("kv")) db.createObjectStore("kv",{keyPath:"id"});
      if(!db.objectStoreNames.contains("cache")) db.createObjectStore("cache",{keyPath:"key"});
      if(!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox",{keyPath:"id"});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("Не удалось открыть локальное хранилище."));
    request.onblocked=()=>reject(new Error("Закрой старую вкладку ORBIS и повтори попытку."));
  });
}

function requestResult<T>(request:IDBRequest<T>):Promise<T> {
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("Ошибка локального хранилища."));
  });
}

async function readStore<T>(storeName:string,key:IDBValidKey):Promise<T|null> {
  const db=await openDatabase();
  try {
    const tx=db.transaction(storeName,"readonly");
    const result=await requestResult(tx.objectStore(storeName).get(key)) as T|undefined;
    return result??null;
  } finally { db.close(); }
}

async function writeStore(storeName:string,value:unknown):Promise<void> {
  const db=await openDatabase();
  try {
    const tx=db.transaction(storeName,"readwrite");
    tx.objectStore(storeName).put(value);
    await new Promise<void>((resolve,reject)=>{
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error("Не удалось сохранить локальные данные."));
      tx.onabort=()=>reject(tx.error||new Error("Сохранение было отменено."));
    });
  } finally { db.close(); }
}

export async function loadSavedIdentity():Promise<SavedIdentity|null> {
  const row=await readStore<Record<string,unknown>>("kv","auth");
  if(!row || typeof row.deviceId!=="string" || !UUID_PATTERN.test(row.deviceId)) return null;
  if(typeof CryptoKey==="undefined" || !(row.privateKey instanceof CryptoKey)) return null;
  return {
    deviceId:row.deviceId,privateKey:row.privateKey,
    username:typeof row.username==="string"?row.username:"",
    profile:row.profile && typeof row.profile==="object"?row.profile as IdentityProfile:undefined
  };
}

export async function saveIdentity(identity:SavedIdentity):Promise<void> {
  await writeStore("kv",{
    id:"auth",deviceId:identity.deviceId,privateKey:identity.privateKey,
    username:identity.username,profile:identity.profile||null
  });
}

export async function clearSavedIdentity():Promise<void> {
  const identity=await loadSavedIdentity();
  const db=await openDatabase();
  try {
    const tx=db.transaction(["kv","outbox"],"readwrite");
    const kv=tx.objectStore("kv");
    const outbox=tx.objectStore("outbox");
    if(identity) {
      const getAll=outbox.getAll();
      getAll.onsuccess=()=>{
        for(const item of getAll.result as Array<Record<string,unknown>>) {
          if(!item.userId) outbox.put({...item,userId:identity.deviceId});
        }
        kv.delete("auth");
      };
    } else {
      kv.delete("auth");
    }
    await new Promise<void>((resolve,reject)=>{
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error("Не удалось завершить выход."));
      tx.onabort=()=>reject(tx.error||new Error("Выход был отменён."));
    });
  } finally { db.close(); }
}

function bytesToBase64Url(bytes:Uint8Array):string {
  let binary="";
  for(const byte of bytes) binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}

function base64UrlToBytes(value:string):Uint8Array {
  if(!BASE64URL_PATTERN.test(value)) throw new Error("Файл восстановления повреждён.");
  const normalized=value.replace(/-/g,"+").replace(/_/g,"/");
  const binary=atob(normalized+"=".repeat((4-normalized.length%4)%4));
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
}

function toArrayBuffer(bytes:Uint8Array):ArrayBuffer {
  const buffer=new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function randomHex(byteLength:number):string {
  return Array.from(crypto.getRandomValues(new Uint8Array(byteLength)),
    byte=>byte.toString(16).padStart(2,"0")).join("");
}

export async function createRecoveryBundle(
  deviceId:string,username:string,privateJwk:JsonWebKey
):Promise<{bundle:RecoveryBundle;code:string}> {
  const code=randomHex(24);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(code),"PBKDF2",false,["deriveKey"]);
  const key=await crypto.subtle.deriveKey(
    {name:"PBKDF2",salt,iterations:RECOVERY_ITERATIONS,hash:"SHA-256"},
    material,{name:"AES-GCM",length:256},false,["encrypt"]
  );
  const encrypted=await crypto.subtle.encrypt(
    {name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(privateJwk))
  );
  const bundle:RecoveryBundle={
    format:"ORBIS-KEY-1",deviceId,username,
    salt:bytesToBase64Url(salt),iv:bytesToBase64Url(iv),
    iterations:RECOVERY_ITERATIONS,
    ciphertext:bytesToBase64Url(new Uint8Array(encrypted)),
    createdAt:new Date().toISOString()
  };
  await writeStore("kv",{id:"recoveryBundle:"+deviceId,bundle});
  return {bundle,code};
}

export function isRecoveryBundle(value:unknown):value is RecoveryBundle {
  if(typeof value!=="object" || value===null) return false;
  const row=value as Record<string,unknown>;
  return row.format==="ORBIS-KEY-1" &&
    typeof row.deviceId==="string" && UUID_PATTERN.test(row.deviceId) &&
    typeof row.username==="string" && /^[a-z0-9_.]{3,24}$/i.test(row.username) &&
    typeof row.salt==="string" && typeof row.iv==="string" &&
    typeof row.ciphertext==="string" && row.iterations===RECOVERY_ITERATIONS &&
    typeof row.createdAt==="string";
}

export async function decryptRecoveryBundle(bundle:RecoveryBundle,code:string):Promise<JsonWebKey> {
  if(!/^[a-f0-9]{48}$/i.test(code)) throw new Error("Проверь секретный код восстановления.");
  const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(code),"PBKDF2",false,["deriveKey"]);
  const key=await crypto.subtle.deriveKey(
    {name:"PBKDF2",salt:toArrayBuffer(base64UrlToBytes(bundle.salt)),iterations:bundle.iterations,hash:"SHA-256"},
    material,{name:"AES-GCM",length:256},false,["decrypt"]
  );
  const plaintext=await crypto.subtle.decrypt(
    {name:"AES-GCM",iv:toArrayBuffer(base64UrlToBytes(bundle.iv))},key,toArrayBuffer(base64UrlToBytes(bundle.ciphertext))
  );
  const parsed:unknown=JSON.parse(new TextDecoder().decode(plaintext));
  if(typeof parsed!=="object" || parsed===null || !("kty" in parsed) ||
    parsed.kty!=="EC" || !("crv" in parsed) || parsed.crv!=="P-256") {
    throw new Error("Файл не содержит совместимый ключ ORBIS.");
  }
  return parsed as JsonWebKey;
}

export async function importPrivateKey(jwk:JsonWebKey):Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
}

export async function createDeviceIdentity():Promise<{
  deviceId:string;privateKey:CryptoKey;publicKey:JsonWebKey;privateJwk:JsonWebKey;
}> {
  const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const publicKey=await crypto.subtle.exportKey("jwk",pair.publicKey);
  const privateJwk=await crypto.subtle.exportKey("jwk",pair.privateKey);
  const privateKey=await importPrivateKey(privateJwk);
  return {deviceId:crypto.randomUUID(),privateKey,publicKey,privateJwk};
}

export async function signGuestChallenge(privateKey:CryptoKey,challenge:string):Promise<string> {
  const signature=await crypto.subtle.sign(
    {name:"ECDSA",hash:"SHA-256"},privateKey,new TextEncoder().encode(challenge)
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export function downloadRecoveryBundle(bundle:RecoveryBundle):void {
  const blob=new Blob([JSON.stringify(bundle,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download="ORBIS-recovery-"+bundle.username+".json";
  anchor.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
