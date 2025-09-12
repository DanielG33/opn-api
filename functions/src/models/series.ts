import {AssetImage} from "./asset";
import {Producer} from "./producer";

export interface Series {
    id: string;
    title: string;
    description: string;
    categories: string[];
    tags?: string[];
    logo?: Partial<AssetImage>,
    cover: Partial<AssetImage>,
    portraitCover?: Partial<AssetImage>,
    producerId: string;
    producer: Partial<Producer>;
    type: 'season-based' | 'limited';
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
