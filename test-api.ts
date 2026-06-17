import { GET } from "./src/app/api/founder/dashboard/route";
import { NextRequest } from "next/server";

async function main() {
  const req = new NextRequest("http://localhost:3000/api/founder/dashboard?days=30");
  try {
    const res = await GET(req);
    const json = await res.json();
    console.log("Status:", res.status);
    console.log("Result:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Dashboard API Error:", err);
  }
}

main();
