import { SalesDocumentPage } from "../../sales-document-page";

export default function CreateQuotePage() {
  return <SalesDocumentPage type="quotes" title="Devis client" eyebrow="Devis & Commandes" createLabel="Nouveau devis" transformLabel="Convertir en commande" transformAction="to-proforma" />;
}
