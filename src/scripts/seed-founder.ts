import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log("Creating mock upload batch...");
  const batchRes = await sql`
    INSERT INTO upload_batches (filename, status, row_count, error_count)
    VALUES ('synthetic_seed_Q3.xlsx', 'success', 0, 0)
    RETURNING id
  `;
  const batchId = batchRes[0].id;

  const stores = ["KLJ", "SWN"];
  const categories = ["Perfume", "Skin Care", "Hair Care", "Body Care", "Gift Sets"];
  const brands: Record<string, string[]> = {
    "Perfume": ["Bella Vita", "Titan Skinn", "Engage"],
    "Skin Care": ["Minimalist", "Plum", "DermaCo"],
    "Hair Care": ["Loreal", "Treseme", "Dove"],
    "Body Care": ["Nivea", "Vaseline", "Bath & Body Works"],
    "Gift Sets": ["Forest Essentials", "Nykaa Beauty"]
  };

  const skus: Record<string, { sku: string, name: string, price: number }[]> = {};
  for (const cat of categories) {
    skus[cat] = [];
    for (const brand of brands[cat]) {
      for (let i = 1; i <= 3; i++) {
        skus[cat].push({
          sku: `${brand.substring(0,3).toUpperCase()}-${cat.substring(0,3).toUpperCase()}-00${i}`,
          name: `${brand} - ${cat} Product ${i}`,
          price: Math.floor(Math.random() * 2000) + 500
        });
      }
    }
  }

  console.log("Generating 90 days of synthetic data...");
  const today = new Date();
  const salesData = [];
  
  let rowNumber = 1;

  for (let i = 0; i < 90; i++) {
    const currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() - (89 - i));
    const dateStr = currentDate.toISOString().split("T")[0];

    // Determine trends
    const isRecent = i >= 76; // last 14 days
    const kljTrafficMult = isRecent ? 0.85 : 1.0; // KLJ declining 15%
    const bellaVitaMult = isRecent ? 1.20 : 1.0; // Bella Vita growing 20%

    for (const store of stores) {
      const baseBills = store === "KLJ" ? 20 : 12;
      let actualBills = Math.floor(baseBills * (store === "KLJ" ? kljTrafficMult : 1.0) * (0.8 + Math.random() * 0.4));
      
      for (let b = 1; b <= actualBills; b++) {
        const billNo = `BILL-${store}-${dateStr.replace(/-/g, '')}-${b.toString().padStart(3, '0')}`;
        const itemsInBill = Math.floor(Math.random() * 3) + 1; // 1 to 3 items per bill
        const customerId = Math.random() > 0.3 ? `CUST-${Math.floor(Math.random() * 1000)}` : null; // 70% customers registered

        for (let item = 0; item < itemsInBill; item++) {
          const category = categories[Math.floor(Math.random() * categories.length)];
          const product = skus[category][Math.floor(Math.random() * skus[category].length)];
          const brand = product.name.split(" - ")[0];
          
          let qty = Math.floor(Math.random() * 2) + 1;
          let amount = product.price * qty;

          // Apply Bella Vita trend
          if (brand === "Bella Vita") {
             amount = amount * bellaVitaMult;
          }

          salesData.push({
            batch_id: batchId,
            sale_date: dateStr,
            bill_no: billNo,
            store: store,
            category: category,
            brand: brand,
            sku: product.sku,
            product_name: product.name,
            quantity: qty,
            net_amount: parseFloat(amount.toFixed(2)),
            customer_id: customerId,
            row_number: rowNumber++
          });
        }
      }
    }
  }

  console.log(`Inserting ${salesData.length} records...`);
  // Insert in chunks
  const chunkSize = 1000;
  for (let i = 0; i < salesData.length; i += chunkSize) {
    const chunk = salesData.slice(i, i + chunkSize);

    const batchIds = chunk.map(c => c.batch_id);
    const saleDates = chunk.map(c => c.sale_date);
    const billNos = chunk.map(c => c.bill_no);
    const storeArr = chunk.map(c => c.store);
    const cats = chunk.map(c => c.category);
    const brnds = chunk.map(c => c.brand);
    const skuArr = chunk.map(c => c.sku);
    const prodNames = chunk.map(c => c.product_name);
    const qtys = chunk.map(c => c.quantity);
    const nets = chunk.map(c => c.net_amount);
    // Handle nulls in arrays
    const custs = chunk.map(c => c.customer_id === null ? null : c.customer_id);
    const rowNums = chunk.map(c => c.row_number);

    await sql`
      INSERT INTO sales_fact (batch_id, sale_date, bill_no, store, category, brand, sku, product_name, quantity, net_amount, customer_id, row_number)
      SELECT * FROM UNNEST (
        ${batchIds}::integer[],
        ${saleDates}::date[],
        ${billNos}::text[],
        ${storeArr}::text[],
        ${cats}::text[],
        ${brnds}::text[],
        ${skuArr}::text[],
        ${prodNames}::text[],
        ${qtys}::integer[],
        ${nets}::numeric[],
        ${custs}::text[],
        ${rowNums}::integer[]
      )
    `;
    console.log(`Inserted ${Math.min(i + chunkSize, salesData.length)} / ${salesData.length}`);
  }

  // Update batch row count
  await sql`UPDATE upload_batches SET row_count = ${salesData.length} WHERE id = ${batchId}`;
  
  console.log("Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
