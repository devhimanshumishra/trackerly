import mongoose, { Schema } from "mongoose";

export const DEFAULT_SUBJECTS = [
  { name: "Project", targetMin: 120 },
  { name: "C++", targetMin: 120 },
  { name: "DSA", targetMin: 60 },
];

const DaySchema = new Schema({
  date: { type: String, unique: true },
  sessions: [{ _id: false, start: Date, end: Date, note: String, subject: String }],
  checklist: [{ _id: false, title: String, done: { type: Boolean, default: false } }],
  ai: { type: String, default: "" },
});

const SettingsSchema = new Schema({
  key: { type: String, default: "main" },
  template: { type: [String], default: ["Gym / walk", "DSA 2 questions", "Project work"] },
  goalHours: { type: Number, default: 5 },
  subjects: { type: [{ _id: false, name: String, targetMin: Number }], default: () => DEFAULT_SUBJECTS },
  running: { type: Schema.Types.Mixed, default: null },
});

export const DayM: any = mongoose.models.Day || mongoose.model("Day", DaySchema);
export const SettingsM: any = mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
