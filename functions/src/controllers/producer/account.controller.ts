import { Request, Response } from 'express';
import { db } from '../../firebase';
import { getProducer, getUserProfile } from '../../services/acount.service';

export const getProfileMe = async (req: Request, res: Response) => {
  const uid = req.user?.uid as string;

  const profile = await getUserProfile(uid);
  if (!profile) return res.status(404).json({ message: 'User not found' });
  return res.json({ success: true, data: profile });
};

export const getProfileProducer = async (req: Request, res: Response) => {
  const uid = req.user?.uid as string;
  console.log({uid})
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) return res.status(404).json({ message: 'User not found' });
  const producerId = String(userDoc.data()?.producerId);

  const producer = await getProducer(producerId);
  if (!producer) return res.status(404).json({ message: 'Producer not found' });
  return res.json({ success: true, data: producer });
};