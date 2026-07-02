"use client";

import {
	AlertCircle,
	CheckCircle2,
	FileType,
	Loader2,
	UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { resolveColumnMappings } from "@/lib/parser/excel-parser";
import { resolveInventoryColumnMappings } from "@/lib/parser/inventory-parser";
import { resolvePurchaseColumnMappings } from "@/lib/parser/purchase-parser";

export default function FounderUploadPage() {
	const router = useRouter();
	const [file, setFile] = useState<File | null>(null);
	const [batchId, setBatchId] = useState<number | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [validationResult, setValidationResult] = useState<any>(null);
	const [uploadType, setUploadType] = useState<"full_replace" | "incremental">(
		"incremental",
	);
	const [dataType, setDataType] = useState<"sales" | "purchase" | "inventory">(
		"sales",
	);
	const [preflight, setPreflight] = useState<{
		hasExistingData: boolean;
		existingRowCount: number;
		existingDateRange: { start: string; end: string } | null;
	} | null>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			const selected = e.target.files[0];
			setFile(selected);
			setValidationResult(null);
			setPreflight(null);
		}
	};

	const processFile = async () => {
		if (!file) return;

		setIsProcessing(true);
		setProgress(5);
		setValidationResult(null);
		setPreflight(null);

		try {
			// 1. Read file in browser using SheetJS
			const XLSX = await import("xlsx");
			const reader = new FileReader();

			const parsePromise = new Promise<any[]>((resolve, reject) => {
				reader.onload = (e) => {
					try {
						const data = new Uint8Array(e.target?.result as ArrayBuffer);
						const workbook = XLSX.read(data, { type: "array" });
						const sheetName = workbook.SheetNames.includes("main")
							? "main"
							: workbook.SheetNames[0];
						const worksheet = sheetName
							? workbook.Sheets[sheetName]
							: undefined;
						if (!worksheet) {
							reject(new Error("No worksheet found in the workbook."));
							return;
						}
						const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
							worksheet,
							{
								raw: true,
								defval: null,
							},
						);
						resolve(rawRows);
					} catch (err) {
						reject(err);
					}
				};
				reader.onerror = () => reject(new Error("File reading failed."));
				reader.readAsArrayBuffer(file);
			});

			const rawRows = await parsePromise;
			setProgress(15);

			if (rawRows.length === 0) {
				throw new Error("Excel sheet is empty.");
			}

			// 2. Validate columns locally first
			const firstRow = rawRows[0];
			if (!firstRow) {
				throw new Error("No rows found in the sheet.");
			}
			const mappingResult =
				dataType === "inventory"
					? resolveInventoryColumnMappings(firstRow)
					: dataType === "purchase"
						? resolvePurchaseColumnMappings(firstRow)
						: resolveColumnMappings(firstRow);
			if (!mappingResult.isValid) {
				throw new Error(
					`Column mapping validation failed:\n- ${mappingResult.errors.join("\n- ")}`,
				);
			}

			// 3. Start batch on server
			const startRes = await fetch("/api/sales/imports?mode=start_batch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ filename: file.name, dataType }),
			});
			const startData = await startRes.json();
			if (!startRes.ok || !startData.success) {
				throw new Error(startData.error || "Failed to start upload batch.");
			}

			const allocatedBatchId = startData.data.batchId;
			setBatchId(allocatedBatchId);
			setProgress(20);

			// 4. Upload in chunks
			const CHUNK_SIZE = 2000;
			const totalChunks = Math.ceil(rawRows.length / CHUNK_SIZE);

			for (let i = 0; i < totalChunks; i++) {
				const chunkRows = rawRows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
				const chunkRes = await fetch("/api/sales/imports?mode=upload_chunk", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						batchId: allocatedBatchId,
						chunkIndex: i,
						rows: chunkRows,
						dataType,
					}),
				});
				const chunkData = await chunkRes.json();
				if (!chunkRes.ok || !chunkData.success) {
					throw new Error(
						chunkData.error || `Failed to upload chunk ${i + 1}.`,
					);
				}

				const chunkProgress = 20 + Math.round(((i + 1) / totalChunks) * 60);
				setProgress(chunkProgress);
			}

			// 5. Run validation on staged batch
			setProgress(85);
			const valRes = await fetch("/api/sales/imports?mode=validate_batch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ batchId: allocatedBatchId, dataType }),
			});
			const valData = await valRes.json();

			if (valRes.ok && valData.success) {
				setValidationResult(valData.data);
				setProgress(95);

				// Run preflight check only for sales data and if we have a valid date range
				if (
					dataType === "sales" &&
					valData.data?.dateRange?.start &&
					valData.data?.dateRange?.end
				) {
					try {
						const pfRes = await fetch(
							`/api/sales/imports/preflight?startDate=${valData.data.dateRange.start}&endDate=${valData.data.dateRange.end}`,
						);
						const pfData = await pfRes.json();
						if (pfData.success) setPreflight(pfData.data);
					} catch (_) {
						// preflight failure is non-blocking
					}
				}
			} else {
				toast.error(valData.error || "Validation failed");
				setValidationResult({
					errors: [
						{
							row: 0,
							field: "system",
							error: valData.error || "Unknown error",
						},
					],
				});
			}
		} catch (err: unknown) {
			console.error(err);
			const msg = err instanceof Error ? err.message : String(err);
			toast.error("Failed to process file: " + msg);
		} finally {
			setProgress(100);
			setIsProcessing(false);
		}
	};

	const handleCommit = async () => {
		if (!validationResult || !batchId) return;

		if (uploadType === "full_replace") {
			const confirmed = window.confirm(
				dataType === "purchase"
					? "WARNING: You are about to perform a Full Replace Upload. This will backup and wipe all existing historical data in the purchase_fact table. Are you sure you want to proceed?"
					: "WARNING: You are about to perform a Full Replace Upload. This will backup and wipe all existing historical data in the sales_fact table. Are you sure you want to proceed?",
			);
			if (!confirmed) return;
		}

		setIsProcessing(true);

		try {
			const res = await fetch("/api/sales/imports?mode=commit_batch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					batchId,
					uploadType,
					dataType,
				}),
			});

			const data = await res.json();

			if (res.ok && data.success) {
				toast.success(`Successfully imported ${data.data.rowsInserted} rows!`);
				router.push(
					dataType === "purchase" ? "/dashboard/ecommerce" : "/dashboard/sales",
				);
			} else {
				toast.error(data.error || "Failed to commit data");
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error("Upload failed: " + msg);
		} finally {
			setIsProcessing(false);
		}
	};
	return (
		<div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">
						{dataType === "purchase"
							? "Upload Purchase Data"
							: "Upload Sales Data"}
					</h2>
					<p className="text-muted-foreground mt-1">
						{dataType === "purchase"
							? "Upload your daily purchase sheet to update the Store Overview."
							: "Upload your daily sales sheet to update the Sales Dashboard."}
					</p>
				</div>
				<Button
					variant="outline"
					onClick={() =>
						router.push(
							dataType === "purchase"
								? "/dashboard/ecommerce"
								: "/dashboard/sales",
						)
					}
				>
					Back to Dashboard
				</Button>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Select File</CardTitle>
						<CardDescription>
							Upload an Excel (.xlsx) or CSV file matching the canonical schema.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1.5">
								<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
									Data Type
								</span>
								<Select
									value={dataType}
									onValueChange={(v) => {
										setDataType(v as "sales" | "purchase" | "inventory");
										setValidationResult(null);
										setPreflight(null);
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="Data type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="sales">Sales Data</SelectItem>
										<SelectItem value="purchase">Purchase Data</SelectItem>
										<SelectItem value="inventory">
											Inventory Pricing & Stock
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5">
								<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
									Upload Type
								</span>
								<Select
									value={uploadType}
									onValueChange={(v) =>
										setUploadType(v as "full_replace" | "incremental")
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Upload type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="full_replace">
											Full replace (morning file)
										</SelectItem>
										<SelectItem value="incremental">
											Incremental (today only)
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<label
							htmlFor="file-upload"
							className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-10 text-center transition-colors hover:bg-muted/40"
						>
							<input
								id="file-upload"
								type="file"
								accept=".xlsx, .xls, .csv"
								className="hidden"
								onChange={handleFileChange}
							/>
							<UploadCloud className="size-10 text-muted-foreground mb-4" />
							<h3 className="font-semibold text-lg">Click to select file</h3>
							<p className="text-sm text-muted-foreground mt-1">
								or drag and drop your file here
							</p>

							{file && (
								<div className="mt-6 flex items-center p-3 bg-background border rounded-md shadow-sm">
									<FileType className="size-5 text-blue-500 mr-3" />
									<div className="text-left">
										<p className="text-sm font-medium">{file.name}</p>
										<p className="text-xs text-muted-foreground">
											{(file.size / 1024).toFixed(2)} KB
										</p>
									</div>
								</div>
							)}
						</label>

						{isProcessing && (
							<div className="space-y-2 mt-4">
								<div className="flex justify-between text-sm">
									<span>Processing...</span>
									<span>{progress}%</span>
								</div>
								<Progress value={progress} />
							</div>
						)}
					</CardContent>
					<CardFooter>
						<Button
							className="w-full"
							onClick={processFile}
							disabled={!file || isProcessing}
						>
							{isProcessing && <Loader2 className="mr-2 size-4 animate-spin" />}
							Validate Data
						</Button>
					</CardFooter>
				</Card>

				{validationResult && (
					<Card
						className={
							validationResult.isValid
								? "border-green-500/50"
								: "border-red-500/50"
						}
					>
						<CardHeader>
							<CardTitle className="flex items-center">
								Validation Results
								{validationResult.isValid ? (
									<Badge
										variant="outline"
										className="ml-2 bg-green-500/10 text-green-600 border-green-500/20"
									>
										<CheckCircle2 className="mr-1 size-3" /> Ready
									</Badge>
								) : (
									<Badge
										variant="outline"
										className="ml-2 bg-red-500/10 text-red-600 border-red-500/20"
									>
										<AlertCircle className="mr-1 size-3" /> Failed
									</Badge>
								)}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="bg-muted/50 p-4 rounded-lg">
										<p className="text-sm text-muted-foreground mb-1">
											Total Rows Processed
										</p>
										<p className="text-2xl font-bold">
											{validationResult.totalRows || 0}
										</p>
									</div>
									<div className="bg-muted/50 p-4 rounded-lg">
										<p className="text-sm text-muted-foreground mb-1">
											Valid Rows
										</p>
										<p className="text-2xl font-bold text-green-600">
											{validationResult.validRows || 0}
										</p>
									</div>
								</div>
								{validationResult.dateRange?.start &&
									validationResult.dateRange?.end && (
										<div className="bg-muted/50 p-4 rounded-lg">
											<p className="text-sm text-muted-foreground mb-1">
												Date Range
											</p>
											<p className="font-medium">
												{validationResult.dateRange.start} to{" "}
												{validationResult.dateRange.end}
											</p>
										</div>
									)}

								{validationResult.errors?.length > 0 && (
									<div className="mt-4">
										<h4 className="font-medium text-sm text-amber-600 mb-2 flex items-center">
											<AlertCircle className="mr-2 size-4" />
											Quarantined Rows (first 10)
										</h4>
										<div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3 max-h-60 overflow-y-auto">
											<ul className="text-sm space-y-2">
												{validationResult.errors
													.slice(0, 10)
													.map(
														(err: { rowNumber: number; errors: string[] }) => (
															<li
																key={`${err.rowNumber}-${err.errors?.join("|")}`}
																className="text-amber-700"
															>
																<strong>Row {err.rowNumber}:</strong>{" "}
																{err.errors?.join(", ")}
															</li>
														),
													)}
												{validationResult.errors.length > 10 && (
													<li className="text-muted-foreground text-xs pt-2">
														...and {validationResult.errors.length - 10} more
														errors
													</li>
												)}
											</ul>
										</div>
									</div>
								)}

								{validationResult.normalizationReport && (
									<div className="mt-4 border-t pt-4">
										<h4 className="font-semibold text-sm mb-3">
											Store Ingestion Mapping Report
										</h4>
										<div className="space-y-3">
											{Object.entries(validationResult.normalizationReport).map(
												([canonicalName, info]: [string, any]) => (
													<div
														key={canonicalName}
														className="bg-muted/30 p-3 rounded-lg border border-border/50 text-sm"
													>
														<div className="flex justify-between items-center mb-1">
															<span className="font-medium">
																{info.displayName}
															</span>
															<Badge
																variant="secondary"
																className="font-semibold"
															>
																{info.totalRows.toLocaleString()} rows
															</Badge>
														</div>
														<p className="text-xs text-muted-foreground mb-2">
															Canonical Store: {canonicalName}
														</p>
														<div className="pl-2 border-l-2 border-border space-y-1">
															{info.rawSourcesCount &&
																Object.entries(info.rawSourcesCount).map(
																	([rawSource, count]: [string, any]) => (
																		<div
																			key={rawSource}
																			className="flex justify-between text-xs text-muted-foreground"
																		>
																			<span>&ldquo;{rawSource}&rdquo;</span>
																			<span>{count.toLocaleString()} rows</span>
																		</div>
																	),
																)}
														</div>
													</div>
												),
											)}
										</div>
									</div>
								)}
							</div>
						</CardContent>
						<CardFooter className="flex flex-col gap-3">
							{/* Preflight conflict warning */}
							{preflight && (
								<div
									className={`w-full p-4 rounded-lg border flex items-start gap-3 ${
										preflight.hasExistingData
											? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
											: "bg-green-500/10 border-green-500/30 text-green-800 dark:text-green-200"
									}`}
								>
									<div className="mt-0.5 shrink-0">
										{preflight.hasExistingData ? (
											<AlertCircle className="size-5 text-amber-500" />
										) : (
											<CheckCircle2 className="size-5 text-green-500" />
										)}
									</div>
									<div className="text-sm">
										{preflight.hasExistingData ? (
											<>
												<p className="font-semibold">
													⚠️ Existing data found for{" "}
													{preflight.existingDateRange?.start} →{" "}
													{preflight.existingDateRange?.end}
												</p>
												<p className="mt-1 opacity-90">
													Committing will <strong>update</strong>{" "}
													{preflight.existingRowCount.toLocaleString()} existing
													records and insert new ones. No data will be
													permanently deleted.
												</p>
											</>
										) : (
											<p className="font-semibold">
												✅ No existing data for this date range — safe to
												commit.
											</p>
										)}
									</div>
								</div>
							)}

							<Button
								className="w-full"
								variant={validationResult.isValid ? "default" : "destructive"}
								disabled={!validationResult.isValid || isProcessing}
								onClick={handleCommit}
							>
								{isProcessing && (
									<Loader2 className="mr-2 size-4 animate-spin" />
								)}
								{validationResult.isValid
									? "Commit Valid Rows"
									: "No Valid Rows to Commit"}
							</Button>
						</CardFooter>
					</Card>
				)}
			</div>
		</div>
	);
}
