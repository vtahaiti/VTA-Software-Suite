export type ReceiptPaperWidth = "58" | "72" | "80";
export function receiptPrintOptions(width?: ReceiptPaperWidth) {
  return width === "58"
    ? { format: "58" as const, widthDots: 384 }
    : { format: "80" as const, widthDots: 576 };
}
export function storedReceiptPrintOptions(receipt: { receiptWidth?: ReceiptPaperWidth; receiptHtml?: string }) {
  // Older local receipts stored their paper width only in the HTML page style.
  const width = receipt.receiptWidth ?? (/size:\s*58mm/i.test(receipt.receiptHtml ?? "") ? "58" : "80");
  return receiptPrintOptions(width);
}
export function bluetoothPrintError(error: unknown) {
  const message = typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  const messages: Record<string, string> = {
    CONNECTION_FAILED: "Connexion impossible. Vérifiez Bluetooth et l’alimentation de l’imprimante.",
    RENDER_FAILED: "Préparation du ticket impossible. Réessayez avec le ticket de test.",
    NOT_CONFIGURED: "Choisissez une imprimante avant de lancer le test."
  };
  if (messages[message]) return messages[message];
  // Only show messages emitted by our native driver, not arbitrary platform errors.
  if (/^(Le logo|Ce document contient|Profil BLE ESC\/POS non reconnu|Bluetooth indisponible|Activez Bluetooth|Recherchez à nouveau|Choisissez une imprimante|Une opération Bluetooth|Connexion interrompue|Connexion à l’imprimante impossible|Envoi interrompu|Délai dépassé|Ticket vide|Le ticket ne contient|Rendu du ticket impossible)/.test(message)) return message;
  return "Impression interrompue. Vérifiez le ticket et l’imprimante avant de réessayer.";
}
export function buildBluetoothTestTicketHtml(width: "58" | "80") {
  const contentWidthMm = width === "58" ? 48 : 64;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0 auto;width:${contentWidthMm}mm;font:11px -apple-system,Arial,sans-serif;color:#000}
    h1{font-size:14px;text-align:center}table{width:100%;border-collapse:collapse}td{padding:4px 0}td:last-child{text-align:right}
    .line{border-top:1px dashed #000;margin:8px 0}.center{text-align:center}
  </style></head><body><h1>VTA POS · TEST ${width} mm</h1>
    <p class="center">TICKET DE TEST — AUCUNE VENTE</p><div class="line"></div>
    <p>Haïti · Kreyòl · Café · reçu · È É À Ç Ù<br>0123456789 · G HTG $</p>
    <table><tr><td>2 × Café</td><td>100,00 G</td></tr><tr><td>1 × Pain</td><td>25,00 G</td></tr>
    <tr><td><strong>TOTAL</strong></td><td><strong>125,00 G</strong></td></tr><tr><td>Reçu</td><td>200,00 G</td></tr><tr><td>Monnaie</td><td>75,00 G</td></tr></table>
    <div class="line"></div><p>Cette ligne longue doit revenir à la ligne sans couper les mots ni les montants.</p>
    <p class="center">FIN DU TEST<br>Vérifiez les accents, les colonnes et la coupe.</p></body></html>`;
}
