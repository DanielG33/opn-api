export interface Asset {
    id: string,
    name: string,
    type: 'image',
    url: URL, // Use this for accessing the file, not the path
    tags?: string[],
    path: string, // relative Firebase storage path
    size: number,
    createdAt: string,
    updatedAt: string
};

export interface AssetImage extends Asset {
    type: 'image',
    format: string,
    alt?: string,
    extension: string,
}