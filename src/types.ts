export type ItemSize = 'small' | 'medium' | 'large';
export type SectionType = 'freezer' | 'fridge';

export interface FridgeItem {
  id: string;
  name: string;
  icon: string;
  size: ItemSize;
  section: SectionType;
  shelfIndex: number;
  gridX: number;
  gridY: number;
  uid: string;
  createdAt?: any;
}

export interface Shelf {
  index: number;
  name: string;
  gridWidth: number;
  gridHeight: number;
}
