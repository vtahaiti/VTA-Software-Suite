const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function addDynamicPages(source, target) {
  const mappings = [];
  function walk(folder, parts = []) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(folder, entry.name), [...parts, entry.name]);
      else if (entry.name === 'page.tsx' && parts.some(part => part.startsWith('['))) {
        const targetParts = parts.map(part => part.startsWith('[') ? 'detail' : part);
        const destination = path.join(target, ...targetParts, 'page.tsx');
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        let text = fs.readFileSync(path.join(folder, entry.name), 'utf8');
        const parsed = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const fn = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword));
        if (fn?.parameters.some(parameter => parameter.getText(parsed).includes('params'))) {
          const body = fn.body.getText(parsed).replace(/await\s+params\b|\buse\(params\)/g, 'useIosRouteParams<{ id: string }>()');
          text = text.slice(0, fn.getStart(parsed)) + `export default function ${fn.name.text}() ${body}` + text.slice(fn.end);
          text = '"use client";\nimport { useIosRouteParams } from "@/lib/ios-navigation";\n' + text.replace(/^[\s\uFEFF]*["']use client["'];?/, '');
        }
        // Re-export aliases retain their relative depth in the mobile tree.
        text = text.replace(/(["'][^"'\n]*)\[id\]([^"'\n]*["'])/g, '$1detail$2');
        fs.writeFileSync(destination, text);
        mappings.push({ pattern: '/' + parts.join('/'), target: '/' + targetParts.join('/') });
      }
    }
  }
  walk(source);
  return mappings.sort((a, b) => b.pattern.length - a.pattern.length);
}

function adaptClientNavigation(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) adaptClientNavigation(file);
    else if (/\.tsx?$/.test(entry.name)) {
      let text = fs.readFileSync(file, 'utf8');
      const names = [];
      text = text.replace(/import\s*\{([^}]+)\}\s*from\s*["']next\/navigation["'];?/g, (all, content) => {
        const keep = content.split(',').map(x => x.trim()).filter(name => {
          if (name === 'useParams') { names.push('useIosRouteParams as useParams'); return false; }
          if (name === 'useRouter') { names.push('useIosRouter as useRouter'); return false; }
          return true;
        });
        return keep.length ? `import { ${keep.join(', ')} } from "next/navigation";` : '';
      });
      if (names.length) text += `\nimport { ${[...new Set(names)].join(', ')} } from "@/lib/ios-navigation";\n`;
      fs.writeFileSync(file, text);
    }
  }
}
module.exports = { addDynamicPages, adaptClientNavigation };
