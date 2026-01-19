import {Request, Response} from "express";
import {
  createSeries,
  deleteSeriesById,
  getSeriesByProducerId,
  getSeriesById,
  updateSeriesById,
  checkSlugAvailability
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
    // Handle specific error codes
    if (err.code === 'SLUG_TAKEN') {
      return res.status(409).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          suggestedSlug: err.suggestedSlug
        }
      });
    }
    
    if (err.code === 'SLUG_INVALID') {
      return res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message
        }
      });
    }

    // Generic error
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
  
  try {
    const updated = await updateSeriesById(id, updates, producerId);
    if (!updated) return res.status(403).json({message: "Forbidden"});
    return res.json({success: true, message: "Series updated"});
  } catch (err: any) {
    // Handle specific error codes
    if (err.code === 'SLUG_TAKEN') {
      return res.status(409).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          suggestedSlug: err.suggestedSlug
        }
      });
    }
    
    if (err.code === 'SLUG_INVALID') {
      return res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message
        }
      });
    }

    // Generic error
    return res.status(500).json({
      success: false,
      error: {
        code: err.code || "unknown",
        message: err.message || "Failed to update series"
      }
    });
  }
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

export const checkSeriesSlugAvailability = async (req: Request, res: Response) => {
  const {slug} = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_SLUG',
        message: 'Slug parameter is required'
      }
    });
  }

  try {
    const result = await checkSlugAvailability(slug);
    return res.json({success: true, data: result});
  } catch (error) {
    console.error('Error checking slug availability:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check slug availability'
      }
    });
  }
};
