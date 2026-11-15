"use strict";
const {SOURCES,CATEGORIES,LANGUAGES,TRANSLATION_LANGUAGES,COUNTRIES}=require("../../lib/news-catalog");
module.exports=function handler(req,res){
 if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"})}
 res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=86400");
 const sources=SOURCES.map(({id,name,publisher,feed,category,language,languageName,country,countryName})=>({id,name,publisher,feed,category,language,languageName,country,countryName}));
 return res.status(200).json({sources,categories:CATEGORIES,languages:LANGUAGES,translationLanguages:TRANSLATION_LANGUAGES,countries:COUNTRIES,refreshIntervalMinutes:10,totalSources:sources.length});
};
