const SOURCES = [
 {id:"bbc-ru",name:"BBC News · Русский",language:"Русский",credit:"BBC News"},
 {id:"oxu-az",name:"Oxu.az",language:"Азербайджанский",credit:"Oxu.az"},
 {id:"bbc-world",name:"BBC News · Мир",language:"English",credit:"BBC News"},
 {id:"aljazeera-en",name:"Al Jazeera",language:"English",credit:"Al Jazeera"}
];
module.exports = function handler(req,res){
 if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
 res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=3600");
 return res.status(200).json({sources:SOURCES});
};
