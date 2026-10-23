import Foundation
func check(_ value: Bool, _ label: String) { if !value { fatalError(label) }; print("PASS: " + label) }
let row = try EscPosRaster.encode(grayscale: [0,255,0,255,0,255,0,255], width: 8, height: 1)
check(Array(row) == [0x1d,0x76,0x30,0,1,0,1,0,0xaa], "ESC/POS header and bit order")
let narrow = try EscPosRaster.encode(grayscale: [0,255,0], width: 3, height: 1)
check(narrow.last == 0xa0, "Non-byte-aligned widths leave white padding")
let white = try EscPosRaster.encode(grayscale: [UInt8](repeating:255,count:8*4), width:8,height:4)
check(white.isEmpty, "Blank page produces no raster strips")
let trimmed = try EscPosRaster.encode(grayscale:[0,255,255],width:1,height:3)
check(trimmed[6] == 1 && trimmed.count == 9, "Trailing white rows removed")
let strips = try EscPosRaster.encode(grayscale:[UInt8](repeating:0,count:576*129),width:576,height:129)
check(strips.count == 16 + 72*129 && strips[6] == 128 && strips[8+72*128+6] == 1, "80 mm raster split into bounded 128-row strips")
check(Array(EscPosRaster.feedAndCut) == [0x1b,0x64,3,0x1d,0x56,0], "Feed then full-cut commands")
do { _ = try EscPosRaster.encode(grayscale:[],width:576,height:1); fatalError("accepted invalid buffer") } catch { print("PASS: Invalid buffers rejected") }

let logoHtml = "<html><body><div class=\"receipt-logo\"><img src=\"data:image/png;base64,AQID\" alt=\"Logo\"/></div><h1>Boutik</h1></body></html>"
let logoDocument = try ReceiptLogoDocument(html: logoHtml)
check(logoDocument.logoData == Data([1,2,3]), "Embedded business logo decoded for native rendering")
check(!logoDocument.html.contains("<img") && !logoDocument.html.contains("receipt-logo") && logoDocument.html.contains("Boutik"), "Logo wrapper removed while receipt text remains")
let plainDocument = try ReceiptLogoDocument(html: "<h1>Boutik sans logo</h1>")
check(plainDocument.logoData == nil && plainDocument.html.contains("Boutik sans logo"), "Business without logo keeps its name")
do { _ = try ReceiptLogoDocument(html: "<img src=\"https://example.test/logo.png\">"); fatalError("remote logo accepted") } catch { print("PASS: Remote logo must be prepared before native printing") }
do { _ = try ReceiptLogoDocument(html: "<img src=\"data:image/png;base64,invalid\">"); fatalError("invalid logo accepted") } catch { print("PASS: Invalid base64 logo rejected") }
