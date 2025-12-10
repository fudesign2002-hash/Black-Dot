
import firebase from 'firebase/compat/app';
import { db } from '../firebase';

const SCENE_BOUNDS_X = 24;
const SCENE_BOUNDS_Z = 24;

const getGridCoordinates = (worldX: number, worldZ: number): { gridX: number; gridZ: number; gridKey: string } => {
  // 將世界座標轉換為非負整數網格座標
  const gridX = Math.floor(worldX + SCENE_BOUNDS_X);
  const gridZ = Math.floor(worldZ + SCENE_BOUNDS_Z);
  const gridKey = `${gridX}_${gridZ}`; // 創建 "X_Z" 格式的字串鍵
  return { gridX, gridZ, gridKey };
};

/**
 * 更新指定區域的熱點地圖點數。
 * @param zoneId 區域 ID
 * @param worldX 點擊的 3D 世界 X 座標
 * @param worldZ 點擊的 3D 世界 Z 座標
 * @param points 要增加的點數
 */
export const updateHotspotPoint = async (zoneId: string, worldX: number, worldZ: number, points: number) => {
  if (!zoneId || zoneId === 'fallback_zone_id') {
    console.warn("Cannot update hotspot: Invalid zone ID.");
    return;
  }
  
  const { gridKey } = getGridCoordinates(worldX, worldZ);
  
  try {
    const zoneDocRef = db.collection('zones').doc(zoneId);
    await zoneDocRef.update({
      [`hotspot_map.${gridKey}`]: firebase.firestore.FieldValue.increment(points)
    });
    // console.log(`Hotspot at ${gridKey} in zone ${zoneId} incremented by ${points} point(s).`);
  } catch (error) {
    console.error("Error updating hotspot point:", error);
  }
};

/**
 * 更新指定藝術品的點讚數 (用於熱點地圖的點擊 +2)。
 * @param artworkId 藝術品 ID
 * @param points 要增加的點數 (例如：2)
 */
export const updateArtworkHotspotLikes = async (artworkId: string, points: number) => {
  if (!artworkId) {
    console.warn("Cannot update artwork likes: Invalid artwork ID.");
    return;
  }
  
  try {
    const artworkDocRef = db.collection('artworks').doc(artworkId);
    await artworkDocRef.update({
      artwork_liked: firebase.firestore.FieldValue.increment(points)
    });
    // console.log(`Artwork ${artworkId} likes incremented by ${points} point(s).`);
  } catch (error) {
    console.error("Error updating artwork likes for hotspot:", error);
  }
};
