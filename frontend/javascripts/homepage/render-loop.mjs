/** 每帧要做的事：更新物体动画并渲染一帧。 */
export function startRenderLoop(renderer, scene, camera, objects) {
  renderer.setAnimationLoop((time) => {
    objects.box.rotation.y = time / 2800;
    renderer.render(scene, camera);
  });
}
