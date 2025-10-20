import {AssetRef} from "./asset";
import {Producer} from "./producer";
import {Series} from "./series";

export interface Sponsor {
    id: string;
    name: string;
    logoUrl: string;
    link?: string;
}

export interface Episode {
    id?: string,
    seriesId: string,
    series: Partial<Series>,
    title: string,
    description: string,
    seasonId?: string, // Only for season-based series
    seasonTitle?: string, // Only for season-based series
    seasonIndex?: number, // Only for season-based series
    episodeNumber: number,
    category?: string,
    subcategories?: string[],
    thumbnail: AssetRef,
    platform: "vimeo",
    videoUrl: string,
    duration: number,
    sponsorLabel?: string,
    sponsorId?: string,
    sponsor?: Sponsor, // Populated when sponsorId exists
    producerId: string,
    producer: Partial<Producer>,
    tags?: string[],
    subcontent: any[],
    createdAt: number,
    updatedAt: number,
}
