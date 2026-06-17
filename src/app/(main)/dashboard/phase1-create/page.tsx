import { OperationsScreen } from "@/components/operations/operations-screen";

export default function SampleCreatePage() {
	return (
		<OperationsScreen
			mode="sample-create"
			title="Sample Create"
			description="Create and review sampling requests against live order references."
		/>
	);
}
