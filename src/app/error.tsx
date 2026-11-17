"use client";
import {useEffect} from "react";

export default function GlobalError({error,reset}:{error:Error & {digest?:string};reset:()=>void}) {
  useEffect(()=>{console.error("ORBIS application error:",error);},[error]);
  return <main className="app-frame"><section className="feed-state-card" role="alert">
    <strong>Не удалось открыть страницу</strong>
    <p>Произошла непредвиденная ошибка. Попробуй загрузить страницу ещё раз.</p>
    <button type="button" className="primary-button" onClick={()=>reset()}>Повторить</button>
  </section></main>;
}
