import UIKit
import Capacitor
import CoreBluetooth

@objc(VtaBluetoothPrinterPlugin)
public class VtaBluetoothPrinterPlugin: CAPPlugin, CAPBridgedPlugin, CBCentralManagerDelegate, CBPeripheralDelegate {
    public let identifier = "VtaBluetoothPrinterPlugin"
    public let jsName = "VtaBluetoothPrinter"
    public let pluginMethods = ["isAvailable", "listPaired", "getDefaultPrinter", "setDefaultPrinter", "clearDefaultPrinter", "printTicket"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var central: CBCentralManager?
    private var devices: [UUID: CBPeripheral] = [:]
    private var scanCall: CAPPluginCall?
    private var printCall: CAPPluginCall?
    private var peripheral: CBPeripheral?
    private var characteristic: CBCharacteristic?
    private var bytes = Data()
    private var offset = 0
    private var timeout: DispatchWorkItem?
    private var targetId: UUID?
    private var connecting = false
    private var scanGeneration = UUID()
    private var printGeneration: UUID?
    private var pumpTimer: DispatchWorkItem?
    private var awaitingWriteResponse = false
    private var disconnecting = Set<UUID>()
    private let printerKey = "vta.pos.blePrinter"
    // Only write to known serial printer profiles, never arbitrary writable GATT data.
    private let profiles = Set(["FFE1", "FF02", "AE01", "2AF1", "49535343-8841-43F4-A8D4-ECBE34729BB3"])

    private func setup() {
        if central == nil { central = CBCentralManager(delegate: self, queue: .main) }
    }
    @objc func isAvailable(_ call: CAPPluginCall) {
        let authorization = CBManager.authorization
        call.resolve(["available": authorization != .denied && authorization != .restricted])
    }
    @objc func listPaired(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.scanCall == nil && self.printCall == nil else { call.reject("Bluetooth occupé."); return }
            self.scanCall = call
            self.devices.removeAll()
            self.setup()
            if self.central?.state == .poweredOn { self.scan() }
            else if self.central?.state != .unknown && self.central?.state != .resetting { self.failScan("Activez Bluetooth et autorisez VTA POS.") }
        }
    }
    private func scan() {
        scanGeneration = UUID()
        let generation = scanGeneration
        central?.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) {
            guard self.scanGeneration == generation, self.scanCall != nil else { return }
            self.central?.stopScan()
            let result = self.devices.values.sorted { ($0.name ?? "") < ($1.name ?? "") }.map { ["name": $0.name ?? "Appareil BLE", "address": $0.identifier.uuidString] }
            self.scanCall?.resolve(["devices": result]); self.scanCall = nil
        }
    }
    private func failScan(_ message: String) {
        central?.stopScan(); scanCall?.reject(message); scanCall = nil
    }
    @objc func getDefaultPrinter(_ call: CAPPluginCall) {
        if let printer = UserDefaults.standard.dictionary(forKey: printerKey) { call.resolve(printer.merging(["configured": true]) { _, new in new }) }
        else { call.resolve(["configured": false]) }
    }
    @objc func setDefaultPrinter(_ call: CAPPluginCall) {
        guard let address = call.getString("address"), UUID(uuidString: address) != nil else { call.reject("Identifiant BLE invalide."); return }
        UserDefaults.standard.set(["address": address, "name": call.getString("name") ?? "Imprimante BLE"], forKey: printerKey)
        call.resolve()
    }
    @objc func clearDefaultPrinter(_ call: CAPPluginCall) { UserDefaults.standard.removeObject(forKey: printerKey); call.resolve() }
    @objc func printTicket(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.printCall == nil && self.scanCall == nil && self.disconnecting.isEmpty else { call.reject("Une opération Bluetooth est déjà en cours."); return }
            guard let html = call.getString("html"), !html.isEmpty else { call.reject("Ticket vide."); return }
            let address = call.getString("address") ?? UserDefaults.standard.dictionary(forKey: self.printerKey)?["address"] as? String
            guard let address = address, let id = UUID(uuidString: address) else { call.reject("Choisissez une imprimante BLE."); return }
            let width = call.getInt("widthDots") ?? 576
            guard width == 384 || width == 576 else { call.reject("Largeur de ticket invalide."); return }
            self.setup()
            do { self.bytes = try PosEscPosRaster.ticket(html: html, width: width) }
            catch { call.reject(error.localizedDescription); return }
            self.printGeneration = UUID(); self.awaitingWriteResponse = false
            self.printCall = call; self.targetId = id; self.offset = 0; self.characteristic = nil; self.connecting = false
            let task = DispatchWorkItem { [weak self] in self?.finish(error: "Délai dépassé. Vérifiez le ticket avant de réimprimer.") }
            self.timeout = task; DispatchQueue.main.asyncAfter(deadline: .now() + 60, execute: task)
            if self.central?.state == .poweredOn { self.connectTarget() }
            else if self.central?.state != .unknown && self.central?.state != .resetting { self.finish(error: "Activez Bluetooth et autorisez VTA POS.") }
        }
    }
    private func connectTarget() {
        guard !connecting, printCall != nil, let id = targetId else { return }
        guard let device = devices[id] ?? central?.retrievePeripherals(withIdentifiers: [id]).first else { finish(error: "Recherchez à nouveau l’imprimante."); return }
        connecting = true; peripheral = device; device.delegate = self
        if device.state == .connected { device.discoverServices(nil) } else { central?.connect(device) }
    }
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            if scanCall != nil { scan() }
            if printCall != nil { connectTarget() }
        }
        else if central.state != .poweredOn && central.state != .unknown && central.state != .resetting {
            failScan("Bluetooth indisponible ou autorisation refusée.")
            if printCall != nil { finish(error: "Connexion Bluetooth interrompue.") }
        }
    }
    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        devices[peripheral.identifier] = peripheral
    }
    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard peripheral.identifier == self.peripheral?.identifier, printCall != nil else { return }
        peripheral.discoverServices(nil)
    }
    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        if disconnecting.remove(peripheral.identifier) != nil { return }
        guard peripheral.identifier == self.peripheral?.identifier else { return }
        finish(error: "Connexion à l’imprimante impossible.")
    }
    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        if disconnecting.remove(peripheral.identifier) != nil { return }
        if printCall != nil && peripheral.identifier == self.peripheral?.identifier { finish(error: "Connexion interrompue. Vérifiez le ticket avant de réimprimer.") }
    }
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard peripheral.identifier == self.peripheral?.identifier, printCall != nil else { return }
        guard error == nil, let services = peripheral.services, !services.isEmpty else { finish(error: "Services BLE indisponibles."); return }
        remainingServices = services.count
        for service in services { peripheral.discoverCharacteristics(nil, for: service) }
    }
    private var remainingServices = 0
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard peripheral.identifier == self.peripheral?.identifier, printCall != nil else { return }
        remainingServices -= 1
        if error == nil, characteristic == nil, let candidate = service.characteristics?.first(where: { profiles.contains($0.uuid.uuidString) && ($0.properties.contains(.write) || $0.properties.contains(.writeWithoutResponse)) }) {
            characteristic = candidate
        }
        if remainingServices == 0 {
            if characteristic != nil { pump() }
            else { finish(error: "Profil BLE ESC/POS non reconnu. Ce modèle peut nécessiter un autre pilote.") }
        }
    }
    private func pump() {
        guard let device = peripheral, let characteristic = characteristic, printCall != nil, !awaitingWriteResponse, pumpTimer == nil else { return }
        guard offset < bytes.count else { finish(error: nil); return }
        let type: CBCharacteristicWriteType = characteristic.properties.contains(.write) ? .withResponse : .withoutResponse
        if type == .withoutResponse && !device.canSendWriteWithoutResponse { return }
        let count = min(180, device.maximumWriteValueLength(for: type), bytes.count - offset)
        guard count > 0 else { finish(error: "Taille BLE invalide."); return }
        awaitingWriteResponse = type == .withResponse
        device.writeValue(bytes.subdata(in: offset..<(offset + count)), for: characteristic, type: type)
        offset += count
        if type == .withoutResponse {
            let generation = printGeneration
            let task = DispatchWorkItem { [weak self] in
                guard let self = self, self.printGeneration == generation else { return }
                self.pumpTimer = nil; self.pump()
            }
            pumpTimer = task
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.02, execute: task)
        }
    }
    public func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        guard peripheral.identifier == self.peripheral?.identifier, characteristic.uuid == self.characteristic?.uuid, printCall != nil, awaitingWriteResponse else { return }
        awaitingWriteResponse = false
        if error != nil { finish(error: "Envoi interrompu. Vérifiez le ticket avant de réimprimer.") } else { pump() }
    }
    public func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
        if peripheral.identifier == self.peripheral?.identifier { pump() }
    }
    private func finish(error: String?) {
        timeout?.cancel(); timeout = nil
        pumpTimer?.cancel(); pumpTimer = nil; printGeneration = nil; awaitingWriteResponse = false
        let call = printCall; printCall = nil
        if let error = error { call?.reject(error) }
        else { call?.resolve(["status": "sent", "address": peripheral?.identifier.uuidString ?? ""]) }
        if error != nil, let device = peripheral, device.state != .disconnected {
            disconnecting.insert(device.identifier)
            central?.cancelPeripheralConnection(device)
        }
        characteristic = nil; peripheral = nil; targetId = nil; connecting = false; bytes = Data()
    }
}

// Render HTML to ESC/POS raster bytes so accents, logos and layout do not depend on a code page.
private enum PosEscPosRaster {
    static func ticket(html: String, width: Int) throws -> Data {
        let scale: CGFloat = 203.0 / 72.0
        let document = try ReceiptLogoDocument(html: html)
        let renderer = try ReceiptLogoPageRenderer(document: document, size: CGSize(width: CGFloat(width) / scale, height: 2048 / scale))
        let pages = renderer.numberOfPages
        guard pages > 0 && pages <= 20 else { throw NSError(domain: "VtaPrint", code: 1, userInfo: [NSLocalizedDescriptionKey: "Ticket vide ou trop long."]) }
        renderer.prepare(forDrawingPages: NSRange(location: 0, length: pages))
        var data = EscPosRaster.initialize
        for page in 0..<pages {
            let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
            let image = UIGraphicsImageRenderer(size: CGSize(width: CGFloat(width), height: 2048), format: format).image { context in
                UIColor.white.setFill(); context.fill(CGRect(x: 0, y: 0, width: width, height: 2048))
                context.cgContext.scaleBy(x: scale, y: scale)
                renderer.drawPage(at: page, in: renderer.paperRect)
            }
            guard let cg = image.cgImage else { throw NSError(domain: "VtaPrint", code: 3, userInfo: [NSLocalizedDescriptionKey: "Rendu du ticket impossible."]) }
            let height = cg.height
            var pixels = [UInt8](repeating: 255, count: width * height)
            let ok = pixels.withUnsafeMutableBytes { pointer -> Bool in
                guard let ctx = CGContext(data: pointer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return false }
                ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height)); return true
            }
            guard ok else { throw NSError(domain: "VtaPrint", code: 2) }
            data.append(try EscPosRaster.encode(grayscale: pixels, width: width, height: height))
        }
        guard data.count > EscPosRaster.initialize.count else { throw NSError(domain: "VtaPrint", code: 4, userInfo: [NSLocalizedDescriptionKey: "Le ticket ne contient aucun élément imprimable."]) }
        data.append(EscPosRaster.feedAndCut)
        return data
    }
}
