const SOURCES = [
  {id:"bbc-ru",name:"BBC News · Русский",category:"world",language:"Русский"},
  {id:"oxu-az",name:"Oxu.az",category:"world",language:"Азербайджанский"},
  {id:"bbc-world",name:"BBC News · Мир",category:"world",language:"English"},
  {id:"dw-en",name:"Deutsche Welle",category:"world",language:"English"},
  {id:"euronews",name:"Euronews",category:"world",language:"English"},
  {id:"aljazeera-en",name:"Al Jazeera",category:"world",language:"English"},
  {id:"guardian-world",name:"The Guardian · Мир",category:"world",language:"English"},
  {id:"france24-en",name:"France 24",category:"world",language:"English"},
  {id:"npr",name:"NPR",category:"world",language:"English"},
  {id:"techcrunch",name:"TechCrunch",category:"technology",language:"English"},
  {id:"the-verge",name:"The Verge",category:"technology",language:"English"},
  {id:"wired",name:"WIRED",category:"technology",language:"English"},
  {id:"ars-technica",name:"Ars Technica",category:"technology",language:"English"},
  {id:"bbc-tech",name:"BBC News · Технологии",category:"technology",language:"English"},
  {id:"wired-ai",name:"WIRED · AI",category:"technology",language:"English"},
  {id:"wired-business",name:"WIRED · Бизнес",category:"technology",language:"English"},
  {id:"science-daily",name:"ScienceDaily",category:"science",language:"English"},
  {id:"nasa",name:"NASA",category:"science",language:"English"},
  {id:"phys-org",name:"Phys.org",category:"science",language:"English"},
  {id:"science-news",name:"Science News",category:"science",language:"English"},
  {id:"nature-science",name:"Nature · Наука",category:"science",language:"English"},
  {id:"variety-film",name:"Variety · Кино",category:"movies",language:"English"},
  {id:"indiewire",name:"IndieWire",category:"movies",language:"English"},
  {id:"deadline",name:"Deadline",category:"movies",language:"English"},
  {id:"hollywood-reporter",name:"The Hollywood Reporter",category:"movies",language:"English"},
  {id:"ign",name:"IGN",category:"gaming",language:"English"},
  {id:"pc-gamer",name:"PC Gamer",category:"gaming",language:"English"},
  {id:"eurogamer",name:"Eurogamer",category:"gaming",language:"English"},
  {id:"gamespot",name:"GameSpot",category:"gaming",language:"English"},
  {id:"kotaku",name:"Kotaku",category:"gaming",language:"English"},
  {id:"game-developer",name:"Game Developer",category:"gaming",language:"English"},
  {id:"cnbc",name:"CNBC",category:"business",language:"English"},
  {id:"bbc-business",name:"BBC News · Бизнес",category:"business",language:"English"},
  {id:"economist",name:"The Economist",category:"business",language:"English"},
  {id:"marketwatch",name:"MarketWatch",category:"business",language:"English"},
  {id:"ft",name:"Financial Times",category:"business",language:"English"},
  {id:"motor1-news",name:"Motor1 · Новости авто",category:"auto",language:"English"},
  {id:"motor1-all",name:"Motor1 · Автомир",category:"auto",language:"English"},
  {id:"electrek",name:"Electrek",category:"auto",language:"English"},
  {id:"insideevs",name:"InsideEVs",category:"auto",language:"English"},
  {id:"autoblog",name:"Autoblog",category:"auto",language:"English"}
];
const CATEGORIES = [
  {id:"world",name:"Мир",icon:"◉",description:"Главные события и международная повестка"},
  {id:"technology",name:"Технологии",icon:"⌘",description:"AI, гаджеты, стартапы и цифровое будущее"},
  {id:"science",name:"Наука",icon:"✧",description:"Космос, открытия, исследования и природа"},
  {id:"movies",name:"Кино",icon:"▣",description:"Премьеры, индустрия, актёры и кинофестивали"},
  {id:"gaming",name:"Игры",icon:"▰",description:"Игровая индустрия, релизы и студии"},
  {id:"business",name:"Бизнес",icon:"↗",description:"Компании, экономика, рынки и предпринимательство"},
  {id:"auto",name:"Авто",icon:"⌁",description:"Автомобили, электрокары и технологии движения"}
];
module.exports = function handler(req,res) {
  if(req.method!=="GET") {res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
  res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({sources:SOURCES,categories:CATEGORIES,refreshIntervalMinutes:10});
};
