import { db } from "./firebase";
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    doc,
    query,
    orderBy,
    where,
    getDoc,
    deleteDoc
} from "firebase/firestore";
import { Account, Project, Transaction, FixedCost, MonthlyRevenue, Fund } from "@/types/finance";

import { logAction } from "./logger";

// Collections
const ACCOUNTS_COL = "finance_accounts";
const TRANSACTIONS_COL = "finance_transactions";
const FIXED_COSTS_COL = "finance_fixed_costs";
const PROJECTS_COL = "finance_projects";
const REVENUES_COL = "finance_revenues";
const FUNDS_COL = "finance_funds";

// --- Accounts ---
export async function getAccounts(): Promise<Account[]> {
    const querySnapshot = await getDocs(collection(db, ACCOUNTS_COL));
    const accounts: Account[] = [];
    querySnapshot.forEach((doc) => {
        accounts.push({ id: doc.id, ...doc.data() } as Account);
    });
    return accounts;
}

export async function createAccount(account: Omit<Account, "id">): Promise<string> {
    const data = Object.fromEntries(
        Object.entries(account).filter(([_, v]) => v !== undefined)
    );
    const docRef = await addDoc(collection(db, ACCOUNTS_COL), data);
    await logAction("CREATE_ACCOUNT", { name: account.name, type: account.type }, docRef.id);
    return docRef.id;
}

export async function updateAccountBalance(accountId: string, newBalance: number): Promise<void> {
    const accountRef = doc(db, ACCOUNTS_COL, accountId);
    await updateDoc(accountRef, { balance: newBalance });
}

export async function updateAccount(accountId: string, data: Partial<Account>): Promise<void> {
    const accountRef = doc(db, ACCOUNTS_COL, accountId);
    await updateDoc(accountRef, data);
}

// --- Projects ---
export async function getProjects(): Promise<Project[]> {
    const querySnapshot = await getDocs(collection(db, PROJECTS_COL));
    const projects: Project[] = [];
    querySnapshot.forEach((doc) => {
        projects.push({ id: doc.id, ...doc.data() } as Project);
    });
    return projects;
}

export async function createProject(project: Omit<Project, "id">): Promise<string> {
    const data = Object.fromEntries(
        Object.entries(project).filter(([_, v]) => v !== undefined)
    );
    const docRef = await addDoc(collection(db, PROJECTS_COL), data);
    await logAction("CREATE_PROJECT", { name: project.name }, docRef.id);
    return docRef.id;
}

export async function getProject(id: string): Promise<Project | null> {
    const docRef = await getDoc(doc(db, PROJECTS_COL, id));
    if (docRef.exists()) {
        return { id: docRef.id, ...docRef.data() } as Project;
    }
    return null;
}

export async function updateProject(projectId: string, data: Partial<Project>): Promise<void> {
    const docRef = doc(db, PROJECTS_COL, projectId);
    await updateDoc(docRef, data);
    await logAction("UPDATE_PROJECT", data, projectId);
}

export async function deleteProject(projectId: string): Promise<void> {
    const docRef = doc(db, PROJECTS_COL, projectId);
    await deleteDoc(docRef);
    await logAction("DELETE_PROJECT", {}, projectId);
}

// --- Transactions ---
export async function getTransactions(): Promise<Transaction[]> {
    // Sorting by date desc. Requires index potentially.
    const q = query(collection(db, TRANSACTIONS_COL)); // Client-side sort if index missing initially safer
    const querySnapshot = await getDocs(q);
    const transactions: Transaction[] = [];
    querySnapshot.forEach((doc) => {
        transactions.push({ id: doc.id, ...doc.data() } as Transaction);
    });
    // Manual sort to avoid index block during dev
    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function createTransaction(tx: Omit<Transaction, "id">): Promise<string> {
    // Firestore throws on undefined, so we sanitize
    const data = Object.fromEntries(
        Object.entries(tx).filter(([_, v]) => v !== undefined)
    );
    const docRef = await addDoc(collection(db, TRANSACTIONS_COL), data);
    await logAction("CREATE_TRANSACTION", { amount: tx.amount, currency: tx.currency }, docRef.id, tx.userId);
    return docRef.id;
}

export async function updateTransactionStatus(txId: string, status: Transaction["status"]): Promise<void> {
    const txRef = doc(db, TRANSACTIONS_COL, txId);
    await updateDoc(txRef, { status });
}

// --- Fixed Costs ---
export async function getFixedCosts(): Promise<FixedCost[]> {
    const querySnapshot = await getDocs(collection(db, FIXED_COSTS_COL));
    const costs: FixedCost[] = [];
    querySnapshot.forEach((doc) => {
        costs.push({ id: doc.id, ...doc.data() } as FixedCost);
    });
    return costs;
}

export async function createFixedCost(cost: Omit<FixedCost, "id">): Promise<string> {
    const data = Object.fromEntries(
        Object.entries(cost).filter(([_, v]) => v !== undefined)
    );
    const docRef = await addDoc(collection(db, FIXED_COSTS_COL), data);
    await logAction("CREATE_FIXED_COST", { name: cost.name, amount: cost.amount }, docRef.id);
    return docRef.id;
}

export async function updateFixedCost(id: string, data: Partial<FixedCost>): Promise<void> {
    const docRef = doc(db, FIXED_COSTS_COL, id);
    await updateDoc(docRef, data);
}

export async function deleteFixedCost(id: string): Promise<void> {
    const docRef = doc(db, FIXED_COSTS_COL, id);
    await deleteDoc(docRef);
    await logAction("DELETE_FIXED_COST", {}, id);
}

// --- Revenue ---
export async function getRevenues(): Promise<MonthlyRevenue[]> {
    const querySnapshot = await getDocs(collection(db, REVENUES_COL));
    const list: MonthlyRevenue[] = [];
    querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as MonthlyRevenue);
    });
    // Sort by Date Desc (Year then Month)
    return list.sort((a, b) => (Number(b.year) * 12 + Number(b.month)) - (Number(a.year) * 12 + Number(a.month)));
}

export async function createRevenue(data: Omit<MonthlyRevenue, "id">): Promise<string> {
    const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    const docRef = await addDoc(collection(db, REVENUES_COL), cleanData);
    await logAction("CREATE_REVENUE", { month: data.month, year: data.year, amount: data.amount }, docRef.id);
    return docRef.id;
}

// --- Funds ---
export async function getFunds(): Promise<Fund[]> {
    const querySnapshot = await getDocs(query(collection(db, FUNDS_COL), orderBy("createdAt", "desc")));
    const funds: Fund[] = [];
    querySnapshot.forEach((doc) => {
        funds.push({ id: doc.id, ...doc.data() } as Fund);
    });
    return funds;
}

export async function createFund(fund: Omit<Fund, "id">): Promise<string> {
    const data = Object.fromEntries(
        Object.entries(fund).filter(([_, v]) => v !== undefined)
    );
    const docRef = await addDoc(collection(db, FUNDS_COL), data);
    await logAction("CREATE_FUND", { name: fund.name }, docRef.id);
    return docRef.id;
}

export async function updateFund(id: string, data: Partial<Fund>): Promise<void> {
    const docRef = doc(db, FUNDS_COL, id);
    await updateDoc(docRef, data);
    await logAction("UPDATE_FUND", data, id);
}

export async function deleteFund(id: string): Promise<void> {
    const docRef = doc(db, FUNDS_COL, id);
    await deleteDoc(docRef);
    await logAction("DELETE_FUND", {}, id);
}
