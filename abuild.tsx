export const VERSION = "3.4.136";

/*
3.4.68 移除自動歸位功能，將排名模式由按鈕切換，並修正 Z 軸排序邏輯。
3.4.69 實作藝術品在進入和退出排名模式時的平滑動畫和彈跳效果。
3.4.70 修正藝術品在排名模式切換時出現跳動的問題，透過調整 ArtworkWrapper的useEffect邏輯，防止動畫被非預期的re-render中斷。
3.4.71 修正進入排名模式時動畫未發生的問題，透過調整 ArtworkWrapper的useEffect邏輯，防止動畫被非預期的re-render中斷。
3.4.72 修正進入排名模式時動畫未發生的問題，透過調整 ArtworkWrapper的useEffect邏輯，防止動畫被非預期的re-render中斷。
3.4.73 修正進入排名模式時動畫未發生的問題，透過調整 ArtworkWrapper的useEffect邏輯，防止動畫被非預期的re-render中斷。
3.4.74 修正進入排名模式時動畫未發生的問題，透過調整 ArtworkWrapper的useEffect邏輯，防止動畫被非預期的re-render中斷。
3.4.75 在 ArtworkWrapper.tsx 中增加 console.log 語句，以追蹤藝術品進入和退出排名模式時的動畫狀態和位置。
3.4.76 重構 ArtworkWrapper.tsx 中的 useEffect 邏輯，使用單一 `prevProps` useRef 物件來管理所有前一個狀態，確保 `isRankingMode` 轉換時的動畫觸發邏輯更加可靠。同時，將 `easeOutElastic` 彈性緩動效果應用於進入和退出排名模式的動畫。
3.4.77 在排名模式下縮小繪畫藝術品 20%25，並在離開時恢復正常大小。
3.4.78 在排名模式下，藝術品左側以大號、粗體的文字顯示其點讚數。
3.4.79 調整排名模式下點讚數文字距離藝術品的水平偏移量。
3.4.80 在排名模式下，點擊藝術品將直接點讚並顯示愛心動畫，不會再拉近或顯示控制列。
3.4.81 在layout setting 2d小地圖中, 點選東西不需要有點選的漣漪效果(藍色圈圈往外擴大)。
3.4.82 Fixed Canvas onClick prop type incompatibility by casting to 'any'. Removed unused ripple rendering from LayoutTab and refined ripple generation logic in App and EmbeddedMuseumScene for artwork and general clicks.
3.4.83 Fixed "Expected 1 arguments, but got 0" error in EmbeddedMuseumScene for useMuseumState hook.
3.4.84 Fixed type error in EmbeddedMuseumScene ripple timeout by hardcoding subtle effect duration.
3.4.85 Added a toggle in DevToolsPanel to temporarily turn off/on Firebase onSnapshot listeners, improving debugging and_performance_testing.
3.4.86 Fixed "Expected 1 arguments, but got 0" error in EmbeddedMuseumScene for useMuseumState hook.
3.4.87 Added dynamic shadow map size based on isSmallScreen, using 265 for small screens.
3.4.88 Synchronized painting scaling factor for likes display and adjusted horizontal offset for visibility.
3.4.89 Further adjusted horizontal offset for likes display in ranking mode to ensure visibility, and enhanced console logging for position tracking.
3.4.90 Provided default `visualDimensions` for paintings in `ArtComponent.tsx` to ensure like counts are rendered even during lazy loading/suspension.
3.4.91 Adjusted horizontal offset for like count, added "liked" label below it, and added a horizontal separator line to its right, adjusted for artwork proximity.
3.4.92 Adjusted horizontal offset for like count to align vertically on the Z-axis, and dynamically calculated the horizontal line's length to extend towards the artwork's left edge.
3.4.93 Adjusted "liked" text to align with the left edge of the number above it, matching the provided image reference.
3.4.94 Removed `center` prop from `Html` component for likes display and adjusted its X-position to directly align the left edge of the numbers block.
3.4.95 Shifted the entire HTML block for ranking mode likes display to a fixed left anchor, and dynamically adjusted the connecting line's length.
3.4.96 Fixed an issue where the `targetScale` in `ArtworkWrapper.tsx` was incorrectly set to `0.7` instead of `0.6` for paintings in ranking mode.
3.4.97 Removed all `console.log` statements.
3.4.98 Changed 2D map SCENE_BOUNDS_X and SCENE_BOUNDS_Z from 18 to 12.
3.4.99 Changed 2D map SCENE_BOUNDS_X and SCENE_BOUNDS_Z from 12 to 24 to shorten perceived distance and make grid denser.
3.4.100 Initial camera position now loads from Firebase custom camera position if available, otherwise defaults.
3.4.101 Fixed camera not loading custom position from Firebase on initial scene entry.
3.4.102 Added console log for camera position initialization and removed hardcoded Canvas camera prop.
3.4.103 移除 Canvas 中硬編碼的攝影機位置，確保 `CameraController` 能完全控制初始攝影機位置。
3.4.104 修正 `LayoutTab` 中 `setIsAnyLayoutItemDragging` 報錯 `is not a function` 的問題，透過在呼叫前加入防禦性檢查。
3.4.105 實作排名模式的固定攝影機角度。
3.4.106 調整排名模式下藝術品間距和攝影機位置。
3.4.107 允許使用者在排名模式攝影機動畫結束後手動調整攝影機角度。
3.4.108 修正排名模式下點擊藝術品「喜歡」時，主控制按鈕列消失的問題。
3.4.109 在排名模式下隱藏切換 zone 的按鈕、編輯模式按鈕和燈光開關按鈕。
3.4.110 為點讚計數邏輯新增註解，強調使用 `likedArtworksLocalCountRef` 解決閉包問題。
3.4.111 修正排名模式下點讚後攝影機跳回初始位置的問題。
3.4.112 修正因為 `lightingConfig` 物件參考變更，即使 `customCameraPosition` 數值未變，仍觸發攝影機重置的問題。現在 `CameraController` 會進行深度比較，確保只有在 `customCameraPosition` 數值實際變更時才重置攝影機。
3.4.113 Added detailed console logs to diagnose `customCameraPosition` changes and `handleMoveToInitial` calls in `CameraController.tsx` and `App.tsx`.
3.4.114 Cleaned up unused variables and refined ripple logic in `App.tsx`, `EmbeddedMuseumScene.tsx`, `LayoutTab.tsx`, `CanvasExhibit.tsx`, `SculptureExhibit.tsx`, `GodRay.tsx`, `SmartSpotlight.tsx`, `CameraController.tsx`, and `SceneTab.tsx` for a more streamlined codebase.
3.4.115 移除 `SmartSpotlight` 元件中不再支援的 `spotlightMode` 屬性。
3.4.116 在小螢幕排名模式下隱藏「上一區」和「下一區」按鈕。
3.4.117 當點擊放大繪畫藝術品時，鏡頭稍微向下並拉遠一點。
3.4.118 為 `App.tsx` 中的 `onAddArtworkToLayout` 函數增加了詳細的 `console.log` 語句，以追蹤執行流程並在錯誤時提供具體的除錯訊息，解決了「加入失敗」的問題。
3.4.119 修正 `ArtworkTab.tsx` 中 `onAddArtworkToLayout` 呼叫的 catch 區塊，現在會記錄錯誤到控制台，以便更好地除錯。
3.4.120 修正 `FloorPlanEditor.tsx` 中 `onAddArtworkToLayout` 屬性從其 `FloorPlanEditorProps` 介面中遺失的問題，導致 `TypeError: onAddArtworkToLayout is not a function` 錯誤。
3.4.121 在 Layout 設定中新增切換功能，以使用 Firebase exhibit_background 作為場景背景圖片。
3.4.122 在sculpture的artwork設定中加一個放大跟縮小的功能，介面很簡單就只有-跟+, 在60%跟260%之間以20%的比例增減，一樣會把資訊送進artworks資料庫中，不要改動到任何現有已經順利的功能
3.4.123 修正雕塑模型放大縮小後效能沒有釋放的問題，透過將 GLB 模型材質的應用邏輯與縮放比例的依賴分離，確保材質只在必要時重新創建。
3.4.124 新增場景環境效果切換功能。
3.4.125 將環境效果調整為視覺疊加層，不影響場景現有的背景、地板顏色或燈光設定。
3.4.126 將所有環境效果的尺寸再縮小 50%。
3.4.127 將環境效果選擇移至 `FloorPlanEditor` 的 `LayoutTab`，並將選定的效果儲存在 Firebase `zones` 資料的 `zone_theme` 欄位中。
3.4.128 實作從遠端 URL 動態載入 `effect_bundle.js`，並將 `EffectRegistry` 作為狀態管理在 `App.tsx` 中，然後傳遞給 `SceneTab` 和 `SceneContent`。
3.4.129 新增零重力模式功能，讓藝術品在區域重力影響下漂浮。
3.4.130 強化零重力模式，增加藝術品獨立重力值、緩慢上下浮動及輕微角度擺動動畫。
3.4.131 調整零重力模式下藝術品的整體漂浮高度，使其整體再降低一些。
3.4.132 調整零重力模式下藝術品的整體漂浮高度，使其整體再提高一些。
3.4.133 調整零重力模式下藝術品的角度擺動幅度，使其與浮動高度成正比。
3.4.134 修正零重力模式下，藝術品在達到漂浮高度後突然跳動到漂浮角度的問題。現在旋轉擺動會平滑地導入。
3.4.135 修正零重力模式下，藝術品在達到漂浮高度後角度擺動才突然導入的問題。現在旋轉擺動會與位置動畫同步，平滑導入。
3.4.136 修正零重力模式下，藝術品在向上浮起時不彈跳，但掉落時保留彈跳效果。
*/