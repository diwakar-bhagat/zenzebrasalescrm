/**
 * ZenZebra CRM Background Job Scheduler
 * Manages asynchronous tasks like view refreshes, RFM scoring runs, and log cleanup.
 */

import { sql } from "@/lib/db";

export interface ScheduledJob {
	id: string;
	name: string;
	cronSchedule: string;
	lastRun?: string;
	status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
	handler: () => Promise<void>;
}

class JobScheduler {
	private jobs: Map<string, ScheduledJob> = new Map();

	constructor() {
		this.registerDefaultJobs();
	}

	private registerDefaultJobs(): void {
		this.registerJob({
			id: "job_refresh_views",
			name: "Refresh Materialized Views",
			cronSchedule: "0 * * * *", // Hourly
			status: "IDLE",
			handler: async () => {
				// Execution placeholder for refreshing cache or analytical tables
				await sql`SELECT 1;`;
			},
		});

		this.registerJob({
			id: "job_recalculate_rfm",
			name: "Recalculate RFM Scores",
			cronSchedule: "0 2 * * *", // Daily at 2 AM
			status: "IDLE",
			handler: async () => {
				await sql`SELECT 1;`;
			},
		});

		this.registerJob({
			id: "job_odoo_sync",
			name: "Odoo Standard Sync Engine",
			cronSchedule: "*/5 * * * *", // Every 5 minutes
			status: "IDLE",
			handler: async () => {
				const { runSyncPipeline } = await import("../odoo/sync/orchestrator");
				await runSyncPipeline();
			},
		});
	}

	public registerJob(job: ScheduledJob): void {
		this.jobs.set(job.id, job);
	}

	public async runJob(jobId: string): Promise<boolean> {
		const job = this.jobs.get(jobId);
		if (!job) return false;

		job.status = "RUNNING";
		try {
			await job.handler();
			job.status = "COMPLETED";
			job.lastRun = new Date().toISOString();
			return true;
		} catch (err) {
			console.error(`Job '${job.name}' failed:`, err);
			job.status = "FAILED";
			return false;
		}
	}

	public getJobs(): ScheduledJob[] {
		return Array.from(this.jobs.values());
	}
}

export const jobScheduler = new JobScheduler();
