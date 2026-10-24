import Capacitor
import StoreKit
import UIKit

@objc(VtaSubscriptionsPlugin)
public class VtaSubscriptionsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VtaSubscriptionsPlugin"
    public let jsName = "VtaSubscriptions"
    public let pluginMethods: [CAPPluginMethod] = ["products", "purchase", "restore", "pending", "finish", "manage"].map {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private let productIDs: Set<String> = ["com.vtaerp.pos.basic.monthly", "com.vtaerp.pos.premium.monthly", "com.vtaerp.pos.pro.monthly"]
    private var unfinished: [UInt64: Transaction] = [:]
    private var observer: Task<Void, Never>?
    private var purchasing = false
    private var intentObserver: Task<Void, Never>?
    private var intentProducts: [String: Product] = [:]

    public override func load() {
        observer = Task { @MainActor [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = result, self.productIDs.contains(transaction.productID) {
                    self.unfinished[transaction.id] = transaction
                    self.notifyListeners("transactionUpdated", data: ["transactionId": String(transaction.id)], retainUntilConsumed: true)
                }
            }
        }
        if #available(iOS 16.4, *) {
            intentObserver = Task { @MainActor [weak self] in
                for await intent in PurchaseIntent.intents {
                    guard let self else { return }
                    if self.productIDs.contains(intent.product.id) {
                        self.intentProducts[intent.product.id] = intent.product
                        self.notifyListeners("purchaseIntent", data: ["productId": intent.product.id], retainUntilConsumed: true)
                    }
                }
            }
        }
    }
    deinit { observer?.cancel(); intentObserver?.cancel() }

    @MainActor private func payload(_ result: VerificationResult<Transaction>) throws -> JSObject {
        guard case .verified(let transaction) = result, productIDs.contains(transaction.productID) else {
            throw NSError(domain: "VTA", code: 1, userInfo: [NSLocalizedDescriptionKey: "Achat Apple non vérifié."])
        }
        unfinished[transaction.id] = transaction
        return ["transactionId": String(transaction.id), "signedTransaction": result.jwsRepresentation,
                "appAccountToken": transaction.appAccountToken?.uuidString.lowercased() ?? ""]
    }

    @objc func products(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                let products = try await Product.products(for: Array(productIDs))
                NSLog("[VTA StoreKit] products returned: %ld", products.count)
                call.resolve(["products": products.filter { $0.subscription?.subscriptionPeriod.unit == .month && $0.subscription?.subscriptionPeriod.value == 1 }.map {
                    ["id": $0.id, "name": $0.displayName, "price": $0.displayPrice]
                }])
            } catch {
                let failure = error as NSError
                NSLog("[VTA StoreKit] product lookup failed: %@ %ld", failure.domain, failure.code)
                call.reject("Impossible de charger les prix Apple. Réessayez avec une connexion Internet.")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard !purchasing else { call.reject("Un achat est déjà en cours."); return }
            guard let id = call.getString("productId"), productIDs.contains(id),
                  let token = call.getString("appAccountToken"), let account = UUID(uuidString: token) else {
                call.reject("Entreprise ou plan invalide."); return
            }
            purchasing = true
            defer { purchasing = false }
            for await entitlement in Transaction.currentEntitlements {
                if case .verified(let existing) = entitlement, productIDs.contains(existing.productID), existing.appAccountToken != account {
                    call.reject("Votre compte Apple possède déjà un abonnement pour une autre entreprise. Utilisez le compte VTA associé."); return
                }
            }
            do {
                let requestedProducts = try await Product.products(for: [id])
                guard let product = intentProducts[id] ?? requestedProducts.first else {
                    call.reject("Ce plan n’est pas encore disponible sur l’App Store."); return
                }
                switch try await product.purchase(options: [.appAccountToken(account)]) {
                case .success(let result): intentProducts.removeValue(forKey: id); call.resolve(["status": "purchased", "transaction": try payload(result)])
                case .pending: call.resolve(["status": "pending"])
                case .userCancelled: call.resolve(["status": "cancelled"])
                @unknown default: call.reject("État de paiement Apple inconnu.")
                }
            } catch { call.reject("L’achat Apple n’a pas pu être confirmé. Vous pouvez restaurer les achats.") }
        }
    }

    @MainActor private func transactions() async throws -> [JSObject] {
        var values: [UInt64: JSObject] = [:]
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, productIDs.contains(transaction.productID) {
                values[transaction.id] = try payload(result)
            }
        }
        for await result in Transaction.unfinished {
            if case .verified(let transaction) = result, productIDs.contains(transaction.productID) {
                values[transaction.id] = try payload(result)
            }
        }
        return Array(values.values)
    }
    @objc func pending(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { call.resolve(["transactions": try await transactions()]) }
            catch { call.reject("Impossible de vérifier les achats Apple.") }
        }
    }
    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                try await AppStore.sync()
                call.resolve(["transactions": try await transactions()])
            } catch { call.reject("La restauration Apple a échoué. Réessayez.") }
        }
    }
    @objc func finish(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let id = UInt64(call.getString("transactionId") ?? ""), let transaction = unfinished[id] else {
                call.reject("Transaction introuvable."); return
            }
            await transaction.finish()
            unfinished.removeValue(forKey: id)
            call.resolve()
        }
    }
    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("Écran Apple indisponible."); return
            }
            do { try await AppStore.showManageSubscriptions(in: scene); call.resolve() }
            catch { call.reject("Impossible d’ouvrir les abonnements Apple.") }
        }
    }
}
