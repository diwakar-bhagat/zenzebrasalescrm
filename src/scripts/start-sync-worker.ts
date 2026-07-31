import { AlwaysOnSyncWorker } from "../lib/odoo/sync/worker";

async function main() {
	console.log("==================================================");
	console.log("⚡ Starting ZenZebra Always-On Odoo SaaS Sync Worker");
	console.log("==================================================");

	const worker = new AlwaysOnSyncWorker();

	// Graceful shutdown handling
	process.on("SIGINT", () => {
		console.log("\n[SIGINT] Shutting down sync worker...");
		worker.stop();
		process.exit(0);
	});

	process.on("SIGTERM", () => {
		console.log("\n[SIGTERM] Shutting down sync worker...");
		worker.stop();
		process.exit(0);
	});

	await worker.start();
}

main().catch((err) => {
	console.error("❌ Fatal error in sync worker runner:", err);
	process.exit(1);
});
