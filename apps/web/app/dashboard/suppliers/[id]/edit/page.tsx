import { SupplierForm } from "../../supplier-form";
export default async function EditSupplierPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <div className="space-y-5"><div><p className="text-sm font-medium text-brand-600">Achats</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">Modifier fournisseur</h1></div><SupplierForm supplierId={id}/></div>}
