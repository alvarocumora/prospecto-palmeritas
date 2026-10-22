import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { BrandButton } from '@/components/brand/Button';
import { buildMarketingDeck } from './deck2026';
export function DeckDownload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div><BrandButton variant="outline" disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try { const { downloadProjectDoc } = await import('@/lib/pdf/generateProjectDoc'); await downloadProjectDoc(buildMarketingDeck(), 'deck'); }
    catch { setError('No se pudo generar el PDF. Intenta nuevamente.'); }
    finally { setBusy(false); }
  }}>{busy ? <LoaderCircle className="animate-spin"/> : <Download/>}{busy ? 'Preparando PDF…' : 'Descargar PDF'}</BrandButton>{error && <p role="alert" className="mt-2 text-sm text-content-muted">{error}</p>}</div>;
}
