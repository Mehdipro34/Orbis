(() => {
"use strict";
const API="https://wdwvcvpgovvkoodozbxf.supabase.co/functions/v1/orbis-api";
const ANON="sb_publishable_B-88igN5GVsuj67o-vtCVA_--RFWsLx";
const OLD_DEVICE="orbis.device.v1",OLD_TOKEN="orbis.guest.token.v1",DB_NAME="orbis-local-v3";
const $=id=>document.getElementById(id),encoder=new TextEncoder(),decoder=new TextDecoder();
let lang=localStorage.getItem("orbis.language.v1")||"ru",auth=null,me=null,currentView="home",profileUsername=null,selectedFiles=[],lastFeedRefresh=0,installPrompt=null,pendingBackup=null,pendingCode=null,toastTimer=null,outboxBusy=false,outboxRequested=false,pendingPosts=[],syncRetryTimer=null,localCommentObjects=new Map();
const feeds={home:{items:[],cursor:null,hasMore:false,loading:false},following:{items:[],cursor:null,hasMore:false,loading:false},popular:{items:[],cursor:null,hasMore:false,loading:false}};
const T={
ru:{welcomeKicker:"МЕЖДУНАРОДНОЕ СООБЩЕСТВО",welcomeTitle:"Твои идеи заслуживают аудитории.",welcomeText:"Создай профиль за несколько секунд. Без почты и номера телефона.",nicknameLabel:"Никнейм",bioLabel:"О себе",optional:"(необязательно)",createAccount:"Создать профиль",alreadyMember:"Уже есть аккаунт?",restoreAccess:"Войти или восстановить доступ",recoveryHelp:"Выбери файл восстановления и введи секретный код.",recoveryFile:"Файл восстановления",recoveryCode:"Секретный код",restoreButton:"Восстановить аккаунт",authFoot:"Сохрани файл восстановления и секретный код отдельно. Без них доступ с другого устройства может быть потерян.",workspace:"ПРОСТРАНСТВО",home:"Главная",following:"Подписки",popular:"Популярное",notifications:"Уведомления",myProfile:"Мой профиль",settings:"Настройки",homeTitle:"Главная лента",composerPlaceholder:"Что нового?",composerHint:"Поделись идеей с миром",publish:"Опубликовать",newPost:"Новая публикация",publicPost:"Публикация будет видна всем",addPhotos:"Добавить фото",community:"ORBIS COMMUNITY",liveFeed:"Общая лента",refresh:"Обновить",loadMore:"Показать ещё",followers:"Подписчики",followingCountLabel:"Подписки",posts:"Публикации",back:"Назад",markAll:"Прочитать всё",yourAccount:"YOUR ACCOUNT",aboutOrbis:"ABOUT ORBIS",aboutTitle:"Мир идей без границ.",aboutText:"Публикуй, находи единомышленников, поддерживай хорошие идеи и создавай свою аудиторию.",yourActivity:"YOUR ACTIVITY",yourPosts:"Твои посты",yourFollowers:"Подписчики",viewProfile:"Открыть профиль",footer:"Your world. Your voice.",privacyNote:"Никнейм публичен. Не публикуй адрес, пароль или личные документы.",saveAccess:"Сохрани доступ к аккаунту",saveAccessHelp:"Скачай файл восстановления и сохрани секретный код отдельно. Это единственный способ войти с другого устройства.",downloadBackup:"Скачать файл восстановления",secretCode:"СЕКРЕТНЫЙ КОД",copy:"Скопировать",backupConfirmed:"Я скачал файл и сохранил код отдельно",continue:"Продолжить",language:"Язык интерфейса",downloadBackupAgain:"Скачать файл восстановления",logout:"Выйти на этом устройстве",logoutWarning:"Выход удалит локальный ключ и токен с этого устройства. Сначала сохрани файл восстановления.",postPlaceholder:"О чём ты думаешь?",like:"Нравится",comment:"Комментарии",save:"Сохранить",follow:"Подписаться",unfollow:"Отписаться",reply:"Ответить",writeComment:"Напиши комментарий…",send:"Отправить",noPosts:"Здесь пока нет публикаций.",noFollowing:"Лента подписок пока пуста. Подпишись на интересных авторов.",noNotifications:"Пока нет уведомлений.",commentsTitle:"Комментарии",edit:"Изменить",delete:"Удалить",profileEdit:"Изменить профиль",displayName:"Имя",bioPlaceholder:"Расскажи о себе…",saveChanges:"Сохранить изменения",saved:"Сохранено",removed:"Удалено",followed:"Подписка добавлена.",unfollowed:"Подписка удалена.",uploading:"Загружаем фото…",loading:"Загружаем…",offline:"Нет подключения. Показаны сохранённые публикации.",retry:"Повторить",noMore:"Больше публикаций нет.",backupReady:"Файл восстановления готов. Обязательно сохрани его и код.",invalidBackup:"Не удалось открыть файл восстановления. Проверь код.",rateLimit:"Слишком много запросов. Попробуй позже.",profileUpdated:"Профиль обновлён.",confirmDelete:"Удалить эту публикацию?",deletedPost:"Публикация удалена.",editPrompt:"Введи новый текст публикации:",photoLimit:"Можно добавить не более четырёх фото.",photoTooLarge:"Не удалось обработать фото.",cacheReady:"ЛОКАЛЬНЫЙ КЭШ ГОТОВ",signingIn:"Проверяем ключ…",publicKeyError:"Браузер не поддерживает безопасные криптографические ключи. Открой приложение по HTTPS.",profileMissing:"Профиль не найден.",backupWarning:"Сохрани файл и код в разных местах."},
en:{welcomeKicker:"A GLOBAL COMMUNITY",welcomeTitle:"Your ideas deserve an audience.",welcomeText:"Create your profile in seconds. No email or phone number.",nicknameLabel:"Username",bioLabel:"About you",optional:"(optional)",createAccount:"Create profile",alreadyMember:"Already have an account?",restoreAccess:"Sign in or restore access",recoveryHelp:"Choose your recovery file and enter its secret code.",recoveryFile:"Recovery file",recoveryCode:"Secret code",restoreButton:"Restore account",authFoot:"Keep your recovery file and secret code separately. Without them, access from another device may be lost.",workspace:"WORKSPACE",home:"Home",following:"Following",popular:"Popular",notifications:"Notifications",myProfile:"My profile",settings:"Settings",homeTitle:"Global feed",composerPlaceholder:"What's happening?",composerHint:"Share an idea with the world",publish:"Publish",newPost:"Create a post",publicPost:"Your post will be visible to everyone",addPhotos:"Add photos",community:"ORBIS COMMUNITY",liveFeed:"Global feed",refresh:"Refresh",loadMore:"Load more",followers:"Followers",followingCountLabel:"Following",posts:"Posts",back:"Back",markAll:"Mark all read",yourAccount:"YOUR ACCOUNT",aboutOrbis:"ABOUT ORBIS",aboutTitle:"Ideas without borders.",aboutText:"Publish, find like-minded people, support good ideas and build your audience.",yourActivity:"YOUR ACTIVITY",yourPosts:"Your posts",yourFollowers:"Followers",viewProfile:"View profile",footer:"Your world. Your voice.",privacyNote:"Your username is public. Never post your address, password or private documents.",saveAccess:"Secure your account",saveAccessHelp:"Download your recovery file and save the secret code separately. This is the only way to sign in from another device.",downloadBackup:"Download recovery file",secretCode:"SECRET CODE",copy:"Copy",backupConfirmed:"I downloaded the file and saved the code separately",continue:"Continue",language:"Interface language",downloadBackupAgain:"Download recovery file",logout:"Sign out on this device",logoutWarning:"Signing out removes the local key and token. Save your recovery file first.",postPlaceholder:"What are you thinking about?",like:"Like",comment:"Comments",save:"Save",follow:"Follow",unfollow:"Unfollow",reply:"Reply",writeComment:"Write a comment…",send:"Send",noPosts:"No posts here yet.",noFollowing:"Your following feed is empty. Follow people you find interesting.",noNotifications:"No notifications yet.",commentsTitle:"Comments",edit:"Edit",delete:"Delete",profileEdit:"Edit profile",displayName:"Display name",bioPlaceholder:"Tell people about yourself…",saveChanges:"Save changes",saved:"Saved",removed:"Removed",followed:"You followed this user.",unfollowed:"You unfollowed this user.",uploading:"Uploading photos…",loading:"Loading…",offline:"You are offline. Cached posts are shown when available.",retry:"Retry",noMore:"No more posts.",backupReady:"Your recovery file is ready. Keep it and the code safe.",invalidBackup:"Could not open recovery file. Check the code.",rateLimit:"Too many requests. Please try again later.",profileUpdated:"Profile updated.",confirmDelete:"Delete this post?",deletedPost:"Post deleted.",editPrompt:"Enter the updated post text:",photoLimit:"You can add up to four photos.",photoTooLarge:"Could not process this photo.",cacheReady:"LOCAL CACHE READY",signingIn:"Verifying key…",publicKeyError:"This browser does not support secure cryptographic keys. Open the app over HTTPS.",profileMissing:"Profile not found.",backupWarning:"Keep the file and code in different places."},
az:{welcomeKicker:"BEYNƏLXALQ İCMA",welcomeTitle:"İdeyaların auditoriyaya layiqdir.",welcomeText:"Bir neçə saniyəyə profil yarat. E-poçt və telefon nömrəsi lazım deyil.",nicknameLabel:"İstifadəçi adı",bioLabel:"Haqqında",optional:"(istəyə bağlı)",createAccount:"Profil yarat",alreadyMember:"Artıq hesabın var?",restoreAccess:"Daxil ol və ya girişi bərpa et",recoveryHelp:"Bərpa faylını seç və gizli kodu daxil et.",recoveryFile:"Bərpa faylı",recoveryCode:"Gizli kod",restoreButton:"Hesabı bərpa et",authFoot:"Bərpa faylını və gizli kodu ayrı saxla. Onlar olmadan başqa cihazdan giriş itə bilər.",workspace:"MƏKAN",home:"Ana səhifə",following:"Abunəliklər",popular:"Populyar",notifications:"Bildirişlər",myProfile:"Profilim",settings:"Parametrlər",homeTitle:"Ümumi lent",composerPlaceholder:"Nə baş verir?",composerHint:"Fikrini dünya ilə bölüş",publish:"Paylaş",newPost:"Yeni paylaşım",publicPost:"Paylaşım hamıya görünəcək",addPhotos:"Şəkil əlavə et",community:"ORBIS İCMASI",liveFeed:"Ümumi lent",refresh:"Yenilə",loadMore:"Daha çox göstər",followers:"İzləyicilər",followingCountLabel:"İzlənilənlər",posts:"Paylaşımlar",back:"Geri",markAll:"Hamısını oxunmuş et",yourAccount:"HESABIN",aboutOrbis:"ORBIS HAQQINDA",aboutTitle:"Sərhədsiz ideyalar dünyası.",aboutText:"Paylaş, eyni düşüncəli insanları tap, yaxşı ideyaları dəstəklə və auditoriyanı qur.",yourActivity:"FƏALİYYƏTİN",yourPosts:"Paylaşımların",yourFollowers:"İzləyicilər",viewProfile:"Profilə bax",footer:"Your world. Your voice.",privacyNote:"İstifadəçi adın hamıya açıqdır. Ünvan, parol və şəxsi sənədləri paylaşma.",saveAccess:"Hesabına girişi qoru",saveAccessHelp:"Bərpa faylını endir və gizli kodu ayrıca saxla. Başqa cihazdan giriş üçün bu lazımdır.",downloadBackup:"Bərpa faylını endir",secretCode:"GİZLİ KOD",copy:"Kopyala",backupConfirmed:"Faylı endirdim və kodu ayrıca saxladım",continue:"Davam et",language:"İnterfeys dili",downloadBackupAgain:"Bərpa faylını endir",logout:"Bu cihazdan çıxış",logoutWarning:"Çıxış açarı və tokeni bu cihazdan siləcək. Əvvəlcə bərpa faylını saxla.",postPlaceholder:"Nə barədə düşünürsən?",like:"Bəyən",comment:"Şərhlər",save:"Saxla",follow:"İzlə",unfollow:"İzləmədən çıx",reply:"Cavabla",writeComment:"Şərhini yaz…",send:"Göndər",noPosts:"Burada hələ paylaşım yoxdur.",noFollowing:"İzlədiyin lent boşdur. Maraqlı insanları izlə.",noNotifications:"Hələ bildiriş yoxdur.",commentsTitle:"Şərhlər",edit:"Dəyiş",delete:"Sil",profileEdit:"Profili dəyiş",displayName:"Ad",bioPlaceholder:"Özün haqqında yaz…",saveChanges:"Dəyişiklikləri saxla",saved:"Saxlanıldı",removed:"Silindi",followed:"İzləməyə başladın.",unfollowed:"İzləmədən çıxdın.",uploading:"Şəkillər yüklənir…",loading:"Yüklənir…",offline:"İnternet yoxdur. Keşdə olan paylaşımlar göstərilir.",retry:"Yenidən cəhd et",noMore:"Daha paylaşım yoxdur.",backupReady:"Bərpa faylı hazırdır. Faylı və kodu təhlükəsiz saxla.",invalidBackup:"Bərpa faylı açıla bilmədi. Kodu yoxla.",rateLimit:"Çox sayda sorğu. Sonra yenidən yoxla.",profileUpdated:"Profil yeniləndi.",confirmDelete:"Bu paylaşım silinsin?",deletedPost:"Paylaşım silindi.",editPrompt:"Yeni paylaşım mətnini daxil et:",photoLimit:"Ən çox dörd şəkil əlavə edə bilərsən.",photoTooLarge:"Şəkli emal etmək mümkün olmadı.",cacheReady:"YERLİ KEŞ HAZIRDIR",signingIn:"Açar yoxlanılır…",publicKeyError:"Brauzer təhlükəsiz kriptoqrafiyanı dəstəkləmir. Tətbiqi HTTPS ilə aç.",profileMissing:"Profil tapılmadı.",backupWarning:"Faylı və kodu ayrı yerlərdə saxla."}
};
const t=k=>(T[lang]&&T[lang][k])||T.ru[k]||k;
function applyLanguage(){document.documentElement.lang=lang;document.querySelectorAll("[data-i]").forEach(e=>{e.textContent=t(e.dataset.i)});document.querySelectorAll("[data-pi]").forEach(e=>{e.placeholder=t(e.dataset.pi)});$("languageSelect").value=lang;$("settingsLanguage").value=lang;localStorage.setItem("orbis.language.v1",lang)}
function toast(s){const el=$("toast");el.textContent=s;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)}
function authMessage(s,error=true){$("authMessage").textContent=s||"";$("authMessage").style.color=error?"var(--danger)":"var(--mint)"}
function b64u(bytes){let bin="";bytes.forEach(x=>bin+=String.fromCharCode(x));return btoa(bin).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}
function unb64u(s){s=s.replace(/-/g,"+").replace(/_/g,"/");const b=atob(s+"=".repeat((4-s.length%4)%4));return Uint8Array.from(b,c=>c.charCodeAt(0))}
function randomHex(n){return Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,"0")).join("")}
let dbPromise=null;
function openDB(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,2);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains("kv"))d.createObjectStore("kv",{keyPath:"id"});if(!d.objectStoreNames.contains("cache"))d.createObjectStore("cache",{keyPath:"key"});if(!d.objectStoreNames.contains("outbox"))d.createObjectStore("outbox",{keyPath:"id"})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return dbPromise}
async function get(store,key){const d=await openDB();return new Promise((resolve,reject)=>{const r=d.transaction(store,"readonly").objectStore(store).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
async function put(store,value){const d=await openDB();return new Promise((resolve,reject)=>{const r=d.transaction(store,"readwrite").objectStore(store).put(value);r.onsuccess=()=>resolve(true);r.onerror=()=>reject(r.error)})}
async function del(store,key){const d=await openDB();return new Promise((resolve,reject)=>{const r=d.transaction(store,"readwrite").objectStore(store).delete(key);r.onsuccess=()=>resolve(true);r.onerror=()=>reject(r.error)})}
async function getAll(store){const d=await openDB();return new Promise((resolve,reject)=>{const r=d.transaction(store,"readonly").objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
async function api(path,opt={}){
 const headers={apikey:ANON};if(auth?.token)headers.Authorization="Bearer "+auth.token;
 let body=opt.body;if(body&&!(body instanceof FormData)&&typeof body!=="string"){headers["Content-Type"]="application/json";body=JSON.stringify(body)}else if(typeof body==="string")headers["Content-Type"]="application/json";
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),15000);let res;
 try{res=await fetch(API+path,{method:opt.method||"GET",headers,body,signal:ctl.signal,cache:"no-store"})}catch(e){throw new Error(e.name==="AbortError"?"Сервер отвечает слишком долго.":t("offline"))}finally{clearTimeout(timer)}
 let data={};try{data=await res.json()}catch{}
 if(!res.ok){const e=new Error(data.error||("HTTP "+res.status));e.status=res.status;e.data=data;throw e}return data;
}
async function backupEncrypt(deviceId,username,privateJwk){
 const code=randomHex(24),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const material=await crypto.subtle.importKey("raw",encoder.encode(code),"PBKDF2",false,["deriveKey"]);
 const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt"]);
 const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,encoder.encode(JSON.stringify(privateJwk)));
 pendingCode=code;pendingBackup={format:"ORBIS-KEY-1",deviceId,username,salt:b64u(salt),iv:b64u(iv),iterations:310000,ciphertext:b64u(new Uint8Array(cipher)),createdAt:new Date().toISOString()};
 await put("kv",{id:"recoveryBundle",bundle:pendingBackup});
 $("backupSecret").textContent=code;$("backupConfirmed").checked=false;$("finishRegistration").disabled=true;$("backupModal").hidden=false;
}
async function backupDecrypt(bundle,code){
 if(bundle?.format!=="ORBIS-KEY-1")throw new Error(t("invalidBackup"));
 const material=await crypto.subtle.importKey("raw",encoder.encode(code),"PBKDF2",false,["deriveKey"]);
 const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:unb64u(bundle.salt),iterations:310000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["decrypt"]);
 return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64u(bundle.iv)},key,unb64u(bundle.ciphertext))));
}
function downloadBundle(bundle){const blob=new Blob([JSON.stringify(bundle,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="ORBIS-recovery-"+bundle.username+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function challengeLogin(deviceId,privateKey){
 const challenge=await api("/api/guest/challenge",{method:"POST",body:{deviceId}});
 const sig=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},privateKey,encoder.encode(challenge.challenge));
 const verified=await api("/api/guest/verify",{method:"POST",body:{deviceId,challengeId:challenge.challengeId,signature:b64u(new Uint8Array(sig))}});
 auth={deviceId,token:verified.token,privateKey,username:verified.user?.username||"",profile:verified.user};me=verified.user;await put("kv",{id:"auth",...auth});return verified;
}
async function register(event){
 event.preventDefault();const btn=$("registerBtn");btn.disabled=true;authMessage(t("signingIn"),false);
 try{
  const username=$("regUsername").value.trim().toLowerCase(),bio=$("regBio").value.trim();
  if(!/^[a-z0-9_.]{3,24}$/.test(username))throw new Error("Никнейм: 3–24 символа, латиница, цифры, точка или _.");
  if(!crypto?.subtle)throw new Error(t("publicKeyError"));
  const deviceId=crypto.randomUUID(),pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const publicJwk=await crypto.subtle.exportKey("jwk",pair.publicKey),privateJwk=await crypto.subtle.exportKey("jwk",pair.privateKey);
  const privateKey=await crypto.subtle.importKey("jwk",privateJwk,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  const created=await api("/api/guest/register",{method:"POST",body:{deviceId,username,bio,publicKey:publicJwk}});
  const signature=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},privateKey,encoder.encode(created.challenge));
  const verified=await api("/api/guest/verify",{method:"POST",body:{deviceId,challengeId:created.challengeId,signature:b64u(new Uint8Array(signature))}});
  auth={deviceId,token:verified.token,privateKey,username,profile:verified.user};me=verified.user;await put("kv",{id:"auth",...auth});
  await backupEncrypt(deviceId,username,privateJwk);authMessage(t("backupReady"),false);
 }catch(e){authMessage(e.message||"Registration failed.")}finally{btn.disabled=false}
}
async function restore(event){
 event.preventDefault();const btn=$("recoveryBtn");btn.disabled=true;authMessage(t("signingIn"),false);
 try{
  const file=$("recoveryFile").files?.[0],code=$("recoveryCode").value.trim();if(!file||!code)throw new Error(t("invalidBackup"));
  const bundle=JSON.parse(await file.text()),jwk=await backupDecrypt(bundle,code);
  const privateKey=await crypto.subtle.importKey("jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  await challengeLogin(bundle.deviceId,privateKey);await put("kv",{id:"recoveryBundle",bundle});await showApp();
 }catch(e){authMessage(e.message||t("invalidBackup"))}finally{btn.disabled=false}
}
async function migrateLegacy(){
 const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const publicJwk=await crypto.subtle.exportKey("jwk",pair.publicKey),privateJwk=await crypto.subtle.exportKey("jwk",pair.privateKey);
 await api("/api/guest/link-key",{method:"POST",body:{publicKey:publicJwk}});
 const privateKey=await crypto.subtle.importKey("jwk",privateJwk,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
 auth.privateKey=privateKey;auth.username=me?.username||"";auth.profile=me;
 await put("kv",{id:"auth",...auth});await backupEncrypt(auth.deviceId,auth.username,privateJwk);
}
async function bootstrap(){
 applyLanguage();
 try{
  const saved=await get("kv","auth");
  if(saved?.deviceId&&saved?.privateKey){
   auth=saved;me=saved.profile||null;
   if(!navigator.onLine){
    if(me){await showApp();return}
    authMessage(t("offline"));$("authScreen").hidden=false;$("appShell").hidden=true;return;
   }
   if(saved.token){
    try{
     const r=await api("/api/guest/me");me=r.user;auth.profile=me;await put("kv",{id:"auth",...auth});
     if(r.authMode==="legacy"){await migrateLegacy();$("authScreen").hidden=true;return}
     await showApp();return;
    }catch{}
   }
   try{await challengeLogin(saved.deviceId,saved.privateKey);await showApp();return}catch{}
   if(me){await showApp();return}
  }
  const device=localStorage.getItem(OLD_DEVICE),token=localStorage.getItem(OLD_TOKEN);
  if(device&&token&&navigator.onLine){
   auth={deviceId:device,token};
   try{
    const r=await api("/api/guest/me");me=r.user;auth.profile=me;
    if(r.authMode==="legacy"){await migrateLegacy();$("authScreen").hidden=true;return}
    authMessage(t("alreadyBackedUp"));
   }catch(e){authMessage(e.message||t("alreadyBackedUp"))}
  }
 }catch(e){console.warn("Local bootstrap",e)}
 $("authScreen").hidden=false;$("appShell").hidden=true;
}
function initial(value){return String(value||"O").trim().charAt(0).toUpperCase()||"O"}
function age(value){const n=Math.max(0,Date.now()-new Date(value).getTime()),m=Math.floor(n/60000);return m<1?"now":m<60?m+"m":m<1440?Math.floor(m/60)+"h":Math.floor(m/1440)+"d"}
function safeUrl(value){try{const u=new URL(value);return u.protocol==="https:"?u.href:""}catch{return ""}}
function activate(view){
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 $("profileView").hidden=view!=="profile";$("notificationsView").hidden=view!=="notifications";$("feedSection").hidden=!["home","following","popular"].includes(view);
 $("composer").hidden=!["home","following","popular"].includes(view);$("composePanel").hidden=true;
 $("viewTitle").textContent=view==="home"?t("homeTitle"):view==="profile"?t("myProfile"):t(view);
 $("feedHeading").textContent=view==="home"?"Для тебя":t(view);
 $("viewEyebrow").textContent=view==="popular"?"TRENDING NOW":view==="following"?"YOUR NETWORK":view==="notifications"?"YOUR ACTIVITY":view==="profile"?"YOUR PROFILE":"THE GLOBAL FEED";
}
async function showApp(){
 $("authScreen").hidden=true;$("appShell").hidden=false;
 $("sidebarName").textContent=me?.name||me?.username||auth.username;
 $("sidebarHandle").textContent="@"+(me?.username||auth.username);
 setAvatarNode($("sidebarAvatar"),me?.avatar_url,me?.name||me?.username);
 setAvatarNode($("composerAvatar"),me?.avatar_url,me?.name||me?.username);
 setAvatarNode($("rightAvatar"),me?.avatar_url,me?.name||me?.username);
 $("rightName").textContent=me?.name||me?.username;
 $("rightHandle").textContent="@"+(me?.username||"member");$("cacheStatus").textContent=t("cacheReady");
 const queued=await getAll("outbox");
 pendingPosts=queued.filter(x=>x.type==="post.create").map(x=>({
  id:"local-"+x.id,body:x.payload.body||"",title:x.payload.title||"",topic:x.payload.topic||"Global",
  username:me?.username,author:me?.name||me?.username,createdAt:x.createdAt,
  media:[],likes:0,liked:false,saved:false,syncStatus:x.status==="failed"?"failed":"pending",syncError:x.lastError||null
 }));
 await openFeed("home",true);refreshUnread();if(navigator.onLine)flushSyncQueue();
}
function skeleton(){ $("feedList").innerHTML='<div class="skeleton-card"></div><div class="skeleton-card"></div>'}
function cacheKey(view){return "feed:"+(auth?.deviceId||"guest")+":"+view}
async function openFeed(view,force){
 currentView=view;profileUsername=null;activate(view);const state=feeds[view];
 if(state.items.length){renderPosts($("feedList"),state.items)}
 else{const cached=await get("cache",cacheKey(view));if(cached?.data?.posts){state.items=cached.data.posts;state.cursor=cached.data.nextCursor;state.hasMore=!!cached.data.hasMore;renderPosts($("feedList"),state.items)}else skeleton()}
 const cached=await get("cache",cacheKey(view));
 if(!force&&cached&&Date.now()-cached.savedAt<90000){$("loadMore").hidden=!state.hasMore;return}
 await fetchFeed(view,false);
}
async function fetchFeed(view,append){
 const state=feeds[view];if(state.loading)return;state.loading=true;$("loadMore").disabled=true;$("loadMore").textContent=t("loading");
 try{
  const query=new URLSearchParams({limit:"20",mode:view==="popular"?"popular":view==="following"?"following":"latest"});
  if(append&&state.cursor)query.set("cursor",state.cursor);
  let data;
  if(view==="following"){
   data=await api("/api/posts?"+new URLSearchParams({limit:"20",mode:"following",...(append&&state.cursor?{cursor:state.cursor}:{})}).toString());
  }else{
   const response=await fetch("/api/public/posts?"+query.toString(),{headers:{accept:"application/json"},cache:"default"});
   if(!response.ok)throw new Error("Публичная лента временно недоступна (HTTP "+response.status+").");
   data=await response.json();
   const ids=(data.posts||[]).map(p=>p.id);
   const authors=[...new Set((data.posts||[]).map(p=>p.username).filter(Boolean))];
   if(auth?.token&&(ids.length||authors.length)){
    const params=new URLSearchParams();
    if(ids.length)params.set("ids",ids.join(","));
    if(authors.length)params.set("authors",authors.join(","));
    const own=await api("/api/posts/state?"+params.toString());
    const liked=new Set(own.likedIds||[]),saved=new Set(own.savedIds||[]),following=new Set(own.followingUsernames||[]);
    data.posts.forEach(p=>{p.liked=liked.has(p.id);p.saved=saved.has(p.id);p.isFollowing=following.has(p.username)});
   }
  }
  const incoming=Array.isArray(data.posts)?data.posts:[];
  if(view==="following")incoming.forEach(p=>p.isFollowing=true);
  if(append){const seen=new Set(state.items.map(p=>p.id));state.items=state.items.concat(incoming.filter(p=>!seen.has(p.id)))}
  else{
   const queued=view==="home"?pendingPosts:[];
   const seen=new Set(queued.map(p=>p.id));
   state.items=queued.concat(incoming.filter(p=>!seen.has(p.id)));
  }
  state.cursor=data.nextCursor||null;state.hasMore=!!data.hasMore;lastFeedRefresh=Date.now();
  renderPosts($("feedList"),state.items);await put("cache",{key:cacheKey(view),data:{posts:state.items,nextCursor:state.cursor,hasMore:state.hasMore},savedAt:Date.now()});
  $("feedUpdated").textContent=new Date().toLocaleTimeString(lang==="en"?"en-US":lang==="az"?"az-AZ":"ru-RU",{hour:"2-digit",minute:"2-digit"});
  $("loadMore").hidden=!state.hasMore;
 }catch(e){
  if(!state.items.length){$("feedList").innerHTML='<div class="empty-state">'+e.message+' <button class="subtle-btn" id="retryFeed">'+t("retry")+'</button></div>';const b=$("retryFeed");if(b)b.onclick=()=>fetchFeed(view,false)}else toast(e.message);
 }finally{state.loading=false;$("loadMore").disabled=false;$("loadMore").textContent=t("loadMore")}
}
function renderPosts(root,items){
 root.replaceChildren();if(!items.length){const empty=document.createElement("div");empty.className="empty-state";empty.textContent=currentView==="following"?t("noFollowing"):t("noPosts");root.append(empty);$("loadMore").hidden=true;return}
 items.forEach((p,i)=>root.append(postCard(p,i)));
}
function postCard(post,index){
 const card=document.createElement("article");card.className="post-card card";card.style.animationDelay=Math.min(index,8)*25+"ms";card.dataset.id=post.id;
 const header=document.createElement("div");header.className="post-head";
 const avatar=document.createElement("span");avatar.className="avatar";
 if(safeUrl(post.avatar_url)){const img=document.createElement("img");img.src=safeUrl(post.avatar_url);img.alt="";img.loading="lazy";avatar.append(img)}else avatar.textContent=initial(post.author||post.username);
 const author=document.createElement("div");author.className="post-author";const name=document.createElement("button");name.textContent=post.author||post.username||"ORBIS member";name.onclick=()=>openProfile(post.username);
 const handle=document.createElement("small");handle.textContent="@"+(post.username||"member")+" · "+age(post.createdAt||post.created_at);author.append(name,handle);header.append(avatar,author);
 if(post.username&&post.username!==me?.username){const follow=document.createElement("button");follow.className="follow-mini";follow.textContent=post.isFollowing?t("unfollow"):t("follow");follow.onclick=async()=>{const desired=!post.isFollowing;post.isFollowing=desired;follow.textContent=desired?t("unfollow"):t("follow");try{await enqueueSync("follow.set",{username:post.username,following:desired});toast(desired?t("followed"):t("unfollowed"))}catch(e){post.isFollowing=!desired;follow.textContent=post.isFollowing?t("unfollow"):t("follow");toast(e.message)}};header.append(follow)}
 card.append(header);
 if(post.syncStatus){
  const status=document.createElement("small");status.className="post-sync-status";
  status.textContent=post.syncStatus==="failed"?"⚠ Не удалось отправить: "+(post.syncError||"ошибка"):"◷ Сохранено на устройстве · ожидает синхронизации";
  card.append(status);
  if(post.syncStatus==="failed"){
   const retry=document.createElement("button");retry.type="button";retry.className="subtle-btn";retry.textContent="Повторить отправку";
   retry.onclick=()=>retrySyncOperation(String(post.id).replace(/^local-/,""));
   card.append(retry);
  }
 }
  const content=document.createElement("p");content.className="post-body";content.textContent=post.body||"";card.append(content);
 const media=(post.media||[]).filter(m=>safeUrl(m.url)).slice(0,4);
 if(media.length){const grid=document.createElement("div");grid.className="post-media";media.forEach(m=>{const image=document.createElement("img");image.src=safeUrl(m.url);image.alt="ORBIS post photo";image.loading="lazy";image.decoding="async";image.onclick=()=>window.open(image.src,"_blank","noopener");grid.append(image)});card.append(grid)}
 const actions=document.createElement("div");actions.className="post-actions";
 const like=document.createElement("button");like.className="action-btn"+(post.liked?" active":"");const updateLike=()=>like.innerHTML=(post.liked?"♥":"♡")+" <span>"+Number(post.likes||0)+"</span>";updateLike();like.disabled=String(post.id).startsWith("local-");like.onclick=async()=>{const desired=!post.liked;post.liked=desired;post.likes=Math.max(0,Number(post.likes||0)+(desired?1:-1));like.classList.toggle("active",desired);updateLike();try{await enqueueSync("like.set",{postId:post.id,liked:desired})}catch(e){post.liked=!desired;post.likes=Math.max(0,Number(post.likes||0)+(desired?-1:1));like.classList.toggle("active",post.liked);updateLike();toast(e.message)}};
 const comments=document.createElement("button");comments.className="action-btn";comments.textContent="▱ "+t("comment");comments.disabled=String(post.id).startsWith("local-");comments.onclick=()=>toggleComments(card,post);
 const spacer=document.createElement("span");spacer.className="action-spacer";
 const save=document.createElement("button");save.className="action-btn"+(post.saved?" saved":"");save.textContent=(post.saved?"◆ ":"◇ ")+t("save");save.onclick=async()=>{save.disabled=true;try{const r=await api("/api/bookmarks",{method:"POST",body:{postId:post.id}});post.saved=r.saved;save.classList.toggle("saved",post.saved);save.textContent=(post.saved?"◆ ":"◇ ")+t("save")}catch(e){toast(e.message)}finally{save.disabled=false}};
 actions.append(like,comments,spacer,save);
 if(post.username===me?.username){const more=document.createElement("button");more.className="action-btn";more.textContent="···";more.onclick=()=>postMenu(post,card);actions.append(more)}
 card.append(actions);return card;
}
function postMenu(post,card){
 const choice=prompt(t("edit")+" / "+t("delete")+"? (1 / 2)","1");
 if(choice==="1"){const text=prompt(t("editPrompt"),post.body);if(text===null)return;api("/api/posts/"+post.id,{method:"PUT",body:{body:text}}).then(()=>{post.body=text;card.querySelector(".post-body").textContent=text;toast(t("profileUpdated"))}).catch(e=>toast(e.message))}
 else if(choice==="2"&&confirm(t("confirmDelete"))){api("/api/posts/"+post.id,{method:"DELETE"}).then(()=>{card.remove();toast(t("deletedPost"))}).catch(e=>toast(e.message))}
}
function commentsCacheKey(postId){return "comments:"+(auth?.deviceId||"guest")+":"+postId}
async function saveCommentsCache(postId,comments){
 await put("cache",{key:commentsCacheKey(postId),data:{comments},savedAt:Date.now()});
}
async function addCachedComment(postId,comment){
 const cached=await get("cache",commentsCacheKey(postId));
 const comments=Array.isArray(cached?.data?.comments)?cached.data.comments:[];
 if(comment.parentId){
  const parent=comments.find(x=>x.id===comment.parentId);
  if(parent){
   parent.replies=Array.isArray(parent.replies)?parent.replies:[];
   if(!parent.replies.some(x=>x.id===comment.id))parent.replies.push(comment);
   parent.repliesCount=parent.replies.length;
  }
 }else if(!comments.some(x=>x.id===comment.id))comments.push(comment);
 await saveCommentsCache(postId,comments.slice(-60));
}
async function toggleComments(card,post){
 let panel=card.querySelector(".comments-panel");if(panel){panel.remove();return}
 panel=document.createElement("section");panel.className="comments-panel";
 const title=document.createElement("div");title.className="comments-title";title.textContent=t("commentsTitle");
 const list=document.createElement("div");list.className="comments-list";
 const form=document.createElement("form");form.className="comment-form";
 const input=document.createElement("input");input.maxLength=1000;input.placeholder=t("writeComment");input.required=true;
 const send=document.createElement("button");send.className="btn btn-primary btn-small";send.type="submit";send.textContent=t("send");form.append(input,send);panel.append(title,list,form);card.append(panel);
 let cached=null;
 try{cached=await get("cache",commentsCacheKey(post.id))}catch{}
 if(cached?.data?.comments)(cached.data.comments||[]).forEach(c=>list.append(commentNode(c,post.id)));
 if(!navigator.onLine){
  if(!cached?.data?.comments?.length)list.textContent=t("offline");
 }else if(!cached?.savedAt||Date.now()-cached.savedAt>60000){
  try{
   const data=await api("/api/posts/"+post.id+"/comments?limit=20");
   await saveCommentsCache(post.id,data.comments||[]);
   list.replaceChildren();(data.comments||[]).forEach(c=>list.append(commentNode(c,post.id)));
  }catch(e){if(!cached?.data?.comments?.length)list.textContent=e.message}
 }
 form.onsubmit=async e=>{
  e.preventDefault();const body=input.value.trim();if(!body)return;send.disabled=true;
  try{
   const opId=await enqueueSync("comment.create",{postId:post.id,body,parentId:null});
   const comment={id:"local-"+opId,postId:post.id,body,createdAt:new Date().toISOString(),own:true,syncStatus:"pending",author:{username:me.username,displayName:me.name||me.username}};
   list.append(commentNode(comment,post.id));await addCachedComment(post.id,comment);input.value="";
  }catch(err){toast(err.message)}finally{send.disabled=false}
 };
}
async function addCachedCommentReplies(postId,updatedComment){
 const cached=await get("cache",commentsCacheKey(postId));
 const comments=Array.isArray(cached?.data?.comments)?cached.data.comments:[];
 const parent=comments.find(x=>x.id===updatedComment.id);
 if(parent){parent.replies=updatedComment.replies||[];parent.repliesCount=parent.replies.length;await saveCommentsCache(postId,comments)}
}
function commentNode(comment,postId){
 if(String(comment.id).startsWith("local-"))localCommentObjects.set(String(comment.id),comment);
 const wrap=document.createElement("div");wrap.className="comment-item";wrap.dataset.commentId=String(comment.id);const text=document.createElement("div");text.className="comment-text";
 const name=document.createElement("button");name.className="comment-author";name.textContent=comment.author?.displayName||comment.author?.username||"Member";name.onclick=()=>openProfile(comment.author?.username);
 const body=document.createElement("p");body.textContent=comment.body;const time=document.createElement("small");time.textContent=age(comment.createdAt);text.append(name,body,time);wrap.append(text);
 if(comment.syncStatus==="pending"||String(comment.id).startsWith("local-")){const status=document.createElement("small");status.className="comment-sync-status";status.textContent="Ожидает синхронизации";wrap.append(status)}
 if(comment.syncStatus==="failed"){const status=document.createElement("small");status.className="comment-sync-status";status.textContent="Не удалось синхронизировать: "+(comment.syncError||"ошибка");wrap.append(status)}
 if(comment.repliesCount){const btn=document.createElement("button");btn.className="reply-toggle";btn.textContent=t("reply")+" · "+comment.repliesCount;btn.onclick=async()=>{btn.disabled=true;try{
  if(!navigator.onLine){if(Array.isArray(comment.replies)&&comment.replies.length)comment.replies.forEach(x=>wrap.append(commentNode(x,postId)));else toast(t("offline"));return}
  const r=await api("/api/comments/"+comment.id+"/replies");comment.replies=r.replies||[];
  (comment.replies).forEach(x=>wrap.append(commentNode(x,postId)));
  await addCachedCommentReplies(postId,comment);
 }catch(e){toast(e.message)}finally{btn.disabled=false}};wrap.append(btn)}
 const form=document.createElement("form");form.className="reply-form";const input=document.createElement("input");input.maxLength=1000;input.placeholder=t("reply")+"…";const send=document.createElement("button");send.textContent="↗";send.type="submit";form.append(input,send);
 if(String(comment.id).startsWith("local-")){input.disabled=true;send.disabled=true;input.placeholder="Дождись синхронизации комментария"}
 form.onsubmit=async e=>{e.preventDefault();if(!input.value.trim()||String(comment.id).startsWith("local-"))return;send.disabled=true;try{const body=input.value.trim(),opId=await enqueueSync("comment.create",{postId,parentId:comment.id,body});const localReply={id:"local-"+opId,postId,parentId:comment.id,body,createdAt:new Date().toISOString(),own:true,syncStatus:"pending",author:{username:me.username,displayName:me.name||me.username}};wrap.append(commentNode(localReply,postId));await addCachedComment(postId,localReply);input.value=""}catch(err){toast(err.message)}finally{send.disabled=false}};
 wrap.append(form);return wrap;
}
function setAvatarNode(node,url,name){
 node.replaceChildren();
 const safe=safeUrl(url);
 if(safe){const img=document.createElement("img");img.src=safe;img.alt="";img.loading="lazy";node.append(img)}
 else node.textContent=initial(name);
}
function renderProfileData(data){
 const user=data.user;if(!user)return;
 $("profileDisplayName").textContent=user.name||user.username;
 $("profileUsername").textContent="@"+user.username;
 $("profileBio").textContent=user.bio||"";
 $("followersCount").textContent=Number(data.followers||0).toLocaleString();
 $("followingCount").textContent=Number(data.following||0).toLocaleString();
 const own=user.username===me?.username;
 $("profileFollow").hidden=own;$("profileEdit").hidden=!own;$("avatarChange").hidden=!own;
 let followerCount=Number(data.followers)||0,isFollowing=!!data.isFollowing;
 $("profileFollow").textContent=isFollowing?t("unfollow"):t("follow");
 setAvatarNode($("profileAvatar"),user.avatar_url,user.name||user.username);
 $("profileFollow").onclick=async()=>{
  const desired=!isFollowing,previousCount=followerCount;
  isFollowing=desired;followerCount=Math.max(0,followerCount+(desired?1:-1));
  $("profileFollow").textContent=desired?t("unfollow"):t("follow");
  $("followersCount").textContent=followerCount.toLocaleString();
  try{
   await enqueueSync("follow.set",{username:user.username,following:desired});
   if(navigator.onLine)setTimeout(()=>flushSyncQueue(),0);
  }catch(e){
   isFollowing=!desired;followerCount=previousCount;
   $("profileFollow").textContent=isFollowing?t("unfollow"):t("follow");
   $("followersCount").textContent=followerCount.toLocaleString();toast(e.message);
  }
 };
 renderPosts($("profilePosts"),data.posts||[]);
}
async function openProfile(username){
 if(!username)return;
 profileUsername=username;currentView="profile";activate("profile");
 const cacheId="profile:"+String(username).toLowerCase();
 let cached=null;
 try{cached=await get("cache",cacheId)}catch{}
 if(cached?.data){renderProfileData(cached.data)}
 else $("profilePosts").innerHTML='<div class="skeleton-card"></div>';
 if(!navigator.onLine){
  if(!cached?.data)$("profilePosts").textContent=t("offline");
  return;
 }
 if(cached?.savedAt&&Date.now()-cached.savedAt<120000)return;
 try{
  const data=await api("/api/profile/"+encodeURIComponent(username));
  await put("cache",{key:cacheId,data,savedAt:Date.now()});
  renderProfileData(data);
 }catch(e){
  if(!cached?.data)$("profilePosts").textContent=e.message;
  else toast(e.message);
 }
}
async function loadNotifications(){
 currentView="notifications";activate("notifications");const list=$("notificationList");list.innerHTML='<div class="skeleton-card"></div>';
 try{
  const data=await api("/api/notifications");list.replaceChildren();
  if(!data.notifications?.length){list.textContent=t("noNotifications");$("unreadBadge").hidden=true;return}
  data.notifications.forEach(n=>{const row=document.createElement("article");row.className="notification-item"+(!n.read_at?" unread":"");const avatar=document.createElement("span");avatar.className="avatar avatar-small";avatar.textContent=initial(n.actor?.display_name||n.actor?.username);const content=document.createElement("div");const p=document.createElement("p");p.textContent=n.body;const meta=document.createElement("small");meta.textContent=(n.actor?.username?"@"+n.actor.username+" · ":"")+age(n.created_at);content.append(p,meta);row.append(avatar,content);if(!n.read_at){const mark=document.createElement("button");mark.className="subtle-btn";mark.textContent="✓";mark.onclick=async()=>{await api("/api/notifications/read",{method:"POST",body:{id:n.id}});row.remove();refreshUnread()};row.append(mark)}list.append(row)});
  $("unreadBadge").hidden=!data.unread;$("unreadBadge").textContent=data.unread||0;
 }catch(e){list.textContent=e.message}
}
async function refreshUnread(){try{const d=await api("/api/notifications");$("unreadBadge").hidden=!d.unread;$("unreadBadge").textContent=d.unread||0}catch{}}
async function go(view){if(view==="profile"){await openProfile(me?.username);return}if(view==="notifications"){await loadNotifications();return}await openFeed(view,false)}
async function compressImage(file){
 if(!file.type.startsWith("image/")||file.size>20*1024*1024)throw new Error(t("photoTooLarge"));
 const bitmap=await createImageBitmap(file),scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");
 canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 canvas.getContext("2d",{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 const blob=await new Promise(r=>canvas.toBlob(r,"image/webp",.82));if(!blob)throw new Error(t("photoTooLarge"));
 return new File([blob],file.name.replace(/\.[^.]+$/,"")+".webp",{type:"image/webp"});
}
async function uploadSelectedFiles(){
 const form=new FormData();for(const f of selectedFiles)form.append("files",await compressImage(f));
 const data=await api("/api/media",{method:"POST",body:form});return data.media||[];
}
async function publishPost(){
 const body=$("postBody").value.trim();if(!body&&!selectedFiles.length){toast("Добавь текст или фото.");return}
 const btn=$("publishPost");btn.disabled=true;btn.textContent=t("uploading");
 try{
  const localFiles=selectedFiles.length?await Promise.all(selectedFiles.map(compressImage)):[];
  const title=body.split("\n")[0].slice(0,120)||"Фото";
  const opId=await enqueueSync("post.create",{body,title,topic:"Global",media:[],localFiles});
  const localPost={id:"local-"+opId,title,topic:"Global",body:body||"Фото",username:me.username,author:me.name||me.username,
    createdAt:new Date().toISOString(),media:[],likes:0,liked:false,saved:false,syncStatus:"pending"};
  pendingPosts.unshift(localPost);feeds.home.items.unshift(localPost);if(feeds.home.items.length>60)feeds.home.items.length=60;
  renderPosts($("feedList"),feeds.home.items);await saveFeedCache("home");
  $("postBody").value="";$("mediaPreview").replaceChildren();selectedFiles=[];$("mediaInput").value="";$("postCharCount").textContent="0 / 4000";$("composePanel").hidden=true;
  toast(navigator.onLine?"Публикация поставлена в очередь отправки.":"Публикация сохранена на устройстве и отправится при подключении.");
  if(navigator.onLine)flushSyncQueue();
 }catch(e){toast(e.message)}
 finally{btn.disabled=false;btn.textContent=t("publish")}
}
async function saveFeedCache(view){
 await put("cache",{key:cacheKey(view),data:{posts:feeds[view].items,nextCursor:feeds[view].cursor,hasMore:feeds[view].hasMore},savedAt:Date.now()});
}
async function enqueueSync(type,payload){
 const id=crypto.randomUUID();
 await put("outbox",{id,type,payload,createdAt:new Date().toISOString(),attempts:0,nextAttemptAt:0,status:"pending",lastError:null});
 if(navigator.onLine)setTimeout(()=>flushSyncQueue(),0);
 return id;
}
function updateLocalPostStatus(operationId,status,error){
 const id="local-"+operationId;
 for(const post of pendingPosts)if(post.id===id){post.syncStatus=status;post.syncError=error||null}
 for(const post of feeds.home.items)if(post.id===id){post.syncStatus=status;post.syncError=error||null}
 if(currentView==="home")renderPosts($("feedList"),feeds.home.items);
 saveFeedCache("home").catch(()=>{});
}
async function reconcileLocalComment(operationId,serverComment){
 const localId="local-"+operationId;
 const localObject=localCommentObjects.get(localId);
 if(localObject){Object.assign(localObject,serverComment);localObject.syncStatus="synced";localObject.syncError=null;localCommentObjects.delete(localId)}
 const cached=await get("cache",commentsCacheKey(serverComment.postId));
 if(cached?.data&&Array.isArray(cached.data.comments)){
  const visit=(items)=>{
   for(let i=0;i<items.length;i++){
    const item=items[i];
    if(item.id===localId){
     items[i]={...serverComment,replies:Array.isArray(item.replies)?item.replies:[],repliesCount:item.repliesCount||0};
     return true;
    }
    if(Array.isArray(item.replies)&&visit(item.replies))return true;
   }
   return false;
  };
  const found=visit(cached.data.comments);
  if(!found&&!serverComment.parentId)cached.data.comments.push(serverComment);
  await saveCommentsCache(serverComment.postId,cached.data.comments.slice(-60));
 }
 document.querySelectorAll(".comment-item").forEach(node=>{
  if(node.dataset.commentId!==localId)return;
  node.dataset.commentId=String(serverComment.id);
  const replyInput=node.querySelector(".reply-form input");
  const replyButton=node.querySelector(".reply-form button");
  if(replyInput){replyInput.disabled=false;replyInput.placeholder=t("reply")+"…"}
  if(replyButton)replyButton.disabled=false;
  const status=node.querySelector(".comment-sync-status");
  if(status)status.remove();
 });
}
async function setLocalCommentSyncStatus(operationId,status,error){
 const localId="local-"+operationId;
 const outboxItem=(await get("outbox",operationId));
 const postId=outboxItem?.payload?.postId;
 if(postId){
  const cached=await get("cache",commentsCacheKey(postId));
  if(cached?.data?.comments){
   const visit=(items)=>{
    for(const item of items){
     if(item.id===localId){item.syncStatus=status;item.syncError=error||null;return true}
     if(Array.isArray(item.replies)&&visit(item.replies))return true;
    }
    return false;
   };
   visit(cached.data.comments);
   await saveCommentsCache(postId,cached.data.comments);
  }
 }
 document.querySelectorAll(".comment-item").forEach(node=>{
  if(node.dataset.commentId!==localId)return;
  let badge=node.querySelector(".comment-sync-status");
  if(!badge){badge=document.createElement("small");badge.className="comment-sync-status";node.append(badge)}
  badge.textContent=status==="failed"?"Не удалось синхронизировать: "+(error||"ошибка"):"Ожидает синхронизации";
  let retry=node.querySelector(".comment-retry");
  if(status==="failed"){
   if(!retry){retry=document.createElement("button");retry.type="button";retry.className="reply-toggle comment-retry";retry.textContent="Повторить";retry.onclick=()=>retrySyncOperation(operationId);node.append(retry)}
  }else if(retry)retry.remove();
 });
}
async function applySyncedOperation(type,payload,result,operationId){
 if(type==="post.create"&&result?.post){
  pendingPosts=pendingPosts.filter(p=>p.id!=="local-"+operationId);
  feeds.home.items=feeds.home.items.filter(p=>p.id!=="local-"+operationId);
  if(!feeds.home.items.some(p=>p.id===result.post.id))feeds.home.items.unshift(result.post);
  feeds.home.items=feeds.home.items.slice(0,60);
  if(currentView==="home")renderPosts($("feedList"),feeds.home.items);
  await saveFeedCache("home");
 }
 if(type==="comment.create"&&result?.comment){
  await reconcileLocalComment(operationId,result.comment);
 }
 if(type==="like.set"&&result){
  for(const feed of Object.values(feeds))for(const post of feed.items)if(post.id===result.postId){post.liked=result.liked;post.likes=result.likes}
  if(["home","following","popular"].includes(currentView))renderPosts($("feedList"),feeds[currentView].items);
 }
 if(type==="follow.set"&&result){
  for(const feed of Object.values(feeds))for(const post of feed.items)if(post.username===result.username)post.isFollowing=result.following;
  if(["home","following","popular"].includes(currentView))renderPosts($("feedList"),feeds[currentView].items);
 }
 if(type==="profile.update"&&result?.user){
  me=result.user;auth.profile=me;await put("kv",{id:"auth",...auth});
  $("sidebarName").textContent=me.name||me.username;
  setAvatarNode($("sidebarAvatar"),me.avatar_url,me.name||me.username);
 }
}
async function markRetry(item,error){
 const attempts=(Number(item.attempts)||0)+1;
 const delay=Math.min(60*60*1000,1000*Math.pow(2,Math.min(attempts,10)));
 const updated={...item,attempts,nextAttemptAt:Date.now()+delay,status:"retry",lastError:String(error||"Sync failed").slice(0,300)};
 await put("outbox",updated);
 if(item.type==="post.create")updateLocalPostStatus(item.id,"retry",updated.lastError);
 if(item.type==="comment.create")await setLocalCommentSyncStatus(item.id,"retry",updated.lastError);
 if(syncRetryTimer)clearTimeout(syncRetryTimer);
 syncRetryTimer=setTimeout(()=>{if(navigator.onLine)flushSyncQueue()},delay+100);
}
async function retrySyncOperation(operationId){
 const item=await get("outbox",operationId);
 if(!item)return;
 await put("outbox",{...item,status:"pending",attempts:0,nextAttemptAt:0,lastError:null});
 if(item.type==="post.create")updateLocalPostStatus(operationId,"pending",null);
 if(item.type==="comment.create")await setLocalCommentSyncStatus(operationId,"pending",null);
 if(navigator.onLine)flushSyncQueue();
}
async function flushSyncQueue(){
 if(outboxBusy){outboxRequested=true;return}
 if(!auth?.token||!navigator.onLine)return;
 outboxBusy=true;outboxRequested=false;
 try{
  let items=(await getAll("outbox")).filter(x=>x.status!=="failed"&&Number(x.nextAttemptAt||0)<=Date.now())
   .sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).slice(0,20);
  if(!items.length)return;
  const ready=[];
  for(const item of items){
   try{
    if(item.type==="post.create"&&Array.isArray(item.payload.localFiles)&&item.payload.localFiles.length){
     const form=new FormData();
     for(const file of item.payload.localFiles)form.append("files",file,file.name||"photo.webp");
     const uploaded=await api("/api/media",{method:"POST",body:form});
     item.payload={...item.payload,media:uploaded.media||[]};
     delete item.payload.localFiles;
     await put("outbox",item);
    }
    ready.push(item);
   }catch(error){await markRetry(item,error.message)}
  }
  if(!ready.length)return;
  const response=await api("/api/sync/batch",{method:"POST",body:{version:1,operations:ready.map(x=>({id:x.id,type:x.type,payload:x.payload}))}});
  const map=new Map((response.results||[]).map(x=>[x.id,x]));
  for(const item of ready){
   const outcome=map.get(item.id);
   if(outcome?.status==="synced"){
    await del("outbox",item.id);
    await applySyncedOperation(item.type,item.payload,outcome.result,item.id);
    if(item.type==="post.create")toast("Публикация синхронизирована.");
   }else if(outcome?.status==="failed"){
    const failed={...item,status:"failed",lastError:outcome.error||"Operation rejected"};
    await put("outbox",failed);
    if(item.type==="post.create")updateLocalPostStatus(item.id,"failed",failed.lastError);
    if(item.type==="comment.create")await setLocalCommentSyncStatus(item.id,"failed",failed.lastError);
    if(item.type==="like.set"){
     for(const feed of Object.values(feeds))for(const post of feed.items)if(post.id===item.payload.postId){
      post.liked=!item.payload.liked;post.likes=Math.max(0,Number(post.likes||0)+(item.payload.liked?-1:1));
     }
     if(["home","following","popular"].includes(currentView))renderPosts($("feedList"),feeds[currentView].items);
    }
    if(item.type==="follow.set"){
     for(const feed of Object.values(feeds))for(const post of feed.items)if(post.username===item.payload.username)post.isFollowing=!item.payload.following;
     if(["home","following","popular"].includes(currentView))renderPosts($("feedList"),feeds[currentView].items);
    }
    if(item.type==="profile.update"){
     try{const actual=await api("/api/guest/me");me=actual.user;auth.profile=me;await put("kv",{id:"auth",...auth});
      $("sidebarName").textContent=me.name||me.username;$("profileDisplayName").textContent=me.name||me.username;$("profileBio").textContent=me.bio||"";
     }catch{}
    }
    toast(failed.lastError);
   }else await markRetry(item,outcome?.error||"Операция не подтверждена сервером.");
  }
 }catch(error){
  const pending=(await getAll("outbox")).filter(x=>x.status!=="failed").slice(0,20);
  for(const item of pending)await markRetry(item,error.message);
 }finally{
  outboxBusy=false;
  if(outboxRequested&&navigator.onLine){outboxRequested=false;setTimeout(()=>flushSyncQueue(),0)}
  else if(navigator.onLine){getAll("outbox").then(items=>{if(items.some(x=>x.status!=="failed"&&Number(x.nextAttemptAt||0)<=Date.now()))setTimeout(()=>flushSyncQueue(),0)}).catch(()=>{})}
 }
}
async function changeAvatar(file){
 if(!file)return;if(!navigator.onLine){toast("Аватар можно изменить после восстановления подключения.");return}
 try{
  const image=await compressImage(file),form=new FormData();form.append("files",image,image.name);
  const uploaded=await api("/api/media",{method:"POST",body:form}),item=uploaded.media?.[0];
  if(!item?.url)throw new Error("Не удалось загрузить аватар.");
  const updated=await api("/api/profile",{method:"PUT",body:{name:me?.name||me?.username,bio:me?.bio||"",avatarUrl:item.url}});
  me=updated.user;await put("kv",{id:"auth",...auth});
  setAvatarNode($("profileAvatar"),item.url,me.name||me.username);
  setAvatarNode($("sidebarAvatar"),item.url,me.name||me.username);
  setAvatarNode($("rightAvatar"),item.url,me.name||me.username);
  setAvatarNode($("composerAvatar"),item.url,me.name||me.username);
  toast(t("profileUpdated"));
 }catch(e){toast(e.message)}
}
async function editProfile(){
 const name=prompt(t("displayName"),me?.name||me?.username||"");if(name===null)return;
 const bio=prompt(t("bioLabel"),me?.bio||"");if(bio===null)return;
 try{
  const previousName=me?.name||me?.username||"";
  const previousBio=me?.bio||"";
  const local={...me,name,bio};me=local;auth.profile=me;await put("kv",{id:"auth",...auth});
  $("sidebarName").textContent=me.name||me.username;
  $("profileDisplayName").textContent=me.name||me.username;
  $("profileBio").textContent=me.bio||"";
  const profileCache=await get("cache","profile:"+String(me.username).toLowerCase());
  if(profileCache?.data){profileCache.data.user={...profileCache.data.user,name:me.name,bio:me.bio};profileCache.savedAt=Date.now();await put("cache",profileCache)}
  await enqueueSync("profile.update",{name,bio,previousName,previousBio});
  toast(navigator.onLine?t("profileUpdated"):"Профиль сохранён на устройстве и ожидает синхронизации.");
 }catch(e){toast(e.message)}
}
async function downloadBackupAgain(){
 const saved=await get("kv","recoveryBundle");if(saved?.bundle){downloadBundle(saved.bundle);showToast(t("backupWarning"));return}
 toast("Сохрани исходный файл восстановления и секретный код.");
}
function showToast(s){toast(s)}
function bind(){
 $("registerForm").addEventListener("submit",register);$("recoveryForm").addEventListener("submit",restore);
 $("toggleRecovery").onclick=()=>$("recoveryForm").hidden=!$("recoveryForm").hidden;
 $("backupConfirmed").onchange=e=>$("finishRegistration").disabled=!e.target.checked;
 $("downloadBackup").onclick=()=>downloadBundle(pendingBackup);
 $("copySecret").onclick=()=>navigator.clipboard.writeText(pendingCode||"").then(()=>toast(t("copy"))).catch(()=>toast(t("copy")));
 $("finishRegistration").onclick=async()=>{if(!$("backupConfirmed").checked)return;$("backupModal").hidden=true;await showApp();authMessage("")};
 $("languageSelect").onchange=e=>{lang=e.target.value;applyLanguage()};$("settingsLanguage").onchange=e=>{lang=e.target.value;applyLanguage()};
 $("settingsBtn").onclick=()=>$("settingsModal").hidden=false;
 $("downloadBackupAgain").onclick=downloadBackupAgain;
 $("logoutBtn").onclick=async()=>{if(!confirm(t("logoutWarning")))return;await del("kv","auth");auth=null;me=null;$("settingsModal").hidden=true;$("appShell").hidden=true;$("authScreen").hidden=false;toast(t("logout"))};
 document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$((b.dataset.close)).hidden=true);
 document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>go(b.dataset.view));
 $("sidebarProfile").onclick=()=>openProfile(me?.username);$("rightProfile").onclick=()=>openProfile(me?.username);
 $("composerTrigger").onclick=()=>{$("composePanel").hidden=false;$("postBody").focus()};
 $("openComposer").onclick=()=>{$("composePanel").hidden=false;$("postBody").focus()};
 $("closeComposer").onclick=()=>$("composePanel").hidden=true;
 $("postBody").oninput=()=>$("postCharCount").textContent=$("postBody").value.length+" / 4000";
 $("mediaInput").onchange=e=>{
  const items=[...e.target.files||[]];if(selectedFiles.length+items.length>4){toast(t("photoLimit"));return}
  selectedFiles.push(...items);renderMediaPreview();
 };
 $("publishPost").onclick=publishPost;$("loadMore").onclick=()=>fetchFeed(currentView,true);
 $("refreshBtn").onclick=()=>currentView==="profile"?openProfile(profileUsername):currentView==="notifications"?loadNotifications():fetchFeed(currentView,false);
 $("refreshFeed").onclick=()=>fetchFeed(currentView,false);$("backToFeed").onclick=()=>openFeed("home",true);
 $("readAll").onclick=async()=>{try{await api("/api/notifications/read",{method:"POST",body:{}});await loadNotifications()}catch(e){toast(e.message)}};
 $("profileEdit").onclick=editProfile;$("avatarInput").onchange=e=>{const file=e.target.files?.[0];if(file)changeAvatar(file);e.target.value="";};
}
function renderMediaPreview(){
 const root=$("mediaPreview");root.replaceChildren();
 selectedFiles.forEach((file,index)=>{const box=document.createElement("div");box.className="media-thumb";const img=document.createElement("img");img.src=URL.createObjectURL(file);const remove=document.createElement("button");remove.type="button";remove.textContent="×";remove.onclick=()=>{selectedFiles.splice(index,1);renderMediaPreview()};box.append(img,remove);root.append(box)});
}
async function init(){
 bind();await bootstrap();
 if("serviceWorker" in navigator){try{await navigator.serviceWorker.register("/sw.js")}catch(e){console.warn(e)}}
 window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("installBtn").hidden=false});
 $("installBtn").onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installBtn").hidden=true};
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&auth?.token){flushSyncQueue();if(Date.now()-lastFeedRefresh>10*60*1000&&["home","following","popular"].includes(currentView))fetchFeed(currentView,false)}});
 window.addEventListener("online",()=>{if(auth?.token){flushSyncQueue();if(["home","following","popular"].includes(currentView))fetchFeed(currentView,false)}});
}
init().catch(e=>{console.error("ORBIS init",e);authMessage(e.message||"ORBIS startup error")});
})();