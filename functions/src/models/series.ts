import {AssetRef} from "./asset";
import {Producer} from "./producer";

export interface Series {
    id: string;
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
