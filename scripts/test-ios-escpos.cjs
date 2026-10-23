const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
if (process.platform !== 'darwin') { console.error('These native protocol tests require the Swift tools on macOS.'); process.exit(1); }
const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vta-print-tests-'));
const binary = path.join(directory, 'escpos-tests');
const env = { ...process.env };
if (!env.DEVELOPER_DIR && fs.existsSync('/Applications/Xcode.app/Contents/Developer')) env.DEVELOPER_DIR = '/Applications/Xcode.app/Contents/Developer';
try {
  const compilation = spawnSync('xcrun', ['swiftc', '-module-cache-path', path.join(directory, 'cache'), path.join(root, 'apps/web/ios/App/App/EscPosRaster.swift'), path.join(root, 'apps/web/ios/App/App/ReceiptLogoDocument.swift'), path.join(__dirname, 'swift-print-tests/main.swift'), '-o', binary], { stdio: 'inherit', env });
  if (compilation.status !== 0) process.exitCode = compilation.status ?? 1;
  else process.exitCode = spawnSync(binary, [], { stdio: 'inherit', env }).status ?? 1;
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
