import { Injectable } from "@nestjs/common";

@Injectable()
export class PdfService {
  createTextPdf(title: string, lines: string[]) {
    const content = [`BT`, `/F1 18 Tf`, `50 760 Td`, `(${this.escape(title)}) Tj`, `/F1 10 Tf`, `0 -28 Td`, ...lines.flatMap((line) => [`(${this.escape(line)}) Tj`, `0 -16 Td`]), `ET`].join("\n");
    const objects = [
      `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`,
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`,
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj`,
      `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`,
      `5 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj`
    ];
    let body = "%PDF-1.4\n";
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(body));
      body += `${object}\n`;
    }
    const xrefOffset = Buffer.byteLength(body);
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let index = 1; index <= objects.length; index += 1) body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(body, "utf8");
  }

  private escape(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }
}