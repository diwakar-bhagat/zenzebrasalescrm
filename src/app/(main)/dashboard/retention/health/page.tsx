import { redirect } from "next/navigation";

export default function CustomerHealthPage() {
	redirect("/dashboard/retention?tab=segments-health");
}
