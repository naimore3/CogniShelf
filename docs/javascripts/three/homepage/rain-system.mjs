/* 轻量氛围粒子：目前只做房间群周围的漂浮尘埃，后续楼层可在各自子文档中扩展。 */

export function createAmbientParticles(THREE, options = {}) {
  const count = options.count || 80;
  const areaX = options.areaX || options.area || 24;
  const areaY = options.areaY || options.height || 28;
  const areaZ = options.areaZ || options.area || 24;
  const centerY = options.centerY || 0;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * areaX;
    positions[i * 3 + 1] = centerY + (Math.random() - 0.5) * areaY;
    positions[i * 3 + 2] = (Math.random() - 0.5) * areaZ;
    speeds[i] = 0.12 + Math.random() * 0.28;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: options.color || "#ffffff",
    size: options.size || 0.09,
    transparent: true,
    opacity: options.opacity == null ? 0.42 : options.opacity,
    depthWrite: false,
    sizeAttenuation: true
  });

  const points = new THREE.Points(geometry, material);
  points.name = "nmd-ambient-particles";

  function update(delta) {
    for (let i = 0; i < count; i += 1) {
      positions[i * 3 + 1] -= speeds[i] * delta;
      if (positions[i * 3 + 1] < centerY - areaY / 2) {
        positions[i * 3 + 1] = centerY + areaY / 2;
        positions[i * 3] = (Math.random() - 0.5) * areaX;
        positions[i * 3 + 2] = (Math.random() - 0.5) * areaZ;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  }

  function setTheme(tokens = {}) {
    if (tokens.particle) material.color.set(tokens.particle);
    material.opacity = tokens.particleOpacity == null ? 0.42 : tokens.particleOpacity;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, setTheme, dispose };
}
