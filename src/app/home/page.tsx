import {LiveFeed} from "@/components/live-feed";
import {PostComposer} from "@/components/post-composer";
import {Sparkles} from "lucide-react";

export default function HomePage(){
  return <section className="timeline-page">
    <div className="timeline-intro">
      <div className="timeline-eyebrow"><Sparkles size={14}/> ТВОЯ ЛЕНТА ORBIS</div>
      <h2>Что происходит?</h2>
      <p>Короткие мысли, идеи и истории людей, на которых ты подписан.</p>
    </div>
    <div className="timeline-compose" id="composer"><PostComposer/></div>
    <div className="timeline-stream-heading">
      <div><span className="timeline-section-title">Публикации</span><span className="timeline-section-subtitle">Последние обновления сообщества</span></div>
      <span className="timeline-status"><i/> В сети</span>
    </div>
    <LiveFeed/>
  </section>;
}
