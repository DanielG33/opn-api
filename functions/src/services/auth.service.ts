import crypto from "crypto";

export const fakeSignIn = async (email: string, password: string): Promise<string> => {
  // Simulate a delay or call to Firebase later
  const fakeToken = crypto.randomBytes(16).toString("hex");
  console.log(`[FAKE LOGIN] ${email} logged in with password ${password}`);
  return `FAKE_TOKEN_${fakeToken}`;
};
