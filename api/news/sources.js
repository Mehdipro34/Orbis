const SOURCES = [
  {id:"bbc-ru",name:"BBC News · Русский",language:"Русский",credit:"BBC News"},
 {id:"oxu-az",name:"Oxu.az",language:"Азербайджанский",credit:"Oxu.az"},
 {id:"bbc-world",name:"BBC News · Мир",language:"English",credit:"BBC News"},
 {id:"aljazeera-en",name:"Al Jazeera",language:"English",credit:"Al Jazeera"},
 {id:"dw-en",name:"Deutsche Welle · Мир",language:"English",credit:"Deutsche Welle"},
 {id:"guardian-world",name:"The Guardian · Мир",language:"English",credit:"The Guardian"},
 {id:"france24-en",name:"France 24",language:"English",credit:"France 24"},
 {id:"euronews",name:"Euronews",language:"English",credit:"Euronews"},
 {id:"techcrunch",name:"TechCrunch · Технологии",language:"English",credit:"TechCrunch"},
 {id:"the-verge",name:"The Verge · Технологии",language:"English",credit:"The Verge"},
 {id:"wired",name:"Wired · Технологии",language:"English",credit:"Wired"},
 {id:"ars-technica",name:"Ars Technica",language:"English",credit:"Ars Technica"},
 {id:"science-daily",name:"ScienceDaily · Наука",language:"English",credit:"ScienceDaily"},
 {id:"nasa",name:"NASA · Космос",language:"English",credit:"NASA"},
 {id:"npr",name:"NPR · Новости",language:"English",credit:"NPR"},
 {id:"bbc-tech",name:"BBC News · Технологии",language:"English",credit:"BBC News"}
];
module.exports = function handler(req,res){
 if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
 res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=86400");
 return res.status(200).json({sources:SOURCES});
};
