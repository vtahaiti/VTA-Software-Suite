import { CustomerForm } from "../../customer-form";
export default async function EditCustomerPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <div className="space-y-5"><div><p className="text-sm font-medium text-brand-600">CRM</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">Modifier client</h1></div><CustomerForm customerId={id}/></div>}
