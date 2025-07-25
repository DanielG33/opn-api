import {AssetRef} from "./asset";

export interface Sponsor {
    id?: string;
    name: string;
    link?: string;
    logo?: {
        id: string,
        name: string,
        url: string,
    }
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
