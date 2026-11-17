"use client";

import {Moon,Sun} from "lucide-react";
import {useSyncExternalStore} from "react";

type Theme="dark"|"light";

function getThemeSnapshot():Theme {
  return window.localStorage.getItem("orbis.theme")==="light"?"light":"dark";
}

function getServerThemeSnapshot():Theme {
  return "dark";
}

function subscribeToThemeChanges(onStoreChange:()=>void) {
  window.addEventListener("storage",onStoreChange);
  window.addEventListener("orbis-theme-change",onStoreChange);
  return ()=>{
    window.removeEventListener("storage",onStoreChange);
    window.removeEventListener("orbis-theme-change",onStoreChange);
  };
}

export function ThemeToggle() {
  const theme=useSyncExternalStore(
    subscribeToThemeChanges,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  function toggleTheme() {
    const next:Theme=theme==="dark"?"light":"dark";
    document.documentElement.dataset.theme=next;
    window.localStorage.setItem("orbis.theme",next);
    window.dispatchEvent(new Event("orbis-theme-change"));
  }

  return <button
    className="icon-button theme-toggle"
    type="button"
    onClick={toggleTheme}
    aria-label={theme==="dark"?"Включить светлую тему":"Включить тёмную тему"}
    title={theme==="dark"?"Светлая тема":"Тёмная тема"}
  >
    {theme==="dark"?<Sun size={18} aria-hidden="true"/>:<Moon size={18} aria-hidden="true"/>}
  </button>;
}
