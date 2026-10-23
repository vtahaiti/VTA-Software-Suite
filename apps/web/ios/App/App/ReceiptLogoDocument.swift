import Foundation

// Extract the embedded business logo separately: the text-only markup formatter
// cannot be relied on to print HTML images.
struct ReceiptLogoDocument {
    let html: String
    let logoData: Data?
    enum LogoError: LocalizedError {
        case unprepared, invalid, multiple
        var errorDescription: String? {
            switch self {
            case .unprepared: return "Le logo doit être téléchargé avant l’impression. Reconnectez-vous puis réessayez."
            case .invalid: return "Le logo du ticket est invalide. Vérifiez l’image du commerce."
            case .multiple: return "Ce document contient plusieurs images. Utilisez la version web pour ce document."
            }
        }
    }
    init(html: String) throws {
        let imagePattern = try NSRegularExpression(pattern: "<img\\b[^>]*>", options: [.caseInsensitive])
        let images = imagePattern.matches(in: html, range: NSRange(html.startIndex..., in: html))
        guard images.count <= 1 else { throw LogoError.multiple }
        guard let image = images.first, let imageRange = Range(image.range, in: html) else {
            self.html = html; self.logoData = nil; return
        }
        let tag = String(html[imageRange])
        let sourcePattern = try NSRegularExpression(pattern: "\\bsrc\\s*=\\s*([\"'])(.*?)\\1", options: [.caseInsensitive, .dotMatchesLineSeparators])
        guard let source = sourcePattern.firstMatch(in: tag, range: NSRange(tag.startIndex..., in: tag)),
              let range = Range(source.range(at: 2), in: tag) else { throw LogoError.invalid }
        let uri = String(tag[range])
        let dataPattern = try NSRegularExpression(pattern: "^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$", options: [.caseInsensitive])
        guard let match = dataPattern.firstMatch(in: uri, range: NSRange(uri.startIndex..., in: uri)),
              let payloadRange = Range(match.range(at: 2), in: uri) else { throw LogoError.unprepared }
        guard let data = Data(base64Encoded: String(uri[payloadRange])), !data.isEmpty, data.count <= 2 * 1024 * 1024 else { throw LogoError.invalid }
        self.logoData = data
        // Remove the original logo box so the manually rendered image is not duplicated.
        let boxPattern = try NSRegularExpression(pattern: "<div\\b[^>]*class\\s*=\\s*[\"'](?:logo|receipt-logo)[\"'][^>]*>\\s*<img\\b[^>]*>\\s*</div>", options: [.caseInsensitive, .dotMatchesLineSeparators])
        let withoutBox = boxPattern.stringByReplacingMatches(in: html, range: NSRange(html.startIndex..., in: html), withTemplate: "")
        self.html = imagePattern.stringByReplacingMatches(in: withoutBox, range: NSRange(withoutBox.startIndex..., in: withoutBox), withTemplate: "")
    }
}
