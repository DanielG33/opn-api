import {AssetImage} from "./asset";
import {Producer} from "./producer";
import {Series} from "./series";

export interface Episode {
    id?: string,
    seriesId: string,
    series: Partial<Series>,
    title: string,
    description: string,
    seasonId: string,
    season: {
        index: number,
        title: string,
        description?: string,
    },
    episodeNumber: number,
    category?: string,
    subcategories?: string[],
    thumbnail: AssetImage,
    platform: "vimeo",
    videoUrl: string,
    duration: number,
    sponsorLabel?: string,
    sponsorId?: string,
    sponsor?: any,
    producerId: string,
    producer: Partial<Producer>,
    tags?: string[],
    subcontent: any[],
    createdAt: number,
    updatedAt: number,
}
