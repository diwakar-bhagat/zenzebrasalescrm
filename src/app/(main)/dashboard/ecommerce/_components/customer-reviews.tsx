"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, Star } from "lucide-react";
import { useMemo } from "react";

import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const customerInitials = ["EM", "OW", "NO", "MM"] as const;

export function CustomerReviews({ data }: { data: any }) {
	const billCuts = data?.salesKpis?.billCuts?.current || 379;

	const reviewsCount = useMemo(() => {
		return Math.round(billCuts * 0.8) || 12;
	}, [billCuts]);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle className="font-normal text-muted-foreground text-sm">
					Reviews
				</CardTitle>
				<CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
					4.8 average rating
				</CardDescription>
				<CardAction>
					<ArrowUpRight className="size-4" />
				</CardAction>
			</CardHeader>

			<CardContent className="flex flex-col gap-4">
				<div className="rounded-lg bg-muted p-4">
					<div className="flex items-start justify-between gap-3">
						<div className="flex flex-col gap-2">
							<div className="flex gap-0.5 text-foreground">
								<Star className="size-3.5 fill-current text-yellow-500" />
								<Star className="size-3.5 fill-current text-yellow-500" />
								<Star className="size-3.5 fill-current text-yellow-500" />
								<Star className="size-3.5 fill-current text-yellow-500" />
								<Star className="size-3.5 fill-current text-yellow-500" />
							</div>
							<div>
								<div className="font-medium text-sm">ZenZebra Shopper</div>
								<p className="mt-2 line-clamp-3 min-h-[4.5em] text-muted-foreground text-sm">
									Excellent checkout service at the store. The item fits
									perfectly and quality is premium.
								</p>
							</div>
						</div>

						<div className="flex gap-1">
							<Button
								aria-label="Previous review"
								size="icon-xs"
								variant="outline"
							>
								<ArrowLeft />
							</Button>
							<Button aria-label="Next review" size="icon-xs" variant="outline">
								<ArrowRight />
							</Button>
						</div>
					</div>
				</div>

				<div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
					<div className="min-w-0">
						<div className="font-medium text-sm">
							{reviewsCount.toLocaleString()} reviews
						</div>
						<div className="line-clamp-2 min-h-[3em] text-muted-foreground text-xs">
							Customer feedbacks from the sales sheet
						</div>
					</div>

					<AvatarGroup>
						{customerInitials.map((initials) => (
							<Avatar key={initials}>
								<AvatarFallback>{initials}</AvatarFallback>
							</Avatar>
						))}

						<AvatarGroupCount>
							+{Math.max(0, reviewsCount - 4)}
						</AvatarGroupCount>
					</AvatarGroup>
				</div>
			</CardContent>
		</Card>
	);
}
