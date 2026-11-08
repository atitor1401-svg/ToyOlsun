// Picks photos for a review, compresses them and uploads to the "images"
// bucket under reviews/<userId>/. Same compression approach as partner photos.
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export const MAX_REVIEW_PHOTOS = 4;
const MAX_BYTES = 350 * 1024;
const STEPS = [
    { width: 1200, quality: 0.6 },
    { width: 1000, quality: 0.5 },
    { width: 900, quality: 0.4 },
    { width: 720, quality: 0.3 },
];

async function compress(uri: string): Promise<string> {
    let base64 = '';
    for (const step of STEPS) {
        const out = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: step.width } }],
            { compress: step.quality, format: ImageManipulator.SaveFormat.JPEG },
        );
        base64 = await FileSystem.readAsStringAsync(out.uri, { encoding: 'base64' });
        if (base64.length * 0.75 <= MAX_BYTES) break;
    }
    return base64;
}

// Returns the public URLs of the uploaded photos ([] if the user cancelled).
export async function pickAndUploadReviewPhotos(userId: string, alreadyChosen: number): Promise<string[]> {
    const remaining = MAX_REVIEW_PHOTOS - alreadyChosen;
    if (remaining <= 0) return [];
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
    });
    if (result.canceled || !result.assets?.length) return [];

    const urls: string[] = [];
    for (const asset of result.assets.slice(0, remaining)) {
        const base64 = await compress(asset.uri);
        const path = `reviews/${userId}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`;
        const { error } = await supabase.storage.from('images').upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from('images').getPublicUrl(path);
        if (data?.publicUrl) urls.push(data.publicUrl);
    }
    return urls;
}
