import bcrypt from "bcryptjs";
import { db } from "./connection";

const SEED_PASSWORD = "password123";

const vendors = [
  {
    owner: { name: "João Machava", phone: "+258841000001" },
    name: "Frango do Rei",
    address: "Avenida das FPLM, Ponta-Gêa, Beira",
    latitude: -19.8201,
    longitude: 34.8384,
    phone: "+258841000010",
    products: [
      {
        name: "Frango grelhado",
        description: "Frango grelhado com arroz branco e salada de couve",
        price_cents: 35000,
      },
      {
        name: "Prego no pão",
        description: "Bifinho de novilho em pão estaladiço com manteiga",
        price_cents: 25000,
      },
      {
        name: "Matapa",
        description: "Folhas de mandioca cozidas com amendoim e camarão seco",
        price_cents: 20000,
      },
      {
        name: "Refrigerante",
        description: "Coca-Cola, Fanta ou Sprite (lata 330 ml)",
        price_cents: 8000,
      },
    ],
  },
  {
    owner: { name: "Maria Cossa", phone: "+258842000001" },
    name: "Padaria Central",
    address: "Rua Major Serpa Pinto, Macúti, Beira",
    latitude: -19.835,
    longitude: 34.8372,
    phone: "+258842000010",
    products: [
      {
        name: "Pão de forma",
        description: "Pão de forma fatiado (embalagem 500 g)",
        price_cents: 12000,
      },
      {
        name: "Croissant",
        description: "Croissant de manteiga acabado de fazer",
        price_cents: 6000,
      },
      {
        name: "Bolo de chocolate",
        description: "Fatia húmida de bolo de chocolate com cobertura",
        price_cents: 18000,
      },
      {
        name: "Sumo de laranja",
        description: "Sumo de laranja natural espremido na hora (500 ml)",
        price_cents: 9000,
      },
    ],
  },
  {
    owner: { name: "Carlos Nhantumbo", phone: "+258843000001" },
    name: "Mini-mercado Buzi",
    address: "Avenida Daniel Napatima, Chaimite, Beira",
    latitude: -19.848,
    longitude: 34.851,
    phone: "+258843000010",
    products: [
      {
        name: "Arroz",
        description: "Arroz branco (1 kg)",
        price_cents: 15000,
      },
      {
        name: "Feijão manteiga",
        description: "Feijão manteiga seco (500 g)",
        price_cents: 10000,
      },
      {
        name: "Óleo Palmas",
        description: "Óleo vegetal Palmas (500 ml)",
        price_cents: 13000,
      },
      {
        name: "Açúcar",
        description: "Açúcar refinado (1 kg)",
        price_cents: 11000,
      },
    ],
  },
];

const stmts = {
  vendorByName: db.prepare("SELECT id FROM vendors WHERE name = ?"),
  userByPhone: db.prepare("SELECT id FROM users WHERE phone = ?"),
  insertUser: db.prepare(
    "INSERT INTO users (name, phone, password_hash, role) VALUES (?, ?, ?, 'vendor_owner')"
  ),
  insertVendor: db.prepare(
    "INSERT INTO vendors (owner_id, name, address, latitude, longitude, phone) VALUES (?, ?, ?, ?, ?, ?)"
  ),
  insertProduct: db.prepare(
    "INSERT INTO products (vendor_id, name, description, price_cents) VALUES (?, ?, ?, ?)"
  ),
};

async function seed() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  let seeded = 0;
  let skipped = 0;

  for (const v of vendors) {
    const existing = stmts.vendorByName.get(v.name) as { id: number } | undefined;
    if (existing) {
      console.log(`  skip   ${v.name} (already exists)`);
      skipped++;
      continue;
    }

    let ownerId: number;
    const existingOwner = stmts.userByPhone.get(v.owner.phone) as { id: number } | undefined;
    if (existingOwner) {
      ownerId = existingOwner.id;
    } else {
      const result = stmts.insertUser.run(v.owner.name, v.owner.phone, passwordHash);
      ownerId = Number(result.lastInsertRowid);
    }

    const vendorResult = stmts.insertVendor.run(
      ownerId,
      v.name,
      v.address,
      v.latitude,
      v.longitude,
      v.phone
    );
    const vendorId = Number(vendorResult.lastInsertRowid);

    for (const p of v.products) {
      stmts.insertProduct.run(vendorId, p.name, p.description, p.price_cents);
    }

    console.log(`  added  ${v.name} (${v.products.length} products, owner: ${v.owner.name})`);
    seeded++;
  }

  console.log(`\nDone — ${seeded} vendor(s) seeded, ${skipped} skipped.`);
  if (seeded > 0) {
    console.log(`Seed credentials: phone = <owner phone>, password = ${SEED_PASSWORD}`);
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
