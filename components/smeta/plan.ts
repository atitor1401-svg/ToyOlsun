// Which kinds of service make up each celebration. Used by the "plan"
// grid and the empty-estimate shortcuts on the smeta screen.
// Every catalog category is covered; each event lists the ones that fit it,
// most important first.
import type { Feather } from '@expo/vector-icons';
import { matchesCategory } from '@/lib/categories';

export type EventKind = 'wedding' | 'khyna' | 'birthday';
export type PlanCategory = 'venues' | 'artists' | 'dj' | 'media' | 'cars' | 'wedding_dress' | 'flowers' | 'decor' | 'tourism';

export interface PlanStep {
    category: PlanCategory;
    icon: keyof typeof Feather.glyphMap;
}

const STEP: Record<PlanCategory, PlanStep> = {
    venues: { category: 'venues', icon: 'home' },
    artists: { category: 'artists', icon: 'mic' },
    dj: { category: 'dj', icon: 'disc' },
    media: { category: 'media', icon: 'camera' },
    wedding_dress: { category: 'wedding_dress', icon: 'feather' },
    flowers: { category: 'flowers', icon: 'sun' },
    decor: { category: 'decor', icon: 'star' },
    cars: { category: 'cars', icon: 'navigation' },
    tourism: { category: 'tourism', icon: 'globe' },
};

const ORDER_BY_EVENT: Record<EventKind, PlanCategory[]> = {
    wedding: ['venues', 'artists', 'dj', 'media', 'wedding_dress', 'flowers', 'decor', 'cars', 'tourism'],
    khyna: ['venues', 'decor', 'flowers', 'artists', 'dj', 'media', 'wedding_dress', 'cars'],
    birthday: ['venues', 'artists', 'dj', 'decor', 'flowers', 'media', 'cars'],
};

export const planFor = (event: EventKind | null): PlanStep[] =>
    ORDER_BY_EVENT[event ?? 'wedding'].map(category => STEP[category]);

export const isStepCovered = (step: PlanStep, cart: { category: string; title?: string; tags?: string[] }[]) =>
    cart.some(item => matchesCategory(item, step.category));
