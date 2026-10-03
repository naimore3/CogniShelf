/* 程序化贴图工具箱：所有可见文字都由 canvas 生成，不新增图片文件。 */

function cssFontStack() {
  return 'Georgia, "Noto Serif SC", "Songti SC", "SimSun", serif';
}

export function createTextureLibrary(THREE) {
  const textures = [];

  function createLabel(text, options = {}) {
    const width = options.width || 512;
    const height = options.height || 160;
    const canvas = document.createElement("canvas");
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = options.background || "rgba(255,255,255,0.92)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = options.color || "#202538";
    ctx.font = `700 ${options.size || 64}px ${cssFontStack()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, height / 2 + 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.push(texture);
    return texture;
  }

  function dispose() {
    textures.forEach((texture) => texture.dispose());
    textures.length = 0;
  }

  return { createLabel, dispose };
}
