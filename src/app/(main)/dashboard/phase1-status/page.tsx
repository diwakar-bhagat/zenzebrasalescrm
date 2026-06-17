import { OperationsScreen } from "@/components/operations/operations-screen";

export default function SamplingStatusPage() {
	return (
		<OperationsScreen
			mode="sampling-status"
			title="Sampling Status"
			description="Track pattern, cutting, stitching, and deadline status."
		/>
	);
}
