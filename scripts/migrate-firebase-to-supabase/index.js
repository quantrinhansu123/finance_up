/* eslint-disable no-console */
// Migration tool: Firestore -> Supabase Postgres
// Usage:
//  - Copy .env.example to .env and fill values
//  - Copy mapping.example.json to mapping.json and adjust if needed
//  - Dry run:  npm run migrate:firebase:dry
//  - Execute:  npm run migrate:firebase
//
// Notes:
//  - Requires Supabase service role key
//  - Firestore Admin service account JSON path via FIREBASE_SERVICE_ACCOUNT_PATH
//  - Auth passwords cannot be migrated; plan to invite/reset in Supabase

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const { createClient } = require("@supabase/supabase-js");
const admin = require("firebase-admin");

const isDryRun = process.argv.includes("--dry-run");
const scriptDir = __dirname;
const mappingPath = path.join(scriptDir, "mapping.json");
const mappingExamplePath = path.join(scriptDir, "mapping.example.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function coerceValue(value) {
  // Firestore Timestamp or similar
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(coerceValue);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = coerceValue(v);
    }
    return out;
  }
  return value ?? null;
}

function applyFieldMap(docData, fieldMap) {
  if (!fieldMap) return docData;
  const result = {};
  for (const [targetField, sourceField] of Object.entries(fieldMap)) {
    result[targetField] = coerceValue(docData[sourceField]);
  }
  // Include any unmapped fields as-is (coerced), unless already set by mapping
  for (const [k, v] of Object.entries(docData)) {
    if (!(k in result)) {
      result[k] = coerceValue(v);
    }
  }
  return result;
}

async function initFirebaseAdmin() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_PATH in .env");
  }
  const absolutePath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Service account file not found at ${absolutePath}`);
  }
  const serviceAccount = readJson(absolutePath);
  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
  if (!projectId) {
    throw new Error("Missing FIREBASE_PROJECT_ID in .env and not found in service account");
  }
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  }
  return admin.firestore();
}

function initSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function migrateCollection({ firestore, supabase, rule }) {
  const {
    firestoreCollection,
    supabaseTable,
    idColumn = "id",
    onConflict = undefined,
    fieldMap = undefined,
    transform = undefined,
    where = undefined,
    batchSize = 500,
  } = rule;

  const colRef = firestore.collection(firestoreCollection);
  let queryRef = colRef;
  // where: [{ field, op, value }]
  if (Array.isArray(where)) {
    for (const w of where) {
      queryRef = queryRef.where(w.field, w.op, w.value);
    }
  }

  const snapshot = await queryRef.get();
  const total = snapshot.size;
  console.log(`- ${firestoreCollection} => ${supabaseTable}: ${total} documents`);
  if (total === 0) return { total: 0, inserted: 0, failed: 0, table: supabaseTable };

  // Prepare records
  let records = snapshot.docs.map((d) => {
    let data = d.data();
    data = applyFieldMap(data, fieldMap);
    // Assign Firestore doc id to a target column (default: id)
    const rec = { [idColumn]: d.id, ...data };
    return rec;
  });

  if (typeof transform === "function") {
    // Not supported from JSON mapping; reserved for future programmatic use
    records = records.map(transform);
  }

  if (isDryRun) {
    console.log(`  Dry-run: would upsert ${records.length} rows into "${supabaseTable}"`);
    return { total, inserted: 0, failed: 0, table: supabaseTable };
  }

  // Upsert in chunks
  let inserted = 0;
  let failed = 0;
  const chunks = chunk(records, batchSize);
  for (let i = 0; i < chunks.length; i++) {
    const part = chunks[i];
    const builder = supabase.from(supabaseTable).upsert(part, {
      onConflict: onConflict || idColumn,
      ignoreDuplicates: false,
    });
    const { error, count } = await builder.select("*", { count: "exact", head: false });
    if (error) {
      failed += part.length;
      console.error(`  Chunk ${i + 1}/${chunks.length} failed:`, error.message);
    } else {
      inserted += part.length;
      console.log(`  Chunk ${i + 1}/${chunks.length} ok (${part.length} rows)`);
    }
  }
  return { total, inserted, failed, table: supabaseTable };
}

async function main() {
  console.log("== Firebase -> Supabase migration ==");
  // Load mapping
  let mapping;
  if (fs.existsSync(mappingPath)) {
    mapping = readJson(mappingPath);
  } else {
    mapping = readJson(mappingExamplePath);
    console.warn('mapping.json not found. Using mapping.example.json. Create "mapping.json" to customize.');
  }

  const firestore = await initFirebaseAdmin();
  const supabase = initSupabase();

  const rules = mapping.collections || [];
  if (rules.length === 0) {
    console.log("No collections configured to migrate.");
    return;
  }

  const results = [];
  for (const rule of rules) {
    try {
      const res = await migrateCollection({ firestore, supabase, rule });
      results.push(res);
    } catch (e) {
      console.error(`Failed migrating ${rule.firestoreCollection} -> ${rule.supabaseTable}`, e);
      results.push({ table: rule.supabaseTable, total: 0, inserted: 0, failed: 0 });
    }
  }

  console.log("\n== Summary ==");
  for (const r of results) {
    console.log(
      `${r.table}: total=${r.total} inserted=${r.inserted} failed=${r.failed}${isDryRun ? " (dry-run)" : ""}`
    );
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

