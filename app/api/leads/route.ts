import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { FreeLead } from "@/lib/models";

export async function POST(req: NextRequest) {
  try {
    const { email, source } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const ipCountry = req.headers.get("x-vercel-ip-country") || "UNKNOWN";

    await dbConnect();
    
    // We use updateOne with upsert to avoid creating duplicate traces if they export multiple times
    await FreeLead.updateOne(
      { email },
      { 
        $setOnInsert: { email, source, ipCountry },
        $set: { updatedAt: new Date() } 
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead capture error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
