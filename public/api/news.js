const SOURCES = {
  "bbc-ru": { name: "BBC News · Русский", url: "https://feeds.bbci.co.uk/russian/rss.xml", language: "Русский", credit: "BBC News", hosts: ["bbc.com", "bbc.co.uk"] },
  "oxu-az": { name: "Oxu.az", url: "https://oxu.az/feed", language: "Азербайджанский", credit: "Oxu.az", hosts: ["oxu.az"] },
  "bbc-world": { name: "BBC News · Мир", url: "https://feeds.bbci.co.uk/news/world/rss.xml", language: "English", credit: "BBC News", hosts: ["bbc.com", "bbc.co.uk"] },
  "aljazeera-en": { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", language: "English", credit: "Al Jazeera", hosts: ["aljazeera.com"] }
};
function decode(value) {
  return String(value || "").replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, "$1")
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code) => {
      const n = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      try { return Number.isFinite(n) ? String.fromCodePoint(n) : ""; } catch { return ""; }
    }).replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/<[^>]*>/g," ").replace(/\\s+/g," ").trim();
}
function tag(block,names) {
  for (const name of names) {
    const match=block.match(new RegExp("<"+name+"(?:\\\\s[^>]*)?>([\\\\s\\\\S]*?)</"+name+"\\\\s*>","i"));
    if(match)return decode(match[1]);
  }
  return "";
}
function parse(xml,source) {
  const blocks=[...xml.matchAll(/<(item|entry)(?:\\s[^>]*)?>([\\s\\S]*?)<\\/\\1\\s*>/gi)].map(x=>x[2]);
  const items=[];
  for(const block of blocks.slice(0,30)){
    const title=tag(block,["title"]);let link=tag(block,["link"]);
    if(!link){const m=block.match(/<link\\b[^>]*href=["']([^"']+)["'][^>]*\\/?\\s*>/i);if(m)link=decode(m[1]);}
    const summary=tag(block,["description","summary","content:encoded","content"]);
    const date=tag(block,["pubDate","published","updated","dc:date"]);
    let url="";try{const parsed=new URL(link);if(parsed.protocol==="https:"&&source.hosts.some(h=>parsed.hostname===h||parsed.hostname.endsWith("."+h)))url=parsed.href;}catch{}
    if(!title||!url)continue;
    items.push({title:title.slice(0,220),summary:summary.slice(0,260),url,publishedAt:date&&!Number.isNaN(Date.parse(date))?new Date(date).toISOString():null,source:source.name,credit:source.credit});
  }
  return items;
}
module.exports = async function handler(req,res) {
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
  const id=String(req.query.source||"bbc-ru"),source=SOURCES[id];
  if(!source)return res.status(404).json({error:"Неизвестный новостной источник."});
  try{
    const response=await fetch(source.url,{headers:{accept:"application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5","user-agent":"ORBIS News Reader/1.0"},signal:AbortSignal.timeout(9000)});
    if(!response.ok)throw new Error("Источник ответил HTTP "+response.status);
    const xml=await response.text();
    if(!xml||!/<(?:rss|feed|rdf:RDF)\\b/i.test(xml))throw new Error("Источник вернул неизвестный формат ленты.");
    const items=parse(xml,source);if(!items.length)throw new Error("В ленте пока нет доступных публикаций.");
    res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json({source:source.name,language:source.language,items,cached:false,fetchedAt:Date.now()});
  }catch(error){return res.status(502).json({error:"Не удалось загрузить "+source.name+": "+error.message});}
};
