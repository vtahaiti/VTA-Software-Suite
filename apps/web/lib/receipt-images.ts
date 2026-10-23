import { getAccessToken } from "@/lib/auth";
import { embedReceiptLogo } from "@/lib/receipt-branding";
import { isEmbeddedLogo } from "@/lib/receipt-logo";

export async function prepareReceiptImages(html: string): Promise<string> {
  if (!/<img\b/i.test(html)) return html;
  const document = new DOMParser().parseFromString(html, 'text/html');
  const images = Array.from(document.querySelectorAll('img'));
  for (const image of images) {
    const source = image.getAttribute('src');
    if (!source) throw new Error("Le logo du ticket est introuvable.");
    const embedded = isEmbeddedLogo(source) ? source : await embedReceiptLogo(source, getAccessToken());
    image.setAttribute('src', embedded);
    image.removeAttribute('crossorigin');
    image.removeAttribute('onerror');
    image.removeAttribute('srcset');
  }
  return '<!doctype html>' + document.documentElement.outerHTML;
}
