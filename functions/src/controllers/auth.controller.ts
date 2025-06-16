import { Request, Response } from 'express';
import { fakeSignIn } from '../services/auth.service';

export const signIn = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const token = await fakeSignIn(email, password);
  return res.json({ token });
};