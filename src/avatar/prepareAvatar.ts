import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

export async function prepareAvatar(uri: string): Promise<File> {
  const sourceContext = ImageManipulator.manipulate(uri);
  let source: Awaited<ReturnType<typeof sourceContext.renderAsync>> | undefined;
  let croppedContext: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let cropped: typeof source;
  try {
    source = await sourceContext.renderAsync();
    // Реальні розміри декодованого зображення, а не MIME/розміри від picker.
    const side = Math.min(source.width, source.height);
    croppedContext = ImageManipulator.manipulate(source);
    croppedContext.crop({ originX: Math.floor((source.width - side) / 2), originY: Math.floor((source.height - side) / 2), width: side, height: side });
    croppedContext.resize({ width: Math.min(side, 512), height: Math.min(side, 512) });
    cropped = await croppedContext.renderAsync();
    const result = await cropped.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    return new File(result.uri);
  } finally {
    cropped?.release();
    croppedContext?.release();
    source?.release();
    sourceContext.release();
  }
}
