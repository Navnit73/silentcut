import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, required: true },
    image: String,
    isPro: { type: Boolean, default: false },
    razorpaySubscriptionId: { type: String, default: null },
    razorpayCustomerId: { type: String, default: null },
  },
  { timestamps: true }
);

const FreeLeadSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    source: { type: String, default: "free_export_720p" },
    ipCountry: { type: String, default: "UNKNOWN" },
  },
  { timestamps: true }
);

export const User = mongoose.models?.User || mongoose.model("User", UserSchema);
export const FreeLead = mongoose.models?.FreeLead || mongoose.model("FreeLead", FreeLeadSchema);
