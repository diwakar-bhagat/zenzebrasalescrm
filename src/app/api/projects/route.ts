import { NextResponse } from "next/server";

import { sql } from "@/lib/db";
import { CACHE_KEYS, CACHE_TTL, redis } from "@/lib/redis";
import type { Project } from "@/types/crm";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientFilter = url.searchParams.get("client");
    const statusFilter = url.searchParams.get("status");

    // Build a deterministic cache key based on the filters
    const cacheKey = clientFilter || statusFilter
      ? `projects_filtered:${clientFilter ?? "all"}:${statusFilter ?? "all"}`
      : `projects_list`;

    // 1. Cache-aside: try Redis first
    const cached = redis ? await redis.get<{ projects: Project[]; count: number; cached: boolean }>(cacheKey) : null;
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    // 2. Cache miss — query Neon
    let rows: Awaited<ReturnType<typeof sql>>;

    if (!clientFilter && !statusFilter) {
      rows = await sql`SELECT * FROM public.projects ORDER BY created_at DESC`;
    } else if (clientFilter && statusFilter) {
      rows = await sql`SELECT * FROM public.projects WHERE client = ${clientFilter} AND phase1_status = ${statusFilter} ORDER BY created_at DESC`;
    } else if (clientFilter) {
      rows = await sql`SELECT * FROM public.projects WHERE client = ${clientFilter} ORDER BY created_at DESC`;
    } else {
      rows = await sql`SELECT * FROM public.projects WHERE phase1_status = ${statusFilter} ORDER BY created_at DESC`;
    }

    const payload = { projects: rows as Project[], count: rows.length, cached: false };

    // 3. Populate cache asynchronously (non-blocking)
    if (redis) {
      redis.set(cacheKey, JSON.stringify(payload), { ex: CACHE_TTL }).catch(console.error);
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Projects API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { referenceNo, client, category, typeId, typeName, budget, deliveryDate, targetPhase1Date, imageUrl } = body;

    // Validate required fields
    if (!referenceNo || !client || !typeId || !budget) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const dDate = deliveryDate ? new Date(deliveryDate) : null;
    const phase1Date = targetPhase1Date ? new Date(targetPhase1Date) : null;

    const res = await sql`
      INSERT INTO public.projects (
        reference_no, client, category, type_id, type_name, budget, delivery_date, target_phase1_date, image_url
      ) VALUES (
        ${referenceNo}, 
        ${client}, 
        ${category}, 
        ${typeId}, 
        ${typeName}, 
        ${Number(budget)}, 
        ${dDate}, 
        ${phase1Date},
        ${imageUrl || null}
      )
      RETURNING id, reference_no
    `;

    if (res.length > 0) {
      const projectId = res[0].id;

      // Initialize tracking tables for this new project
      try {
        await sql`
          INSERT INTO public.phase1_tracking (project_id, status_red, status_orange, status_green)
          VALUES (${projectId}, 0, 0, 0)
        `;
        await sql`
          INSERT INTO public.phase2_tracking (project_id, status_red, status_orange, status_green)
          VALUES (${projectId}, 0, 0, 0)
        `;
      } catch (_trackingError) {
        // Tracking tables are optional — don't fail the whole request
      }

      // Invalidate projects list cache so the next GET fetches fresh data
      if (redis) {
        redis.del(`projects_list`).catch(console.error);
      }
    }

    return NextResponse.json({ success: true, project: res[0] });
  } catch (error) {
    console.error("Create Project Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
