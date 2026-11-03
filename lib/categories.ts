// Shared category rules for the catalog and the Explore search.

interface CategorisedService {
    category: string;
    title?: string;
    tags?: string[];
}

// DJs used to be listed under "artists" (tagged "dj" or named "DJ ..."). Until
// those rows are moved to the new "dj" category, they show under both chips,
// so nobody disappears for users still on older app versions.
export const isDjService = (s: CategorisedService): boolean => {
    if (s.category === 'dj') return true;
    if (s.category !== 'artists') return false;
    const taggedDj = (s.tags || []).some(tag => tag.toLowerCase() === 'dj');
    const namedDj = /^\s*dj(\b|_)/i.test(s.title || '');
    return taggedDj || namedDj;
};

export const matchesCategory = (s: CategorisedService, category: string): boolean => {
    if (category === 'all') return true;
    if (category === 'dj') return isDjService(s);
    return s.category === category;
};
