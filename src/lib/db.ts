import mongoose from "mongoose";
const g = globalThis as any;
export const db = () => (g._mongo ??= mongoose.connect(process.env.MONGODB_URI!));
