const SOURCES = {
  "bbc-ru": {name:"BBC News · Русский",url:"https://feeds.bbci.co.uk/russian/rss.xml",category:"world",language:"Русский",credit:"BBC News",hosts:["bbc.com","bbc.co.uk"]},
  "oxu-az": {name:"Oxu.az",url:"https://oxu.az/feed",category:"world",language:"Азербайджанский",credit:"Oxu.az",hosts:["oxu.az"]},
  "bbc-world": {name:"BBC News · Мир",url:"https://feeds.bbci.co.uk/news/world/rss.xml",category:"world",language:"English",credit:"BBC News",hosts:["bbc.com","bbc.co.uk"]},
  "dw-en": {name:"Deutsche Welle",url:"https://rss.dw.com/xml/rss-en-all",category:"world",language:"English",credit:"Deutsche Welle",hosts:["dw.com"]},
  "euronews": {name:"Euronews",url:"https://www.euronews.com/rss",category:"world",language:"English",credit:"Euronews",hosts:["euronews.com"]},
  "aljazeera-en": {name:"Al Jazeera",url:"https://www.aljazeera.com/xml/rss/all.xml",category:"world",language:"English",credit:"Al Jazeera",hosts:["aljazeera.com"]},
  "guardian-world": {name:"The Guardian · Мир",url:"https://www.theguardian.com/world/rss",category:"world",language:"English",credit:"The Guardian",hosts:["theguardian.com"]},
  "france24-en": {name:"France 24",url:"https://www.france24.com/en/rss",category:"world",language:"English",credit:"France 24",hosts:["france24.com"]},
  "npr": {name:"NPR",url:"https://feeds.npr.org/1001/rss.xml",category:"world",language:"English",credit:"NPR",hosts:["npr.org"]},

  "techcrunch": {name:"TechCrunch",url:"https://techcrunch.com/feed/",category:"technology",language:"English",credit:"TechCrunch",hosts:["techcrunch.com"]},
  "the-verge": {name:"The Verge",url:"https://www.theverge.com/rss/index.xml",category:"technology",language:"English",credit:"The Verge",hosts:["theverge.com"]},
  "wired": {name:"WIRED",url:"https://www.wired.com/feed/rss",category:"technology",language:"English",credit:"WIRED",hosts:["wired.com"]},
  "ars-technica": {name:"Ars Technica",url:"https://feeds.arstechnica.com/arstechnica/index",category:"technology",language:"English",credit:"Ars Technica",hosts:["arstechnica.com"]},
  "bbc-tech": {name:"BBC News · Технологии",url:"https://feeds.bbci.co.uk/news/technology/rss.xml",category:"technology",language:"English",credit:"BBC News",hosts:["bbc.com","bbc.co.uk"]},
  "wired-ai": {name:"WIRED · AI",url:"https://www.wired.com/feed/tag/ai/latest/rss",category:"technology",language:"English",credit:"WIRED",hosts:["wired.com"]},
  "wired-business": {name:"WIRED · Бизнес",url:"https://www.wired.com/feed/category/business/latest/rss",category:"technology",language:"English",credit:"WIRED",hosts:["wired.com"]},

  "science-daily": {name:"ScienceDaily",url:"https://www.sciencedaily.com/rss/top/science.xml",category:"science",language:"English",credit:"ScienceDaily",hosts:["sciencedaily.com"]},
  "nasa": {name:"NASA",url:"https://www.nasa.gov/rss/dyn/breaking_news.rss",category:"science",language:"English",credit:"NASA",hosts:["nasa.gov"]},
  "phys-org": {name:"Phys.org",url:"https://phys.org/rss-feed/",category:"science",language:"English",credit:"Phys.org",hosts:["phys.org"]},
  "science-news": {name:"Science News",url:"https://www.sciencenews.org/feed",category:"science",language:"English",credit:"Science News",hosts:["sciencenews.org"]},
  "nature-science": {name:"Nature · Наука",url:"https://www.nature.com/subjects/science.rss",category:"science",language:"English",credit:"Nature",hosts:["nature.com"]},

  "variety-film": {name:"Variety · Кино",url:"https://variety.com/v/film/feed/",category:"movies",language:"English",credit:"Variety",hosts:["variety.com"]},
  "indiewire": {name:"IndieWire",url:"https://www.indiewire.com/feed/",category:"movies",language:"English",credit:"IndieWire",hosts:["indiewire.com"]},
  "deadline": {name:"Deadline",url:"https://deadline.com/feed/atom/",category:"movies",language:"English",credit:"Deadline",hosts:["deadline.com"]},
  "hollywood-reporter": {name:"The Hollywood Reporter",url:"https://www.hollywoodreporter.com/feed/",category:"movies",language:"English",credit:"The Hollywood Reporter",hosts:["hollywoodreporter.com"]},

  "ign": {name:"IGN",url:"https://www.ign.com/rss/v2/articles/feed",category:"gaming",language:"English",credit:"IGN",hosts:["ign.com"]},
  "pc-gamer": {name:"PC Gamer",url:"https://www.pcgamer.com/rss/",category:"gaming",language:"English",credit:"PC Gamer",hosts:["pcgamer.com"]},
  "eurogamer": {name:"Eurogamer",url:"https://www.eurogamer.net/feed",category:"gaming",language:"English",credit:"Eurogamer",hosts:["eurogamer.net"]},
  "gamespot": {name:"GameSpot",url:"https://www.gamespot.com/feeds/mashup/",category:"gaming",language:"English",credit:"GameSpot",hosts:["gamespot.com"]},
  "kotaku": {name:"Kotaku",url:"https://kotaku.com/rss",category:"gaming",language:"English",credit:"Kotaku",hosts:["kotaku.com"]},
  "game-developer": {name:"Game Developer",url:"https://www.gamedeveloper.com/rss.xml",category:"gaming",language:"English",credit:"Game Developer",hosts:["gamedeveloper.com"]},

  "cnbc": {name:"CNBC",url:"https://www.cnbc.com/id/100003114/device/rss/rss.html",category:"business",language:"English",credit:"CNBC",hosts:["cnbc.com"]},
  "bbc-business": {name:"BBC News · Бизнес",url:"https://feeds.bbci.co.uk/news/business/rss.xml",category:"business",language:"English",credit:"BBC News",hosts:["bbc.com","bbc.co.uk"]},
  "economist": {name:"The Economist",url:"https://www.economist.com/the-world-this-week/rss.xml",category:"business",language:"English",credit:"The Economist",hosts:["economist.com"]},
  "marketwatch": {name:"MarketWatch",url:"https://feeds.marketwatch.com/marketwatch/topstories",category:"business",language:"English",credit:"MarketWatch",hosts:["marketwatch.com"]},
  "ft": {name:"Financial Times",url:"https://www.ft.com/rss/home",category:"business",language:"English",credit:"Financial Times",hosts:["ft.com"]},

  "motor1-news": {name:"Motor1 · Новости авто",url:"https://www.motor1.com/rss/news/all/",category:"auto",language:"English",credit:"Motor1",hosts:["motor1.com"]},
  "motor1-all": {name:"Motor1 · Автомир",url:"https://www.motor1.com/rss/articles/all/",category:"auto",language:"English",credit:"Motor1",hosts:["motor1.com"]},
  "electrek": {name:"Electrek",url:"https://electrek.co/feed/",category:"auto",language:"English",credit:"Electrek",hosts:["electrek.co"]},
  "insideevs": {name:"InsideEVs",url:"https://insideevs.com/rss/news/",category:"auto",language:"English",credit:"InsideEVs",hosts:["insideevs.com"]},
  "autoblog": {name:"Autoblog",url:"https://www.autoblog.com/rss.xml",category:"auto",language:"English",credit:"Autoblog",hosts:["autoblog.com"]}
};

const CATEGORIES = [
  {id:"world",name:"Мир",icon:"◉",description:"Главные события и международная повестка"},
  {id:"technology",name:"Технологии",icon:"⌘",description:"AI, гаджеты, стартапы и цифровое будущее"},
  {id:"science",name:"Наука",icon:"✧",description:"Космос, открытия, исследования и природа"},
  {id:"movies",name:"Кино",icon:"▣",description:"Премьеры, индустрия, актёры и кинофестивали"},
  {id:"gaming",name:"Игры",icon:"▰",description:"Игровая индустрия, релизы и студии"},
  {id:"business",name:"Бизнес",icon:"↗",description:"Компании, экономика, рынки и предпринимательство"},
  {id:"auto",name:"Авто",icon:"⌁",description:"Автомобили, электрокары и технологии движения"}
];

function decode(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code) => {
      const n = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      try { return Number.isFinite(n) ? String.fromCodePoint(n) : ""; } catch { return ""; }
    })
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'")
    .replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
}
function tag(block,names) {
  for (const name of names) {
    const match = block.match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+name+"\\s*>","i"));
    if (match) return decode(match[1]);
  }
  return "";
}
function safeHostUrl(value,source) {
  try {
    const url=new URL(value);
    if(url.protocol!=="https:" || !source.hosts.some(host=>url.hostname===host || url.hostname.endsWith("."+host))) return "";
    return url.href;
  } catch { return ""; }
}
function imageFrom(block,source) {
  const candidates = [
    block.match(/<media:thumbnail\b[^>]*url=["']([^"']+)["']/i)?.[1],
    block.match(/<media:content\b[^>]*url=["']([^"']+)["']/i)?.[1],
    block.match(/<enclosure\b[^>]*url=["']([^"']+)["']/i)?.[1],
    block.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1]
  ].filter(Boolean);
  for(const candidate of candidates) {
    try {
      const url=new URL(candidate);
      if(url.protocol==="https:" && source.hosts.some(host=>url.hostname===host || url.hostname.endsWith("."+host))) return url.href;
    } catch {}
  }
  return null;
}
function isFamilySafe(item) {
  const text=(String(item.title||"")+" "+String(item.summary||"")).toLocaleLowerCase();
  const blocked=/(?:\bporn(?:ography)?\b|\bexplicit sex\b|\brape\b|\bsexual assault\b|\bsex trafficking\b|\bchild abuse\b|\bgraphic violence\b|\bmassacre\b|\bsuicide\b|\bself[- ]harm\b|\bdrug trafficking\b|\boverdose\b|\bbeheading\b|\btorture\b|\bterror attack\b|\bshooting spree\b|порно|изнасил|сексуальн.{0,16}насил|домогательств|насилие над детьми|убийств|убит[аоы]?|самоубийств|суицид|самоповрежден|наркотрафик|передозиров|обезглав|пытк|теракт|массовая стрельба|cinsi zorakılıq|zorlama|uşaq istismarı|qətl|öldür|intihar|narkotik|partlayış|terror)/iu;
  return !blocked.test(text);
}
function parse(xml,source) {
  const blocks=[...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/gi)].map(match=>match[2]);
  const items=[];
  for(const block of blocks.slice(0,35)) {
    const title=tag(block,["title"]);
    let link=tag(block,["link"]);
    if(!link) {
      const atom=[...block.matchAll(/<link\b([^>]*)\/?>/gi)].map(match=>match[1]);
      const picked=atom.find(attrs=>/rel=["']alternate["']/i.test(attrs))||atom[0]||"";
      link=picked.match(/href=["']([^"']+)["']/i)?.[1]||"";
    }
    const url=safeHostUrl(link,source);
    if(!title||!url) continue;
    const description=tag(block,["description","summary","content:encoded","content"]);
    const date=tag(block,["pubDate","published","updated","dc:date"]);
    const item={
      id:url, title:title.slice(0,240), summary:description.slice(0,340),
      url, image:imageFrom(block,source),
      publishedAt:date&&!Number.isNaN(Date.parse(date))?new Date(date).toISOString():null,
      source:source.name, credit:source.credit, language:source.language, category:source.category
    };
    if(isFamilySafe(item)) items.push(item);
  }
  return items;
}
async function loadSource(source) {
  const response=await fetch(source.url,{
    headers:{accept:"application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5","user-agent":"ORBIS News Reader/2.0"},
    signal:AbortSignal.timeout(6500)
  });
  if(!response.ok) throw new Error("HTTP "+response.status);
  const xml=await response.text();
  if(!xml||!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error("Неизвестный RSS-формат");
  return parse(xml,source);
}

module.exports = async function handler(req,res) {
  if(req.method!=="GET") {res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
  const sourceId=String(req.query.source||"");
  const categoryId=String(req.query.category||"world");
  let selected=[];
  if(sourceId) {
    const source=SOURCES[sourceId];
    if(!source) return res.status(404).json({error:"Неизвестный новостной источник."});
    selected=[source];
  } else {
    if(!CATEGORIES.some(item=>item.id===categoryId)) return res.status(404).json({error:"Неизвестная категория."});
    selected=Object.values(SOURCES).filter(item=>item.category===categoryId).slice(0,5);
  }
  const settled=await Promise.allSettled(selected.map(loadSource));
  const items=[];
  const failures=[];
  for(let i=0;i<settled.length;i++) {
    const result=settled[i];
    if(result.status==="fulfilled") items.push(...result.value);
    else failures.push(selected[i].name);
  }
  const unique=new Map();
  for(const item of items) if(!unique.has(item.url)) unique.set(item.url,item);
  const merged=[...unique.values()].sort((a,b)=>{
    const ta=a.publishedAt?Date.parse(a.publishedAt):0;
    const tb=b.publishedAt?Date.parse(b.publishedAt):0;
    return tb-ta;
  }).slice(0,32);
  res.setHeader("Cache-Control","s-maxage=600, stale-while-revalidate=1800, stale-if-error=86400");
  if(!merged.length) return res.status(502).json({error:"Сейчас не удалось получить безопасные новости из этой категории.",failedSources:failures});
  return res.status(200).json({
    category:categoryId,categoryName:CATEGORIES.find(item=>item.id===categoryId)?.name,
    items:merged,sourceCount:selected.length,workingSources:settled.filter(x=>x.status==="fulfilled").length,
    failedSources:failures,fetchedAt:Date.now()
  });
};
