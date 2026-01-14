import { db } from "./firebase";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { UserProfile } from "@/types/user";

export async function getUsers(): Promise<UserProfile[]> {
    const querySnapshot = await getDocs(collection(db, "users"));
    const users: UserProfile[] = [];
    querySnapshot.forEach((doc) => {
        users.push({ uid: doc.id, ...doc.data() } as UserProfile);
    });
    return users;
}

export async function getUserById(userId: string): Promise<UserProfile | null> {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { uid: docSnap.id, ...docSnap.data() } as UserProfile;
    }
    return null;
}

export async function createUser(userId: string, userData: Partial<UserProfile>): Promise<void> {
    await setDoc(doc(db, "users", userId), {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
    });
}

export async function updateUser(userId: string, userData: Partial<UserProfile>): Promise<void> {
    await updateDoc(doc(db, "users", userId), {
        ...userData,
        updatedAt: new Date()
    });
}

export async function deleteUser(userId: string): Promise<void> {
    await deleteDoc(doc(db, "users", userId));
}
