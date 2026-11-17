"use client";
import {Moon,Sun} from "lucide-react";
import {useEffect,useState} from "react";

type Theme="dark"|"light";

export function ThemeToggle() {
  const [theme,setTheme]=useState<Theme>("dark");
  useEffect(()=>{
    const saved=window.localStorage.getItem("orbis.theme");
    if(saved==="light" || saved==="dark") {
      setTheme(saved); document.documentElement.dataset.theme=saved;
    }
  },[]);
  function toggleTheme() {
    const next:Theme=theme==="dark"?"light":"dark";
    setTheme(next);
    document.documentElement.dataset.theme=next;
    window.localStorage.setItem("orbis.theme",next);
  }
  return <button className="icon-button theme-toggle" type="button" onClick={toggleTheme}
    aria-label={theme==="dark"?"Включить светлую тему":"Включить тёмную тему"}
    title={theme==="dark"?"Светлая тема":"Тёмная тема"}>
    {theme==="dark"?<Sun size={18} aria-hidden="true"/>:<Moon size={18} aria-hidden="true"/>}
  </button>;
}
