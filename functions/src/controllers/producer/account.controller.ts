import {Request, Response} from "express";
import {db} from "../../firebase";
import {getProducer, getUserProfile, updateUserProfile} from "../../services/acount.service";
import {updateProducerById} from "../../services/producer.service";

export const getProfileMe = async (req: Request, res: Response) => {
  const uid = req.user?.uid as string;

  const profile = await getUserProfile(uid);
  if (!profile) return res.status(404).json({message: "User not found"});
  return res.json({success: true, data: profile});
};

export const updateProfileMe = async (req: Request, res: Response) => {
  try {
    const uid = req.user?.uid as string;
    const updateData = req.body;

    // Get current user to extract producerId
    const currentUser = await getUserProfile(uid);
    if (!currentUser) {
      return res.status(404).json({message: "User not found"});
    }

    const producerId = currentUser.producerId;

    // Separate user data from company/producer data
    const { company, producer, ...userData } = updateData;
    const companyData = company || producer;

    // Update user profile (exclude company/producer data)
    if (Object.keys(userData).length > 0) {
      await updateUserProfile(uid, userData);
    }

    // Update producer data if provided and producerId exists
    if (companyData && producerId) {
      await updateProducerById(producerId, companyData);
    }

    // Return success response
    return res.json({
      success: true, 
      message: "Profile updated successfully"
    });

  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile"
    });
  }
};

export const getProfileProducer = async (req: Request, res: Response) => {
  const uid = req.user?.uid as string;
  console.log({uid});
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return res.status(404).json({message: "User not found"});
  const producerId = String(userDoc.data()?.producerId);

  const producer = await getProducer(producerId);
  if (!producer) return res.status(404).json({message: "Producer not found"});
  return res.json({success: true, data: producer});
};
