import { OperationsScreen } from "@/components/operations/operations-screen";

export default function SuppliersPage() {
	return (
		<OperationsScreen
			mode="suppliers"
			title="Supplier Performance"
			description="Supplier scorecard with delivery, fulfillment, and pricing signals."
		/>
	);
}
