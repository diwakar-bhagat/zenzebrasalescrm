import { sql } from "./src/lib/db";

async function main() {
  try {
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sales_fact'
    `;
    console.log("sales_fact columns:", columns);
    
    try {
      const settings = await sql`SELECT key, value FROM public.settings`;
      console.log("Settings:", settings);
    } catch (err) {
      console.error("Settings table error:", err);
    }

  } catch (err) {
    console.error("DB Error:", err);
  }
}

main();
