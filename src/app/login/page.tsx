"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { ZenZebraLogo } from "@/components/brand/ZenZebraLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
	const router = useRouter();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");
		setLoading(true);

		const form = new FormData(event.currentTarget);
		const username = form.get("username");
		const password = form.get("password");

		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});

			if (response.ok) {
				router.replace("/dashboard");
				return;
			}

			// Show the real error message from server for better debugging
			try {
				const data = await response.json();
				setError(data.error || "Invalid credentials");
			} catch {
				setError(`Server error (${response.status})`);
			}
		} catch (err: any) {
			setError(err?.message || "Network error");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex h-dvh items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-8">
				<div className="flex flex-col items-center gap-3">
					<ZenZebraLogo size="lg" showTagline />
				</div>
				<Card>
					<CardHeader className="pb-4">
						<p className="text-center text-muted-foreground text-sm">
							Sign in to your account
						</p>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="username">Username</Label>
								<Input
									id="username"
									name="username"
									type="text"
									autoComplete="username"
									autoFocus
									required
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="password">Password</Label>
								<div className="relative">
									<Input
										id="password"
										name="password"
										type={showPassword ? "text" : "password"}
										autoComplete="current-password"
										required
										className="pr-10"
									/>
									<button
										type="button"
										onClick={() => setShowPassword(!showPassword)}
										className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
										aria-label={
											showPassword ? "Hide password" : "Show password"
										}
									>
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
							</div>
							{error && (
								<p className="text-center text-destructive text-sm">{error}</p>
							)}
							<Button type="submit" className="w-full" disabled={loading}>
								{loading ? "Signing in..." : "Sign in"}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
