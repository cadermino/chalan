// Achica una foto a JPEG de hasta 2000 px por lado antes de subirla, como el
// backoffice con las fotos de servicios (lib/serviceRequestMedia.js): una foto
// de celular pesa 3-5 MB y con datos móviles tardaba en subir, y la IA la lee
// igual de bien achicada. Si el navegador no la sabe abrir, va tal cual.
const MAX_SIDE = 2000;

export default async function shrinkPhoto(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
  } catch (e) {
    return file;
  }
}
