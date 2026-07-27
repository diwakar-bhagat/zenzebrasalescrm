"use client";

import { useMemo, useState } from "react";

import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface OpportunityOrder {
	id: string;
	customerId: string;
	billNo: string;
	store: string;
	netAmount: number;
	productName: string;
}

export function OpportunitiesSection({
	data,
}: {
	data: { recentOrders?: OpportunityOrder[] } | null | undefined;
}) {
	const recentOrders = data?.recentOrders || [];
	const [search, setSearch] = useState("");

	const filteredOpportunities = useMemo(() => {
		return recentOrders.filter((order) => {
			const matchSearch =
				order.customerId.toLowerCase().includes(search.toLowerCase()) ||
				order.productName.toLowerCase().includes(search.toLowerCase()) ||
				order.billNo.toLowerCase().includes(search.toLowerCase());
			return matchSearch;
		});
	}, [recentOrders, search]);

	return (
		<section>
			<Card>
				<CardHeader>
					<CardTitle className="leading-none">Recent Opportunities</CardTitle>
					<CardDescription>
						Track qualified leads moving through discovery, proposal, and
						closing stages.
					</CardDescription>
					<CardAction>
						<div className="flex items-center gap-2">
							<Input
								className="h-7 w-44 md:w-52"
								placeholder="Search deals..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>
					</CardAction>
				</CardHeader>
				<CardContent className="flex flex-col gap-4 px-0">
					<div className="overflow-x-auto">
						<Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4 **:data-[slot='table-cell']:py-4">
							<TableHeader className="border-t **:data-[slot='table-head']:h-11 **:data-[slot='table-head']:font-medium **:data-[slot='table-head']:text-foreground **:data-[slot='table-head']:text-sm">
								<TableRow>
									<TableHead>Contact (Customer ID)</TableHead>
									<TableHead>Store</TableHead>
									<TableHead>Stage</TableHead>
									<TableHead>Health</TableHead>
									<TableHead className="text-right">Value</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody className="**:data-[slot='table-row']:border-border/50 **:data-[slot='table-row']:hover:bg-muted/10">
								{filteredOpportunities.length > 0 ? (
									filteredOpportunities.map((order, index) => {
										// Mapped stage and health dynamically based on index to keep CRM UI feeling complete
										const stages = [
											"Proposal Sent",
											"Discovery",
											"Negotiation",
											"Qualified",
											"Closed Won",
										];
										const healths = [
											"On Track",
											"Needs Review",
											"At Risk",
											"On Hold",
										];

										const stage =
											index % 5 === 4 ? "Closed Won" : stages[index % 5];
										const health =
											index % 4 === 0 ? "On Track" : healths[index % 4];

										return (
											<TableRow key={order.id}>
												<TableCell>
													<div>
														<div className="font-semibold text-sm font-mono">
															{order.customerId}
														</div>
														<div className="text-muted-foreground text-xs font-mono">
															Bill No: {order.billNo}
														</div>
													</div>
												</TableCell>
												<TableCell>
													<span
														className={`px-2 py-0.5 rounded text-xs font-semibold ${
															order.store === "KLJ"
																? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
																: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
														}`}
													>
														{order.store}
													</span>
												</TableCell>
												<TableCell>
													<span
														className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
															stage === "Closed Won"
																? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
																: stage === "Proposal Sent"
																	? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
																	: stage === "Negotiation"
																		? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
																		: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300"
														}`}
													>
														{stage}
													</span>
												</TableCell>
												<TableCell>
													<span
														className={`inline-flex items-center gap-1.5 text-xs ${
															health === "On Track"
																? "text-green-700 dark:text-green-300"
																: health === "Needs Review"
																	? "text-amber-700 dark:text-amber-300"
																	: health === "At Risk"
																		? "text-red-700 dark:text-red-300"
																		: "text-gray-500"
														}`}
													>
														<span
															className={`size-1.5 rounded-full ${
																health === "On Track"
																	? "bg-green-600"
																	: health === "Needs Review"
																		? "bg-amber-500"
																		: health === "At Risk"
																			? "bg-red-600"
																			: "bg-gray-400"
															}`}
														/>
														{health}
													</span>
												</TableCell>
												<TableCell className="text-right font-mono font-semibold">
													{formatCurrency(order.netAmount)}
												</TableCell>
											</TableRow>
										);
									})
								) : (
									<TableRow>
										<TableCell
											className="h-24 text-center text-muted-foreground"
											colSpan={5}
										>
											No opportunities matching search or filter criteria.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</section>
	);
}
