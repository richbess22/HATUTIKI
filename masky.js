// masky.js
const images = [
  "https://files.catbox.moe/90i7j4.png",
  "https://files.catbox.moe/4gca2n.png"
];

function getImage() {
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}

module.exports = getImage;
