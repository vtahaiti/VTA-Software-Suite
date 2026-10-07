import { ProductForm } from "../../product-form";
export default async function EditProductPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <div className="space-y-5"><div><p className="text-sm font-medium text-brand-600">Produits</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">Modifier un produit</h1></div><ProductForm productId={id}/></div>}
