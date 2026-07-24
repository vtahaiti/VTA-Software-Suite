import { redirect } from "next/navigation";

export default function SalesOrdersRedirect() {
  redirect("/dashboard/sales/proformas");
}
