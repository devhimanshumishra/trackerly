import mongoose, { Schema } from "mongoose";

const DaySchema = new Schema({
  date: { type: String, unique: true },
  sessions: [{ _id: false, start: Date, end: Date, note: String }],
  checklist: [{ _id: false, title: String, done: { type: Boolean, default: false } }],
  ai: { type: String, default: "" },
});

const SettingsSchema = new Schema({
  key: { type: String, default: "main" },
  template: { type: [String], default: ["Gym / walk", "DSA 2 questions", "Project work"] },
  goalHours: { type: Number, default: 5 },
  running: { type: Schema.Types.Mixed, default: null },
});

export const DayM: any = mongoose.models.Day || mongoose.model("Day", DaySchema);
export const SettingsM: any = mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
