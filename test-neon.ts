import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  try {
    const res = await (sql as any).query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'upload_batches';
    `);
    console.log(res);
  } catch(e) {
    console.error(e);
  }
}
main();
