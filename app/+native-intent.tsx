// Shared service links (toyolsun://service?id=123) are handled by the catalog
// screen itself, which reads the original URL via expo-linking. Send the
// router to the catalog instead of an unknown "/service" route.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
    try {
        if (/(^|\/)service(\?|$|\/)/.test(path)) return '/';
    } catch {
        // fall through to the original path
    }
    return path;
}
