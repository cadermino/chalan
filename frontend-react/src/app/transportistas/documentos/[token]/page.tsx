import type { Metadata } from 'next'
import { instrumentSerif, interTight, jetbrainsMono } from '@/lib/fonts'
import { LandingNav } from '@/components/LandingNav'
import { LandingFooter } from '@/components/LandingFooter'
import { CarrierDocumentsUpload } from '@/components/CarrierDocumentsUpload'
import '../../../landing.css'

// El link que recibe el transportista por correo al registrarse, o que un admin
// le copia desde el backoffice. Personal: no se indexa.
export const metadata: Metadata = {
  title: 'Sube tus documentos | Chalán',
  robots: { index: false, follow: false },
}

export default async function CarrierDocuments({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const fontVars = [instrumentSerif.variable, interTight.variable, jetbrainsMono.variable].join(' ')

  return (
    <>
      <LandingNav />
      <main id="main-content" className={`chalan-landing ${fontVars}`}>
        <section className="block">
          <div className="wrap" style={{ maxWidth: 640 }}>
            <CarrierDocumentsUpload token={token} />
          </div>
        </section>
      </main>
      <LandingFooter />
    </>
  )
}
