export type Id = string;
export interface Source {
  id: Id;
  title: string;
  url: string | null;
  authorLabel: string | null;
  publishedAt: string | null;
}
interface MediaBase {
  id: Id;
  src: string;
  width: number;
  height: number;
  caption: string;
  sourceId: Id;
}
export interface Photo extends MediaBase {
  kind: 'image';
  alt: string;
  capturedAt: string | null;
  photographer: string | null;
  exif: Record<string, string | number> | null;
  publicationStatus?: 'local-preview' | 'approved' | 'public-source';
}
export interface Film extends MediaBase {
  kind: 'video';
  purpose: 'cover-loop';
  publicationStatus: 'approved' | 'public-source';
  duration: number;
  poster: string;
}
export interface Embed {
  id: Id;
  kind: 'embed';
  platform: 'bilibili';
  bvid: string;
  page: number;
  title: string;
  durationLabel: string;
  caption: string;
  sourceId: Id;
}
export interface Member {
  id: Id;
  name: string;
  specialties: string[];
  cohort: string | null;
  portraitId: Id | null;
  bio: string | null;
}
export interface Contribution {
  memberId: Id;
  role: string;
  source: string;
  note?: string;
  detail?: string;
}
export interface EventSeries {
  id: Id;
  title: string;
  summary: string;
}
export interface Event {
  id: Id;
  storyId?: Id;
  seriesId?: Id | null;
  title: string;
  fullTitle: string;
  titleLines?: string[];
  year: number;
  date: string | null;
  dates?: string[];
  place: string | null;
  timeLabel?: string | null;
  timeNote?: string;
  teamSize: number | null;
  cameraCount: number | null;
  coverId: Id;
  secondaryCoverId?: Id;
  groupId: Id | null;
  galleryIds: Id[];
  featuredGalleryIds?: Id[];
  workIds: Id[];
  noteIds: Id[];
  sourceId: Id;
  summary: string;
  contributions: Contribution[];
  creditsNote?: string;
  viewpoints?: { mediaId: Id; label: string }[];
  cameras?: { label: string; equipment: string; imageId: Id | null }[];
}
export interface WorkCredit {
  role: string;
  name: string;
  memberId: Id | null;
  sourceId: Id;
  sourceDescription: string;
}
export interface WorkPart {
  page: number;
  part: string;
  duration: number;
  durationLabel: string;
}
export interface Work {
  id: Id;
  title: string;
  subtitle: string;
  kind: 'film' | 'photos' | 'replay';
  formatLabel?: string;
  displayDescription?: string;
  publicationLabel?: string;
  updatedAt?: string;
  year: number | null;
  yearLabel?: string;
  publishedAt?: string | null;
  sourceAccount?: 'club' | 'personal' | 'mixed';
  mediaId: Id | null;
  coverId: Id;
  eventId: Id | null;
  galleryIds?: Id[];
  authorIds: Id[];
  creditMemberIds: Id[];
  credits?: WorkCredit[];
  parts?: WorkPart[];
  videos?: { mediaId: Id; label: string; durationLabel?: string; parts?: WorkPart[] }[];
  sourceId: Id;
  externalUrl?: string;
  notice?: string;
  description: string;
}
export interface Note {
  id: Id;
  title: string;
  subtitle: string;
  sourceId: Id;
  eventId: Id | null;
  kind: string;
  authorLabel: string;
  publishedAt: string | null;
  editorialSummary?: boolean;
  documentId?: Id;
  /** Unlisted notes keep their page but leave the notes library index (their entry lives on an event page). */
  unlisted?: boolean;
  sections: { title: string; text: string; imageId: Id | null }[];
}
export interface SourceDocument {
  id: Id;
  title: string;
  dateLabel: string;
  sourceName: string;
  authorLabel?: string;
  sourceUrl?: string;
  blocks: Array<
    | { type: 'paragraph' | 'heading' | 'toc-link'; sourceIndex: number; text: string; prefix?: string; level?: 2 | 3; anchor?: string; target?: string }
    | { type: 'table'; sourceIndex: number; rows: string[][] }
  >;
}
export interface EventRecord {
  replaySourceId: Id;
  replayMediaId: Id;
  replayDurationLabel: string;
  id: Id;
  sourceId: Id;
  intro: string;
  result: string[];
  preparation: { title: string; text: string }[];
  cameras: { title: string; mediaId: Id | null; equipment: string; purpose: string; observation: string; next: string }[];
  execution: { title: string; text: string }[];
  issues: { item: string; observed: string; next: string }[];
  system: { title: string; text: string }[];
  promotion: string;
  costs: { item: string; detail: string; amount: number; type: string }[];
  sourceNotes: string[];
  media: Record<'lead' | 'result' | 'plan' | 'desk' | 'team' | 'communication', Id>;
  reviewNoteId: Id;
  photoWorkId: Id;
  guideIds: Id[];
}
export interface Catalog {
  version: number;
  site: {
    name: string;
    subtitle: string;
    school: string;
    english: string;
    featuredEventId: Id;
    promoWorkId: Id;
    heroStillId: Id;
    heroVideoId: Id;
  };
  sources: Source[];
  appointments?: { memberId: Id; cohortLabel: string; role: string; sourceId: Id }[];
  media: (Photo | Film | Embed)[];
  members: Member[];
  series: EventSeries[];
  events: Event[];
  works: Work[];
  notes: Note[];
  documents?: SourceDocument[];
  stories?: EventRecord[];
}
