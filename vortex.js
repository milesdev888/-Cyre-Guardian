/* vortex.js — retired. Purple network mesh was causing unscannable chrome and
   a violet wash on tool heroes. Kept as a no-op so cached <script src="/vortex.js">
   tags and ai-vibe-loader pins cannot resurrect the dots. */
(function () {
  'use strict';
  function scrub() {
    var mesh = document.getElementById('cy-ai-mesh');
    if (mesh && mesh.parentNode) mesh.parentNode.removeChild(mesh);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scrub);
  } else {
    scrub();
  }
})();
