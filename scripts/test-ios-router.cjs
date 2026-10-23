const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vta-router-tests-'));
const source = fs.readFileSync('apps/web/ios/App/App/PosBridgeViewController.swift', 'utf8');
const router = source.slice(source.indexOf('private struct PosStaticRouter: Router'));
const main = `import Foundation
protocol Router { var basePath: String { get set }; func route(for path: String) -> String }
${router}
let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
try FileManager.default.createDirectory(at: root.appendingPathComponent("dashboard/pos"), withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: root) }
for file in ["index.html", "index.txt", "404.html", "dashboard/pos/index.html", "dashboard/pos/index.txt"] {
    try Data("fixture".utf8).write(to: root.appendingPathComponent(file))
}
private let router = PosStaticRouter(basePath: root.path)
for (request, expected) in [("/", "index.html"), ("/dashboard/pos", "dashboard/pos/index.html"), ("/dashboard/pos/", "dashboard/pos/index.html"), ("/dashboard/pos.txt", "dashboard/pos/index.txt"), ("/dashboard/pos/index.txt", "dashboard/pos/index.txt"), ("/index.txt", "index.txt"), ("/missing", "404.html"), ("/../../outside.txt", "404.html")] {
    precondition(router.route(for: request) == root.appendingPathComponent(expected).path, "Incorrect routing for \\(request)")
}
print("8 iOS static navigation checks passed")
`;
try {
  fs.writeFileSync(path.join(directory, 'main.swift'), main);
  const env = { ...process.env, DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer' };
  const binary = path.join(directory, 'router-tests');
  const built = spawnSync('xcrun', ['swiftc', '-module-cache-path', path.join(directory, 'cache'), path.join(directory, 'main.swift'), '-o', binary], { env, stdio: 'inherit' });
  process.exitCode = built.status === 0 ? spawnSync(binary, [], { env, stdio: 'inherit' }).status : built.status;
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
