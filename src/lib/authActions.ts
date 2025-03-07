import { getUserByUsername } from "@/models/userModel";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import CustomError from "../classes/CustomError";
import bcrypt from "bcryptjs";
import { TokenContent } from "hybrid-types/DBTypes";
import jwt from "jsonwebtoken";
import { redirect } from "next/navigation";

// const key = new TextEncoder().encode(secretKey);

// export async function encrypt(payload: any) {
//   return await new SignJWT(payload)
//     .setProtectedHeader({ alg: "HS256" })
//     .setIssuedAt()
//     .setExpirationTime("10 sec from now")
//     .sign(key);
// }

// export async function decrypt(input: string): Promise<any> {
//   const { payload } = await jwtVerify(input, key, {
//     algorithms: ["HS256"],
//   });
//   return payload;
// }

export async function login(formData: FormData) {
  const key = process.env.JWT_SECRET;
  if (!key) {
    throw new CustomError("JWT secret not set", 500);
  }

  // Verify credentials && get the user

  const userLogin = {
    username: formData.get("username") as string,
    password: formData.get("password") as string,
  };

  const user = await getUserByUsername(userLogin.username);

  if (!user || !bcrypt.compareSync(userLogin.password, user.password)) {
    throw new CustomError("Incorrect username/password", 403);
  }

  const tokenContent: TokenContent = {
    user_id: user.user_id,
    level_name: user.level_name,
  };

  // Create the session
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const session = jwt.sign(tokenContent, key, { expiresIn: "7d" });

  // Save the session in a cookie
  const cookieStore = await cookies();
  cookieStore.set("session", session, { expires, httpOnly: true });
}

export async function logout() {
  // Destroy the session
  const cookieStore = await cookies();
  cookieStore.set("session", "", { expires: new Date(0) });
}

export async function getSession() {
  const key = process.env.JWT_SECRET;
  if (!key) {
    throw new CustomError("JWT secret not set", 500);
  }

  const cookieStore = await cookies();

  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  return jwt.verify(session, key) as TokenContent;
}

export async function updateSession(request: NextRequest) {
  const key = process.env.JWT_SECRET;
  if (!key) {
    throw new CustomError("JWT secret not set", 500);
  }

  const session = request.cookies.get("session")?.value;
  if (!session) return;

  // Refresh the session so it doesn't expire
  const tokenContent = jwt.verify(session, key) as TokenContent;
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const res = NextResponse.next();
  res.cookies.set({
    name: "session",
    value: jwt.sign(tokenContent, key, { expiresIn: "7d" }),
    httpOnly: true,
    expires: expires,
  });
  return res;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user_id) {
    redirect("/");
  }
}
