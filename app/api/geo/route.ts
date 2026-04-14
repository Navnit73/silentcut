import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Use Vercel's real IP headers, fallback to US if not found (e.g., local dev)
  const country = request.headers.get("x-vercel-ip-country") || "US";
  const timezone = request.headers.get("x-vercel-ip-timezone") || "";
  
  const isIndia = country === "IN";
  
  // Dynamic Pricing Logic based on Vercel Edge details
  const pricing = {
    currency: isIndia ? "INR" : "USD",
    symbol: isIndia ? "₹" : "$",
    short: {
      amount: isIndia ? 24900 : 299, // in cents/paise
      display: isIndia ? "249" : "2.99"
    },
    long: {
      amount: isIndia ? 82900 : 1000, 
      display: isIndia ? "829" : "10.00"
    },
    country,
    timezone
  };

  return NextResponse.json(pricing);
}
