import {AssetRef} from "./asset";
import {Producer} from "./producer";
import {SeriesPublicationStatus} from "../types/series-status";

export interface Series {
    id: string;
    slug: string;
    title: string;
    description: string;
    categories: string[];
    producerId: string;
    producerName: string;
    type: 'season-based' | 'limited';
    tags?: string[];
    logo?: Partial<AssetRef>,
    cover: Partial<AssetRef>,
    portraitCover?: Partial<AssetRef>,
    producer: Partial<Producer>;
    sectionsOrder: string[];
    // Series publication workflow status (DRAFT/IN_REVIEW/PUBLISHED/HIDDEN/REJECTED)
    // This controls series visibility on public site, NOT content draft flags
    publicationStatus: SeriesPublicationStatus;
    reviewNotes?: string;
    submittedAt?: number;
    publishedAt?: number;
    createdAt: string;
    updatedAt: string;
}

export interface Season {
  id?: string;
  index: number;
  title?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}
