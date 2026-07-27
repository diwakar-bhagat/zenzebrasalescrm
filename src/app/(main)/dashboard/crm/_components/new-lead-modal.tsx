"use client";

import { Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface NewLeadModalProps {
	onLeadCreated?: () => void;
}

export function NewLeadModal({ onLeadCreated }: NewLeadModalProps) {
	const [open, setOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		partnerName: "",
		email: "",
		phone: "",
		stage: "Qualified",
		expectedRevenue: "",
		store: "KLJ",
		salesperson: "Sales Rep",
		notes: "",
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.name.trim()) return;

		setIsSubmitting(true);
		try {
			const res = await fetch("/api/crm/leads", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...formData,
					expectedRevenue: Number(formData.expectedRevenue || 0),
				}),
			});

			const json = await res.json();
			if (json.success) {
				setOpen(false);
				setFormData({
					name: "",
					partnerName: "",
					email: "",
					phone: "",
					stage: "Qualified",
					expectedRevenue: "",
					store: "KLJ",
					salesperson: "Sales Rep",
					notes: "",
				});
				if (onLeadCreated) onLeadCreated();
			}
		} catch (err) {
			console.error("Failed to submit lead", err);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm" className="gap-2">
					<Plus className="size-4" />
					Add Opportunity
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<UserPlus className="size-5 text-primary" />
							Create Opportunity
						</DialogTitle>
						<DialogDescription>
							Add a new deal or lead into the ZenZebra sales pipeline.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="name">Opportunity / Deal Name *</Label>
							<Input
								id="name"
								placeholder="e.g. Enterprise Corporate Merchandise Order"
								value={formData.name}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, name: e.target.value }))
								}
								required
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="partnerName">Customer / Company</Label>
								<Input
									id="partnerName"
									placeholder="e.g. Acme Corp"
									value={formData.partnerName}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											partnerName: e.target.value,
										}))
									}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="expectedRevenue">Expected Value (₹)</Label>
								<Input
									id="expectedRevenue"
									type="number"
									placeholder="50000"
									value={formData.expectedRevenue}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											expectedRevenue: e.target.value,
										}))
									}
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="phone">Mobile Phone</Label>
								<Input
									id="phone"
									placeholder="9876543210"
									value={formData.phone}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, phone: e.target.value }))
									}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="email">Email Address</Label>
								<Input
									id="email"
									type="email"
									placeholder="contact@acme.com"
									value={formData.email}
									onChange={(e) =>
										setFormData((prev) => ({ ...prev, email: e.target.value }))
									}
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="stage">Initial Stage</Label>
								<Select
									value={formData.stage}
									onValueChange={(val) =>
										setFormData((prev) => ({ ...prev, stage: val }))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select Stage" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="Qualified">Qualified</SelectItem>
										<SelectItem value="Discovery">Discovery</SelectItem>
										<SelectItem value="Proposal Sent">Proposal Sent</SelectItem>
										<SelectItem value="Negotiation">Negotiation</SelectItem>
										<SelectItem value="Closed Won">Closed Won</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="grid gap-2">
								<Label htmlFor="store">Store Location</Label>
								<Select
									value={formData.store}
									onValueChange={(val) =>
										setFormData((prev) => ({ ...prev, store: val }))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select Store" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="KLJ">Klj store</SelectItem>
										<SelectItem value="SmartworksNoida">
											SmartworksNoida Noida
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="notes">Notes & Key Details</Label>
							<Textarea
								id="notes"
								placeholder="Enter key customer requirements, budget, timeline..."
								rows={3}
								value={formData.notes}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, notes: e.target.value }))
								}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Creating..." : "Save Opportunity"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
