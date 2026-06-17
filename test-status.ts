import { GET } from "./src/app/api/founder/status/route";
import { NextRequest } from "next/server";

async function main() {
  const req = new NextRequest("http://localhost:3000/api/founder/status");
  const res = await GET();
  console.log("Status:", res.status);
  console.log("Result:", await res.json());
}
main().catch(console.error);
