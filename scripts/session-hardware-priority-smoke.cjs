const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${message}`);
  }
}

const apiClient = read("apps/web/lib/api-client.ts");
const productsPage = read("apps/web/app/dashboard/products/page.tsx");
const productForm = read("apps/web/app/dashboard/products/product-form.tsx");
const posPage = read("apps/web/app/dashboard/pos/page.tsx");

assert(apiClient.includes("response.status !== 401 && response.status !== 403"), "fetchWithAuth refreshes on 401 and 403");
assert(productsPage.includes("fetchWithAuth(`${apiUrl}/products?"), "Products list uses authenticated refresh fetch");
assert(productsPage.includes("fetchWithAuth(`${apiUrl}/products`"), "Quick product creation uses authenticated refresh fetch");
assert(productForm.includes("fetchWithAuth(productId ? `${apiUrl}/products/${productId}`"), "Product create/edit uses authenticated refresh fetch");
assert(productForm.includes("fetchWithAuth(`${apiUrl}/products/units`"), "Unit creation uses authenticated refresh fetch");
assert(posPage.includes("fetchWithAuth(`${apiUrl}/pos/products?"), "POS product paging uses authenticated refresh fetch");
assert(posPage.includes("fetchWithAuth(`${apiUrl}/pos/cart/${endpoint}`"), "POS cart operations use authenticated refresh fetch");
assert(posPage.includes("fetchWithAuth(heldSaleId ? `${apiUrl}/pos/held-sales/${heldSaleId}/finalize`"), "POS checkout/finalize uses authenticated refresh fetch");
assert(posPage.includes("fetchWithAuth(`${apiUrl}/pos/held-sales`"), "POS held sale save uses authenticated refresh fetch");
assert(posPage.includes("fetchWithAuth(`${apiUrl}/pos/customers`"), "POS quick customer uses authenticated refresh fetch");
assert(productForm.includes("Suggestions Quincaillerie / Matériaux"), "Hardware/material suggestions are visible in product form");
assert(productForm.includes('type: "Fer / acier"') && productForm.includes('units: ["barre", "tonne", "kg", "mètre"]'), "Fer/acier unit suggestions include barre, tonne, kg, metre");
assert(productForm.includes('type: "Ciment"') && productForm.includes('units: ["sac", "palette"]'), "Ciment unit suggestions include sac and palette");
assert(productForm.includes('type: "Peinture"') && productForm.includes('units: ["gallon", "litre"]'), "Peinture unit suggestions include gallon and litre");

if (process.exitCode) process.exit(process.exitCode);
