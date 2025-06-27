import {db} from "../firebase";

// TODO: enable draft system
export const updateSeriesPageBlock = async (seriesId: string, data: any) => {
  return db.collection('series').doc(seriesId)
    .set(data, { merge: true })
    .catch(error => {
      throw {code: "error", message: "There was an error updating the block"};
    })
};
