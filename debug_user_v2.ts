
import { db } from "./lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

async function dumpUser() {
    try {
        console.log("Searching for ceo.fata@gmail.com...");
        const q = query(collection(db, "users"), where("email", "==", "ceo.fata@gmail.com"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            console.log("No user found with that email.");
        }
        snapshot.forEach(doc => {
            console.log("FULL USER DATA:", JSON.stringify(doc.data(), null, 2));
        });
    } catch (e) {
        console.error("Error:", e);
    }
}

dumpUser();
