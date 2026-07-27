import { useEffect, useState } from "react";
import { useFilterStore } from "@/stores/founder/filter-store";

export function useRetention(hasData: boolean) {
	const [data, setData] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);

	const { startDate, endDate, store, categoryScope } = useFilterStore();

	useEffect(() => {
		if (!hasData) return;

		const fetchData = async () => {
			setIsLoading(true);
			try {
				const params = new URLSearchParams({ startDate, endDate });
				if (store !== "ALL") params.set("store", store);
				if (categoryScope !== "all") params.set("categoryScope", categoryScope);

				const res = await fetch(
					`/api/customer-retention/overview?${params.toString()}`,
				);
				const json = await res.json();
				if (json.success) {
					setData(json.data);
				}
			} catch (err) {
				console.error("Failed to fetch retention overview", err);
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [hasData, startDate, endDate, store, categoryScope]);

	return { data, isLoading };
}
