import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { durationSeconds } = body;
    
    // Validate
    if (typeof durationSeconds !== 'number') {
      return NextResponse.json({ error: "Invalid duration payload" }, { status: 400 });
    }

    // Determine Country / Currency
    const country = request.headers.get("x-vercel-ip-country") || "US";
    const isIndia = country === "IN";
    const currency = isIndia ? "INR" : "USD";

    // Dynamic Pricing calculation
    // < 10 mins (600s) = short, >= 10 mins = long
    let amountInCents = 0;
    if (durationSeconds <= 600) {
      amountInCents = isIndia ? 24900 : 299;
    } else {
      amountInCents = isIndia ? 82900 : 1000;
    }

    // Ensure API Keys are loaded
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      // In development when keys are missing, we fake a successful response so the UI logic works.
      console.warn("WARNING: RAZORPAY_KEY_ID/SECRET not found. Serving mock test Order ID.");
      return NextResponse.json({
        id: "order_mock_" + Date.now(),
        amount: amountInCents,
        currency,
        key: key_id || "mock_key_id"
      });
    }

    // Call REST API natively
    const basicAuth = Buffer.from(`${key_id}:${key_secret}`).toString("base64");
    
    const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${basicAuth}`
      },
      body: JSON.stringify({
        amount: amountInCents,
        currency: currency,
        receipt: `export_${Date.now()}`
      })
    });

    const data = await rpRes.json();

    if (!rpRes.ok) {
      console.error("Razorpay API Error:", data);
      return NextResponse.json({ error: "Upstream payment error" }, { status: rpRes.status });
    }

    // Pass the key to the frontend so it can initialize the widget
    return NextResponse.json({
      id: data.id,
      amount: data.amount,
      currency: data.currency,
      key: key_id
    });

  } catch (err: unknown) {
    console.error("Razorpay order creation failed", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
