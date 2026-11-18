"use client";

import Image from "next/image";
import {useState,type FormEvent} from "react";
import {
  BookOpen, CalendarDays, CloudSun, Coins, ExternalLink, Film, Image as ImageIcon,
  LoaderCircle, MapPin, Newspaper, Orbit, Search, Sparkles, Trophy
} from "lucide-react";

type AnyRecord=Record<string,unknown>;
type ResultItem={title:string;url:string;description?:string;image?:string;meta?:string};

async function getJson(path:string):Promise<AnyRecord>{
  const response=await fetch(path,{cache:"no-store"});
  const value:unknown=await response.json().catch(()=>({}));
  if(!response.ok){
    const message=typeof value==="object"&&value!==null&&"error" in value
      ?String((value as {error:unknown}).error):"Интеграция временно недоступна.";
    throw new Error(message);
  }
  if(typeof value!=="object"||value===null)throw new Error("Сервер вернул некорректный ответ.");
  return value as AnyRecord;
}
function text(value:unknown,fallback="—"):string{
  return typeof value==="string"&&value.trim()?value:fallback;
}
function rows(value:unknown):AnyRecord[]{
  return Array.isArray(value)?value.filter((x):x is AnyRecord=>typeof x==="object"&&x!==null):[];
}
function formatNumber(value:unknown):string{
  return typeof value==="number"&&Number.isFinite(value)?new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(value):"—";
}

const sports=[
  {value:"Soccer",label:"Футбол"},
  {value:"Basketball",label:"Баскетбол"},
  {value:"Ice Hockey",label:"Хоккей"},
  {value:"Tennis",label:"Теннис"},
  {value:"Cricket",label:"Крикет"}
];

export function ExploreView(){
  const [active,setActive]=useState("weather");
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const [lat,setLat]=useState("40.4093");
  const [lon,setLon]=useState("49.8671");
  const [weather,setWeather]=useState<AnyRecord|null>(null);

  const [amount,setAmount]=useState("1");
  const [base,setBase]=useState("USD");
  const [quote,setQuote]=useState("EUR");
  const [currency,setCurrency]=useState<AnyRecord|null>(null);

  const [sport,setSport]=useState("Soccer");
  const [sportDate,setSportDate]=useState(new Date().toISOString().slice(0,10));
  const [sportsData,setSportsData]=useState<AnyRecord|null>(null);

  const [search,setSearch]=useState("");
  const [wiki,setWiki]=useState<AnyRecord|null>(null);
  const [books,setBooks]=useState<AnyRecord|null>(null);
  const [googleBooks,setGoogleBooks]=useState<AnyRecord|null>(null);
  const [images,setImages]=useState<AnyRecord|null>(null);
  const [nasa,setNasa]=useState<AnyRecord|null>(null);
  const [gifs,setGifs]=useState<AnyRecord[]>([]);

  async function run(name:string,action:()=>Promise<void>){
    setBusy(name);setError("");setNotice("");
    try{await action();}
    catch(e){setError(e instanceof Error?e.message:"Не удалось выполнить запрос.");}
    finally{setBusy("");}
  }
  function locate(){
    setError("");setNotice("");
    if(!navigator.geolocation){setError("Браузер не поддерживает геолокацию.");return;}
    setBusy("locate");
    navigator.geolocation.getCurrentPosition(position=>{
      setLat(position.coords.latitude.toFixed(4));
      setLon(position.coords.longitude.toFixed(4));
      setNotice("Координаты получены. Нажми «Обновить погоду».");
      setBusy("");
    },()=>{
      setError("Не удалось получить местоположение. Можно оставить координаты Баку или ввести свои.");
      setBusy("");
    },{enableHighAccuracy:false,timeout:9000,maximumAge:300000});
  }
  function loadWeather(){
    return run("weather",async()=>{
      const result=await getJson("/api/integrations/weather?lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lon));
      setWeather(result);
    });
  }
  function loadCurrency(){
    return run("currency",async()=>{
      const result=await getJson("/api/integrations/currency?base="+base+"&quote="+quote+"&amount="+encodeURIComponent(amount));
      setCurrency(result);
    });
  }
  function loadSports(){
    return run("sports",async()=>{
      const result=await getJson("/api/integrations/sports?view=day&date="+sportDate+"&sport="+encodeURIComponent(sport));
      setSportsData(result);
    });
  }
  function searchEverything(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const q=search.trim();
    if(q.length<2){setError("Введи минимум два символа для поиска.");return;}
    void run("search",async()=>{
      const [wikiResult,openLibraryResult,googleResult,commonsResult]=await Promise.all([
        getJson("/api/integrations/wiki?q="+encodeURIComponent(q)+"&lang=ru"),
        getJson("/api/integrations/books?q="+encodeURIComponent(q)),
        getJson("/api/integrations/google-books?q="+encodeURIComponent(q)),
        getJson("/api/integrations/commons?q="+encodeURIComponent(q))
      ]);
      setWiki(wikiResult);
      setBooks(openLibraryResult);
      setGoogleBooks(googleResult);
      setImages(commonsResult);
    });
  }
  function loadNasa(){
    return run("nasa",async()=>{
      const result=await getJson("/api/integrations/nasa");
      setNasa(result);
    });
  }
  async function searchGiphy(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const q=search.trim();
    const key=process.env.NEXT_PUBLIC_GIPHY_API_KEY||"";
    if(!key){setError("Для GIPHY нужен бесплатный API key из кабинета разработчика. Остальные интеграции доступны без него.");return;}
    if(q.length<2){setError("Введи тему для поиска GIF.");return;}
    await run("giphy",async()=>{
      const url=new URL("https://api.giphy.com/v1/gifs/search");
      url.searchParams.set("api_key",key);
      url.searchParams.set("q",q);
      url.searchParams.set("limit","12");
      url.searchParams.set("rating","pg");
      const response=await fetch(url);
      const data:unknown=await response.json();
      if(!response.ok||typeof data!=="object"||data===null)throw new Error("GIPHY временно недоступен.");
      setGifs(rows((data as AnyRecord).data));
    });
  }

  const tabs=[
    {id:"weather",label:"Погода",icon:CloudSun},
    {id:"currency",label:"Валюты",icon:Coins},
    {id:"sports",label:"Спорт",icon:Trophy},
    {id:"discover",label:"Поиск",icon:Search},
    {id:"space",label:"Космос",icon:Orbit},
    {id:"gifs",label:"GIF",icon:Film}
  ];
  const forecast=rows(weather?.forecast);
  const events=rows(sportsData?.data&&typeof sportsData.data==="object"?(sportsData.data as AnyRecord).events:[]);
  const wikiResults=rows(wiki?.results);
  const bookResults=rows(books?.results);
  const googleResults=rows(googleBooks?.results);
  const imageResults=rows(images?.results);

  return <div className="explore-page">
    <section className="explore-intro">
      <div className="explore-intro-orbit"><Orbit size={38}/></div>
      <div className="explore-kicker"><Sparkles size={15}/> ORBIS DISCOVER</div>
      <h2>Открывай мир за пределами ленты.</h2>
      <p>Погода, курсы, спорт, книги, знания, космос и изображения — в одном пространстве.</p>
      <div className="explore-provider-strip">
        <span>9 интеграций без собственного платного API</span>
        <span><i/> Серверные ключи не раскрываются</span>
      </div>
    </section>

    <div className="explore-tabs" role="tablist" aria-label="Инструменты обзора">
      {tabs.map(tab=>{
        const Icon=tab.icon;
        return <button key={tab.id} type="button" role="tab" aria-selected={active===tab.id}
          className={active===tab.id?"explore-tab active":"explore-tab"}
          onClick={()=>{setActive(tab.id);setError("");setNotice("");}}>
          <Icon size={16}/>{tab.label}
        </button>;
      })}
    </div>

    {(error||notice)&&<div className={error?"explore-alert error":"explore-alert success"} role={error?"alert":"status"}>{error||notice}</div>}

    {active==="weather"&&<section className="explore-card">
      <div className="explore-card-heading"><div className="explore-heading-icon"><CloudSun size={20}/></div>
        <div><span>MET NORWAY</span><h3>Погода по всему миру</h3></div></div>
      <p className="explore-muted">Официальный прогноз погоды. Можно использовать координаты своего устройства.</p>
      <div className="explore-fields">
        <label>Широта<input value={lat} onChange={e=>setLat(e.target.value)} inputMode="decimal"/></label>
        <label>Долгота<input value={lon} onChange={e=>setLon(e.target.value)} inputMode="decimal"/></label>
        <button type="button" className="explore-secondary" onClick={locate} disabled={busy==="locate"}>
          {busy==="locate"?<LoaderCircle size={15} className="spin"/>:<MapPin size={15}/>} Моё местоположение
        </button>
      </div>
      <button type="button" className="explore-primary" onClick={()=>void loadWeather()} disabled={busy==="weather"}>
        {busy==="weather"?<LoaderCircle size={16} className="spin"/>:<CloudSun size={16}/>} Обновить погоду
      </button>
      {weather&&<div className="weather-result">
        <div className="weather-main"><div><span>ТЕКУЩАЯ ТЕМПЕРАТУРА</span><strong>{formatNumber((weather.current as AnyRecord|null)?.temperatureC)}°C</strong></div>
          <div><span>ВЕТЕР</span><strong>{formatNumber((weather.current as AnyRecord|null)?.windMps)} м/с</strong></div>
          <div><span>ВЛАЖНОСТЬ</span><strong>{formatNumber((weather.current as AnyRecord|null)?.humidityPercent)}%</strong></div></div>
        <div className="weather-hours">{forecast.map((item,i)=><div key={String(item.time||i)}>
          <span>{new Date(String(item.time||"")).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</span>
          <strong>{formatNumber(item.temperatureC)}°</strong>
          <small>{formatNumber(item.windMps)} м/с</small>
        </div>)}</div>
        <a className="explore-source" href="https://api.met.no/weatherapi/locationforecast/2.0/documentation" target="_blank" rel="noreferrer">Источник: MET Norway <ExternalLink size={13}/></a>
      </div>}
    </section>}

    {active==="currency"&&<section className="explore-card">
      <div className="explore-card-heading"><div className="explore-heading-icon"><Coins size={20}/></div>
        <div><span>FRANKFURTER</span><h3>Конвертер валют</h3></div></div>
      <p className="explore-muted">Справочные курсы центральных банков. Это не биржевые котировки в реальном времени.</p>
      <div className="explore-fields currency-fields">
        <label>Сумма<input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal"/></label>
        <label>Из<select value={base} onChange={e=>setBase(e.target.value)}>
          {["USD","EUR","GBP","TRY","CHF","JPY","CAD","AUD","AZN"].map(x=><option key={x}>{x}</option>)}
        </select></label>
        <label>В<select value={quote} onChange={e=>setQuote(e.target.value)}>
          {["EUR","USD","GBP","TRY","CHF","JPY","CAD","AUD","AZN"].map(x=><option key={x}>{x}</option>)}
        </select></label>
      </div>
      <button type="button" className="explore-primary" onClick={()=>void loadCurrency()} disabled={busy==="currency"}>
        {busy==="currency"?<LoaderCircle size={16} className="spin"/>:<Coins size={16}/>} Рассчитать
      </button>
      {currency&&<div className="currency-result">
        <span>{formatNumber(currency.amount)} {text(currency.base)} =</span>
        <strong>{formatNumber(currency.converted)} {text(currency.quote)}</strong>
        <small>1 {text(currency.base)} = {formatNumber(currency.rate)} {text(currency.quote)} · {text(currency.date)}</small>
        {typeof currency.note==="string"&&<p>{currency.note}</p>}
        <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Источник: Frankfurter <ExternalLink size={13}/></a>
      </div>}
    </section>}

    {active==="sports"&&<section className="explore-card">
      <div className="explore-card-heading"><div className="explore-heading-icon"><Trophy size={20}/></div>
        <div><span>THESPORTSDB</span><h3>Спортивные события</h3></div></div>
      <p className="explore-muted">Расписание и справочная информация о командах и лигах. Бесплатная версия ограничена по частоте запросов.</p>
      <div className="explore-fields">
        <label>Вид спорта<select value={sport} onChange={e=>setSport(e.target.value)}>{sports.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
        <label>Дата<input type="date" value={sportDate} onChange={e=>setSportDate(e.target.value)}/></label>
      </div>
      <button type="button" className="explore-primary" onClick={()=>void loadSports()} disabled={busy==="sports"}>
        {busy==="sports"?<LoaderCircle size={16} className="spin"/>:<CalendarDays size={16}/>} Найти события
      </button>
      {sportsData&&<div className="sports-result">
        {events.length===0&&<p className="explore-muted">На эту дату события не найдены. Попробуй другую дату или вид спорта.</p>}
        {events.map((event,i)=><article className="sports-event" key={String(event.idEvent||i)}>
          <div><strong>{text(event.strEvent,"Спортивное событие")}</strong>
            <span>{text(event.strLeague)} · {text(event.dateEvent,sportDate)} {text(event.strTime,"")}</span></div>
          <div className="sports-score">{text(event.intHomeScore,"—")} : {text(event.intAwayScore,"—")}</div>
        </article>)}
        <a className="explore-source" href="https://www.thesportsdb.com/API.php" target="_blank" rel="noreferrer">Источник: TheSportsDB <ExternalLink size={13}/></a>
      </div>}
    </section>}

    {active==="discover"&&<section className="explore-card">
      <div className="explore-card-heading"><div className="explore-heading-icon"><Search size={20}/></div>
        <div><span>WIKIPEDIA · OPEN LIBRARY · GOOGLE BOOKS · WIKIMEDIA</span><h3>Единый поиск</h3></div></div>
      <p className="explore-muted">Ищи энциклопедические статьи, книги и изображения с указанием авторства и лицензий.</p>
      <form className="explore-search-form" onSubmit={searchEverything}>
        <Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Например, история Баку, экономика, космос…"/>
        <button type="submit" disabled={busy==="search"}>{busy==="search"?<LoaderCircle size={15} className="spin"/>:"Искать"}</button>
      </form>
      {wiki&&<ResultGroup title="Wikipedia" icon={<Newspaper size={16}/>} items={wikiResults.map(x=>({
        title:text(x.title),url:text(x.url,"#"),description:text(x.snippet,"")
      }))}/>}
      {books&&<ResultGroup title="Open Library" icon={<BookOpen size={16}/>} items={bookResults.map(x=>({
        title:text(x.title),url:text(x.url,"#"),description:text(x.authors,"").replace(/,/g," · ")
      }))}/>}
      {googleBooks&&<ResultGroup title="Google Books" icon={<BookOpen size={16}/>} items={googleResults.map(x=>({
        title:text(x.title),url:text(x.pageUrl,"#"),description:text(x.authors,"").replace(/,/g," · "),
        image:typeof x.coverUrl==="string"?x.coverUrl:undefined
      }))}/>}
      {images&&<ResultGroup title="Wikimedia Commons" icon={<ImageIcon size={16}/>} items={imageResults.map(x=>({
        title:text(x.title),url:text(x.pageUrl,"#"),
        description:[text(x.artist,"Автор не указан"),text(x.license,"Лицензия не указана")].join(" · "),
        image:typeof x.imageUrl==="string"?x.imageUrl:undefined
      }))}/>}
      {(wiki||books||googleBooks||images)&&<p className="explore-license-note">Перед повторным использованием изображений проверяй условия лицензии на странице оригинала.</p>}
    </section>}

    {active==="space"&&<section className="explore-card">
      <div className="explore-card-heading"><div className="explore-heading-icon"><Orbit size={20}/></div>
        <div><span>NASA APOD</span><h3>Космическое фото дня</h3></div></div>
      <p className="explore-muted">Ежедневный материал NASA о космосе. Общий демонстрационный ключ имеет ограничение запросов.</p>
      <button type="button" className="explore-primary" onClick={()=>void loadNasa()} disabled={busy==="nasa"}>
        {busy==="nasa"?<LoaderCircle size={16} className="spin"/>:<Sparkles size={16}/>} Показать материал дня
      </button>
      {nasa&&<div className="nasa-result">
        <div className="nasa-meta">{text(nasa.date)} · {text(nasa.copyright,"NASA")}</div>
        <h3>{text(nasa.title)}</h3>
        {typeof nasa.imageUrl==="string"&&nasa.mediaType!=="video"&&
          <a href={String(nasa.imageUrl)} target="_blank" rel="noreferrer" className="nasa-image">
            <Image src={String(nasa.imageUrl)} alt={text(nasa.title)} width={900} height={600} unoptimized/>
          </a>}
        <p>{text(nasa.explanation)}</p>
        <a className="explore-source" href={text(nasa.pageUrl,"https://apod.nasa.gov/apod/astropix.html")} target="_blank" rel="noreferrer">Оригинал NASA <ExternalLink size={13}/></a>
      </div>}
    </section>}

    {active==="gifs"&&<section className="explore-card">
      <div className="explore-card-heading"><div className="explore-heading-icon"><Film size={20}/></div>
        <div><span>GIPHY</span><h3>GIF и стикеры</h3></div></div>
      <p className="explore-muted">Поиск выполняется напрямую в браузере, как требует документация GIPHY.</p>
      <form className="explore-search-form" onSubmit={searchGiphy}>
        <Film size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск GIF…"/>
        <button type="submit" disabled={busy==="giphy"}>{busy==="giphy"?<LoaderCircle size={15} className="spin"/>:"Найти"}</button>
      </form>
      {!process.env.NEXT_PUBLIC_GIPHY_API_KEY&&<div className="explore-key-needed">
        <strong>Требуется API key GIPHY</strong>
        <p>Ключ ещё не настроен. Получи его в кабинете разработчика и добавь в Vercel как NEXT_PUBLIC_GIPHY_API_KEY для preview-ветки.</p>
        <a href="https://developers.giphy.com/dashboard/" target="_blank" rel="noreferrer">Кабинет GIPHY <ExternalLink size={13}/></a>
      </div>}
      {gifs.length>0&&<div className="giphy-grid">{gifs.map((gif,i)=>{
        const images=gif.images as AnyRecord|undefined;
        const fixed=images?.fixed_width as AnyRecord|undefined;
        const url=text(fixed?.url,"");
        return url?<a key={String(gif.id||i)} href={text(gif.url,"#")} target="_blank" rel="noreferrer">
          <Image src={url} alt={text(gif.title,"GIF")} width={180} height={140} unoptimized/>
        </a>:null;
      })}</div>}
      <div className="giphy-credit">Powered by GIPHY</div>
    </section>}

    <section className="explore-integration-status">
      <h3>Интеграции ORBIS</h3>
      <div className="integration-status-grid">
        {[
          ["Frankfurter","Курсы валют","Без ключа"],
          ["MET Norway","Погода","Без ключа"],
          ["TheSportsDB","Спортивные события","Общий ключ 123"],
          ["Wikipedia","Энциклопедия","Без ключа"],
          ["Open Library","Каталог книг","Без ключа"],
          ["Google Books","Каталог книг","Публичный API"],
          ["Wikimedia Commons","Изображения и лицензии","Без ключа"],
          ["NASA APOD","Космические материалы","DEMO_KEY с лимитом"],
          ["ImgBB","Хранение изображений","Секретный ключ сервера"],
          ["GIPHY","GIF и стикеры","Нужен личный API key"]
        ].map(([name,description,access])=><div className="integration-status-item" key={name}>
          <span className={access.startsWith("Нужен")?"integration-status-dot pending":"integration-status-dot"}/>
          <div><strong>{name}</strong><small>{description}</small></div><em>{access}</em>
        </div>)}
      </div>
    </section>
  </div>;
}

function ResultGroup({title,icon,items}:{title:string;icon:React.ReactNode;items:ResultItem[]}){
  return <section className="explore-result-group">
    <div className="explore-result-heading">{icon}<h4>{title}</h4><span>{items.length}</span></div>
    {items.length===0&&<p className="explore-muted">Ничего не найдено.</p>}
    {items.slice(0,8).map((item,index)=><article className="explore-result-item" key={item.url+index}>
      {item.image&&<a href={item.url} target="_blank" rel="noreferrer" className="explore-result-image">
        <Image src={item.image} alt="" width={72} height={72} unoptimized/>
      </a>}
      <div><a href={item.url} target="_blank" rel="noreferrer"><strong>{item.title}</strong><ExternalLink size={12}/></a>
        {item.description&&<p>{item.description}</p>}</div>
    </article>)}
  </section>;
}
