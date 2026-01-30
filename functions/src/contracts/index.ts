// NOTE: This file is duplicated in api/admin/public. Keep in sync.
export enum SubContentStatus {
  Draft = "draft",
  Published = "published"
}

export type ContentKey = `subContent_${string}` | `episode_${string}`;

export enum TargetKind {
  SeriesSubContentSlider = "seriesSubContentSlider",
  EpisodeSubContentSlider = "episodeSubContentSlider",
  Cta = "cta",
  Gallery = "gallery",
  SeriesPageEpisodeSlider = "seriesPageEpisodeSlider",
  PlaylistItem = "playlistItem"
}

export interface SeriesSubContent {
  id: string;
  seriesId: string;
  title: string;
  description?: string;
  videoUrl?: string;
  thumbnail?: { id: string; name: string; type?: string; url: string };
  type: "video" | "article" | "gallery" | "other";
  status: SubContentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SubContentSnapshot {
  subContentId: string;
  seriesId: string;
  title: string;
  description?: string;
  videoUrl?: string;
  thumbnail?: { id: string; name: string; type?: string; url: string };
  type: "video" | "article" | "gallery" | "other";
  status: SubContentStatus;
  updatedAt: number;
}

export interface SliderItem {
  itemKey: string;
  contentKey: ContentKey;
  subContentId: string;
  snapshot: SubContentSnapshot;
  isActive: boolean;
  isHidden?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface UsagePointer {
  targetKind: TargetKind;
  seriesId: string;
  episodeId?: string;
  sliderId?: string;
  itemKey: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}