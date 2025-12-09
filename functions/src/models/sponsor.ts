import {AssetRef} from "./asset";

export interface Sponsor {
    id?: string;
    name: string;
    link?: string;
    logo?: AssetRef; // Primary storage as AssetRef object
    logoUrl: string; // Computed field for backward compatibility
    bgColor?: string;
    bgOpacity?: string;
    createdAt: number;
    updatedAt: number;
}

export interface UploadSponsorInput {
    name: string;
    link?: string;
    logo: AssetRef
}
