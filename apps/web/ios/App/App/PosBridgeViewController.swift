import UIKit
import Capacitor

@objc(PosBridgeViewController)
class PosBridgeViewController: CAPBridgeViewController {
    override func router() -> Router { PosStaticRouter() }
    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.scrollView.keyboardDismissMode = .interactive
        webView?.scrollView.alwaysBounceHorizontal = false
    }
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(VtaNativePrintPlugin())
        bridge?.registerPluginInstance(VtaBluetoothPrinterPlugin())
    }
}

@objc(VtaNativePrintPlugin)
public class VtaNativePrintPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VtaNativePrintPlugin"
    public let jsName = "VtaNativePrint"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "printHtml", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sharePdf", returnType: CAPPluginReturnPromise)
    ]

    @objc func printHtml(_ call: CAPPluginCall) {
        guard let html = call.getString("html"), !html.isEmpty else {
            call.reject("Document vide."); return
        }
        DispatchQueue.main.async {
            guard let view = self.bridge?.viewController?.view else {
                call.reject("Écran indisponible."); return
            }
            let controller = UIPrintInteractionController.shared
            let info = UIPrintInfo(dictionary: nil)
            info.jobName = call.getString("title") ?? "VTA POS"
            info.outputType = .general
            info.orientation = call.getString("orientation") == "landscape" ? .landscape : .portrait
            controller.printInfo = info
            do { controller.printPageRenderer = try ReceiptLogoPageRenderer(document: ReceiptLogoDocument(html: html)) }
            catch { call.reject(error.localizedDescription); return }
            controller.present(from: CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1), in: view, animated: true) { _, completed, error in
                if let error = error { call.reject(error.localizedDescription); return }
                call.resolve(["status": completed ? "printed" : "cancelled"])
            }
        }
    }

    @objc func sharePdf(_ call: CAPPluginCall) {
        guard let html = call.getString("html"), !html.isEmpty else {
            call.reject("Document vide."); return
        }
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("Écran indisponible."); return
            }
            let format = call.getString("format") ?? "80"
            let width: CGFloat = format == "58" ? 164.41 : format == "80" ? 226.77 : format == "LETTER" ? 612 : 595.28
            let height: CGFloat = format == "LETTER" ? 792 : 841.89
            var size = CGSize(width: width, height: height)
            if call.getString("orientation") == "landscape" { size = CGSize(width: height, height: width) }
            let renderer: ReceiptLogoPageRenderer
            do { renderer = try ReceiptLogoPageRenderer(document: ReceiptLogoDocument(html: html), size: size) }
            catch { call.reject(error.localizedDescription); return }
            renderer.prepare(forDrawingPages: NSRange(location: 0, length: renderer.numberOfPages))
            let data = UIGraphicsPDFRenderer(bounds: renderer.paperRect).pdfData { context in
                for page in 0..<renderer.numberOfPages {
                    context.beginPage()
                    renderer.drawPage(at: page, in: renderer.paperRect)
                }
            }
            do {
                // A unique cache directory avoids overwriting a document still in the share sheet.
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let name = URL(fileURLWithPath: call.getString("fileName") ?? "vta-pos.pdf").lastPathComponent
                let file = directory.appendingPathComponent(name.hasSuffix(".pdf") ? name : name + ".pdf")
                try data.write(to: file)
                let share = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                share.popoverPresentationController?.sourceView = presenter.view
                share.popoverPresentationController?.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
                share.completionWithItemsHandler = { _, completed, _, error in
                    try? FileManager.default.removeItem(at: directory)
                    if let error = error { call.reject(error.localizedDescription) }
                    else { call.resolve(["status": completed ? "shared" : "cancelled"]) }
                }
                presenter.present(share, animated: true)
            } catch { call.reject(error.localizedDescription) }
        }
    }
}

// Next export has one index.html per route; Capacitor's default router is SPA-only.
private struct PosStaticRouter: Router {
    var basePath = ""
    func route(for path: String) -> String {
        let root = URL(fileURLWithPath: basePath, isDirectory: true).standardizedFileURL
        let clean = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let candidate = root.appendingPathComponent(clean).standardizedFileURL
        guard candidate.path == root.path || candidate.path.hasPrefix(root.path + "/") else { return root.appendingPathComponent("404.html").path }
        // Next client navigation requests /login.txt, while trailingSlash export
        // writes /login/index.txt. Serve the payload instead of forcing a reload.
        if candidate.pathExtension == "txt", !FileManager.default.fileExists(atPath: candidate.path) {
            let payload = candidate.deletingPathExtension().appendingPathComponent("index.txt")
            if FileManager.default.fileExists(atPath: payload.path) { return payload.path }
        }
        if candidate.pathExtension.isEmpty {
            let index = candidate.appendingPathComponent("index.html")
            return FileManager.default.fileExists(atPath: index.path) ? index.path : root.appendingPathComponent("404.html").path
        }
        return candidate.path
    }
}
