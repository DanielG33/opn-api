import {Request, Response} from "express";
import {
  createSeries,
  deleteSeriesById,
  getSeriesByProducerId,
  getSeriesById,
  updateSeriesById
} from "../../services/series.service";
import {db} from "../../firebase";

export const listProducerSeries = async (req: Request, res: Response) => {
  const uid = req.user?.uid as string;
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return res.status(404).json({message: "User not found"});

  const producerId = String(userDoc.data()?.producerId);
  const series = await getSeriesByProducerId(producerId);
  return res.json({success: true, data: series});
};

export const createProducerSeries = async (req: Request, res: Response) => {
  const uid = req.user?.uid as string;
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists)
    return res.status(404).json({message: "User not found"});

  const userData: any = userDoc.data();
  const producerId = String(userData.producerId);

  const producerDoc = await db.collection("producers").doc(producerId).get();
  if (!producerDoc.exists)
    return res.status(404).json({message: "Producer not found"});

  try {
    const series = await createSeries(req.body, producerId, producerDoc.data());
    return res.status(201).json({success: true, data: series});
  } catch (err: any) {
    return res.status(422).json({
      success: false,
      error: {
        code: err.code || "unknown",
        message: err.message
      }
    });
  }
};

export const getProducerSeries = async (req: Request, res: Response) => {
  const uid = req.user?.uid as string;
  const {id} = req.params;
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return res.status(404).json({message: "User not found"});
  const producerId = String(userDoc.data()?.producerId);
  const series = await getSeriesById(id);
  if (!series || series.producerId !== producerId)
    return res.status(403).json({message: "Forbidden"});
  return res.json({success: true, data: series});
};

export const updateProducerSeries = async (req: Request, res: Response) => {
  const uid = req.user?.uid as string;
  const {id} = req.params;
  const updates = req.body;
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return res.status(404).json({message: "User not found"});
  const producerId = String(userDoc.data()?.producerId);
  const updated = await updateSeriesById(id, updates, producerId);
  if (!updated) return res.status(403).json({message: "Forbidden"});
  return res.json({success: true, message: "Series updated"});
};

export const deleteProducerSeries = async (req: Request, res: Response) => {
  const uid = req.user?.uid as string;
  const {id} = req.params;
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return res.status(404).json({message: "User not found"});
  const producerId = String(userDoc.data()?.producerId);
  const deleted = await deleteSeriesById(id, producerId);
  if (!deleted) return res.status(403).json({message: "Forbidden"});
  return res.json({success: true, message: "Series deleted"});
};

export const submitProducerSeries = async (req: Request, res: Response) => {
  // TODO: sent a request to publish from series-draft to series

  // const uid = req.user?.uid as string;
  // const { id } = req.params;
  // const userDoc = await db.collection('users').doc(uid).get();
  // if (!userDoc.exists)
  //   return res.status(404).json({ message: 'User not found' });
  // const producerId = String(userDoc.data()?.producerId);
  // const submitted = await submitSeriesForReview(id, producerId);
  // if (!submitted) return res.status(403).json({ message: 'Forbidden' });
  // return res.json({ success: true, message: 'Series submitted for review' });
};
