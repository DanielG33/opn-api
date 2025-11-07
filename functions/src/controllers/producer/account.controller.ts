import {Request, Response} from "express";
import {db} from "../../firebase";
import * as admin from "firebase-admin";
import {getProducer, getUserProfile, updateUserProfile} from "../../services/acount.service";
import {updateProducerById, createProducer} from "../../services/producer.service";

export const getProfileMe = async (req: Request, res: Response) => {
  const uid = req.user?.uid as string;
  const email = req.user?.email as string;
  console.log('getProfileMe called with uid:', uid, 'email:', email);

  try {
    let profile = await getUserProfile(uid);
    console.log('Retrieved profile:', profile);
    
    if (!profile) {
      console.log('No profile found for uid:', uid, 'attempting to create from Firebase Auth');
      
        // Try to create user profile from Firebase Auth data
        try {
          const userRecord = await admin.auth().getUser(uid);        const newUserData = {
          id: uid,
          name: userRecord.displayName || 'User',
          email: userRecord.email,
          role: 'producer',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await db.collection('users').doc(uid).set(newUserData);
        console.log('Created new user profile:', newUserData);
        
        return res.json({success: true, data: newUserData});
      } catch (createError) {
        console.error('Error creating user profile:', createError);
        return res.status(404).json({message: "User not found and could not be created"});
      }
    }
    
    return res.json({success: true, data: profile});
  } catch (error) {
    console.error('Error in getProfileMe:', error);
    return res.status(500).json({message: "Internal server error"});
  }
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

    let producerId = currentUser.producerId;

    // Separate user data from company/producer data
    const { company, producer, ...userData } = updateData;
    const companyData = company || producer;

    // Update user profile (exclude company/producer data)
    if (Object.keys(userData).length > 0) {
      await updateUserProfile(uid, userData);
    }

    // Handle company/producer data
    if (companyData) {
      if (producerId) {
        // Update existing producer
        await updateProducerById(producerId, companyData);
      } else {
        // Create new producer and link to user
        const newProducer = await createProducer({
          userId: uid,
          ...companyData
        });
        producerId = newProducer.id;
        
        // Link producer to user
        await updateUserProfile(uid, { producerId });
      }
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
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return res.status(404).json({message: "User not found"});
  
  const userData = userDoc.data();
  const producerId = userData?.producerId;

  // If user doesn't have a producerId, they haven't completed onboarding
  if (!producerId) {
    return res.json({
      success: true, 
      data: { 
        status: 'incomplete',
        user: userData
      }
    });
  }

  const producer = await getProducer(producerId);
  if (!producer) {
    return res.json({
      success: true, 
      data: { 
        status: 'incomplete',
        user: userData
      }
    });
  }
  
  return res.json({
    success: true, 
    data: {
      status: 'complete',
      ...producer
    }
  });
};
