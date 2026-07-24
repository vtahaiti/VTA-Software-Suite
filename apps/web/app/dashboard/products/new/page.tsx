import { redirect } from "next/navigation";

export default function ProductsNewRedirect() {
  redirect("/dashboard/products/create");
}
