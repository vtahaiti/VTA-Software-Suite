import UIKit

class ReceiptLogoPageRenderer: UIPrintPageRenderer {
    private let fixedSize: CGSize?
    private let logo: UIImage?
    init(document: ReceiptLogoDocument, size: CGSize? = nil) throws {
        fixedSize = size
        if let data = document.logoData {
            guard let image = UIImage(data: data) else { throw ReceiptLogoDocument.LogoError.invalid }
            logo = image
        } else { logo = nil }
        super.init()
        headerHeight = logo == nil ? 0 : 60
        addPrintFormatter(UIMarkupTextPrintFormatter(markupText: document.html), startingAtPageAt: 0)
    }
    override var paperRect: CGRect { fixedSize.map { CGRect(origin: .zero, size: $0) } ?? super.paperRect }
    override var printableRect: CGRect { fixedSize != nil ? paperRect.insetBy(dx: 8, dy: 12) : super.printableRect }
    override func drawHeaderForPage(at pageIndex: Int, in headerRect: CGRect) {
        guard pageIndex == 0, let logo = logo, logo.size.width > 0, logo.size.height > 0 else { return }
        let ratio = min(min(79, printableRect.width) / logo.size.width, 51 / logo.size.height)
        let size = CGSize(width: logo.size.width * ratio, height: logo.size.height * ratio)
        logo.draw(in: CGRect(x: headerRect.midX - size.width / 2, y: headerRect.minY + 3, width: size.width, height: size.height))
    }
}
