import { db } from "../firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

export interface OrderPayload {
  orderId: string;
  items: any;
  amount: number;
  source: string;
}

/**
 * Saves an order to Firestore.
 * - Always awaits the write (no fire-and-forget).
 * - Throws on failure so the caller can show a real error to the user.
 * - Normalises `source` to lowercase so report filters work correctly.
 */
export const saveOrder = async ({
  orderId,
  items,
  amount,
  source,
}: OrderPayload): Promise<string> => {
  const docRef = await addDoc(collection(db, "orders"), {
    orderId,
    items,
    amount: Number(amount) || 0,
    source: source.toLowerCase(), // MUST be "online" or "offline" (lowercase)
    date: Timestamp.now(),
  });
  return docRef.id; // Return Firestore document ID for reference
};
