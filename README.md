# Cosmic Proofs Encyclopedia

A multilingual, offline-capable critical-study index of 200 arguments about Earth's shape and motion.

## Languages

- Arabic (default, RTL)
- English
- French
- Spanish

## Features

- 200 numbered entries across 10 strands
- Flag-based language pills with RTL/LTR transitions
- Instant search by number, title, or keyword
- Category filtering
- Hamburger index drawer for all 200 proofs with instant filtering
- Accessible detail modal with previous/next navigation
- Nuzhat al-Mushtaq dark/light manuscript palette
- Amiri Arabic reading font paired with Inter UI typography
- Minimal × icon close buttons
- Installable PWA with offline caching, including font caching after the first controlled load
- Original SVG diagrams for every strand
- Responsive layout with RTL support

## Strands

1. Water & Level
2. Horizon & Visibility
3. Motion & Gravity
4. Sun, Moon & Stars
5. Air & Pressure
6. Curvature & Measurement
7. Perspective & Optics
8. Maps & Travel
9. Space & Satellites
10. Poles & Antarctica

## Content note

The entries are neutral paraphrases of commonly circulated arguments, followed by scientific and analytical notes. The notes explain the mainstream physical and geodetic context and are not presented as absolute consensus. This is an educational index, not a verbatim reproduction of any book.

## Offline use

The service worker caches the application shell, the full dataset, and the diagrams on first load. The “Download images for offline use” button also stores the diagrams in the page's Cache API. After the first successful load, the app can reopen without a network connection.

## Structure

```text
index.html
style.css
translations.js
app.js
data.json
manifest.json
sw.js
favicon.svg
images/
  water.svg
  horizon.svg
  physics.svg
  astronomy.svg
  atmosphere.svg
  geometry.svg
  observation.svg
  navigation.svg
  space.svg
  polar.svg
  icon-192.png
  icon-512.png
  icon-maskable-512.png
  apple-touch-icon.png
```
