import { supabase } from "./supabase";
import { v4 as uuidv4 } from "uuid";

export const db = "SUPABASE_MOCK_DB";

export function collection(db: any, path: string) {
    const table = path === "users" ? "employees" : path;
    return { _isQuery: true, table: table, conditions: [], orders: [], offsetLimit: null };
}

export function doc(db: any, path: string, id?: string) {
    if (arguments.length === 2 && path.includes("/")) {
        const parts = path.split("/");
        const table = parts[0] === "users" ? "employees" : parts[0];
        return { table: table, id: parts[1] };
    }
    const table = path === "users" ? "employees" : path;
    return { table: table, id: id || uuidv4() };
}

export function query(col: any, ...constraints: any[]) {
    const newQuery = { ...col, conditions: [...col.conditions], orders: [...col.orders] };
    constraints.forEach(c => {
        if (c.type === 'where') newQuery.conditions.push(c);
        if (c.type === 'orderBy') newQuery.orders.push(c);
        if (c.type === 'limit') newQuery.offsetLimit = c.value;
        if (c.type === 'startAfter') {
           // Basic pagination mock (mostly for logs)
        }
    });
    return newQuery;
}

export function where(field: string, op: string, value: any) {
    return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction = "asc") {
    return { type: 'orderBy', field, direction };
}

export function limit(value: number) {
    return { type: 'limit', value };
}

export function startAfter(value: any) {
    return { type: 'startAfter', value };
}

// Convert camelCase string to snake_case for Supabase if needed (basic mapping)
const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const snakeToCamelObj = (obj: any) => {
    if(!obj || typeof obj !== 'object') return obj;
    const res: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const camel = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        res[camel] = value;
    }
    return res;
};
const camelToSnakeObj = (obj: any) => {
    if(!obj || typeof obj !== 'object') return obj;
    const res: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = camelToSnake(key);
        let finalValue = value;
        
        // Convert JS epoch milliseconds to ISO strings for Postgres timestamp columns
        if (typeof value === 'number' && value > 1000000000000 && 
           (snakeKey.includes('_at') || snakeKey.includes('date') || snakeKey.includes('time'))) {
            finalValue = new Date(value).toISOString();
        }
        
        res[snakeKey] = finalValue;
    }
    return res;
};

export async function getDocs(q: any) {
    let builder: any = supabase.from(q.table).select("*");
    
    q.conditions.forEach((c: any) => {
        // Assume mapping might be needed but Supabase tables largely align names or use underscores
        // For 'email' == email, etc.
        if (c.op === "==") builder = builder.eq(c.field, c.value);
        if (c.op === "in") builder = builder.in(c.field, c.value);
        if (c.op === "array-contains") builder = builder.contains(c.field, [c.value]);
    });
    
    q.orders.forEach((o: any) => {
        builder = builder.order(o.field, { ascending: o.direction === "asc" });
    });
    
    if (q.offsetLimit) {
        builder = builder.limit(q.offsetLimit);
    }
    
    const { data, error } = await builder;
    if (error) {
        console.error("getDocs error on table", q.table, error);
        return { empty: true, docs: [], forEach: () => {} };
    }
    
    const docs = (data || []).map((row: any) => {
        // Map common fields to simulate their types
        const originalData = snakeToCamelObj(row);
        return {
            id: row.id || row.uid || "some-id",
            data: () => originalData
        };
    });
    
    return {
        empty: docs.length === 0,
        docs: docs,
        forEach: (cb: any) => docs.forEach(cb)
    };
}

export async function getDoc(docRef: any) {
    const { data, error } = await supabase.from(docRef.table).select("*").eq("id", docRef.id).maybeSingle();
    if (error || !data) return { exists: () => false, data: () => undefined, id: docRef.id };
    
    return {
        id: docRef.id,
        exists: () => true,
        data: () => snakeToCamelObj(data)
    };
}

export async function setDoc(docRef: any, data: any, options?: any) {
    const payload = camelToSnakeObj(data);
    if (!payload.id) payload.id = docRef.id;
    
    if (options?.merge) {
        await supabase.from(docRef.table).upsert(payload);
    } else {
        await supabase.from(docRef.table).insert([payload]);
    }
}

export async function updateDoc(docRef: any, data: any) {
    const payload = camelToSnakeObj(data);
    await supabase.from(docRef.table).update(payload).eq("id", docRef.id);
}

export async function addDoc(col: any, data: any) {
    const payload = camelToSnakeObj(data);
    if (!payload.id) payload.id = uuidv4();
    const { data: inserted, error } = await supabase.from(col.table).insert([payload]).select("id").single();
    if (error) {
        console.error("addDoc error", error);
        throw error;
    }
    return { id: inserted ? inserted.id : payload.id };
}

export async function deleteDoc(docRef: any) {
    await supabase.from(docRef.table).delete().eq("id", docRef.id);
}

export const Timestamp = {
    now: () => ({ toMillis: () => Date.now(), toDate: () => new Date() })
};

export type DocumentData = any;
export type QueryDocumentSnapshot<T = DocumentData> = any;
