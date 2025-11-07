import * as crypto from "crypto";
import {User} from "../models/user";
import {db} from "../firebase";

export const fakeSignIn = async (email: string, password: string): Promise<string> => {
  // Simulate a delay or call to Firebase later
  const fakeToken = crypto.randomBytes(16).toString("hex");
  return `FAKE_TOKEN_${fakeToken}`;
};

export const createUser = async (fullName: string, email: string, password: string, firebaseUid?: string): Promise<User> => {
  // Validate input
  if (!fullName.trim()) {
    throw new Error("Full name is required");
  }
  
  if (!email.includes("@")) {
    throw new Error("Invalid email format");
  }
  
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  // Use Firebase UID if provided, otherwise generate one
  const userId = firebaseUid || crypto.randomUUID();

  // Check if user already exists in Firestore
  const existingUserDoc = await db.collection('users').doc(userId).get();
  if (existingUserDoc.exists) {
    throw new Error("User already exists");
  }

  // Check if email already exists in Firestore
  const existingUserQuery = await db.collection('users').where('email', '==', email).get();
  if (!existingUserQuery.empty) {
    throw new Error("Email already exists");
  }

  // Create user object
  const user: User = {
    id: userId,
    name: fullName,
    email: email,
    role: 'producer', // Default role for admin users
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Save user to Firestore with Firebase UID as document ID
  await db.collection('users').doc(userId).set(user);

  return user;
};
