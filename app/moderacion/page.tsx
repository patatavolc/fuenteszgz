import Link from "next/link";
import { CommunityModerationPanel } from "@/components/community-moderation-panel";

export default function ModerationPage() {
  return <main className="privacy-page"><Link className="back-link" href="/">← Volver al mapa</Link><p className="eyebrow">GESTIÓN COMUNITARIA</p><h1>Revisión de propuestas</h1><CommunityModerationPanel/></main>;
}
