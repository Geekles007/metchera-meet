import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { JWT } from "next-auth/jwt";

// Define your user type
interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

// Extend the session interface
declare module "next-auth" {
  interface Session {
    user: User & {
      id: string;
    };
  }
}

// Extend the JWT interface
declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        // In a real application, you would verify credentials from a database
        // Here, we're just doing a simple check for demonstration purposes
        if (
          parsedCredentials.data.email === "user@example.com" &&
          parsedCredentials.data.password === "password"
        ) {
          return {
            id: "1",
            name: "Demo User",
            email: "user@example.com",
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user: any }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
}); 