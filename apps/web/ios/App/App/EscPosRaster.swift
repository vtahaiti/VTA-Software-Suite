import Foundation

// No UIKit dependency: protocol bytes can be tested without an iPhone or printer.
enum EscPosRaster {
    enum EncodingError: Error { case invalidDimensions }
    static func encode(grayscale: [UInt8], width: Int, height: Int) throws -> Data {
        guard width > 0, width <= 576, height > 0, height <= 2048,
              grayscale.count == width * height else { throw EncodingError.invalidDimensions }
        let rowBytes = (width + 7) / 8
        var lastRow = height - 1
        while lastRow >= 0 && grayscale[(lastRow * width)..<((lastRow + 1) * width)].allSatisfy({ $0 >= 180 }) { lastRow -= 1 }
        guard lastRow >= 0 else { return Data() }
        var output = Data()
        for start in stride(from: 0, through: lastRow, by: 128) {
            let rows = min(128, lastRow - start + 1)
            output.append(contentsOf: [0x1d, 0x76, 0x30, 0, UInt8(rowBytes & 255), UInt8(rowBytes >> 8), UInt8(rows & 255), UInt8(rows >> 8)])
            for row in start..<(start + rows) {
                for byte in 0..<rowBytes {
                    var value: UInt8 = 0
                    for bit in 0..<8 {
                        let x = byte * 8 + bit
                        if x < width && grayscale[row * width + x] < 180 { value |= UInt8(0x80 >> bit) }
                    }
                    output.append(value)
                }
            }
        }
        return output
    }
    static let initialize = Data([0x1b, 0x40])
    static let feedAndCut = Data([0x1b, 0x64, 3, 0x1d, 0x56, 0])
}
