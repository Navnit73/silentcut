import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import dbConnect from "@/lib/mongodb";
import { User } from "@/lib/models";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      
      await dbConnect();
      const existingUser = await User.findOne({ email: user.email });
      
      if (!existingUser) {
        await User.create({
          name: user.name,
          email: user.email,
          image: user.image,
          isPro: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
        });
      }
      return true;
    },
    async jwt({ token, trigger, session }) {
      if (token.email) {
        await dbConnect();
        const dbUser = await User.findOne({ email: token.email });
        if (dbUser) {
          token.isPro = dbUser.isPro;
          token.id = dbUser._id.toString();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).isPro = token.isPro;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export async function GET(req: any, { params }: { params: Promise<any> }) {
  const resolvedParams = await params;
  return handler(req, { params: resolvedParams } as any);
}

export async function POST(req: any, { params }: { params: Promise<any> }) {
  const resolvedParams = await params;
  return handler(req, { params: resolvedParams } as any);
}
