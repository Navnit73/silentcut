import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_ID } = process.env;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !RAZORPAY_PLAN_ID) {
      console.error("Missing Razorpay Subscription Keys");
      return NextResponse.json({ error: "Payments misconfigured on server." }, { status: 500 });
    }

    const authHeader = "Basic " + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

    // Create a new Razorpay Subscription
    // Reference: https://razorpay.com/docs/api/subscriptions/#create-a-subscription
    const rzpRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        plan_id: RAZORPAY_PLAN_ID,
        customer_notify: 1,
        total_count: 120, // 10 years, typical default for "unlimited" recurring
      }),
    });

    const subData = await rzpRes.json();

    if (subData.error) {
      console.error("Razorpay subscription error:", subData.error);
      return NextResponse.json({ error: subData.error.description || "Failed to create subscription" }, { status: 400 });
    }

    return NextResponse.json({
      subscription_id: subData.id,
      key: RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay Sub Error:", error);
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }
}
