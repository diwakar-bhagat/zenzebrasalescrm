import { redirect } from "next/navigation";

export default function SegmentsPage() {
	redirect("/dashboard/retention?tab=segments");
}
