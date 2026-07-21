import { SalesDocumentDetailPage } from "../../sales-document-detail-page";

export default function QuoteDetailPage() {
  return <SalesDocumentDetailPage type="quotes" title="Devis" transformAction="to-proforma" transformLabel="Convertir en commande" />;
}
