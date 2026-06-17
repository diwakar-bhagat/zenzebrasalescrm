import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  try {
    const rawSql = `SELECT 1 as num`;
    const res = await (sql as any).query(rawSql);
    console.log(res);
  } catch(e) {
    console.error(e);
  }
}
main();
