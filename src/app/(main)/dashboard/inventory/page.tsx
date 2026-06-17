import { OperationsScreen } from "@/components/operations/operations-screen";

export default function InventoryPage() {
	return (
		<OperationsScreen
			mode="inventory"
			title="Fabric and Trim Inventory"
			description="Inventory health, stock pressure, and supplier coverage."
		/>
	);
}
