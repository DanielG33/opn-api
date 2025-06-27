export interface Asset {
    id?: string,
    name: string,
    type: string,
    url: string, // Use this for accessing the file, not the path
    path: string, // relative Firebase storage path
    size: number,
    extra?: {
        tags?: string[],
    }
    createdAt: number,
    updatedAt?: number
}

export interface UploadAssetInput {
  seriesId: string;
  path: string;
  name: string;
  base64EncodedFile: string;
  size: number;
}

export interface AssetRef {
  id: string;
  name: string;
  url: string;
  type: string;
}

export interface AssetImage extends Asset {
    format: string,
    alt?: string,
    extension: string,
}
