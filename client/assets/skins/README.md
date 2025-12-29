# Snake Skin Assets

## Where to Place Your Snake Sprites

Place your snake head and body sprite images in the following directory structure:

```
client/assets/skins/
  default/
    head.png
    body.png
  snake1/
    head.png
    body.png
  snake2/
    head.png
    body.png
  ...
```

## File Requirements

### Format
- **File Type:** PNG (with transparency)
- **Dimensions:** 128x128 pixels (square, same size for both head and body)
- **Orientation:** Face upward (sprites will be rotated automatically in-game)
- **Background:** Transparent (alpha channel)

### Head Sprite (`head.png`)
- Should look like a snake head facing upward
- Centered in the 128x128 image
- Can include eyes, mouth, or other features
- Will be used for the first segment (head) of the snake

### Body Sprite (`body.png`)
- Should be a repeating pattern or segment design
- Centered in the 128x128 image
- Should tile seamlessly when placed end-to-end
- Will be used for all body segments

## Adding New Skins

1. Create a new folder in `client/assets/skins/` with your skin name (e.g., `snake1`, `snake2`)
2. Place `head.png` and `body.png` in that folder
3. Add the skin ID to `client/sprites.js` in the `AVAILABLE_SKINS` array:
   ```javascript
   const AVAILABLE_SKINS = [
     { id: "default" },
     { id: "snake1" },  // Add your new skin here
     { id: "snake2" },
   ];
   ```

## Current Skin: default

The `default` skin folder is already created. Place your snake head and body sprites here:
- `client/assets/skins/default/head.png`
- `client/assets/skins/default/body.png`

## Notes

- Sprites will be automatically scaled based on snake size
- The game will fall back to programmatic drawing if sprites fail to load
- All skins are preloaded when the game starts
- Sprites support color tinting based on the snake's hue (optional)

