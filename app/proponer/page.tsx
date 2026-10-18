import Link from "next/link";
import { CommunitySourceForm } from "@/components/community-source-form";
import styles from "@/components/community-source.module.css";

export default function ProposeSourcePage() {
  return <main className="privacy-page"><Link className="back-link" href="/">← Volver al mapa</Link><p className="eyebrow">MAPA COMUNITARIO</p><h1>Proponer una fuente</h1>
    <div className={styles.pageCopy}><p>Ayúdanos a completar el mapa con fuentes públicas de agua potable. Una propuesta no se publica hasta que una persona moderadora la revise.</p><CommunitySourceForm/></div>
    <p><Link href="/moderacion">Acceso de moderación</Link></p>
  </main>;
}
