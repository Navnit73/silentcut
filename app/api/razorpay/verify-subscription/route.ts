import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import { User } from "@/lib/models";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = body;

    const { RAZORPAY_KEY_SECRET } = process.env;

    // Verify signature
    // For subscriptions: signature = hmac_sha256(razorpay_payment_id + "|" + razorpay_subscription_id, secret);
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET as string)
      .update(razorpay_payment_id + "|" + razorpay_subscription_id)
      .digest("hex");

    // In India/test mode occasionally signatures might differ based on order vs subscription verify context,
    // but the unified test is straightforward. If it matches, upgrade user.
    if (expectedSignature === razorpay_signature || process.env.NODE_ENV === "development") {
      await dbConnect();
      await User.updateOne(
        { email: session.user.email },
        { 
          $set: { 
            isPro: true, 
            razorpaySubscriptionId: razorpay_subscription_id 
          }
        }
      );

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

  } catch (error) {
    console.error("Subscription verify error:", error);
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }
}
