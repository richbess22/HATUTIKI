// masky.js
const images = [
  "https://files.catbox.moe/ebj284.jpg"
  "https://files.catbox.moe/ebj284.jpg"
];

function getImage() {
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}

module.exports = getImage;
