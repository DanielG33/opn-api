import {Request, Response} from "express";
import {fakeSignIn, createUser} from "../services/auth.service";

export const signIn = async (req: Request, res: Response) => {
  const {email, password} = req.body;

  if (!email || !password) {
    return res.status(400).json({error: "Email and password are required"});
  }

  const token = await fakeSignIn(email, password);
  return res.json({token});
};

export const signUp = async (req: Request, res: Response) => {
  console.log('SignUp endpoint called with body:', req.body);
  
  const {fullName, email, password, firebaseUid} = req.body;

  if (!fullName || !email || !password) {
    console.log('Missing required fields:', { fullName: !!fullName, email: !!email, password: !!password });
    return res.status(400).json({error: "Full name, email and password are required"});
  }

  try {
    console.log('Attempting to create user:', { fullName, email, firebaseUid });
    const user = await createUser(fullName, email, password, firebaseUid);
    console.log('User created successfully:', user);
    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return res.status(400).json({error: error.message});
  }
};
